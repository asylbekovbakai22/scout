# Known limitations

- Browser end-to-end sign-in, production OAuth configuration, deployed RLS, and Redis failover have not been verified by the offline test suite. Configure and test these for your deployment.
- An interrupted stream now retains partial results, shows an error and offers manual Retry. It does not resume from a cursor; retry can repeat unfinished AI work. There is no automatic retry loop.
- Saved/Attended writes use separate database calls. An attendance upsert followed by a failed Saved deletion can leave both rows in the database until the user retries; hydration excludes attended events from Saved. A transactional database RPC would improve this.
- The browser cache is scoped to account IDs. Legacy unscoped local-only data is deliberately not imported, since its owner cannot be established. Confirmed database records are restored after sign-in. There is no offline write queue.
- Ticketmaster radius is 1–50 miles. AI and campus sources do not enforce an exact geographic boundary.
- AI dates, descriptions and links can be incorrect. Model-typed URLs are marked unverified unless replaced with a matching grounding source. A grounding source is evidence of a link, not independent verification of every event detail.
- SSE authentication currently uses a query token. Configure access-log redaction; migrating to header-authenticated streaming remains future work.
- Daily AI limits count attempts, not dollars. Redis is needed to share counters across processes and restarts. Memory fallback is per-process and cannot enforce an account-wide spending ceiling. Set provider-side spending limits as well.
- Simultaneous cache misses across clients can duplicate paid work. Shared in-flight request coalescing is future work; daily and per-user limits mitigate, but do not remove, this cost.
- The repository still has an inherited lint backlog outside the changed files. Build, typecheck and regression tests are separate checks.
