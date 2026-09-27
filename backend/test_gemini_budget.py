"""Unit tests for the Gemini daily budget + per-user AI stream limiter.

Run directly (no pytest needed):  venv\\Scripts\\python.exe test_gemini_budget.py

Exercises the in-memory (Redis-down) paths, which are what run locally.
Requires the same .env as the app (main.py validates SUPABASE_* at import).
"""

import asyncio
from types import SimpleNamespace

import main


def reset_state():
    # Force the in-memory path even if a local Redis happens to be configured,
    # so tests never touch shared counters.
    main._redis_client = None
    main._redis_available = False
    main._gemini_day_local["date"] = ""
    main._gemini_day_local["count"] = 0
    main._gemini_limit_logged_date = None
    main._ai_stream_store.clear()


async def test_budget_enforced_at_limit():
    reset_state()
    main.GEMINI_DAILY_CALL_LIMIT = 3
    results = [await main._gemini_budget_reserve() for _ in range(5)]
    assert results == [True, True, True, False, False], results
    count, backend = await main._gemini_budget_status()
    assert count == 3, count
    assert backend == "memory", backend
    assert await main._gemini_budget_exhausted() is True


async def test_kill_switch():
    reset_state()
    main.GEMINI_DAILY_CALL_LIMIT = 0
    assert await main._gemini_budget_reserve() is False
    assert await main._gemini_budget_exhausted() is True
    count, _ = await main._gemini_budget_status()
    assert count == 0, count  # kill switch blocks without counting


async def test_cap_disabled_negative():
    reset_state()
    main.GEMINI_DAILY_CALL_LIMIT = -1
    results = [await main._gemini_budget_reserve() for _ in range(10)]
    assert all(results)
    assert await main._gemini_budget_exhausted() is False


async def test_day_rollover_resets_counter():
    reset_state()
    main.GEMINI_DAILY_CALL_LIMIT = 2
    assert await main._gemini_budget_reserve() is True
    assert await main._gemini_budget_reserve() is True
    assert await main._gemini_budget_reserve() is False
    # Simulate the stored counter belonging to yesterday.
    main._gemini_day_local["date"] = "2000-01-01"
    assert await main._gemini_budget_reserve() is True
    count, _ = await main._gemini_budget_status()
    assert count == 1, count


async def test_limit_trip_logs_error_once(caplog_records):
    reset_state()
    caplog_records.clear()
    main.GEMINI_DAILY_CALL_LIMIT = 1
    await main._gemini_budget_reserve()
    await main._gemini_budget_reserve()  # trips
    await main._gemini_budget_reserve()  # already tripped — must not re-log
    errors = [r for r in caplog_records if r.levelname == "ERROR" and "daily call limit" in r.getMessage()]
    assert len(errors) == 1, [r.getMessage() for r in errors]


async def test_ai_stream_limit_per_user():
    reset_state()
    main.AI_STREAM_HOURLY_LIMIT = 2
    req_a = SimpleNamespace(state=SimpleNamespace(user_id="user-a"))
    req_b = SimpleNamespace(state=SimpleNamespace(user_id="user-b"))
    assert await main._ai_stream_allowed(req_a) is True
    assert await main._ai_stream_allowed(req_a) is True
    assert await main._ai_stream_allowed(req_a) is False  # user-a over limit
    assert await main._ai_stream_allowed(req_b) is True   # user-b unaffected


async def test_ai_stream_limit_disabled_or_no_user():
    reset_state()
    main.AI_STREAM_HOURLY_LIMIT = -1
    req = SimpleNamespace(state=SimpleNamespace(user_id="user-a"))
    assert all([await main._ai_stream_allowed(req) for _ in range(20)])
    main.AI_STREAM_HOURLY_LIMIT = 2
    anon = SimpleNamespace(state=SimpleNamespace())  # middleware never stashed an id
    assert await main._ai_stream_allowed(anon) is True


async def test_rate_limited_sse_payload_shape():
    resp = main._rate_limited_sse_response()
    chunks = [c async for c in resp.body_iterator]
    assert len(chunks) == 1
    body = chunks[0]
    assert body.startswith("data: "), body
    import json
    payload = json.loads(body[len("data: "):].strip())
    assert payload["status"] == "error"
    assert payload["events"] == []
    assert payload["message"]


def run():
    import logging

    records = []

    class Capture(logging.Handler):
        def emit(self, record):
            records.append(record)

    logging.getLogger().addHandler(Capture())

    original_limits = (main.GEMINI_DAILY_CALL_LIMIT, main.AI_STREAM_HOURLY_LIMIT)
    tests = [
        ("budget_enforced_at_limit", test_budget_enforced_at_limit()),
        ("kill_switch", test_kill_switch()),
        ("cap_disabled_negative", test_cap_disabled_negative()),
        ("day_rollover_resets_counter", test_day_rollover_resets_counter()),
        ("limit_trip_logs_error_once", test_limit_trip_logs_error_once(records)),
        ("ai_stream_limit_per_user", test_ai_stream_limit_per_user()),
        ("ai_stream_limit_disabled_or_no_user", test_ai_stream_limit_disabled_or_no_user()),
        ("rate_limited_sse_payload_shape", test_rate_limited_sse_payload_shape()),
    ]
    failures = 0
    for name, coro in tests:
        try:
            asyncio.run(coro)
            print(f"PASS {name}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL {name}: {exc}")
    main.GEMINI_DAILY_CALL_LIMIT, main.AI_STREAM_HOURLY_LIMIT = original_limits
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    run()
