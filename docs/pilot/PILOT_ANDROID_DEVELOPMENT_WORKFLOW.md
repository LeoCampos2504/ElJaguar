# EL JAGUAR — Real Pilot V1 · Android Development Workflow (Phase 0A)

```
PHASE_0A_STATUS=COMPLETE
REFERENCE_TAG=prototype-demo-v1
REFERENCE_SHA=5eaa57896144f23812e48c9216886fe9940bda86

ANDROID_TARGET=GOOGLE_PLAY
ANDROID_FRAMEWORK=CAPACITOR

ANDROID_STUDIO_LOCAL_REQUIRED=NO

RESPONSIVE_BROWSER_PREVIEW=YES
INTERNAL_CLOUD_APK=YES
PHYSICAL_ANDROID_TESTING=YES

CLIENT_APK_DISTRIBUTION=NO
GOOGLE_PLAY_CLOSED_TESTING=REQUIRED
GOOGLE_PLAY_PRODUCTION_RELEASE=REQUIRED

CAPACITOR_IMPLEMENTED=NO
CLOUD_BUILD_IMPLEMENTED=NO
GOOGLE_PLAY_CONFIGURED=NO

PRODUCT_SOURCE_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
RAILWAY_CHANGED=NO
```

This phase is preparation only. It records the product target, the account
rules, the current repository baseline and the planned workflow from browser
preview to Google Play. Nothing in this document has been implemented yet:
no Capacitor, no `android/` folder, no GitHub Actions workflow, no secrets, no
Play Console setup.

## 1. Git baseline

| Item | Value |
| --- | --- |
| Repository | `https://github.com/LeoCampos2504/ElJaguar.git` |
| Base branch | `testing` |
| `origin/testing` at branch creation | `5eaa57896144f23812e48c9216886fe9940bda86` |
| Frozen reference tag | `prototype-demo-v1` (annotated: "EL JAGUAR presentation-ready prototype v1") |
| Tag resolves to commit | `5eaa57896144f23812e48c9216886fe9940bda86` |
| Pilot development branch | `work/el-jaguar-pilot-v1`, created from `origin/testing` |
| Worktree at preflight | clean |
| `main` | not touched |

The presentation prototype stays recoverable at any time with:

```bash
git switch --detach prototype-demo-v1
```

The tag must never be moved or deleted. All pilot work happens on
`work/el-jaguar-pilot-v1` (or branches cut from it) and is not merged into
`testing` or `main` without an explicit gate.

## 2. Product target

- **One Android app, "EL JAGUAR"**, distributed through Google Play only.
- The same app serves **CLIENT** and **DRIVER**. The authenticated role decides
  which interface is shown. There is **no role selector** in the production UI.
- **CENTRAL** is a private, responsive web administration panel. It is not part
  of the Android app and not a customer-facing web app.
- There is **no customer-facing web app** and **no direct APK distribution** to
  clients or drivers.

### Account rules (canonical)

| Rule | CLIENT | DRIVER |
| --- | --- | --- |
| Self-registration from the app | Yes: every public registration creates role `CLIENT` | No |
| Account creation | App registration | Created or activated only by ADMIN/CENTRAL |
| Credentials | Chosen by the client | Supplied or reset by administration |
| Role change | A client can never promote themselves to driver | — |
| Routing after login | Client UI | `role=DRIVER` routes automatically to Driver UI |

The registration form never asks whether the user is a driver.

Driver **AUTHORIZED** and driver **AVAILABLE** are separate states:

- **AUTHORIZED** is set only by admin.
- **AVAILABLE** is set voluntarily by the driver.
- Rejecting a trip carries **no penalty**, no negative score, no automatic
  deauthorization and no forced unavailability.

## 3. Current repository assessment

Inspected on `5eaa578` (identical to `prototype-demo-v1`).

### Frontend (repository root)

| Area | Finding |
| --- | --- |
| Package | `remis-norte-prototipo` 0.1.0, `"type": "module"`, private |
| Stack | React 19.3, React Router DOM 7.18 (`BrowserRouter`), Vite 8.3, TypeScript 7.0, Leaflet 1.9 + react-leaflet 5, lucide-react |
| Entry point | `index.html` → `src/main.tsx` → `src/App.tsx` (`DemoProvider` › `DriverSessionProvider` › `BrowserRouter`) |
| Routing | `/` → `/demo` (presentation landing), `/cliente/*` (client), `/chofer/*` (driver), `/central/*` (central), fallback `*` → `/cliente` |
| Vite config | `vite.config.ts` only registers `@vitejs/plugin-react`; default `base` (`/`) and default output `dist/` |
| State | Demo state in React context, persisted in `localStorage` (`src/demo/demo-storage.ts`) |
| Map | Leaflet with public OpenStreetMap tiles (`tile.openstreetmap.org`), lazy-loaded chunk |
| Scripts | `dev` (vite), `build` (`tsc -b && vite build`), `preview`, `start` (`serve --single` for Railway), `test` (Node built-in test runner, `--experimental-strip-types`) |
| Lockfile | `package-lock.json`, lockfileVersion 3, committed |
| Local toolchain | Node 24.18, npm 11.16 |
| GitHub workflows | None (`.github/` does not exist) |
| Android / Capacitor | None |

Baseline validation on the new branch before any change:

- `npm test`: PASS (58 tests, 0 failures)
- `npm run build` (includes `tsc -b`): PASS; output `dist/index.html` plus JS/CSS assets

### Backend (`server/`)

Separate Fastify + Prisma 7 + PostgreSQL package with its own
`package.json`/lockfile, deployed to Railway TESTING as the `testing jaguar`
service (`/health`, `/ready`). It is **out of scope** for this phase and not
touched.

### Findings that matter for the Android shell

1. **Several dependencies are pinned to `"latest"`** in `package.json`
   (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `react-router-dom`,
   `lucide-react`, `typescript`, `@types/react*`). `npm ci` still reproduces the
   lockfile exactly, so CI is deterministic, but any `npm install` can jump
   major versions. Before Capacitor is added, these should be pinned to the
   locked versions (separate authorized change).
2. **The prototype is demo-first.** `/demo`, `DemoRoleSwitcher`, `DemoPanel` and
   the `RESET DEMO` controls are presentation features. They conflict with the
   "no role selector in production UI" rule and must be removed or hidden
   behind a development-only flag before any Play build.
3. **CENTRAL routes live in the same bundle** as client and driver. The Android
   build must not expose `/central/*`. Options for a later phase: separate Vite
   entry points, or a build-time flag that excludes Central from the mobile
   bundle.
4. **`BrowserRouter` works inside Capacitor.** Capacitor serves the web assets
   from `https://localhost` and falls back to `index.html` for unknown paths,
   so no switch to `HashRouter` is required.
5. **The Android hardware back button** is not handled today. It will need the
   `@capacitor/app` `backButton` listener wired to React Router history.
6. **OpenStreetMap public tiles** are acceptable for development but the OSM
   tile usage policy does not allow a production app to rely on
   `tile.openstreetmap.org`. A tile provider with terms for app use must be
   chosen before closed testing.
7. **No backend integration exists in the frontend yet.** The API base URL will
   have to come from a Vite env variable (`VITE_API_BASE_URL`) set per build
   (development / closed testing / production), never hard-coded.

## 4. Why Capacitor

- Reuses the existing React + TypeScript + Vite UI and domain code unchanged.
- Adds a native Android project that wraps the built `dist/` web assets.
- Gives access to native capabilities through plugins: geolocation, app
  lifecycle and back button, push notifications, status bar, splash screen.
- Produces standard Gradle output (debug APK, signed release AAB) that can be
  built entirely in CI.

No blocking reason to rewrite in Kotlin, Java, Flutter or React Native has been
found.

## 5. No local Android Studio

`ANDROID_STUDIO_LOCAL_REQUIRED=NO`

The operator's PC cannot reliably run Android Studio, the emulator or the
Android SDK. Day-to-day development therefore uses only:

- Git
- Node / npm
- a desktop browser (with device emulation)
- GitHub (repository + Actions)
- Claude / Codex
- a physical Android phone

All Android SDK, Java and Gradle work runs in GitHub Actions. The generated
`android/` folder will be committed to the repository once Capacitor is added,
so it can be edited as text and built in CI without opening Android Studio.

## 6. Testing levels

### Level 1 — Web responsive preview (browser)

**Purpose:** layout, forms, navigation, mobile dimensions, general interaction.

**Workflow**

1. `git switch work/el-jaguar-pilot-v1` and `git pull`.
2. `npm ci` (only after a lockfile change or on a fresh clone).
3. `npm run dev` → open the printed `http://localhost:5173` URL.
4. Open browser DevTools → device toolbar and check these widths
   (height ~ 800–915 px):

   | Width | Reference device class |
   | --- | --- |
   | 360 px | small / budget Android |
   | 390 px | common mid-range |
   | 412 px | Pixel-class Android |
   | 430 px | large phone |

5. Before every commit: `npm test` and `npm run build` must pass.

**Optional:** to open the dev server on the physical phone over the same Wi-Fi,
run `npm run dev -- --host` and browse to the PC's LAN IP. This is still Level 1
(a browser, not the Android shell).

**Limits:** no Android back button, no native permissions, no app lifecycle,
no push notifications. Browser geolocation only.

**Operator actions:** run the dev server, check the four widths, report visual
or interaction issues.

### Level 2 — Internal Android build (cloud APK)

**Purpose:** real Android shell; hardware back button; permission prompts;
pause/resume lifecycle; location; push notifications later; testing on a
physical device.

**The APK is INTERNAL ONLY.** It is for the developer/operator. It is never
sent to EL JAGUAR clients or drivers and is not the delivered product.

**Workflow (once Phase 0B/0C are implemented)**

1. Push commits to `work/el-jaguar-pilot-v1` (or open a PR against it).
2. GitHub Actions runs the Android workflow (section 7).
3. Open the run in **GitHub → Actions**, wait for a green result.
4. Download the `el-jaguar-debug-apk` artifact (a `.zip` containing the APK)
   from the run summary, on the phone or on the PC.
5. Install on the physical phone:
   - On the phone, allow "Install unknown apps" for the browser or file manager
     used to open the APK (one-time setting, operator's own device only).
   - Open the APK and install. Each fresh CI runner generates its own debug
     keystore, so consecutive debug APKs may be signed differently. If Android
     reports a signature conflict ("App not installed"), uninstall the previous
     debug build first. A stable, non-secret debug keystore can be added later
     to allow in-place updates.
6. Run the Level 2 checklist:
   - App launches, splash and icon correct.
   - Back button navigates inside the app and exits only from the root screen.
   - Location permission prompt appears and both allow/deny paths behave.
   - Background → foreground keeps state.
   - Network loss shows a usable message.
   - Screen widths and safe areas (notch, gesture bar) look right.

**Debugging without Android Studio:** with the phone connected by USB and
USB debugging enabled, Chrome on the PC at `chrome://inspect` can inspect the
app's WebView (console, network, DOM) for debug builds. This needs only
Chrome, not the Android SDK.

**Operator actions:** enable developer options / USB debugging on the test
phone (optional, for inspection), allow unknown-app installs for internal APKs,
download the artifact, install, run the checklist, report results.

### Level 3 — Google Play (signed AAB)

**Purpose:** the only distribution channel for the real pilot and the public
release.

**Tracks, in order**

1. **Internal testing** (up to 100 testers, near-instant availability): smoke
   test of the signed Play build by the developer/operator.
2. **Closed testing** — **required for the pilot.** EL JAGUAR pilot users
   (clients and drivers) are added through an email list or Google Group and
   install from the Play Store opt-in link.
3. **Production** — only after the pilot and its gates pass.

**Note on new personal developer accounts:** Google Play currently requires
new *personal* developer accounts to run a closed test with a minimum number of
opted-in testers for a continuous period (at the time of writing: 12 testers
for 14 days) before production access can be requested. An *organization*
account is not subject to that rule but requires a D-U-N-S number. This must be
confirmed in the Play Console when the account is created, because it affects
the pilot timeline.

**Operator actions (one-time)**

- Create the Google Play developer account (personal or organization; pay the
  registration fee; complete identity verification).
- Create the app "EL JAGUAR" in Play Console with the final `applicationId`
  (proposed `ar.com.eljaguar.app`; **must be decided before the first upload
  and cannot be changed afterwards**).
- Enroll in **Play App Signing** (Google holds the app signing key; we hold only
  an upload key).
- Complete store listing, content rating, target audience, data safety form
  (location data is collected), and a public privacy policy URL.
- Create the closed-testing track and tester list.

## 7. Cloud build plan (GitHub Actions)

Not implemented in this phase. Planned file:
`.github/workflows/android-internal-apk.yml`.

### Triggers

- `push` to `work/el-jaguar-pilot-v1`
- `pull_request` targeting `work/el-jaguar-pilot-v1`
- `workflow_dispatch` (manual run from the Actions tab)

### Steps

| # | Step | Planned implementation |
| --- | --- | --- |
| 1 | Checkout | `actions/checkout` |
| 2 | Setup Node | `actions/setup-node`, Node 24 (matches local), npm cache |
| 3 | Install | `npm ci` |
| 4 | Test | `npm test` |
| 5 | TypeScript check | `npx tsc -b` |
| 6 | Web build | `npm run build` → `dist/` |
| 7 | Capacitor sync | `npx cap sync android` (copies `dist/` into `android/`) |
| 8 | Setup Java | `actions/setup-java`, Temurin JDK 21 (as required by current Capacitor/AGP) |
| 9 | Setup Android SDK | `android-actions/setup-android` (GitHub `ubuntu-latest` images also ship an SDK) |
| 10 | Gradle build | `cd android && ./gradlew assembleDebug` |
| 11 | Upload artifact | `actions/upload-artifact`, name `el-jaguar-debug-apk`, short retention (e.g. 14 days) |

Runner: `ubuntu-latest`. Gradle and npm caches enabled to keep runs short.

### Later (not now)

- Signing secrets in GitHub Secrets, release job `./gradlew bundleRelease`
  producing a signed AAB.
- Optional Play upload automation to the internal/closed track through a Google
  Play service account (credential stored only as a GitHub Secret).
- `versionCode` derived from the CI run number; `versionName` from a tag.

## 8. Release AAB workflow (eventual)

1. Operator generates the **upload keystore** once, on a machine that has a
   JDK (`keytool`), or in a one-off manual CI job whose output is downloaded
   and then deleted from the run. The keystore file and passwords are stored
   offline in a secure place **and** as GitHub Secrets:
   - `ANDROID_UPLOAD_KEYSTORE_BASE64`
   - `ANDROID_UPLOAD_KEYSTORE_PASSWORD`
   - `ANDROID_UPLOAD_KEY_ALIAS`
   - `ANDROID_UPLOAD_KEY_PASSWORD`
2. A release workflow (manual `workflow_dispatch` or on a release tag) decodes
   the keystore into the runner's temp directory, runs
   `./gradlew bundleRelease`, and uploads the signed `.aab` as an artifact.
3. Operator uploads the `.aab` to the Play Console internal track (or, later,
   CI uploads it with a service-account secret).
4. Promote internal → closed testing → production in the Play Console after
   each gate.

Losing the upload key is recoverable with Play App Signing (Google can reset
it), but it still must be backed up.

## 9. Security rules

Never commit to the repository:

- keystores (`*.jks`, `*.keystore`)
- signing passwords or key aliases with passwords
- Google Play service-account JSON
- Play Console credentials
- Firebase private keys / admin SDK credentials
- database credentials or `DATABASE_URL` values

`google-services.json` for Firebase (push notifications, later) contains only
public client identifiers; it will still be injected from a GitHub Secret
rather than committed, to keep one uniform rule.

When the `android/` folder is added, `.gitignore` must also cover
`android/app/*.jks`, `android/keystore.properties`, `android/local.properties`,
`android/.gradle/` and `android/app/build/`.

All future signing and publishing credentials live only in **GitHub Secrets**
(and the operator's offline backup).

## 10. Operator actions by stage

| Stage | Operator actions | Tools needed |
| --- | --- | --- |
| Level 1 — browser | `npm run dev`, check 360/390/412/430 px, report issues | PC, Node/npm, browser |
| Level 2 — internal APK | Enable "install unknown apps" on own test phone; download CI artifact; install; run checklist; optional `chrome://inspect` | GitHub, physical Android phone, USB cable (optional) |
| Level 3a — Play setup | Create developer account; decide `applicationId`; create app; Play App Signing; store listing; privacy policy; data safety | Browser, Play Console, payment method, identity documents |
| Level 3b — signing | Generate and back up upload keystore; add GitHub Secrets | JDK `keytool` or manual CI job; GitHub repository settings |
| Level 3c — closed testing | Upload AAB; create tester list; share opt-in link with pilot clients/drivers; collect feedback | Play Console |
| Level 3d — production | Approve production release after pilot gates | Play Console |

## 11. Proposed next phases (not authorized)

- **Phase 0B — dependency pinning + Capacitor scaffold:** pin `"latest"`
  dependencies to locked versions; add `@capacitor/core`, `@capacitor/cli`,
  `@capacitor/android`; `capacitor.config.ts` with `appId`/`appName`
  `EL JAGUAR`, `webDir: dist`; generate and commit `android/`; extend
  `.gitignore`. No business features.
- **Phase 0C — cloud internal APK workflow:** add
  `.github/workflows/android-internal-apk.yml` per section 7; verify a green run
  and install the artifact on the physical phone.
- Later phases: production shell (remove demo role switcher / landing from the
  mobile bundle, exclude Central), back-button handling, authentication and
  role routing, API integration, then Play signing and closed testing.
