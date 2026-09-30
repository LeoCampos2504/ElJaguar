# EL JAGUAR — Real Pilot V1 · Phase 0C · Cloud Android Debug APK Build

```
PHASE_0C_STATUS=COMPLETE
BRANCH=work/el-jaguar-pilot-v1
REFERENCE_TAG=prototype-demo-v1
REFERENCE_SHA=5eaa57896144f23812e48c9216886fe9940bda86

WORKFLOW_FILE=.github/workflows/android-internal-apk.yml
WORKFLOW_NAME=EL JAGUAR Android Internal APK

CI_NODE_VERSION=24.21.0
CI_JAVA_VERSION=21.0.12.1 (Temurin, OpenJDK 21 LTS)
CI_ANDROID_COMPILE_SDK=36
CI_ANDROID_TARGET_SDK=36
CI_GRADLE_VERSION=8.14.3

CI_NPM_CI=PASS
CI_TEST=PASS
CI_TEST_COUNT=58
CI_WEB_BUILD=PASS
CI_CAP_SYNC=PASS
CI_GRADLE_BUILD=PASS

CI_WORKFLOW_STATUS=SUCCESS

APK_ARTIFACT_NAME=el-jaguar-debug-apk
APK_FILENAME=app-debug.apk
APK_SIZE=4327309
APK_SHA256=267ce4003c0ab9af253b8fd37df22cb7f8b8fa7622441c00977269ee1f9d0950

APK_DISTRIBUTION=INTERNAL_DEVELOPMENT_ONLY

ANDROID_STUDIO_REQUIRED=NO
LOCAL_ANDROID_SDK_REQUIRED=NO

ANDROID_SIGNING_CONFIGURED=NO
GOOGLE_PLAY_CONFIGURED=NO
FIREBASE_CONFIGURED=NO

PRODUCT_SOURCE_CHANGED=NO
BUSINESS_LOGIC_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
RAILWAY_CHANGED=NO

MAIN_TOUCHED=NO
TESTING_TOUCHED=NO
PRODUCTION_TOUCHED=NO

NEXT_PHASE=PHASE_0D_PHYSICAL_ANDROID_SMOKE
NEXT_PHASE_AUTHORIZED=NO
```

The canonical assessments are
[PILOT_ANDROID_DEVELOPMENT_WORKFLOW.md](PILOT_ANDROID_DEVELOPMENT_WORKFLOW.md)
(Phase 0A) and [PILOT_PHASE_0B_CAPACITOR.md](PILOT_PHASE_0B_CAPACITOR.md)
(Phase 0B).

> **The APK built here is INTERNAL DEVELOPMENT ONLY.** It is debug-signed and
> intended only for the operator's own test phone. It is not the pilot
> distribution, not the Google Play build, not a release build and must never
> be sent to EL JAGUAR clients or drivers.

## 1. Preflight and local baseline

| Check | Result |
| --- | --- |
| Branch | `work/el-jaguar-pilot-v1` |
| Worktree | clean |
| `HEAD` = `origin/work/el-jaguar-pilot-v1` | `f89fa82853b2e892f9c111e24b989190b49d1eee` (in sync) |
| `prototype-demo-v1` | `5eaa57896144f23812e48c9216886fe9940bda86` (unchanged) |
| `npm ci` / `npm test` / `npm run build` / `npx cap sync android` | PASS / 58 of 58 / PASS / PASS |

## 2. Workflow

File: [`.github/workflows/android-internal-apk.yml`](../../.github/workflows/android-internal-apk.yml)

**Triggers:** `push` to `work/el-jaguar-pilot-v1`, `pull_request` targeting
`work/el-jaguar-pilot-v1`, and `workflow_dispatch`.

**Job settings:** `ubuntu-latest`, 30-minute timeout, `permissions: contents: read`,
checkout with `persist-credentials: false`. A new push to the same ref cancels
the previous run still in progress.

| # | Step | Implementation | Guard |
| --- | --- | --- | --- |
| 1 | Checkout | `actions/checkout@v7` | — |
| 2 | Node | `actions/setup-node@v7`, Node 24, npm cache keyed on `package-lock.json`; prints `node --version`, `npm --version` | — |
| 3 | Install | `npm ci` | fails on lockfile mismatch |
| 4 | Tests | `npm test` piped to a log with `set -o pipefail` | a failing test fails the job; the counts are published as a notice |
| 5 | Web build | `npm run build` (`tsc -b && vite build`) | `test -f dist/index.html` |
| 6 | Capacitor sync | `npx cap sync android` | `test -f android/app/src/main/assets/public/index.html` |
| 7 | Java | `actions/setup-java@v6`, Temurin 21, `cache: gradle`; prints `java -version` | — |
| 8 | Android SDK | `android-actions/setup-android@v4` with `platform-tools`, `platforms;android-36`, `build-tools;35.0.0`; accepts the SDK licenses | — |
| 9 | Gradle | `./gradlew assembleDebug --no-daemon` in `android/` | — |
| 10 | APK metadata | `stat`, `sha256sum`, `./gradlew --version`; published as notices and in the job summary | `test -f` on the APK |
| 11 | Artifact | `actions/upload-artifact@v7`, name `el-jaguar-debug-apk`, 14-day retention | `if-no-files-found: error` |

The TypeScript check is not run twice: `npm run build` already includes
`tsc -b`.

**Caching:** npm through `setup-node`, Gradle through `setup-java` (Gradle
caches and wrapper only). No third-party cache action is used. APKs and build
outputs are not cached, and no signing material exists to cache.

**Action versions:** each action's current major release tag at the time of
writing (checkout v7.0.1, setup-node v7.0.0, setup-java v6.0.1, upload-artifact
v7.0.1, setup-android v4.0.4). All of these run on the `node24` runtime.

## 3. Security

- **Zero secrets.** The workflow references no `secrets.*` values. No
  repository secrets were created or modified.
- No keystore, upload key, `signingConfigs`, Play service account, Firebase
  project or `google-services.json` exists.
- The APK is signed with the Android Gradle Plugin's **default debug key**,
  which is generated fresh on each runner. That is why every run produces a
  different APK checksum (see section 5).
- Token permissions are limited to `contents: read`. Credentials are not
  persisted after checkout.

## 4. CI results

### Run 1 — commit `4b6f5dc` (`ci: build El Jaguar Android debug APK in cloud`)

| Field | Value |
| --- | --- |
| Run ID / number | `36791755604` / #1 (push) |
| Job ID | `110146019740` |
| Conclusion | **success** (1 min 47 s); every step succeeded |
| Artifact | `el-jaguar-debug-apk`, ID `11131934183`, 3,966,473 bytes (zip) |
| APK | `app-debug.apk`, 4,327,309 bytes, SHA-256 `b91691a35a6e789d767613b2b9b3146061e9d6b53c5dbea7540a34819f02ea5c` |

The pipeline was green on its first run. **No build failure had to be fixed.**

### CI problem encountered: logs not publicly readable

GitHub requires signing in to read job logs, even for a public repository, and
the logs API returned HTTP 403 without authentication. Test counts and
toolchain versions could not be read from run 1 without signing in to the
operator's account, which was not done. The step conclusions and the APK
metadata notice were readable.

**Fix (CI only), commit `e134ed4`**
(`ci: publish Android build test and toolchain summary`):

- The test step writes the counts (`tests`/`pass`/`fail`) to a public
  annotation and to the job summary.
- The metadata step also publishes Node, Java and Gradle versions and the
  min/compile/target SDK values.
- `shell: bash` with `set -o pipefail` was added to the test step. The runner's
  default shell does not enable `pipefail`, so without it piping `npm test`
  through `tee` could hide a test failure.

Local gates after the change: `npm test` 58 of 58, `npm run build` PASS,
`npx cap sync android` PASS, `git diff --check` PASS.

### Run 2 — commit `e134ed4` (certified run)

| Field | Value |
| --- | --- |
| Run ID / number | `36792088182` / #2 (push) |
| Run URL | https://github.com/LeoCampos2504/ElJaguar/actions/runs/36792088182 |
| Job ID | `110147098270` |
| Conclusion | **success**; all 13 workflow steps succeeded |
| Tests notice | `tests=58 pass=58 fail=0` |
| Toolchain notice | `node=v24.21.0`, `java=openjdk version 21.0.12.1 2026-08-18 LTS`, `gradle=8.14.3`, `minSdkVersion=24 compileSdkVersion=36 targetSdkVersion=36` |
| APK notice | `app-debug.apk size=4327309 sha256=267ce4003c0ab9af253b8fd37df22cb7f8b8fa7622441c00977269ee1f9d0950` |
| Artifact | `el-jaguar-debug-apk`, ID `11132570133`, 3,966,473 bytes (zip), digest `sha256:2e39d04dcc3d95836d6e24e01685047b3c5f7b0acb07f2b0c8f2e60e0e8147c1`, not expired, expires `2026-10-14T23:38:48Z` |

**Artifact contents:** the upload step's only path is
`android/app/build/outputs/apk/debug/app-debug.apk` with
`if-no-files-found: error`, and it succeeded. The artifact therefore holds
exactly `app-debug.apk`. The artifact was **not** downloaded, because
downloading requires authentication and installing on a device is the
operator's task in Phase 0D.

GitHub also posted a notice that the `ubuntu-latest` label moves to Ubuntu 26
starting 2026-10-19. The build uses no OS-specific tooling beyond the actions
above, so no change is needed now. Pinning `ubuntu-24.04` remains an option if
the migration causes a problem.

## 5. Notes for Phase 0D (operator)

1. Open the latest green run of **EL JAGUAR Android Internal APK** in
   GitHub → Actions (signed in), and download `el-jaguar-debug-apk` from the
   run summary. It is a zip containing `app-debug.apk`.
2. Compare the APK's SHA-256 with the value in that run's **"Debug APK"**
   notice. Every push produces a new APK with a different checksum. The value
   certified above belongs to run 36792088182. Later runs, including the run
   triggered by this documentation commit, publish their own values.
3. Because each run signs with a new debug key, installing a newer debug APK
   over an older one can fail with "App not installed". Uninstall the previous
   debug build first.
4. Follow the Level 2 checklist in the Phase 0A document.

## 6. Changed files

| Path | Commit | Why |
| --- | --- | --- |
| `.github/workflows/android-internal-apk.yml` | `4b6f5dc` (new), `e134ed4` (reporting and pipefail) | Cloud debug APK pipeline |
| `docs/pilot/PILOT_PHASE_0C_CLOUD_ANDROID_BUILD.md` | this commit | Phase report |

Not changed: `src/**`, `server/**`, Prisma, `android/**`, `package*.json`,
`capacitor.config.ts`, database, Railway, GitHub Secrets, Google Play and
Firebase. `testing`, `main` and `prototype-demo-v1` were not touched.
