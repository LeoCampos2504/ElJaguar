# Prototype Block 4 — Central connected operations console

## Status and baseline

`PROTOTYPE_BLOCK4_STATUS=PASS`

`BLOCK4_TECHNICAL_GATE=PASS`
`BLOCK4_OPERATOR_UI_GATE=PASS`
`BLOCK4_FINAL_GATE=PASS`

- Project: `remis-norte-prototipo`.
- Branch: `testing`.
- `PRE_BLOCK4_HEAD`: `f9eaf69fdf0130c70c5c7ac7cabe8f10fde8eab3`.
- `origin/testing` matched the baseline. `main` remains `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.
- The worktree contained only Block 4 changes at start. Those changes were preserved.
- The technical candidate was promoted to final PASS after the operator's physical smoke confirmation recorded below.

## Routes, layout, and shared demo state

Central routes are `/central` (redirects to `/central/inicio`), `/central/inicio`, `/central/viajes`, `/central/viajes/nuevo`, `/central/choferes`, `/central/tarifas`, and `/central/historial`.

The desktop-first layout has an operations sidebar and header, with tablet/mobile adaptations. It is connected to the same in-memory `DemoState` as Client and Driver. The discreet demo role selector uses SPA navigation and does not dispatch domain actions or reset state. Same-tab navigation shares state; a reload, another tab, or another device does not.

## Implemented operations

- Dashboard KPIs derive active trips/requests, available and busy drivers, and completed trip history from `DemoState`; no revenue or finance metrics are presented.
- The local map reuses the existing illustrative map and shows demo driver/location/status details. It does not use external maps, GPS, or geolocation.
- The active-trip panel shows demo ID, source, passenger, route, fare snapshot, trip status, dispatch status, target driver when an exclusive offer is pending, assigned driver/vehicle, and a status progression. No timestamps are invented.
- Manual telephone requests capture passenger name, contact phone, and known demo-zone locations. Fare is shown before submission; missing fare or a non-terminal active trip blocks creation. Source is recorded as `PHONE`; the domain also supports `DISPATCHER`, but the form does not offer `APP`.
- Manual requests use the same zonal fare and sequential dispatch logic as Client requests. The single-active-trip demo limitation is `DEMO_CONCURRENT_ACTIVE_TRIPS_LIMIT=1`.
- Dispatch supervision is Central-only and may display offer history. Manual override cancels the previous pending offer before opening one exclusive pending offer for a different eligible available driver. The trip remains `REQUESTED` with `driverId=null`; only that driver accepting moves it to `ASSIGNED`.
- The driver roster uses shared driver/vehicle state. Availability controls only toggle `AVAILABLE`/`UNAVAILABLE` through the existing guarded action and are disabled for a pending offer or active assigned trip.
- Fare editing accepts positive integer ARS amounts, formats them without floating-point currency arithmetic, and updates only the in-memory fare table. Existing trip prices remain snapshots; future quotes use the changed fare. Reset restores the demo fixtures.
- Trip list/history derive from the shared active trip and `tripHistory`, retain source, and show passenger, route, status, driver, vehicle, and fare without revenue, commission, or settlement data.

## Technical verification

- `npm test`: PASS, 47 tests (15 Central tests plus the existing Client, Driver, and dispatch suites).
- `node_modules\\.bin\\tsc -b --pretty false`: PASS, run against the final route changes.
- `npm run build`: PASS; Vite produced `dist/index.html` and production assets.
- `git diff --check`: PASS. Git emitted line-ending conversion notices only; no whitespace errors.
- Lint: NOT AVAILABLE; no lint script is configured.
- Secret review: PASS; reviewed the Block 4 diff and searched for password/token/API-key/private database URL patterns. No credentials or private endpoints were added. Public TESTING URLs are outside this product diff.
- Regression coverage: Client and Driver test files remain in the `npm test` command and pass as part of the 47-test suite.
- Reducer tests prove sequential exclusive override: A's pending offer is `CANCELLED`, B receives the single `PENDING` offer, trip remains `REQUESTED` and unassigned, and only B's acceptance changes it to `ASSIGNED`.
- Domain tests cover PHONE/DISPATCHER request creation, no-fare and active-trip guards, shared dispatch, unavailable/busy override rejection, no-candidate manual intervention, positive fare validation, future quote updates, active fare snapshot, reset action, and availability locks.

## UI and deployment gates

No Computer Use, Chrome automation, Playwright, or browser visual interaction was run for this candidate. A previous Computer Use attempt stopped because it could not identify the current Chrome URL confidently; this phase intentionally leaves browser interaction to the operator.

Before the operator confirmation below, the physical UI smoke was pending; those earlier candidate-stage notes are retained as history. The operator confirmation completes the UI gate. No Computer Use, Chrome automation, Playwright, or browser visual interaction was used by Codex for this certification; no automated evidence is claimed.

Candidate publication and read-only HTTP checks:

- Product commit: `a2f58f580dd72794b444e182698f7e4834679120` (`feat: add connected central demo console`), pushed to `origin/testing`.
- The TESTING web service served the updated Vite bundle `/assets/index-qnqOh1T-.js` with HTTP 200; the bundle contains Central UI markers.
- GET `/`, `/cliente`, `/chofer`, `/central`, `/central/inicio`, `/central/viajes`, `/central/choferes`, `/central/tarifas`, and `/central/historial`: all HTTP 200 and returned the SPA HTML shell. This confirms server fallback/routing only, not visual behavior.
- TESTING API GET `/health`: HTTP 200, `{"status":"ok","service":"remis-norte-api"}`.
- TESTING API GET `/ready`: HTTP 200, `{"status":"ready","service":"remis-norte-api","database":"reachable"}`. This was a read-only health probe; no database changes, SQL, or migrations were performed.
- No Railway dashboard/configuration changes were made. The browser and three-role interactive smoke remain for the operator.

## Scope gates

- Finance UI: NO.
- Backend, Prisma, migrations, database state, and SQL changed: NO. The API `/ready` endpoint was queried read-only and reported `database=reachable`.
- Railway configuration changed: NO.
- Production or `main` touched: NO.
- New external dependencies: NO.

## Next action

Block 4 is certified PASS. Proceed only with the separately authorized Prototype Block 5 work; PostgreSQL and migrations remain paused.

## Operator physical smoke certification

The operator confirmed opening `https://testing-jaguar-web-testing.up.railway.app/central` and that Block 4 works correctly for the presentation. This physical certification was performed by the operator, not by Computer Use. No automated visual evidence was invented; this confirmation complements the technical gates and HTTP checks recorded above.

`OPERATOR_PHYSICAL_SMOKE=PASS`
`CENTRAL_DASHBOARD_PHYSICAL_SMOKE=PASS`
`CENTRAL_NAVIGATION_PHYSICAL_SMOKE=PASS`
`CENTRAL_MANUAL_REQUEST_PHYSICAL_SMOKE=PASS`
`CENTRAL_MANUAL_OVERRIDE_PHYSICAL_SMOKE=PASS`
`CENTRAL_FARE_EDIT_PHYSICAL_SMOKE=PASS`
`OPERATOR_CONFIRMED_AT=2026-09-27`

## Demo limitations and paused work

`DEMO_CONCURRENT_ACTIVE_TRIPS_LIMIT=1`
`SAME_TAB_SHARED_STATE=YES`
`CROSS_TAB_SHARED_STATE=NO`
`CROSS_DEVICE_SHARED_STATE=NO`
`DATABASE_IMPLEMENTATION_STATUS=PAUSED_AFTER_PREPARATION`

## Final negative gates

`PRODUCT_SOURCE_CHANGED=NO`
`BACKEND_CHANGED=NO`
`PRISMA_CHANGED=NO`
`MIGRATION_CHANGED=NO`
`DATABASE_CONNECTED=NO`
`DATABASE_MUTATED=NO`
`RAILWAY_CONFIGURATION_CHANGED=NO`
`MAIN_BRANCH_TOUCHED=NO`
`PRODUCTION_TOUCHED=NO`

## Final Block 4 summary

`CENTRAL_ROUTES_CREATED=YES`
`CENTRAL_DESKTOP_LAYOUT_CREATED=YES`
`CENTRAL_DASHBOARD_CREATED=YES`
`CENTRAL_KPIS_CONNECTED=YES`
`CENTRAL_MAP_CONNECTED=YES`

`CENTRAL_ACTIVE_TRIP_CONNECTED=YES`
`CENTRAL_MANUAL_REQUEST_CONNECTED=YES`
`CENTRAL_DISPATCH_SUPERVISION_CONNECTED=YES`
`CENTRAL_MANUAL_OVERRIDE_CONNECTED=YES`

`MANUAL_OVERRIDE_REQUIRES_DRIVER_ACCEPTANCE=YES`
`MAX_SIMULTANEOUS_PENDING_OFFERS=1`

`CENTRAL_DRIVERS_CONNECTED=YES`
`CENTRAL_AVAILABILITY_CONNECTED=YES`

`CENTRAL_FARES_CONNECTED=YES`
`CENTRAL_FARE_EDIT_CONNECTED=YES`
`ACTIVE_TRIP_FARE_SNAPSHOT_PRESERVED=YES`

`CENTRAL_HISTORY_CONNECTED=YES`
`DEMO_ROLE_SWITCHER_CREATED=YES`
`FINANCE_UI_CREATED=NO`
