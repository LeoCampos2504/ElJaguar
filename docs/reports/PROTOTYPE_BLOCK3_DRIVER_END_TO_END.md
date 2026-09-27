# Prototype Block 3 — Driver experience end-to-end

## Baseline and scope

- Branch: `testing`.
- Pre-implementation local HEAD and `origin/testing`: `a1313dd35e6730b814d7093348f580623e4b7600`.
- Worktree was clean at preflight; `main` remained at `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.
- This block adds a connected driver demo experience to the existing prototype and the existing in-memory `DemoState`.
- No backend, API, database, Prisma, migration, Railway configuration, production, or external dependency work is in scope.

## Implemented behavior

- Routes: `/chofer`, `/chofer/ingreso`, `/chofer/inicio`, `/chofer/oferta`, `/chofer/viaje`, `/chofer/viajes`, and `/chofer/perfil`.
- Demo driver identity is held in a separate in-memory React context. It is not persisted and changing identity does not mutate business state.
- Existing demo drivers and vehicles are used for profile selection. The login explicitly identifies itself as demo-only and not real authentication.
- The existing strict sequential dispatch model remains authoritative: one pending offer at a time, visible only to its target. Actor-aware reducer actions prevent a different driver from accepting, rejecting, or progressing another driver's trip.
- Drivers can toggle availability when not locked by a pending offer or active trip. Assigned drivers progress through en route, arrived, in progress, and confirmed completion.
- Passenger cancellation is visible to the owning driver, releases availability according to the existing reducer, and is not exposed to another driver.
- Driver history is derived from the same shared trip history and filtered by assigned driver. Profile and driver bottom navigation are present.
- The client flow remains intact. The Client home can enter driver demo mode; the driver's active-trip page can return to the same trip in the Client flow. `DemoPanel` remains an auxiliary debug control and is not needed for the driver happy path.

## Validation

- `npm test`: PASS, 32 tests including actor ownership, sequential offer privacy, full trip progression, cancellation, availability, route guards, and driver history.
- `node_modules\\.bin\\tsc -b --pretty false`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS (only Git line-ending conversion warnings were emitted).
- Lint: NOT AVAILABLE; the project has no lint script/configuration in `package.json`.
- Local browser E2E: PASS for client request → exclusive offer → A rejection → B acceptance → client sees the same assigned driver/vehicle → en route → arrived → start → confirmed completion → client completion and driver history.
- Local browser cancellation smoke: PASS for assigned-trip cancellation; the client receives the cancelled state, the owning driver sees the cancellation and availability restoration, and another driver's home does not expose that trip.
- Driver flow is completed without using the debug panel; the panel remains visible only in the existing Client/debug experience.
- Exact viewport certification at 360, 390, and 430 px: DEFERRED to final prototype presentation QA; no claim of pixel-perfect viewport certification is made here.

## Negative gates

- Backend/API source changed: NO.
- Prisma schema or migrations changed/applied: NO.
- Database connected or mutated: NO.
- SQL executed: NO.
- Frontend existing Client flow removed: NO.
- External dependencies added: NO.
- Railway configuration changed: NO.
- Production touched: NO.
- Main branch touched: NO.

## Deployment certification

Pending push of the product commit and subsequent Railway TESTING deployment. After push, verify direct web routes and SPA fallback, API `/health` and `/ready`, record deployed source SHA, then commit this report's certification update separately.

## Next action

Implement Prototype Block 4: connected desktop Central/Admin experience using the same `DemoState` for dashboard, map, requests, drivers and availability, trip monitoring, manual request creation, assignment override, zonal fares, and history. Exclude finance.
