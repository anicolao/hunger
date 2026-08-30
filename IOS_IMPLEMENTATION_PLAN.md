# iOS Shell Implementation Plan

This plan turns `IOS_DESIGN.md` into one reviewable pull request made of green,
vertical commits. Each feature commit must package a usable increment, exercise
its real web/native boundary, and add or extend a tracer-bullet test. The branch
is `docs/ios-shell-design`; it remains the single iOS shell PR branch through
release-candidate completion.

The implementation source of truth remains, in priority order:

1. `MVP_DESIGN.md` for product and data rules;
2. `IOS_DESIGN.md` for shell architecture, ownership, and security boundaries;
3. `UX_DESIGN.md` for screen and accessibility behavior; and
4. `E2E_GUIDE.md` for deterministic user-journey evidence.

## Delivery rules

- Keep the IndexedDB append-only event sequence authoritative. Swift must not
  define, store, edit, import, export, or project domain records.
- Write materialized records only through deterministic TypeScript event
  playback. Every persistence tracer bullet deletes the projection cache and
  proves recovery from events.
- Use `flake.nix` as the only iOS environment and command entry point. It owns
  Apple developer-directory selection, XcodeGen, Bun, build wrappers, bundle
  audits, test wrappers, and CI commands. Do not add ad-hoc shell scripts or
  require contributors to export toolchain variables manually.
- Commit declarative XcodeGen configuration and generated `Hunger.xcodeproj` so
  Xcode opens normally. A flake check regenerates the project in a temporary
  tree and fails when the committed project is stale.
- Use Apple frameworks only at runtime. Do not add CocoaPods, Carthage, remote
  Swift packages, analytics, remote configuration, or downloaded web assets.
- Treat `hunger-app`, host `app`, the named `WKWebsiteDataStore` UUID, IndexedDB
  database name, and event schema as migration-sensitive release constants.
- Make phone portrait the primary UI-test and screenshot surface. Add iPad only
  where native presentation differs, such as the share popover.
- Run the relevant local flake verifier before every commit.
- Push each completed feature commit immediately. While implementing the next
  slice, let GitHub CI run; before pushing that next commit, inspect the prior
  commit's checks and resolve any failure first.
- Keep the existing browser `Verify` and retained preview green. Add macOS iOS
  verification without weakening or serializing the Ubuntu browser job.
- Never use a passing unit test as a substitute for the slice's user-visible
  tracer bullet.
- Record simulator evidence in CI. Record the physical-device and multi-iOS
  checks required by `IOS_DESIGN.md` as a release checklist when hardware or
  runtimes are not available to automation.

## Flake command contract

The implementation exposes these commands with `nix run`:

| Command | Contract |
| --- | --- |
| `nix develop` | Provides pinned web/PDF tools plus Darwin-only XcodeGen and sets `DEVELOPER_DIR` to the installed Xcode without changing global machine state. |
| `nix run .#ios-generate` | Regenerates `ios/Hunger.xcodeproj` from `ios/project.yml`. |
| `nix run .#ios-build-web` | Builds native-mode SvelteKit assets and emits/verifies the signed-bundle resource manifest. |
| `nix run .#ios-test-unit` | Generates the project and runs Swift unit tests on the selected iPhone simulator. |
| `nix run .#ios-test-ui` | Builds the native web payload and runs phone-primary XCUITests. |
| `nix run .#ios-verify` | Runs project-staleness, web, bundle-audit, Swift unit, XCUITest, and unsigned simulator build gates. |

Every command resolves paths from the flake checkout, fails on non-Darwin with
a clear explanation when it requires Xcode, uses `set -euo pipefail`, and
supports deterministic overrides such as `IOS_DESTINATION` without repurposing
system environment variables.

## Commit sequence

### 0. `docs: plan the offline iOS implementation`

Add this plan, push the design branch, open the iOS shell PR, and establish the
browser CI/preview feedback loop before native code lands.

Verification:

- Markdown whitespace validation passes;
- the branch contains only the design and implementation plan relative to
  `main`;
- GitHub `Verify` and `Deploy preview` pass; and
- the retained preview link is present on the PR.

### 1. `feat(ios): prove the offline event-backed shell`

Deliver the architecture's feasibility gate and smallest installable shell:

- extend `flake.nix` with the command contract above and Darwin Xcode tools;
- add XcodeGen project configuration, iOS 17 target, SwiftUI container, and
  classic `WKWebView`;
- add the `VITE_NATIVE_SHELL=ios` build boundary without changing browser
  behavior;
- package every static route, font, icon, and hashed asset with a deterministic
  manifest;
- serve allowlisted routes from `hunger-app://app/` through
  `WKURLSchemeHandler` with traversal-safe resolution and correct MIME types;
- configure the fixed named persistent `WKWebsiteDataStore` before web-view
  construction;
- add fail-closed main-frame navigation policy, native CSP, and a compiled
  content-rule list that blocks remote resource schemes;
- disable service-worker registration, manifest UI, fixture hooks, remote URLs,
  and inspection in Release native builds; and
- show bounded native loading/recovery states without duplicating app UI.

Tracer bullet: `OfflineEventPersistenceUITests` launches from a clean install,
activates the real app, creates a check-in event through the phone UI, recreates
the web view/relaunches, deletes projection stores through a test-only event
boundary, and verifies the same state is replayed while all remote requests are
denied.

Unit proof: asset path normalization, route mapping, MIME resolution, manifest
integrity, navigation policy, and immutable persistence constants.

Gate: if IndexedDB does not persist for the custom scheme across a simulator
relaunch and in-place build update, stop the sequence and revise
`IOS_DESIGN.md` to the proven fallback before implementing later slices.

### 2. `feat(ios): add the constrained platform bridge`

Deliver a real, versioned capability boundary:

- install `hungerNativeV1` with request/reply behavior in the page content
  world;
- validate exact origin, main frame, protocol version, request identifier,
  command allowlist, payload schema, field count, string length, and total size;
- provide typed success and error replies that complete exactly once;
- add a frozen TypeScript facade and runtime capability negotiation;
- keep browser platform adapters as the fallback when the handshake is absent;
- add native-to-web `app.lifecycle` delivery using typed arguments rather than
  interpolated JavaScript; and
- compile all bridge and test hooks out of release payloads when they are not
  part of the production protocol.

Tracer bullet: `NativeBridgeUITests` loads the packaged phone app, proves the
capability handshake, verifies a permitted status request, rejects malformed,
oversized, subframe, wrong-version, and unknown-command requests, and confirms
normal check-ins still append and replay web events without native domain CRUD.

Unit proof: exhaustive request decoding/validation, origin/frame policy,
command dispatch, reply mapping, and TypeScript native/browser adapter choice.

### 3. `feat(ios): schedule private local reminders`

Deliver the first user-facing native capability:

- add `NotificationCoordinator` backed by `UNUserNotificationCenter`;
- expose authorization status, contextual permission request, deterministic
  replace schedule, cancel-all, and app-settings commands;
- map only validated reminder windows/cadence into fixed notification IDs and
  neutral local content;
- re-query status on foreground and prevent duplicate requests;
- route a notification tap to Today only after the web application is ready;
- cancel reminders on pause, completion, or Delete Everything; and
- request no APNs registration or remote-notification entitlement.

Tracer bullet: `NativeReminderUITests` chooses a reminder window during
onboarding, observes the permission result through a deterministic test
notification center, verifies the choice in Settings, then pauses and proves
all requests are cancelled. Unit coverage retains replacement-without-
duplicates and notification-open routing checks.

Unit proof: every authorization state, future-state fallback, time-window
validation, stable identifiers, cadence mapping, idempotent replacement,
foreground refresh, and notification response routing.

### 4. `feat(ios): share private exports`

Deliver native export without changing its data authority:

- keep TypeScript export generation and redaction authoritative;
- validate bridge filename, MIME type, content type, and conservative byte
  limits;
- write protected temporary HTML/JSON files;
- present `UIActivityViewController` modally on iPhone and from an anchored
  popover on iPad;
- delete temporary output after dismissal and again on launch; and
- validate the existing WebKit photo-picker and quota-degradation path without
  adding a native photo data model.

Tracer bullet: `NativeExportUITests` creates a day-30 event history, requests
both real exports from the phone UI, inspects shared files for schema and photo
redaction, cancels the share sheet, and verifies temporary cleanup. An iPad
smoke test proves popover presentation does not crash.

Unit proof: allowed filename/type pairs, path stripping, byte limits, protected
file lifecycle, source-event/photo exclusion, and presenter selection.

### 5. `feat(ios): coordinate private deletion and recovery`

Complete the cross-boundary lifecycle contract:

- coordinate Delete Everything only after the web repository closes, clears,
  and verifies events, projections, photos, caches, and preferences;
- cancel native notifications and delete native temporary files before
  reporting completion;
- recreate the web view with the same persistent profile and show onboarding;
- recover from `webViewWebContentProcessDidTerminate` at the last allowlisted
  route with a bounded retry policy;
- refresh platform state on foreground without mutating domain data; and
  disable multiple scenes until their ownership contract is designed.

Tracer bullet: `NativePrivacyAndRecoveryUITests` seeds source events, cached
projections, a local photo, reminder requests, and a temporary export; triggers
Delete Everything through the phone UI; relaunches and verifies every layer is
empty. It then creates fresh state, terminates the Web Content process, and
verifies event-backed recovery without data clearing.

Unit proof: deletion state machine, partial-failure/retry mapping, allowed-route
recovery, retry bound, foreground refresh, and cleanup verification.

### 6. `test(ios): certify the offline release shell`

Finish integration without adding product scope:

- add a parallel macOS GitHub Actions job using only flake commands;
- prove clean-checkout Xcode generation and stale-project detection;
- audit the built `.app` for remote URLs, source maps, fixture symbols,
  service-worker registration, unexpected entitlements, and unmanifested web
  resources;
- add `PrivacyInfo.xcprivacy` and only the usage descriptions required by the
  tested picker path;
- verify Release disables WebKit inspection and Debug logging contains no
  domain data;
- run the primary journey at small/current/large phone dimensions, large text,
  dark mode, reduced motion, VoiceOver semantics, and hardware keyboard;
- retain simulator screenshots and `.xcresult` artifacts; and
- document physical-device, oldest/current iOS, notification-delivery, camera,
  low-storage, device-restart, in-place upgrade, TestFlight, signing, and App
  Store privacy checks that CI cannot honestly certify.

Tracer bullet: `OfflineReleaseJourneyUITests` completes onboarding, paired
check-in, insight review, experiment start, profile export, reminder pause, and
privacy deletion through the packaged phone app in airplane-mode conditions,
then relaunches to a clean first-run state.

Regression proof: existing browser scenarios `001–012`, TypeScript unit tests,
native build audit, Swift unit suites, all iOS tracer bullets, Xcode Release
build, whitespace validation, clean console, and zero unexpected network
access.

## Per-commit push protocol

For commit `N`:

1. run its focused flake tests during development;
2. run `nix run .#ios-verify` and the existing browser change verifier before
   committing when the slice affects shared web code;
3. commit one coherent feature plus its tracer bullet;
4. if `N > 1`, inspect GitHub checks for commit `N - 1` and do not push while a
   prior failure is unresolved;
5. push commit `N` to `docs/ios-shell-design`;
6. let checks run while implementing commit `N + 1` locally; and
7. before the next push, verify commit `N` is green by exact SHA.

The final commit is not ready for review merely because its local tests pass.
The current PR head must have green browser Verify, preview deployment, and iOS
verification checks.

## MVP iOS completion gate

The PR is ready for requested review only when:

- the custom-scheme persistence gate has passed, or the design and
  implementation have both moved to a proven fallback;
- every pushed feature commit has a successful check run or is superseded by a
  documented CI-only correction;
- the PR head has green browser, deploy-preview, and iOS checks;
- all native integration occurs through the versioned allowlist and Swift
  contains no appetite-domain persistence model;
- an app built from a clean checkout completes the primary journey without a
  network connection;
- deleting projection stores demonstrates recovery from immutable events;
- Delete Everything clears source events, projections, photos, WebKit caches,
  notifications, native preferences, and temporary exports;
- phone-primary XCUITest evidence and release artifacts are attached;
- unavailable physical-device and signing checks are explicitly unchecked,
  never implied by simulator success; and
- the PR description lists architecture, delivered scope, migrations,
  privacy/network behavior, deliberate non-goals, exact flake verification
  commands, preview URL, and remaining human release checks.

At that point request review without merging the branch.
