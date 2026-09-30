# EL JAGUAR — Real Pilot V1 · Phase 0B · Capacitor Android Scaffold

```
PHASE_0B_STATUS=COMPLETE
BRANCH=work/el-jaguar-pilot-v1
REFERENCE_TAG=prototype-demo-v1
REFERENCE_SHA=5eaa57896144f23812e48c9216886fe9940bda86

EXISTING_DEPENDENCIES_PINNED=YES
CAPACITOR_CORE_VERSION=8.5.2
CAPACITOR_CLI_VERSION=8.5.2
CAPACITOR_ANDROID_VERSION=8.5.2

CAPACITOR_IMPLEMENTED=YES
ANDROID_PROJECT_CREATED=YES
ANDROID_STUDIO_REQUIRED=NO
ANDROID_LOCAL_BUILD_REQUIRED=NO

APP_NAME=EL JAGUAR
APPLICATION_ID=ar.com.eljaguar.app
APPLICATION_ID_STATUS=PROVISIONAL_BEFORE_FIRST_PLAY_UPLOAD
WEB_DIR=dist

NPM_TEST=PASS
NPM_TEST_COUNT=58
NPM_BUILD=PASS
CAP_SYNC_ANDROID=PASS

PRODUCT_BUSINESS_LOGIC_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
RAILWAY_CHANGED=NO
GITHUB_ACTIONS_CHANGED=NO
GOOGLE_PLAY_CHANGED=NO
MAIN_TOUCHED=NO
PRODUCTION_TOUCHED=NO

NEXT_PHASE=PHASE_0C_CLOUD_ANDROID_BUILD
NEXT_PHASE_AUTHORIZED=NO
```

The canonical assessment is
[PILOT_ANDROID_DEVELOPMENT_WORKFLOW.md](PILOT_ANDROID_DEVELOPMENT_WORKFLOW.md)
(Phase 0A). This phase only turns the existing web app into an Android-ready
source tree. It adds no business functionality. Compiling the APK in the cloud
is Phase 0C.

## 1. Preflight

| Check | Result |
| --- | --- |
| Current branch | `work/el-jaguar-pilot-v1` |
| Worktree | clean |
| `HEAD` | `cd1de3a0d4721d43384b9f7400249a83858f9fd5` |
| `origin/work/el-jaguar-pilot-v1` | `cd1de3a0d4721d43384b9f7400249a83858f9fd5` (in sync, no pull needed) |
| `prototype-demo-v1` | `5eaa57896144f23812e48c9216886fe9940bda86` (unchanged) |
| `testing`, `main` | not touched |

## 2. Baseline gate (before any change)

| Command | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm test` | PASS, 58/58 |
| `npm run build` (`tsc -b && vite build`) | PASS |

## 3. Pinning the existing dependencies

Each dependency declared as `"latest"` was replaced with the exact version
already resolved in `package-lock.json`. No package was upgraded.

| Package | Section | Before | After (locked version) |
| --- | --- | --- | --- |
| `@vitejs/plugin-react` | dependencies | `latest` | `6.1.1` |
| `lucide-react` | dependencies | `latest` | `1.48.0` |
| `react` | dependencies | `latest` | `19.3.0` |
| `react-dom` | dependencies | `latest` | `19.3.0` |
| `react-router-dom` | dependencies | `latest` | `7.18.4` |
| `vite` | dependencies | `latest` | `8.3.1` |
| `@types/react` | devDependencies | `latest` | `19.3.0` |
| `@types/react-dom` | devDependencies | `latest` | `19.3.0` |
| `typescript` | devDependencies | `latest` | `7.0.2` |

Dependencies that already used caret ranges (`leaflet`, `react-leaflet`,
`serve`, `@types/leaflet`) were left unchanged.

After `npm install --package-lock-only`, the lockfile diff touched only the
root package's declared ranges (9 lines). A script compared every
`packages["node_modules/…"].version` entry against the previous commit:
**0 existing packages changed or were removed**. `npm ci`, `npm test` (58/58)
and `npm run build` then passed again.

## 4. Capacitor

Installed with `--save-exact`:

| Package | Version | Section |
| --- | --- | --- |
| `@capacitor/core` | `8.5.2` | dependencies |
| `@capacitor/android` | `8.5.2` | dependencies |
| `@capacitor/cli` | `8.5.2` | devDependencies |

8.5.2 is the current stable release of all three, and `@capacitor/android`
8.5.2 declares `@capacitor/core ^8.5.0` as a peer dependency, so the set is
consistent. The Capacitor CLI requires Node ≥ 22; the local toolchain is Node
24.18.

Adding them introduced 104 new lockfile entries (mostly the CLI's dependency
tree) and changed **none** of the existing resolved versions.

No native plugins were added: no `@capacitor/app`, `@capacitor/geolocation`,
`@capacitor/push-notifications`, Firebase or native Google Maps.

### Known audit note

`npm audit` reports 3 **moderate** advisories: `uuid` (GHSA-w5hq-g745-h8pq) via
`xcode`, a dependency of `@capacitor/cli` used for **iOS** project editing.
This is development-time CLI tooling and is not bundled into the web assets or
the Android app. The only automatic fix `npm audit` offers is a downgrade to
`@capacitor/cli@8.4.3`, which it describes as a breaking change. **Not applied.**
Revisit when a Capacitor patch release updates the dependency.

## 5. Capacitor configuration

[`capacitor.config.ts`](../../capacitor.config.ts):

| Key | Value |
| --- | --- |
| `appId` | `ar.com.eljaguar.app` |
| `appName` | `EL JAGUAR` |
| `webDir` | `dist` |

**`APPLICATION_ID_STATUS=PROVISIONAL_BEFORE_FIRST_PLAY_UPLOAD`.** The
application ID can still be changed, but only by explicit operator decision
and only before the first upload to Google Play. After that upload, Google Play
makes it permanent. Changing it now would mean updating `capacitor.config.ts`,
`android/app/build.gradle` (`namespace`, `applicationId`),
`android/app/src/main/res/values/strings.xml`, and moving
`MainActivity.java` to the matching Java package directory.

No Google Play project and no Firebase project were created.

## 6. Android project

Commands run: `npm run build` → `npx cap add android` → `npx cap sync android`.
All succeeded without Android Studio, an emulator or an Android SDK
(`ANDROID_HOME` is not set on this PC). The Gradle build itself was **not**
run locally. That is expected: it belongs to Phase 0C in the cloud.

Verified in the generated project:

| File | Verified value |
| --- | --- |
| `android/app/build.gradle` | `namespace = "ar.com.eljaguar.app"`, `applicationId "ar.com.eljaguar.app"`, `versionCode 1`, `versionName "1.0"`, no `signingConfigs` |
| `android/app/src/main/res/values/strings.xml` | `app_name` and `title_activity_main` = `EL JAGUAR`; `package_name` = `ar.com.eljaguar.app` |
| `android/app/src/main/AndroidManifest.xml` | single `MainActivity` launcher; only permission `INTERNET` |
| `android/app/src/main/java/ar/com/eljaguar/app/MainActivity.java` | extends `BridgeActivity` (no custom code) |
| `android/variables.gradle` | `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36` |
| `android/build.gradle` | Android Gradle Plugin `8.13.0` |
| `android/gradle/wrapper/gradle-wrapper.properties` | Gradle `8.14.3` |
| `android/gradle.properties` | `org.gradle.jvmargs=-Xmx1536m`, `android.useAndroidX=true`; no credentials |
| `android/app/src/main/assets/capacitor.config.json` (generated, ignored) | `appId`, `appName`, `webDir` match the config |

Launcher icons and splash images are the Capacitor defaults. EL JAGUAR artwork
belongs to a later application-shell phase.

### Notes for Phase 0C

- `android/gradlew` is committed with the executable bit (`100755`) so `./gradlew`
  works on the Linux runner.
- `android/capacitor.settings.gradle` points Gradle at
  `node_modules/@capacitor/android`, and `android/capacitor-cordova-android-plugins/`
  and `android/app/src/main/assets/public/` are generated and git-ignored. CI
  must therefore run `npm ci`, `npm run build` and `npx cap sync android` before
  Gradle, as the Phase 0A plan already specifies.
- Capacitor 8 / AGP 8.13 require JDK 21 on the runner.

## 7. Source control and secrets

`android/.gitignore` (Capacitor template) already excludes `build/`, `.gradle/`,
`local.properties`, `*.apk`, `*.aab`, copied web assets and generated config.
The root `.gitignore` was extended to also exclude, anywhere in the repo:

```
!*.example
android/local.properties
android/.gradle/
android/app/build/
*.jks
*.keystore
keystore.properties
google-services.json
```

The existing `.env`, `.env.*` and `!.env.example` rules are unchanged, and
`.env.example` remains tracked.

Checked with `git check-ignore`: `android/local.properties`, `android/.gradle/`,
`android/app/build/`, `*.jks`, `*.keystore`, `keystore.properties`,
`android/app/google-services.json` and `.env.production` are ignored;
`.env.example` is tracked.

The staged diff was scanned for sensitive file paths and for
password/secret/key/token/`DATABASE_URL` values. **None found.** No signing
configuration, keystore or credential exists in the project.

## 8. Prototype behavior and mobile rendering

The prototype is intentionally unchanged: `/demo`, `/cliente/*`, `/chofer/*` and
`/central/*`, the demo role switcher and the demo panels are all still present.
Role routing and production navigation belong to the next application-shell
phase.

`index.html` already has
`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
which the Android WebView needs. No change to `index.html`, CSS or layout was
required.

## 9. npm scripts added

| Script | Command | Purpose |
| --- | --- | --- |
| `android:sync` | `npm run build && cap sync android` | Build web assets, copy them into `android/` and update native plugin wiring |
| `android:copy` | `npm run build && cap copy android` | Build and copy web assets only |

No script opens Android Studio (`cap open android` was not added).

## 10. Final validation

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm test` | PASS, 58/58 |
| `npm run build` | PASS |
| `npx cap sync android` | PASS |
| `npx cap --version` | 8.5.2 |
| `git diff --check` | PASS (after removing template trailing whitespace in `android/build.gradle`) |

## 11. Changed files

| Path | Change | Why |
| --- | --- | --- |
| `package.json` | modified | Pin 9 `"latest"` entries to their locked versions; add exact Capacitor 8.5.2 packages; add `android:sync` / `android:copy` scripts |
| `package-lock.json` | modified | Root declarations updated to the pinned ranges; Capacitor packages and their dependency tree added; no existing resolved version changed |
| `capacitor.config.ts` | new | Capacitor configuration: app ID (provisional), app name, web dir |
| `.gitignore` | modified | Android build/local files, keystores, signing properties and `google-services.json` excluded; `!*.example` added |
| `android/**` (53 files) | new | Capacitor-generated Android project (Gradle wrapper, app module, manifest, `MainActivity`, default resources, template tests) |
| `android/build.gradle` | new (1 edit) | Generated file; trailing whitespace on one blank line removed to pass `git diff --check` |
| `android/gradlew` | new, mode `100755` | Executable bit set so the Gradle wrapper runs on the Linux CI runner |
| `docs/pilot/PILOT_PHASE_0B_CAPACITOR.md` | new | This report |

Not changed: `src/**`, `index.html`, `vite.config.ts`, `tsconfig*.json`,
`tests/**`, `server/**` (including Prisma), Railway configuration, GitHub
Actions (none exist), Google Play and Firebase.
