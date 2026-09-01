# MVP Remediation Plan

This plan closes the functional, verification, and release-readiness gaps found
in the post-beta audit. It preserves the product boundaries in `MVP_DESIGN.md`,
keeps the append-only event sequence authoritative, and delivers every repair as
a reviewable tracer bullet rather than as an unverified horizontal rewrite.

The implementation source of truth remains, in priority order:

1. `MVP_DESIGN.md` for product boundaries and evidence rules;
2. `IOS_DESIGN.md` for native ownership and offline security boundaries;
3. `UX_DESIGN.md` for screen behavior, language, and accessibility;
4. this plan for audited remediation scope; and
5. `E2E_GUIDE.md` for deterministic journey evidence.

## Delivery rules

- Use `flake.nix` for every environment, build, audit, simulator, App Store, and
  test command. Fix a missing or brittle command in the flake instead of adding
  an ad-hoc environment script.
- Keep source events authoritative. Settings, episodes, insights, experiments,
  and program state are changed only by appending events; IndexedDB projections
  remain disposable caches rebuilt by deterministic playback.
- Make phone portrait the primary screenshot and interaction surface. Add iPad
  evidence where native presentation differs and desktop evidence where the web
  layout differs.
- Each commit must close a user-visible behavior end to end, include its unit
  rules and tracer-bullet test, preserve all earlier tests, and leave the branch
  green before the next commit is pushed.
- Exercise real adapters at their boundary. Browser tests may use deterministic
  clocks and a fake native notification center, but release tests must also prove
  behavior through the packaged `WKWebView`, and physical-device-only claims
  must remain visibly unchecked until performed.
- Never claim that a reminder, export, migration, offline route, or cleanup
  succeeded until the responsible platform confirms it.
- Do not add accounts, cloud synchronization, remote push notifications,
  analytics, weight or calorie targets, diagnoses, causal claims, streaks, or
  other deliberate non-goals while closing these gaps.

## Slice 0: unblock the current settings PR

Commit: `fix(ios): package the settings gear as an offline asset`

- Keep the Settings icon as the committed SVG asset and force Vite to emit it as
  a packaged file instead of embedding its XML namespace in a data URL.
- Retain the release audit's fail-closed remote-URL scan; do not broaden its
  allowlist to accept arbitrary strings following an SVG namespace.
- Verify the asset manifest contains the emitted gear, the packaged application
  makes no remote request for it, Settings renders it in both navigation
  surfaces, and no gear emoji appears.

Tracer bullet: the existing `001-shell-and-onboarding` Settings step verifies
that the rendered mask resolves to an emitted SVG rather than a data URL, then
the native Release payload audit proves the icon is bundled and the native app
contains no unexpected remote URL.

This slice belongs on the current `feat/settings-navigation-build-info` PR. The
remaining slices should begin from its merged head on one remediation branch so
their schema and lifecycle changes are reviewed together.

## Slice 1: make reminders a derived, reconciled schedule

Commit: `fix: reconcile reminders from authoritative app state`

- Define a pure desired-schedule model derived from authorization, selected
  windows, program status, program day/week, paused state, and captured timezone.
- Replace the display-only cadence string with a versioned schedule payload that
  represents week-one prompts, tapered later stages, experiment context, and the
  day-30 stop condition from `MVP_DESIGN.md`.
- Reconcile after onboarding, every switch change, reminder pause/resume,
  program pause/resume/completion, experiment transition, foreground entry,
  timezone change, app upgrade, and Delete Everything.
- Make replacement atomic from the application's perspective: report partial
  native failures, immediately converge to the desired set on retry, and never
  persist a successful state before native confirmation.
- Limit onboarding selections to the designed maximum, label native and browser
  capabilities honestly, and implement a real browser in-app prompt or explicitly
  mark that capability unavailable.

Tracer bullet: `013-reminder-state-reconciliation` activates reminders, changes
windows without an extra apply button, pauses and resumes, advances through all
cadence stages, completes the program, relaunches, and compares the adapter's
stable pending identifiers with the pure desired schedule after each action.

Unit proof: schedule derivation, stage mapping, stable identifiers, idempotent
replacement, partial failure/retry, no duplicate requests, timezone changes,
and program/experiment state transitions.

## Slice 2: complete the native notification lifecycle

Commit: `fix(ios): deliver and diagnose local reminders`

- Install `UNUserNotificationCenterDelegate` before application launch
  completes, opt into visible foreground presentation, and route notification
  responses to Today only after the packaged web app reports application-level
  readiness.
- Expose current authorization status and pending schedule diagnostics through
  the constrained bridge without exposing private domain content.
- Refresh status and reconcile on foreground. Show denied/restricted states in
  Settings with an explicit Open Notification Settings action.
- Add a debug/test-only short-interval notification route so simulator and
  physical-device tests can prove delivery without waiting for fixed day parts.
- Keep notifications local: no APNs registration, push entitlement, background
  mode, or remote payload.

Tracer bullet: expand `NativeReminderUITests` to prove request, pending IDs,
background delivery, foreground presentation, tap-to-Today, denied-settings
recovery, pause/resume, completion cancellation, and relaunch reconciliation.

Release proof: perform and record the physical-device locked/unlocked delivery,
tap, restart, timezone, and TestFlight smoke checks in
`IOS_RELEASE_CHECKLIST.md`.

## Slice 3: repair program lifecycle and calendar progression

Commit: `fix: make program pause and completion authoritative`

- Derive program day and week from local calendar days in the captured IANA
  timezone, including DST transitions, rather than elapsed 24-hour intervals.
- Apply program status consistently: paused programs stop new check-ins and
  reminders while retaining history, resume restores them, and completion is
  derived without requiring a Profile visit.
- Add an explicit, confirmed restart flow after completion while retaining or
  deliberately clearing prior-program history according to the product design.
- Ensure Today, Insights, Profile, experiments, exports, and reminders use the
  same lifecycle projection.

Tracer bullet: `014-program-lifecycle-and-dst` crosses spring-forward and
fall-back boundaries, pauses from Settings, proves Today and reminders pause,
resumes, reaches day 30 without visiting Profile, and completes a confirmed
restart.

## Slice 4: finish onboarding and Settings recovery paths

Commit: `fix: make guidance and preferences reachable`

- Replace the broken `/onboarding?step=scale` link with a reusable scale-help
  destination that existing users can open from Settings and both check-ins.
- Implement the stored reduced-prompt preference and the explicit include-photo
  export preference, defaulting to the privacy-preserving behavior.
- Complete support actions with Pause check-ins, Learn about support, and
  Dismiss, all with reversible and non-judgmental behavior.
- Add notification diagnostics, storage state, migration recovery entry points,
  accessibility preferences, and restart controls to Settings without showing
  build identity elsewhere.

Tracer bullet: `015-settings-and-guidance` completes onboarding once, opens
scale help from every entry point without restarting onboarding, exercises each
preference across reload, and verifies the complete support path.

## Slice 5: enforce insight evidence and history contracts

Commit: `fix: make insights conservative and reproducible`

- Implement recency, actionability, novelty, deduplication, and at-most-one-new-
  primary-insight-per-seven-days rules.
- Complete no-variation, sparse-data, and outlier-created-effect suppression for
  every candidate family.
- Preserve immutable insight snapshots and mark them when source episodes are
  edited or deleted; never silently rewrite the historical result.
- Add observation history with evidence counts, source links, feedback, algorithm
  version, and honest changed/deleted-source labels.
- Recompute current eligibility from event playback while retaining prior
  snapshots as explainable history.

Tracer bullet: `016-insight-history-and-evidence` attempts constant, sparse, and
outlier histories; advances through promotion windows; records feedback; edits
and deletes source events; rebuilds projections; and verifies current results
and historical snapshots remain distinct and reproducible.

## Slice 6: complete experiment timing and Today integration

Commit: `fix: run experiments for their declared interval`

- Show the active experiment as Today's secondary action with pause/stop choices.
- Prevent an experiment from being completed before its declared seven local
  days; automatically make the result available when that interval elapses.
- Keep baseline, target, measure, and eligibility fixed at acceptance, and
  preserve the one-active-experiment invariant through replay and replacement.
- Return an insufficient-data result without losing the history or falsely
  implying a measured change.

Tracer bullet: `017-timed-experiment-on-today` accepts an evidence-backed offer,
uses Today throughout the window, rejects early completion, crosses the calendar
boundary, verifies all three result states, and rebuilds from events.

## Slice 7: make photos, export, and storage failures explicit

Commit: `fix: preserve check-ins through storage pressure`

- On photo processing or quota failure, save the sensation event, omit the photo,
  announce exactly what happened, and offer Manage Data for both create and edit.
- Revoke replaced preview object URLs and clean orphaned photo blobs after edits,
  deletion, failed transactions, and Delete Everything.
- Keep exports photo-free by default. When the user explicitly opts in, include
  photos only in a documented, size-bounded format and report native share errors.
- Verify JSON and HTML exports against source events, escaping, schema version,
  photo policy, temporary-file protection, and cleanup.

Tracer bullet: `018-storage-and-private-export` forces quota failures on create
and edit, proves the episode survives, toggles explicit photo inclusion, inspects
both export formats, cancels native sharing, and verifies cleanup after relaunch.

## Slice 8: provide migration recovery and dependable offline updates

Commit: `fix: recover local data and version the offline shell`

- Catch repository/schema startup failures and show the designed recovery state
  with Export Original Data and deliberate Reset actions.
- Test supported in-place event/schema migrations while deleting projection
  stores to prove that migrated source events remain authoritative.
- Generate a versioned service-worker precache manifest from the production
  build, including every hashed asset and application route required offline.
- Delete obsolete caches on activation, use a navigation fallback, and adopt an
  update strategy that cannot pin stale HTML indefinitely.
- Keep service workers absent from the packaged iOS build and retain its signed
  asset-manifest audit.

Tracer bullet: `019-migration-offline-update` upgrades seeded old data, recovers
from unsupported data by exporting it, installs version A offline, updates to
version B, visits every primary route without network, and confirms obsolete
assets are removed.

## Slice 9: harden the native bridge and release toolchain

Commit: `test(ios): close native shell tracer gaps`

- Introduce an explicit web `app.ready` handshake and queue lifecycle or
  notification navigation until it arrives.
- Expand bridge UI tests to reject malformed, oversized, wrong-origin,
  wrong-version, subframe, and unknown commands through the real packaged app.
- Expand persistence tests to cover in-place upgrade and projection deletion;
  export tests to inspect JSON/HTML and iPad presentation; and privacy tests to
  seed events, projections, photos, reminders, caches, and temporary exports.
- Select an available simulator deterministically in `flake.nix` and CI instead
  of coupling `OS=latest` to a model that may not exist in that runtime.
- Keep Xcode generation, app packaging, release URL/entitlement auditing, test
  invocation, artifacts, signing, TestFlight, and App Store operations behind
  flake applications.

Tracer bullet: `OfflineReleaseJourneyUITests` completes the phone-first journey
through the packaged app with network denied, terminates Web Content, relaunches,
upgrades in place, shares exports, and deletes every private-data layer.

## Slice 10: certify appearance, accessibility, and physical release behavior

Commit: `test: certify the remediated MVP`

- Implement follow-system dark appearance with sufficient contrast in both the
  SPA and native loading/recovery surfaces.
- Verify 200% text, smallest and largest supported phones, landscape, iPad,
  reduced motion, forced colors, hardware keyboard, focus restoration, semantic
  labels, and VoiceOver reading/action order.
- Run all browser scenarios, native unit and UI tests, static/offline audits,
  clean-console checks, and zero-private-network checks from a clean checkout.
- Complete the oldest/current iOS, real camera, low-storage, restart, in-place
  upgrade, locked/unlocked notification, notification tap, and TestFlight smoke
  items on physical devices. Do not mark unavailable evidence complete.
- Update product, UX, implementation, E2E, privacy, support, and release
  documentation to match the verified behavior exactly.

Tracer bullet: `020-accessible-release-journey` completes onboarding, paired
check-in, insight review, experiment, profile, reminder control, export, and
deletion on a phone using accessibility navigation, then repeats layout-critical
states across the required appearance and size matrix.

## Audit-to-slice coverage

| Observed gap | Closing slice |
| --- | --- |
| Release audit mistakes inline SVG namespace for a remote URL | 0 |
| Pause/resume, switch changes, completion, and partial reminder replacement | 1 |
| Cadence discarded and browser prompt claim inaccurate | 1 |
| Foreground notification, tap routing, permission recovery, diagnostics | 2 |
| Program pause/resume/completion/restart and DST progression | 3 |
| Broken scale help, unused preferences, incomplete support actions | 4 |
| Insight gates, promotion cadence, snapshots, source changes, history | 5 |
| Active experiment missing from Today and premature completion | 6 |
| Silent photo failure, edit fallback, export photo option, cleanup | 7 |
| Startup recovery, projection migration, stale/incomplete PWA cache | 8 |
| Missing app-ready contract and incomplete native tracer bullets | 9 |
| Brittle simulator selection and incomplete release automation | 9 |
| Missing dark mode, accessibility matrix, and physical-device evidence | 10 |

## Completion gate

Remediation is complete only when:

- every row in the coverage table has an implemented slice and passing tracer
  bullet;
- source projections can be deleted and rebuilt from events after every relevant
  schema change;
- reminder state shown in Settings matches the native pending request set after
  every lifecycle transition;
- all numbered browser and native journeys pass through flake commands from a
  clean checkout;
- the Release payload audit finds no undeclared resource, remote URL, fixture,
  source map, service worker, or unexpected entitlement;
- the PR head has green browser verification, iOS verification, and retained
  preview deployment checks; and
- physical-device-only checklist items are either completed with recorded build
  evidence or explicitly reported as remaining blockers.
