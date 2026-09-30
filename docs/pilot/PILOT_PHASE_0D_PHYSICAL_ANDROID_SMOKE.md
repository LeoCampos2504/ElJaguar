# EL JAGUAR — Real Pilot V1 · Phase 0D · Physical Android Smoke

```
PHASE_0D_STATUS=PASS

APK_DOWNLOAD=PASS
APK_INSTALL=PASS
APK_LAUNCH=PASS
PHYSICAL_ANDROID_SMOKE=PASS

ANDROID_STUDIO_USED=NO

CLOUD_ANDROID_PIPELINE_VALIDATED=YES
PHYSICAL_ANDROID_INSTALLATION_VALIDATED=YES

CURRENT_APK_CONTENT=PRESENTATION_PROTOTYPE
CURRENT_APK_PRODUCT_UX_CERTIFIED=NO

NEXT_PRODUCT_SURFACE=CLIENT
DRIVER_DEVELOPMENT_STARTED=NO
CENTRAL_DEVELOPMENT_STARTED=NO

NEXT_PHASE=PHASE_1_CLIENT_ANDROID
NEXT_PHASE_AUTHORIZED=NO
```

Previous phase:
[PILOT_PHASE_0C_CLOUD_ANDROID_BUILD.md](PILOT_PHASE_0C_CLOUD_ANDROID_BUILD.md).

## 1. What was tested

The operator ran the first physical-device smoke test manually and confirmed
the results listed below. Claude did not download, install or run the APK. This
document records the operator's confirmation.

| Check | Result (operator-confirmed) |
| --- | --- |
| Download the `el-jaguar-debug-apk` artifact from the latest successful GitHub Actions run | PASS |
| Install `app-debug.apk` on a real Android phone | PASS |
| Open the app | PASS |
| Android Studio used | NO |

**Build tested.** The operator used "the latest successful GitHub Actions
artifact". When this record was written, the latest successful run of
**EL JAGUAR Android Internal APK** on `work/el-jaguar-pilot-v1` was
run `36792310955` (#3, commit `e723b66`). Its "Debug APK" notice reports
`app-debug.apk`, 4,327,309 bytes, SHA-256
`60900005d1b44dcb9b522fbff62605bb24e0efa8164cd789dc4587cce75f97c8`. The
operator did not report comparing the checksum or give the phone model and
Android version, so those details are not recorded.

## 2. What this certifies

- **Cloud pipeline validated end to end.** GitHub Actions produces an APK that
  downloads, installs and launches on real hardware, with no Android Studio and
  no local Android SDK. This confirms the Phase 0A strategy
  (`ANDROID_STUDIO_LOCAL_REQUIRED=NO`).
- **Physical installation validated.** The debug-signed internal APK installs
  on the operator's phone through the Level 2 workflow.

## 3. What this does NOT certify

- **Product UX.** The APK still contains the **presentation prototype** from
  `prototype-demo-v1`: the demo landing page, the demo role switcher and demo
  panels, the client, driver and central demo routes, and demo data. That is
  the expected state after Phase 0B. This smoke test proves the infrastructure
  only.
- The detailed Level 2 checklist (back button, permissions, lifecycle, network
  loss, safe areas) was **not** part of this confirmation. It will be applied
  to the real client shell.
- Google Play, signing, Firebase, the backend and authentication are
  untouched.
- **Not a distribution build.** The APK remains internal development only.

## 4. Next direction

The next development stage deliberately focuses on the **CLIENT** surface
only (`PHASE_1_CLIENT_ANDROID`, not yet authorized). Driver and Central
development have not started.

## 5. Git

| Item | Value |
| --- | --- |
| Branch | `work/el-jaguar-pilot-v1` |
| `HEAD` = `origin/work/el-jaguar-pilot-v1` before this commit | `e723b6697cef7b952d54c046468113853c6c7ff3` |
| `prototype-demo-v1` | `5eaa57896144f23812e48c9216886fe9940bda86` (unchanged) |
| Changed files | this document only |
| `testing`, `main` | not touched |
