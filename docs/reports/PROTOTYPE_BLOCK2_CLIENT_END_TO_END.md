# PROTOTYPE BLOCK 2 — Client end-to-end on shared DemoState

## Baseline and scope

- `PRE_BLOCK2_HEAD`: `95f92f4f967e3933a5b7cb6d1a14fa35c971f511`
- Branch: `testing`; worktree was clean and `origin/testing` matched before work.
- `DemoProvider` was already mounted around the client router. `useDemo()` exposes one in-memory `DemoState`; dispatch remains sequential/exclusive, and there is no persistence.
- This change is limited to the client prototype, its in-memory dispatch retry action, tests, and this report. No backend, database, Prisma, migrations, Railway, production, or external dependency changes.

## Client routes

Existing routes retained: `/cliente`, `/cliente/buscar`, `/cliente/viaje`, `/cliente/buscando`, `/cliente/en-camino`, `/cliente/llego`, `/cliente/en-viaje`, `/cliente/finalizado`, `/cliente/viajes`, `/cliente/viajes/:id`, `/cliente/tarifas`, `/cliente/ayuda`, `/cliente/perfil`.

Added `/cliente/asignado` to distinguish accepted assignment from `/cliente/en-camino`, and `/cliente/cancelado` to give cancellation a truthful result screen.

`getClientRouteForTripState()` maps `REQUESTED → buscando`, `ASSIGNED → asignado`, `DRIVER_EN_ROUTE → en-camino`, `ARRIVED → llego`, `IN_PROGRESS → en-viaje`, `COMPLETED → finalizado`, and `CANCELLED → cancelado`. Guards redirect incompatible trip-state routes and preview requests while a non-terminal trip already exists.

## Shared flow

- Home reads the demo passenger and selected origin; origin is shown as a disabled demo location rather than a misleading selector. An unfinished trip offers a direct continue action instead of silently starting another.
- Quick destinations and recognized search results resolve to known demo zones and update `selectedDestination`. Query parameters remain presentation/deep-link compatibility only; a recognized query is reconciled once when no destination is selected. Unknown text is not treated as a geocoded place and cannot be quoted.
- Preview calls `quoteTrip()` and renders the actual selected origin, destination, and fare. `NO_FARE`/missing locations are explained and disable request.
- Request calls `requestTrip()` once and navigates to searching; reducer protection still prevents duplicate active trips.
- Searching is bound to `activeTrip`/dispatch. A pending offer does not expose candidate/driver identity. `NO_CANDIDATES` explains the result and offers cancel, home, or retry. `RETRY_DISPATCH` resets only the attempted-candidate cursor for the same `REQUESTED` trip and uses current availability.
- Driver and vehicle details are selected from the assigned active trip only. ETA is a deterministic distance-based demo estimate; the map remains illustrative and labels the selected origin, destination, and assigned driver's fixture location.
- Passenger cancellation invokes `cancelTrip()` only when `canPassengerCancel()` permits it; the cancellation screen/history use the resulting same trip. Cancellation is not offered during `IN_PROGRESS` or terminal states.
- Completion stores the same trip as `COMPLETED`, adds it once to shared runtime history, and displays its route, fare, driver, and vehicle. Existing fixture history remains visible.
- The `DemoPanel` contains visibly marked `DEMO · DEBUG · SIMULACIÓN` controls for accept/reject/timeout, driver-en-route, arrival, start, completion, and reset. Calling the driver remains explicitly disabled in this prototype (no driver phone is invented). Inert menu/help/logout affordances were removed or presented as non-actionable demo content.

## Verification

- Tests: `PASS`, 20 total (14 Block 1 tests preserved; 6 focused client-flow tests added for quote, request/state-route mapping, driver visibility, completion/history/reset, no-candidates/retry, incompatible routes, and cancellation).
- Typecheck: `PASS` — `node_modules/.bin/tsc -b --pretty false`.
- Build: `PASS` — `npm run build`.
- Lint: `NOT_AVAILABLE` — no lint script is configured.
- Local browser E2E: `PASS` for Terminal quote (`$2.500`), request, no driver identity while pending, sequential reject then timeout, assignment of the next remaining candidate, en-route, arrival, start, completion, same-trip history, no-candidate presentation, retry without a duplicate trip, and cancellation. A direct incompatible URL after a full page reload returned to home because the specified demo state is intentionally in-memory; the route mapping/guard was additionally verified by focused unit tests.
- `CLIENT_MOBILE_360=NOT_VERIFIED`; `CLIENT_MOBILE_390=NOT_VERIFIED`; `CLIENT_MOBILE_430=NOT_VERIFIED`.
- `CLIENT_MOBILE_RESPONSIVE_SMOKE=DEFERRED_NOT_BLOCKING` by the explicit product decision for this prototype publication. Computer Use could not control the viewport with sufficient confidence; no evidence was obtained to certify PASS, but no concrete responsive defect was detected either. Exact-width physical checks move to `PROTOTYPE_FINAL_PRESENTATION_QA`. No CSS was changed speculatively.
- `RESPONSIVE_FAILURE_DETECTED=NO`; `RESPONSIVE_QA_DEFERRED_TO=PROTOTYPE_FINAL_PRESENTATION_QA`; `PUBLICATION_BLOCKED_BY_RESPONSIVE=NO`.

## Negative gates

- `DRIVER_FULL_UI_CREATED=NO`; `ADMIN_UI_CREATED=NO`
- `BACKEND_CHANGED=NO`; `PRISMA_CHANGED=NO`; `MIGRATION_CHANGED=NO`
- `DATABASE_CONNECTED=NO`; `DATABASE_MUTATED=NO`
- `RAILWAY_TOUCHED=NO`; `PRODUCTION_TOUCHED=NO`
- `NO_NEW_EXTERNAL_DEPENDENCIES=YES`
- Main was not checked out or modified.

## Files and release gate

Expected fileset: `src/App.tsx`, `src/components.tsx`, `src/styles.css`, `src/client-flow.ts`, `src/demo/{types.ts,demo-context.ts,demo-state.tsx,dispatch.ts}`, `tests/client-flow.test.mjs`, `package.json`, and this report.

The responsive smoke is explicitly deferred and does not block publication; it is not represented as PASS. After the quality gates and scoped diff review pass, publish the listed Block 2 files with `feat: connect client demo flow end to end` to `origin testing`. After publication, the next product block is the connected demo Driver experience that replaces these driver DEBUG controls.
