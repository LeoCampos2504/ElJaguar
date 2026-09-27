# Prototype Block 5 — Final presentation experience

## Status and baseline

`PROTOTYPE_BLOCK5_STATUS=CANDIDATE_PENDING_OPERATOR_FINAL_SMOKE`

- Branch: `testing`.
- `PRE_BLOCK5_HEAD=6532015afe1f6ecd63dfcc1e5a5e5bafba2b6f57` (`origin/testing` matched at preflight).
- `main` remained `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.
- The product gates and static HTTP smoke passed. This does not certify the final visual/interactive presentation; the operator smoke remains pending.
- Blocks 1–4 are preserved. The single-active-trip demo limit, exclusive sequential offers, and manual override acceptance rule are unchanged.

## Presentation landing and shared role navigation

- `/` redirects to `/demo`. The landing identifies EL JAGUAR as an operational prototype and gives the local context: Libertador General San Martín, Calilegua, Jujuy.
- The three cards open Client, Driver, and Central. The existing role selector remains available in each flow and keeps the same mounted `DemoProvider`; switching views does not reset the active trip or offer.
- When returning to Client with an active trip, the selector opens that trip's current state route. After Driver accepts, Client and Central therefore show the same assigned trip.
- `/demo` includes `REINICIAR ESCENARIO`: it resets the demo reducer and clears the in-memory driver session, then shows “Escenario reiniciado”.

## Incoming driver request — same device, one SPA

- On `/chofer/inicio`, the incoming request sheet is rendered only when `getOfferForDriver(state, selectedDriverId)` returns the current `PENDING` offer. This keeps the UI target check aligned with the actor-checked reducer.
- The sheet enters with CSS fade/slide motion, has a pulsing bell (no sound/vibration), small real map, pickup/destination, confirmed fare, and demo distance. A reduced-motion preference disables the animation.
- `RECHAZAR` resolves the current offer and the existing sequential dispatcher opens the next offer. The old driver sees no sheet for that offer; “CAMBIAR MÓVIL DEMO” opens the profile selector so the operator can enter as the next target. The new target sees its own sheet on Driver Inicio.
- `ACEPTAR` uses the existing actor-checked action, closes the sheet, assigns the trip and moves to `/chofer/viaje`. Only one pending offer can exist. Client and Central continue to read the same in-memory trip.
- No DemoPanel action is used for the presentation path.

## Real local map and precomputed road routes

- Map library: Leaflet with React Leaflet. Tile provider: OpenStreetMap (`tile.openstreetmap.org`), with visible OSM attribution and no API key.
- Leaflet is loaded as a separate Vite chunk. If Leaflet rendering fails, an error boundary shows a local fallback; if OSM tiles fail, an in-map notice appears and trip actions remain available.
- One coordinate source lives in `src/demo/map-locations.ts`; Driver, Client, and Central do not keep separate copies. The center, Terminal, Hospital, Ledesma, Libertador, and Calilegua points were checked with OpenStreetMap/Nominatim on 2026-09-27. The UNJu demo pin uses ETHA, Mariano Moreno 1368, the address published by UNJu for the Libertador classroom extension, as a documented nearby demo reference.
- Geographic references: [OSM Libertador](https://www.openstreetmap.org/?mlat=-23.8093358&mlon=-64.7921741#map=15/-23.8093358/-64.7921741), [OSM Terminal](https://www.openstreetmap.org/?mlat=-23.8101792&mlon=-64.7878292#map=17/-23.8101792/-64.7878292), [OSM Hospital O. Orías](https://www.openstreetmap.org/way/513219413), [OSM Calilegua](https://www.openstreetmap.org/?mlat=-23.774232&mlon=-64.7701918#map=15/-23.774232/-64.7701918), and [UNJu Facultad de Ingeniería — Extensión Áulica Libertador](https://www.fi.unju.edu.ar/secretarias/sacad/oferta-academica.html) (Escuela Técnica “Ing. Herminio Arrieta”, Mariano Moreno 1368).
- Static simplified road geometries were obtained during development from the OSRM-compatible public OSM car router and stored in `src/demo/map-routes.ts`: Centro→Terminal, Hospital, UNJu, Calilegua, Barrio Ledesma and Libertador; Terminal/UNJu/Calilegua→Centro; and the demo Driver A approach to Centro. `ROUTE_GEOMETRY_PRECOMPUTED=YES`; `ROUTE_CALCULATION_AT_RUNTIME=NO`. Unsupported pairs return no geometry instead of throwing.
- Client shows origin/destination and only shows a driver marker after assignment. Searching never reveals the pending target. Driver offer/trip maps show the static demo mobile and relevant route; Central shows the local fleet and may show the pending target. Markers are static; no GPS, tracking, polling, interpolation, or continuous movement was added.
- OSM tiles require internet access. Missing tiles do not block quote, offer, or trip actions.

## Persistence, reset, debug, and limitations

- Demo business state persists in browser local storage under `remis-norte-demo-state-v1`, version `1`. Reads are guarded against storage errors, corrupt JSON, wrong versions, and malformed required arrays/dispatch fields; invalid data falls back to `createInitialDemoState()`.
- Reducer state is written locally after changes. There is no storage-event listener, `BroadcastChannel`, or synchronization protocol. Same-tab role views share state; cross-tab live synchronization is not implemented/claimed. Data is not shared across devices.
- Driver session identity is held in React memory only and is not serialized. A page refresh keeps the demo trip but asks the operator to choose a Driver profile again.
- DemoPanel is hidden unless `debug=1`. Destination parsing uses `URLSearchParams`, including combined links such as `?destino=Terminal&debug=1`.
- Demo limitations remain `DEMO_CONCURRENT_ACTIVE_TRIPS_LIMIT=1`, no cross-device sharing, no live driver movement, no runtime route service, and `DATABASE_IMPLEMENTATION_STATUS=PAUSED_AFTER_PREPARATION`.
- User-facing status/source labels use Spanish terminology; Central no longer renders raw offer or dispatch status codes. No finance UI was added.

## Verification

- `npm test`: PASS, 57 tests; all previous Block 1–4 suites remain included. New coverage checks incoming offer exclusivity and A→B handoff, shared assigned trip visibility, quick-destination coordinates, precomputed/missing geometry, debug query behavior, storage rehydration/corruption/reset, and absence of persisted driver identity.
- `node_modules\.bin\tsc -b --pretty false`: PASS.
- `npm run build`: PASS. Vite output includes `RealMap` as a separate approximately 158 kB chunk and the main JavaScript chunk remains below 500 kB.
- `git diff --check`: PASS; only line-ending conversion notices.
- Lint: NOT AVAILABLE; no lint script is configured.
- Dependency install/audit: Leaflet, React Leaflet, and Leaflet typings added; npm reported 0 vulnerabilities at install.
- Secret scan: PASS; no API keys, credentials, database URLs, or private endpoints were found in the scoped source/test/package diff.
- Local static-server smoke: PASS. `/`, `/demo`, `/cliente`, `/chofer`, `/central`, `/cliente/viajes`, `/chofer/viajes`, and `/central/viajes` returned HTTP 200 with the SPA shell; built JavaScript and CSS assets returned 200.
- TESTING API regression (read-only): `/health` returned HTTP 200; `/ready` returned HTTP 200 and reported `database=reachable`. The readiness endpoint is a connectivity probe; this block ran no SQL or migration and made no database mutation or connection-setting change.
- Computer Use, Playwright, and browser visual automation were not used. Local physical UI/responsive review remains pending and is not represented as PASS.

## Railway TESTING deployment evidence

- Product commits: `9bcf8cae56d43e8170aac17403e0a358c512b487` (Block 5) and `597610a4dc30fc58d6c9275abeb792924a15ef09` (Leaflet stylesheet import correction). Both were pushed to `origin/testing`; `main` was not changed.
- After the correction deployed, the presentation URL `https://testing-jaguar-web-testing.up.railway.app/demo` served bundle `/assets/index-BSJJwxWl.js` (367,837 bytes) and stylesheet `/assets/index-DdE4LSj0.css` (79,243 bytes). The served stylesheet includes Leaflet container, tile-pane, and attribution selectors and matches the local production build outputs.
- `/`, `/demo`, `/cliente`, `/chofer`, `/central`, `/cliente/viajes`, `/chofer/viajes`, and `/central/viajes` each returned HTTP 200 with the same current bundle and stylesheet, confirming SPA fallback on the deployed service.
- Read-only API checks after deployment: `GET https://testing-jaguar-testing.up.railway.app/health` returned HTTP 200 with `{"status":"ok","service":"remis-norte-api"}`; `/ready` returned HTTP 200 with `{"status":"ready","service":"remis-norte-api","database":"reachable"}`. `/ready` probes connectivity; this block ran no SQL or migration, made no database mutation, and changed no Railway setting.
- These are deployment/HTTP checks, not a visual or interactive operator certification. The presentation remains a candidate until the physical final smoke below is performed.

## Exact presentation script

1. Open `/demo` and press **REINICIAR ESCENARIO**.
2. Enter **CLIENTE**, choose **Terminal**, inspect the local map and road route, confirm the fare, then press **SOLICITAR REMIS**.
3. Change **Vista demo** to **CHOFER** and enter as Driver A. Confirm the animated **Nueva solicitud** sheet, then press **RECHAZAR**.
4. Choose **CAMBIAR MÓVIL DEMO**, enter as Driver B, and confirm the new exclusive request appears. Press **ACEPTAR**.
5. Confirm the assigned mobile/map, then press **IR A BUSCAR AL PASAJERO**, **LLEGUÉ**, and **INICIAR VIAJE** in sequence.
6. Switch to **CLIENTE** and verify the same assigned trip; switch to **CENTRAL** and verify the same operation.
7. Return to **CHOFER**, press **FINALIZAR VIAJE**, then verify **Finalizado** for Client and the trip in Central history.
8. Return to `/demo` and reset the scenario.

The flow requires no debug query, page refresh, URL editing, terminal, or Railway dashboard.

## Gates and next action

`FINANCE_UI_CREATED=NO`
`CROSS_DEVICE_REALTIME_CREATED=NO`
`LIVE_DRIVER_MOVEMENT_CREATED=NO`
`RUNTIME_ROUTING_DEPENDENCY_CREATED=NO`
`BACKEND_CHANGED=NO`
`PRISMA_CHANGED=NO`
`MIGRATION_CHANGED=NO`
`DATABASE_MUTATED=NO`
`RAILWAY_CONFIGURATION_CHANGED=NO`
`PRODUCTION_TOUCHED=NO`
`MAIN_BRANCH_TOUCHED=NO`

Next action: the operator opens `https://testing-jaguar-web-testing.up.railway.app/demo` and physically performs the script above, paying particular attention to OSM tiles/route, Driver A reject → Driver B offer, role changes, map states, completion, and reset. Keep PostgreSQL and migrations paused. After operator confirmation, certify `PROTOTYPE_PRESENTATION_READY=YES`; do not resume database work automatically.

## Final presentation branding

`FINAL_PRESENTATION_BRAND=EL JAGUAR`
`TEMPORARY_PROTOTYPE_NAME_REMOVED=YES`
`BRANDING_PASS=PASS`
`OLD_VISIBLE_BRAND_REFERENCES=0` (checked in `index.html`, `src`, and `tests`)
`BRANDING_COMMIT=25f6c54a96c8088628a59eda88078ec35ddf28c2`
`INTERNAL_PACKAGE_NAME_CHANGED=NO`

After automatic TESTING deployment, `GET https://testing-jaguar-web-testing.up.railway.app/demo` returned HTTP 200 with title `EL JAGUAR · Prototipo` and bundle `/assets/index-NDb7OKxq.js`. The served JavaScript contains `EL JAGUAR` and has no old visible brand reference. `/`, `/demo`, `/cliente`, `/chofer`, `/central`, and the three role history routes all returned HTTP 200 with that same bundle. This static HTTP verification does not replace the operator's final physical smoke; candidate status remains pending.
