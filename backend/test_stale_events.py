"""Unit tests for serve-time stale event filtering and timezone helpers.

Run: venv\\Scripts\\python.exe test_stale_events.py
"""

from datetime import datetime, timezone

import main


def reset_tz_log():
    main._CITY_TZ_LOGGED.clear()


def test_miami_timezone_mapped():
    reset_tz_log()
    tz = main._city_timezone("Miami, FL")
    assert str(tz) == "America/New_York", str(tz)


def test_unknown_city_falls_back_to_eastern(caplog_records):
    reset_tz_log()
    tz = main._city_timezone("Boise, ID")
    assert str(tz) == "America/New_York", str(tz)
    warnings = [r for r in caplog_records if "CITY_TZ_FALLBACK" in r.getMessage()]
    assert len(warnings) == 1, [r.getMessage() for r in warnings]


def test_tm_utc_metadata():
    start = {"dateTime": "2026-07-10T13:30:00Z"}
    utc, has_time = main._tm_start_metadata(start, "Miami, FL")
    assert has_time is True
    assert utc == "2026-07-10T13:30:00Z", utc


def test_tm_local_metadata():
    start = {
        "localDate": "2026-07-10",
        "localTime": "09:30:00",
        "timezone": "America/New_York",
    }
    utc, has_time = main._tm_start_metadata(start, "Miami, FL")
    assert has_time is True
    # 9:30 AM ET = 13:30 UTC (EDT in July)
    assert utc == "2026-07-10T13:30:00Z", utc


def test_ai_date_with_time():
    sk, display, utc, has_time = main._parse_ai_date("July 10, 2026 at 5:00 PM", "Miami, FL")
    assert has_time is True
    assert "5:00 PM" in display
    assert utc == "2026-07-10T21:00:00Z", utc
    assert sk.startswith("2026-07-10"), sk


def test_ai_date_without_time_kept():
    _, display, utc, has_time = main._parse_ai_date("July 10, 2026", "Miami, FL")
    assert has_time is False
    assert utc is None
    assert "·" not in display


def test_stale_morning_event_dropped():
    # 9:30 AM ET → stale at 5:40 PM ET same day
    ev = {
        "name": "Morning show",
        "date": "Fri, Jul 10 · 9:30 AM",
        "start_at_utc": "2026-07-10T13:30:00Z",
        "has_start_time": True,
    }
    now = datetime(2026, 7, 10, 21, 40, tzinfo=timezone.utc)  # 5:40 PM ET
    assert main._is_stale_event(ev, "Miami, FL", now_utc=now) is True


def test_recent_event_within_grace_kept():
    # 5:00 PM ET event at 5:40 PM ET — within 1h grace
    ev = {
        "name": "Evening show",
        "date": "Fri, Jul 10 · 5:00 PM",
        "start_at_utc": "2026-07-10T21:00:00Z",
        "has_start_time": True,
    }
    now = datetime(2026, 7, 10, 21, 40, tzinfo=timezone.utc)
    assert main._is_stale_event(ev, "Miami, FL", now_utc=now) is False


def test_date_only_today_kept():
    ev = {
        "name": "Evening social",
        "date": "Fri, Jul 10",
        "has_start_time": False,
    }
    now = datetime(2026, 7, 10, 21, 40, tzinfo=timezone.utc)
    assert main._is_stale_event(ev, "Miami, FL", now_utc=now) is False


def test_serve_events_filters_list():
    now = datetime(2026, 7, 10, 21, 40, tzinfo=timezone.utc)
    stale = {
        "name": "Old",
        "start_at_utc": "2026-07-10T13:30:00Z",
        "has_start_time": True,
    }
    fresh = {
        "name": "Soon",
        "start_at_utc": "2026-07-10T21:00:00Z",
        "has_start_time": True,
    }
    no_time = {"name": "Tonight", "date": "Fri, Jul 10", "has_start_time": False}

    orig = main._is_stale_event

    def _patched(ev, city, now_utc=None):
        return orig(ev, city, now_utc=now)

    main._is_stale_event = _patched  # type: ignore[assignment]
    try:
        out = main._serve_events([stale, fresh, no_time], "Miami, FL")
    finally:
        main._is_stale_event = orig  # type: ignore[assignment]

    names = [e["name"] for e in out]
    assert names == ["Soon", "Tonight"], names


def test_display_fallback_for_legacy_cache():
    # Cached dict without start_at_utc — parse display string at serve time.
    ev = {
        "name": "Legacy",
        "date": "Fri, Jul 10 · 9:30 AM",
        "has_start_time": False,
    }
    now = datetime(2026, 7, 10, 21, 40, tzinfo=timezone.utc)
    assert main._is_stale_event(ev, "Miami, FL", now_utc=now) is True


def run():
    import logging

    records = []

    class Capture(logging.Handler):
        def emit(self, record):
            records.append(record)

    logging.getLogger().addHandler(Capture())

    tests = [
        ("miami_timezone_mapped", test_miami_timezone_mapped),
        ("unknown_city_falls_back_to_eastern", lambda: test_unknown_city_falls_back_to_eastern(records)),
        ("tm_utc_metadata", test_tm_utc_metadata),
        ("tm_local_metadata", test_tm_local_metadata),
        ("ai_date_with_time", test_ai_date_with_time),
        ("ai_date_without_time_kept", test_ai_date_without_time_kept),
        ("stale_morning_event_dropped", test_stale_morning_event_dropped),
        ("recent_event_within_grace_kept", test_recent_event_within_grace_kept),
        ("date_only_today_kept", test_date_only_today_kept),
        ("serve_events_filters_list", test_serve_events_filters_list),
        ("display_fallback_for_legacy_cache", test_display_fallback_for_legacy_cache),
    ]
    failures = 0
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL {name}: {exc}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    run()
