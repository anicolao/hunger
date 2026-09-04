# Android Shell Implementation Plan

## Outcome

Ship the existing event-sourced Svelte application as a Play-distributed Android app that launches and works without a network connection, schedules private on-device reminders, and uses Android system surfaces for permissions, photos, sharing, Back, and appearance.

The web event log remains authoritative. Android stores only native operational state such as the last requested alarm schedule and temporary exports; it never creates or edits hunger, episode, settings, insight, or experiment records.

## Toolchain contract

All repository commands run through `flake.nix`:

- `nix develop .#android` provides the pinned API 36 SDK, build-tools, platform-tools, Gradle, JDK, and Bun.
- `nix run .#android-build-web` creates and integrity-manifests the offline SPA payload.
- `nix run .#android-test-unit` runs JVM tests.
- `nix run .#android-build-debug` builds the installable debug APK.
- `nix run .#android-test-ui` starts the pinned API 36 emulator and runs instrumentation tracer bullets with radios disabled.
- `nix run .#android-build-release` creates the unsigned release AAB.
- `nix run .#android-audit-release` rejects remote URLs, network permission, fixture code, development assets, unexpected permissions, or an incomplete bundle.
- `nix run .#android-verify` performs the local release gate. Set `ANDROID_RUN_UI_TESTS=1` to include the emulator suite.

Gradle resolves declared Android/Kotlin libraries and records dependency locks and verification metadata. Nix supplies every machine-level dependency; Android Studio is optional.

## Commit sequence and tracer bullets

### 1. `build(android): pin the shell toolchain and offline payload`

Add the Nix Android environment, Gradle project, manifest, resources, packaged web task, and implementation plan.

Tracer bullet: build an APK and prove the embedded root and onboarding documents, build hash, and integrity manifest are present without a service worker or website landing page.

### 2. `feat(android): contain the offline application`

Load only packaged assets at a stable HTTPS-like origin, preserve IndexedDB across launches and app upgrades, block untrusted navigation, recover from renderer loss, and route Back through web history.

Tracer bullet: launch with radios disabled, complete onboarding, save an event, recreate the Activity, and verify the replayed state remains visible.

### 3. `feat(android): add the versioned native bridge`

Generalize the TypeScript boundary to iOS and Android. Add an origin-checked, main-frame-only Android message listener with strict request and payload validation.

Tracer bullet: the packaged app reports Android capabilities; malformed, oversized, wrong-origin, and unknown-command requests are rejected without side effects.

### 4. `feat(android): schedule private local reminders`

Request notification permission only after intent, create one low-data notification channel, replace the complete derived schedule with one-shot inexact alarms, persist only that operational schedule, and restore it after reboot, time, timezone, or package changes.

Tracer bullet: permission, replacement, cancellation, diagnostics, reboot restoration, and notification-to-Today routing work without FCM, a server, or exact-alarm access.

### 5. `feat(android): integrate system presentation and lifecycle`

Match status/navigation regions to the selected theme, apply edge-to-edge insets, expose foreground events to the SPA, support predictive Back, and keep controls usable with TalkBack and large text.

Tracer bullet: light/dark changes reach system chrome and a background/foreground transition reconciles authoritative reminder state.

### 6. `feat(android): use private system photo and export flows`

Use the Android Photo Picker for explicit image selection and the Sharesheet with a scoped `FileProvider` URI for temporary exports. Remove temporary exports after completion and at next launch.

Tracer bullet: select a photo without broad media permission, share both formats without storage permission, then verify no temporary export is retained.

### 7. `feat(android): coordinate deletion and recovery`

Make Delete Everything cancel alarms, remove delivered notifications and native temporary state after the SPA has deleted its canonical event log and projections. Retain the existing fail-closed web recovery path.

Tracer bullet: delete, force-stop, and relaunch to the first onboarding screen with no pending alarms, cached schedule, or export.

### 8. `test(android): certify the release shell`

Add JVM validation tests, instrumentation journeys, manifest/bundle audits, and an Android CI job. Capture reports, APK/AAB metadata, and screenshots as artifacts.

Tracer bullet: `nix run .#android-verify` is green from a clean checkout; the optional emulator gate repeats the offline cold-launch journey.

## Release boundary

This plan ends with a qualified unsigned Play App Bundle. Play Console organization setup, signing/upload key handoff, listing declarations, tester groups, and upload automation are a separate credentialed release slice. No signing secret belongs in Git, Gradle files, Nix derivations, or CI artifacts.
