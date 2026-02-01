# API Integration Gaps Remediation Plan (Updated 2026-02-01)

## Executive summary
The codebase already ships a unified API client, circuit breaker, retry logic, and catalog payload validation. This update focuses on the remaining gaps that still affect external API resilience (Jikan): request pacing, version fallback/deprecation visibility, and runtime response shape checks. The plan below aligns with the current `js/services/*` architecture and avoids duplicating existing modules.

## Current state (today)
- `js/services/api-client.js` provides centralized request handling, interceptors, and error reporting.
- `js/reviews.js` already uses retries, caching, and the circuit breaker for Jikan.
- `js/app.js` fetches the catalog through `ApiClient` and validates payload structure.
- `js/services/schema-validator.js` validates persisted storage payloads.

## Gaps to close
1. No request pacing for Jikan (token bucket / min interval).
2. No service-level version fallback or deprecation header capture.
3. No runtime validation of Jikan response shapes (silent schema drift risk).

## Scope for this update (implement now)
- Add a rate limiter service and wire it into Jikan calls.
- Extend `ApiClient` with service configuration, version fallback, and deprecation capture.
- Register Jikan response schemas and validate them in `ReviewsService` with error reporting.

## Out of scope (future follow-up)
- Dedicated API mocks and tests for Jikan-specific flows.
- UI surfacing of deprecation warnings.
- Metrics/telemetry dashboards for API health.

## Implementation steps
1. Create `js/services/rate-limiter.js` (token bucket + per-service queue).
2. Extend `js/services/api-client.js`:
   - Service registry (`jikan` v4 + v3 fallback).
   - `requestService` + `getServiceJson` helpers.
   - Deprecation header capture and lookup.
3. Add Jikan response schemas to `js/services/schema-validator.js`.
4. Update `js/reviews.js`:
   - Route Jikan calls through `ApiClient.getServiceJson`.
   - Apply `RateLimiter` for review + synopsis calls.
   - Validate responses and report schema drift.
5. Update `AGENTS.md` nodes/edges/flowchart for new service.

## Files touched
- `js/services/rate-limiter.js` (new)
- `js/services/api-client.js` (service-aware requests + deprecation capture)
- `js/services/schema-validator.js` (Jikan schemas)
- `js/reviews.js` (rate limiting + service requests + validation)
- `AGENTS.md` (documentation refresh)

## Success checks
- Jikan calls are rate-limited and queued under burst load.
- Jikan requests use `ApiClient.requestService` and can fallback on 404/410.
- Schema drift emits errors via `ErrorHandler` without crashing the UI.

## Document control
| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 2.0 | 2026-02-01 | Codex | Update scope to current architecture and implemented gaps |
