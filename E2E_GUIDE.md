# End-to-End Testing Guide

Playwright scenarios are the primary proof of every user-visible MVP flow.
Vitest proves the many data and algorithm cases that do not need a browser;
Playwright proves that a real user can complete the journey through the real
UI and storage adapter.

This contract adapts the strongest patterns in `../food` and
`../games/jaipur`: numbered vertical slices, one atomic verification/screenshot
step API, generated phone-first walkthroughs, fixed browser conditions, real
persistence, multiple viewports, and reviewed pixel-exact baselines.

## Quality contract

Every user-facing implementation slice includes:

1. the smallest coherent user capability;
2. any schema, domain, insight, or migration change it needs;
3. unit coverage for pure rules and edge cases;
4. accessible UI at every affected state;
5. a Playwright tracer bullet through the real UI;
6. semantic assertions and reviewed screenshots; and
7. updates to the affected product or test documentation.

A UI backed only by mock state, unused domain code, or an algorithm without a
visible browser proof is not a complete slice.

## Determinism and visual regression

Canonical CI screenshots are produced on Linux. Local macOS screenshots use a
platform suffix so rendering differences never require tolerance. Within a
platform, screenshots have zero-pixel tolerance:

```ts
expect: {
  toHaveScreenshot: {
    maxDiffPixels: 0,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css'
  }
}
```

Tests fix all sources of variation:

- clock and date;
- `America/Toronto` timezone and `en-CA` locale;
- device scale factor `1`;
- phone and desktop viewport dimensions;
- reduced-motion preference;
- insight and experiment algorithm versions;
- fixture IDs, timestamps, reasons, occasions, and photo bytes;
- browser rendering flags and repository-managed fonts; and
- random IDs through an injected deterministic ID factory in E2E mode.

No test may loosen screenshot tolerance, mask dynamic content, accept an
unreviewed baseline, rely on a retry, or use a random production value.

## Test layout

Each user journey owns a numbered directory, scenario, generated walkthrough,
and screenshots:

```text
tests/e2e/
  helpers/
    fixture-builder.ts
    test-step-helper.ts
  001-shell-and-onboarding/
    001-shell-and-onboarding.spec.ts
    README.md
    screenshots/
```

The shared `TestStepHelper.step()` must perform one atomic documented step:

1. wait for an observable ready state;
2. run semantic and accessibility assertions;
3. check relevant layout invariants;
4. compare the deterministic screenshot; and
5. record the step for the generated scenario `README.md`.

Tests never manage screenshot counters or walkthrough text independently.
Scenario walkthroughs are generated only from the canonical phone run and must
not be hand-edited. Desktop screenshots remain reviewed secondary regression
evidence, but the documentation always presents the primary phone form factor.

## Browser projects

Run every core scenario in Chromium at:

| Project | Viewport | Purpose |
| --- | ---: | --- |
| `phone` | 393 × 852 | Primary one-handed experience and canonical walkthrough |
| `desktop` | 1280 × 900 | Secondary wide responsive regression |

Run the responsive/accessibility scenario additionally at:

| Project | Viewport |
| --- | ---: |
| `mobile-landscape` | 852 × 393 |
| `tablet` | 820 × 1180 |

Use Chromium software-rendering flags equivalent to the reference apps.
Repository-managed fonts prevent host font drift.

## Storage, network, and service workers

- Reset IndexedDB, Cache Storage, local storage, and notification permission
  state before every scenario.
- Exercise the real IndexedDB adapter. Do not replace it with an in-memory
  store for ordinary E2E tests.
- Treat the append-only `events` store as the only source of truth. Entity
  stores are disposable projections and may only be cleared and rewritten by
  deterministic event playback.
- Seed long histories through a versioned E2E fixture import that translates
  fixtures into source events, force a replay, then verify the projection
  through the normal UI. The import/replay hook must be tree-shaken or disabled
  in production builds.
- Block every external request. An MVP test must never upload a photo, call an
  analytics endpoint, or touch production data.
- Block service workers in normal scenarios to avoid stale assets. Use one
  isolated PWA/offline project to test installation, cached shell behavior,
  and upgrades deliberately.
- Stub only platform boundaries the browser cannot provide deterministically:
  notification scheduling, native share/export, and camera/photo selection.
  Assert the full payload sent to each adapter.

## Waiting and selectors

- Use roles, labels, visible copy, and stable state attributes. Test IDs are
  reserved for values with no useful accessible selector, such as a build
  marker.
- Wait on user-visible state with Playwright's auto-waiting assertions.
- Never use `waitForTimeout`, sleeps, arbitrary polling intervals, or a timeout
  increase to hide a race.
- Configure no retries and forbid focused or skipped tests in every run.
- A domain operation exposes a stable status such as `ready`, `saving`,
  `saved`, or `error`; tests wait on that status rather than elapsed time.

## Semantic and layout assertions

A screenshot supplements assertions; it does not replace them. Each step
checks the data and behavior that matter, including:

- the selected scale value and its text anchor;
- matching of before and after entries into one episode;
- evidence counts and computed values behind every insight;
- the exact experiment and comparison state;
- persistence after reload and offline reopening;
- focus placement, live-region announcements, and keyboard operation;
- 44 × 44 CSS-pixel minimum touch targets;
- no horizontal overflow or clipped interactive controls;
- no overlap between sticky actions and content; and
- text alternatives that do not depend on color, icons, or photos.

Long Today and Insights pages may scroll vertically. Check-in, permission, and
confirmation surfaces must keep their primary action visible at the phone
viewport without an accidental nested scroll region.

## Scenario map

### 001 — Shell and onboarding

- First scaffold increment: load the responsive public landing state and prove
  the 30-day promise, unified scale direction, learning loop, local-first
  framing, keyboard focus, target sizes, and deterministic build marker.
- Keep this scenario and its walkthrough as onboarding is implemented; extend
  it rather than replacing the landing tracer bullet.
- Load a clean install and show the 30-day promise.
- Explain the unified scale, learning-not-restriction framing, local storage,
  and safety boundary.
- Decline optional photos and reminders without blocking activation.
- Complete onboarding and show week 1 on Today.

### 002 — Before-eating check-in

- Start from Today, choose a sensation with one tap, and save.
- Verify the persistent “finish this check-in” affordance.
- Prove that score words and direction are unambiguous.
- Prove keyboard and touch operation.

### 003 — After-eating check-in

- Finish the open episode, select a post-eating sensation, and save.
- Add and omit each optional field in representative paths.
- Verify the reason taxonomy, short-note limit, local photo compression, and
  return to Today.
- Confirm that contradictory-looking answers are accepted without correction
  or judgment.

### 004 — Today, correction, and incomplete episodes

- Display completed and unfinished entries in local-time order.
- Edit a mistaken score and recompute derived content.
- Abandon a forgotten open entry without inventing an after score.
- Append a deletion tombstone, then verify the entry and photo are absent from
  the replayed projection after reload and from export.

### 005 — First-week insight

- Begin below the minimum evidence threshold and show exactly what is still
  needed.
- Add the qualifying paired entry through the UI.
- Generate a deterministic early observation with evidence count, neutral
  wording, and no causal claim.
- Record optional helpful/not-helpful feedback.

### 006 — Progression and recurring patterns

- Cross week boundaries using a fixed clock and local timezone.
- Preserve access after missed days; never reset or shame the user.
- Show hunger, fullness, context, and personal-pattern lessons at the intended
  stages.
- Verify that reminder frequency tapers according to settings.

### 007 — Experiment lifecycle

- Offer the highest-priority eligible experiment and explain why.
- Start, skip, or replace it without penalty.
- Keep only one active experiment.
- Show “too little data,” “appears similar,” and “appears changed” results from
  fixed baseline/intervention fixtures.

### 008 — Day-30 Appetite Profile

- Build all supported profile sections from a complete deterministic history.
- Distinguish observations, missing evidence, and patterns that changed.
- Complete the program without locking the user out of their data.
- Export a human-readable summary and structured JSON without photos by
  default.

### 009 — Persistence, offline use, and privacy controls

- Reload and reopen offline with no record loss.
- Handle storage quota failure while preserving the score without the photo.
- Migrate the prior supported schema fixture.
- Export, delete one episode, and delete all data.
- Verify no external network request contains private data.

### 010 — Responsive and accessible journey

- Complete onboarding, paired check-in, insight review, experiment start, and
  profile review by keyboard.
- Run at phone portrait, phone landscape, tablet, and desktop sizes.
- Check focus visibility/order, status announcements, headings, labels,
  contrast, reduced motion, zoom resilience, safe areas, and target sizes.

### 011 — Safety and non-judgmental states

- Display the support path after repeated extreme discomfort without a
  diagnosis or alarmist claim.
- Pause reminders and tracking immediately.
- Search rendered product copy for forbidden calorie, weight, compliance,
  causal, diagnostic, and moralizing phrases.
- Verify that extreme values do not trigger praise, punishment, or food advice.

### 012 — Reminder adapter and graceful degradation

- Request permission only after a user action and explain the value first.
- Schedule only the reminder windows the user chose.
- Verify the native local-notification payload through its adapter contract.
- On an unsupported browser, show persistent in-app prompts and accurate copy;
  never claim a closed-browser reminder was scheduled.

## Unit-test boundary

Use Vitest, not browser scenarios, to exhaustively cover:

- score validation and scale copy mappings;
- local-time bucketing and daylight-saving boundaries;
- episode completion, edits, deletion, and schema migration;
- medians, rates, evidence thresholds, ties, and missing data;
- every insight candidate and suppression rule;
- experiment ranking and baseline/intervention comparison;
- day/week progression and reminder tapering; and
- export redaction and photo cleanup.

Every insight fixture should assert the complete structured result, not only
rendered prose. A copy change must not silently change the underlying evidence.

## Commands after scaffold

The application scaffold should expose one verification contract:

```sh
bun run check
bun run test:unit
bun run test:e2e
bun run build
bun run verify:change
```

`verify:change` runs all four commands plus `git diff --check`, exits on the
first failure, and is invoked by repository hooks and CI. Snapshot updates use
a separate explicit command and are always followed by an ordinary test run.
