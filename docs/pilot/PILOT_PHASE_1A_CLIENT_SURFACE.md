# EL JAGUAR — Real Pilot V1 · Phase 1A · Client Android Surface

```
PHASE_1A_STATUS=COMPLETE

CURRENT_ANDROID_SURFACE=CLIENT_ONLY

CLIENT_LOGIN_UI=YES (mock)
CLIENT_REGISTRATION_UI=YES (mock, CLIENT only, no role selector)
CLIENT_HOME=YES
CLIENT_PICKUP_SELECTION=YES
CLIENT_DESTINATION_SELECTION=YES
CLIENT_MOCK_FARE=YES (FARE_SOURCE=MOCK_LOCAL)
CLIENT_REQUEST_FLOW=YES (mock)
CLIENT_SEARCHING_STATE=YES
CLIENT_ACCEPTED_STATE=YES

PILOT_SAVED_LOCATIONS=NO
PILOT_FAVORITE_LOCATIONS=NO
PILOT_RECENT_DESTINATIONS=NO

REAL_AUTH_IMPLEMENTED=NO
REAL_GPS_IMPLEMENTED=NO
REAL_BACKEND_IMPLEMENTED=NO
REAL_DISPATCH_IMPLEMENTED=NO
PUSH_IMPLEMENTED=NO

DRIVER_DEVELOPMENT_STARTED=NO
CENTRAL_DEVELOPMENT_STARTED=NO

PROTOTYPE_REFERENCE_PRESERVED=YES

NPM_TEST=PASS
NPM_TEST_COUNT=72
CLIENT_BUILD=PASS
CLIENT_ANDROID_SYNC=PASS
CI_ANDROID_BUILD=PASS

NEXT_PHASE=PHASE_1B_CLIENT_PHYSICAL_REVIEW
NEXT_PHASE_AUTHORIZED=NO
```

Previous phases:
[0A](PILOT_ANDROID_DEVELOPMENT_WORKFLOW.md) ·
[0B](PILOT_PHASE_0B_CAPACITOR.md) ·
[0C](PILOT_PHASE_0C_CLOUD_ANDROID_BUILD.md) ·
[0D](PILOT_PHASE_0D_PHYSICAL_ANDROID_SMOKE.md).

This is the first real product surface. The Android app now packages **only
the CLIENT experience**, which runs on mock/local development data. Driver and
Central development have not started.

## 1. Build targets

| Target | Vite mode | Command | Used for |
| --- | --- | --- | --- |
| Presentation prototype | default | `npm run dev`, `npm run build` | Historical reference (`/demo`, `/cliente/*`, `/chofer/*`, `/central/*`), Railway TESTING web |
| **Client (Android)** | `client` | `npm run dev:client`, `npm run build:client` | The Android app |

**How the target is selected.** `vite.config.ts` derives
`import.meta.env.VITE_APP_TARGET` from the Vite mode (`client` or
`prototype`) at build time. `src/main.tsx` dynamically imports either
`src/client-app/ClientApp.tsx` or `src/prototype-root.tsx`. Because the value
is a build-time constant, the bundler removes the other branch completely. The
client build emits only `ClientApp` and `ClientMap` chunks, with none of the
prototype, `RealMap`, driver or central code. In client mode, a small Vite
plugin also replaces the prototype's `<title>`/description in `index.html`
with `EL JAGUAR`. The source `index.html` is unchanged. The mechanism is
cross-platform: no environment files and no shell variables.

**Bundle verification.** `npm run build:client` ends with
`scripts/verify-client-bundle.mjs`, which fails the build if `dist/` contains:

- prototype or demo markers: `Vista demo`, `RESET DEMO`, `PROTOTIPO`,
  `Destinos rápidos`, `Destinos recientes`, …
- driver or central markers: `VER ESTADO EN MODO CLIENTE`, `Central operativa`,
  `Asignación de móviles`, …
- the `/chofer` or `/central` routes
- `Favoritos` or `Guardados`

It also fails if the client markers or the client title are missing. To check
the verifier itself, I ran it against the prototype build: it **failed** with
21 findings. Against the client build it passes.

**npm scripts**

| Script | Command |
| --- | --- |
| `dev:client` | `vite --mode client` |
| `build:client` | `tsc -b && vite build --mode client && node scripts/verify-client-bundle.mjs` |
| `verify:client` | `node scripts/verify-client-bundle.mjs` |
| `android:sync:client` | `npm run build:client && cap sync android` |
| `android:copy:client` | `npm run build:client && cap copy android` |

The Phase 0B scripts `android:sync` / `android:copy` (which packaged the
prototype build) were **removed**, so a prototype APK cannot be produced by
mistake. A test asserts that every script calling `cap sync`/`cap copy` goes
through `build:client`.

## 2. Client routes

| Path | Screen |
| --- | --- |
| `/` | Client entry: → `/ingresar` (signed out), `/viaje` (current trip), or `/inicio` |
| `/ingresar` | Login |
| `/registrarme` | Registration |
| `/inicio` | Client home ("¿A dónde vas?") |
| `/pedir/origen` | Pickup selection (step 1 of 2) |
| `/pedir/destino` | Destination selection (step 2 of 2) |
| `/pedir/confirmar` | Fare + "PEDIR REMIS" |
| `/viaje` | Trip status |

Any other path redirects to `/`. That includes `/demo`, `/cliente/*`,
`/chofer/*` and `/central/*`. A pure route guard
(`src/client-app/domain/client-routes.ts`) also keeps the flow in order:

- signed-out users go to login;
- an open or finished trip pins the user to `/viaje` until they leave it;
- the confirm screen needs both a pickup and a destination.

## 3. What the client sees

1. **Launch → login.** EL JAGUAR brand, "Teléfono o usuario", "Contraseña"
   (with show/hide), **Iniciar sesión**, and **Registrarme**.
2. **Registration.** Nombre y apellido, Teléfono, Contraseña, Repetir
   contraseña, **Crear cuenta**. There is no role question. Every
   registration yields a `CLIENT` session.
3. **Home.** Greeting, a large **¿A dónde vas?** button, and two rows: "Te
   buscamos en" (pickup) and "Vas a" (destination). The account button opens
   "Mi cuenta" with **Cerrar sesión**. There is no demo, Central, Chofer, role
   switcher, reset or debug control.
4. **Pickup, then destination.** Each picker has a map with fixed public
   reference points plus a searchable list of those points. The client can tap
   any spot on the map, which marks a point near the closest service zone, then
   confirm it. Points outside the service area are rejected ("Ese punto está
   fuera de la zona de servicio."), and pickup and destination must differ.
5. **Fare.** Map with both points, the two places (each can be changed), and
   "Tarifa **$X** · Precio fijo por zona". The button is **PEDIR REMIS**.
6. **Searching.** "Buscando un chofer disponible…" with the sequential-dispatch
   concept as text only: "Le ofrecemos tu viaje a los choferes cercanos, de a
   uno por vez."
7. **Accepted.** "Tu viaje fue aceptado", plus the mock driver card (name,
   vehicle, colour, plate, móvil number).
8. **Basic states.** A progress row plus a headline for each state:

   | State (internal) | Label | Headline |
   | --- | --- | --- |
   | REQUESTED | Buscando chofer | Buscando un chofer disponible… |
   | ASSIGNED | Chofer confirmado | Tu viaje fue aceptado |
   | DRIVER_EN_ROUTE | En camino | Tu chofer está en camino |
   | ARRIVED | Llegó | Tu chofer llegó |
   | IN_PROGRESS | En viaje | Viaje en curso |
   | COMPLETED | Finalizado | Viaje finalizado |
   | CANCELLED | Cancelado | Viaje cancelado |

   Internal state names are never shown. The map shows only the pickup,
   the destination and a dashed connector. There is no live vehicle tracking.
9. **Cancellation.** "Cancelar viaje" appears through **ARRIVED** and asks
   for confirmation ("¿Seguro que querés cancelar el viaje?"). From
   **IN_PROGRESS** on, it is replaced by "El viaje ya comenzó y no se puede
   cancelar." The reducer enforces the same rule. Nothing is enforced
   server-side yet.
10. **End.** COMPLETED or CANCELLED → **Volver al inicio**. This clears the
    trip **and the pickup/destination draft**, so no place is ever reused.

**Mock progression.** No driver is contacted. After a request, the trip
advances on fixed timers so that every state can be reviewed on a phone:

| Transition | After |
| --- | --- |
| Searching → accepted | 5 s |
| Accepted → en route | 5 s |
| En route → arrived | 9 s |
| Arrived → in progress | 9 s |
| In progress → completed | 12 s |

The timers are in `MOCK_STATUS_DURATION_MS`.

## 4. Data and scope rules

- **Auth (mock).** `signInWithMock` / `registerClientWithMock` validate the
  format only: phone digits, password length, matching confirmation. **No
  credential is checked or stored.** The password never enters app state or
  storage, and a test asserts this.
- **Persistence (device-local).** The session (role, name, phone) and the
  current trip/draft are kept in `localStorage` (`el-jaguar-client-v1`) so an
  Android restart does not lose the trip. Invalid or non-CLIENT data is
  ignored. This is not real account persistence.
- **Locations (current trip only).** `PILOT_SAVED_LOCATIONS=NO`,
  `PILOT_FAVORITE_LOCATIONS=NO`, `PILOT_RECENT_DESTINATIONS=NO`. The
  prototype's Casa, Trabajo, quick destinations and recent destinations are not
  used. The reference-point list is fixed and identical for every user.
  Each `TripPlace` records its `source` (`REFERENCE_POINT` or `MAP_POINT`),
  so real device location can later supply a place without redesigning the
  flow. No GPS and no `@capacitor/geolocation`.
- **Fare (mock).** `quoteMockFare` is a local zonal table:
  - the prototype's three known pairs: Centro–Terminal $2.500, Centro–Hospital
    $1.800, Barrio Ledesma–Calilegua $3.200;
  - otherwise same zone $1.500, urban pair $2.200, any pair with Calilegua
    $4.000.

  There is no kilometre, dynamic, surge or traffic pricing, and no external
  API.
- **Map.** Lazy-loaded react-leaflet with the public OpenStreetMap tiles. The
  Phase 0A warning still applies: a tile provider with terms for app use is
  needed before closed testing.

## 5. Tests

`npm test` now runs **72** tests: the 58 existing tests unchanged, plus 14 in
`tests/client-surface.test.mjs`.

| Required check | Covered by |
| --- | --- |
| CLIENT_TARGET_STARTS_IN_CLIENT=YES | Scripts, `vite.config.ts` and `main.tsx` select the client root in client mode; `/` → login / home |
| DEMO_VISIBLE=NO | Client sources never import `App`, `components`, `demo/*`, `driver/*`, `central/*`, `presentation/*` and contain no demo/debug/reset markers; also checked in the bundle |
| ROLE_SELECTOR_VISIBLE=NO | Same scan, plus no `DRIVER`/`CENTRAL`/`ADMIN` references; registration screen has no role/driver wording; a `role: 'DRIVER'` input still yields `CLIENT` |
| DRIVER_ROUTE_ACCESSIBLE=NO | `/chofer`, `/chofer/*` → `/` (signed in or out); also checked in the bundle |
| CENTRAL_ROUTE_ACCESSIBLE=NO | `/central`, `/central/*` → `/`; also checked in the bundle |
| SAVED_LOCATIONS_VISIBLE=NO, FAVORITES_VISIBLE=NO, RECENT_DESTINATIONS_VISIBLE=NO | No Casa/Trabajo/favoritos/guardados/recientes/frecuentes/historial in client sources; storage holds only session/draft/trip; draft cleared after each trip |
| CLIENT_CAN_SET_PICKUP=YES, CLIENT_CAN_SET_DESTINATION=YES | Reducer, list filter, map tap → nearest zone, outside-area rejection |
| CLIENT_CAN_SEE_MOCK_FARE=YES | Every zone pair priced, symmetric, `MOCK_LOCAL`, formatted |
| CLIENT_CAN_REQUEST_MOCK_RIDE=YES | Request creates REQUESTED trip; ignored when incomplete or duplicated |
| CLIENT_CAN_SEE_SEARCHING_STATE=YES | REQUESTED headline, mock delay, home redirects to `/viaje` |

Additional tests cover the full state sequence to COMPLETED, the cancellation
rule (allowed through ARRIVED, refused from IN_PROGRESS), Spanish labels with
no technical names, mock auth validation, route-guard ordering, and storage
round-trip and rejection.

## 6. Manual browser review (Level 1)

I ran `npm run dev:client` in a browser with device emulation and checked
every screen:

- **Login and registration:** validation errors shown.
- **Picking places:** map tap → candidate → confirm, list selection, and
  same-place rejection.
- **Trip:** fare, request, searching, accepted, en route / arrived /
  in progress (no cancel button), completed → home with an empty draft.
- **Interruptions:** a second trip, reloading the page mid-trip (returned to
  `/viaje`), and cancellation with confirmation.
- **Foreign routes:** `/chofer` redirected to login.

Checks at **360, 390, 412 and 430 px** showed no horizontal overflow.
`npm run dev` (prototype) still opens `/demo` with its original title and no
console errors.

## 7. CI (internal debug APK)

`.github/workflows/android-internal-apk.yml` now packages the CLIENT target.
All existing gates are kept, in this order:

1. `npm ci`
2. `npm test`
3. **Prototype reference build** (`npm run build`), so the prototype must keep
   compiling
4. **Client build** (`npm run build:client`, including bundle verification),
   run last so `dist/` is the client
5. `npx cap sync android`, plus a check that the synced
   `assets/public/index.html` carries the client title, and an
   `Android surface: CLIENT_ONLY` notice
6. JDK 21
7. Android SDK
8. `./gradlew assembleDebug`
9. APK metadata
10. Artifact upload

| Field | Value |
| --- | --- |
| Commit | `22631700e3723224fbd36c410816270ef0e2e39b` (`feat: build El Jaguar client Android surface`) |
| Run | `36794672090` (#5, push): **success**, every step green |
| Notices | `tests=72 pass=72 fail=0` · `Android surface: CLIENT_ONLY` · node v24.21.0, Java 21.0.12.1, Gradle 8.14.3, SDK 24/36/36 |
| APK | `app-debug.apk`, 4,291,700 bytes, SHA-256 `09379f83ad7d13bc4815191e886c594b6bd88293474e4e07fd4465210b01a65a` |
| Artifact | `el-jaguar-debug-apk`, ID `11133162433`, expires 2026-10-15 |

The APK is still **internal development only**, debug-signed, with no
secrets.

## 8. Known limitations for Phase 1B (physical review)

- **Android back button exits the app.** Capacitor 8 has no built-in history
  handling, and `@capacitor/app` is out of scope here. Every inner screen has
  an on-screen back button instead. Wire the hardware back button when the
  App plugin is authorized.
- **Insets.** The default Capacitor 8 configuration pads the WebView, and no
  `viewport-fit=cover` was added. Check the status bar and gesture bar on the
  device.
- **Map tiles need network.** Without a connection, the map shows a notice and
  the reference-point list still works.
- **Text and naming.** The progress labels are small at 360 px, though the
  headline carries the state. The mock driver and plate are fixed demo data
  inside the client domain, not real records.
- **Vehicle wording.** The button says **PEDIR REMIS**, matching EL JAGUAR's
  remisería service and the prototype. The phase brief's example said "PEDIR
  MOTOTAXI". Change the label if mototaxi is intended.

## 9. Changed files

| Path | Change |
| --- | --- |
| `src/client-app/**` (new) | Client target: `ClientApp`, provider, UI kit, map, 5 screen files, `client.css`, and pure domain modules (`client-routes`, `client-state`, `places`, `fare`, `auth`, `client-storage`) |
| `src/main.tsx` | Selects the client or prototype root at build time |
| `src/prototype-root.tsx` (new) | Prototype root (leaflet CSS + `App` + `styles.css`), previously inline in `main.tsx` |
| `src/vite-env.d.ts` | Type for `VITE_APP_TARGET` |
| `vite.config.ts` | Mode → target define; client document title/description |
| `package.json` | Client scripts; prototype Android scripts removed; new test file added to `npm test` |
| `scripts/verify-client-bundle.mjs` (new) | Client bundle gate |
| `tests/client-surface.test.mjs` (new) | 14 client tests |
| `.github/workflows/android-internal-apk.yml` | Packages the client target; prototype build kept as a gate |
| `docs/pilot/PILOT_PHASE_1A_CLIENT_SURFACE.md` (new) | This report |

Not changed: `src/App.tsx`, the prototype components, demo, driver, central and
presentation code, `index.html`, `styles.css`, existing tests, `android/**`,
`server/**`, Prisma, database, Railway, Google Play, Firebase and package
dependencies. `testing`, `main` and `prototype-demo-v1`
(`5eaa57896144f23812e48c9216886fe9940bda86`) were not touched.
