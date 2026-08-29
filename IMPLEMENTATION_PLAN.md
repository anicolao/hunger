# MVP Implementation Plan

This plan turns the approved product, UX, and end-to-end contracts into a
reviewable sequence of tracer-bullet commits. Each commit must leave the
application usable, keep all earlier scenarios passing, and include the domain
rules, real IndexedDB path, accessible UI, unit coverage, Playwright journey,
phone-first walkthrough, and reviewed phone/desktop screenshots needed for its
capability.

The implementation source of truth remains, in priority order:

1. `MVP_DESIGN.md` for product boundaries and domain rules;
2. `UX_DESIGN.md` for screen behavior, copy, layout, and accessibility; and
3. `E2E_GUIDE.md` for verification and deterministic test behavior.

## Delivery rules

- Work on one pull-request branch: `feat/mvp`.
- Make each commit a complete user capability, not a horizontal layer.
- Push a commit as soon as its local verifier passes so hosted CI can run while
  the next slice is prepared.
- Before pushing the next commit, confirm that CI for the prior commit is green.
- Do not hide missing or changed Linux screenshots. CI publishes candidates;
  inspect them, add the approved files to the same slice, and rerun normally.
- Domain modules accept explicit time and IDs and do not import Svelte or
  browser globals.
- Browser scenarios use the real IndexedDB repository. Long histories enter
  through a versioned, development-only fixture boundary and are then read by
  normal application code.
- No commit may add remote private-data transport, third-party runtime scripts,
  calories, weight targets, streaks, diagnoses, causal claims, or moral labels.
- `bun run verify:change` is the local completion gate. The hosted `Verify` and
  `Deploy preview` jobs are the remote gate.

## Commit sequence

### 0. `docs: plan MVP implementation slices`

Record this plan, create the MVP branch, open the pull request, and establish
the CI/preview feedback loop before feature work begins.

Verification:

- existing scenario `001` remains green;
- production static build remains green; and
- the PR receives its retained `/pr<number>/` preview comment.

### 1. `feat: activate the local-first 30-day program`

Deliver the first-launch journey and real application shell:

- typed schema and IndexedDB repository for `Program`, `EatingEpisode`,
  settings, insights, experiments, and photos;
- deterministic clock and ID boundaries used by tests;
- four-step onboarding with an exploratory unified scale;
- local-only/privacy and safety explanations with reminders optional;
- activation that persists a program and opens Day 1 Today;
- responsive mobile bottom navigation and wide sidebar; and
- honest empty Today, Insights, and Profile destinations.

Tracer bullet: extend `001-shell-and-onboarding` from the public promise through
all four onboarding steps, reload, and verify the persisted Day 1 Today shell.

Unit proof: scale mapping/validation, elapsed program day/week, and repository
round-trip/migration primitives.

### 2. `feat: complete and manage paired check-ins`

Deliver the smallest useful recording loop:

- reusable accessible `SensationScale` with no default;
- create a before-eating episode and persist the pending state;
- finish it with the identical-direction after scale;
- optional reason, occasion, 140-character note, and local processed photo;
- open-episode collision choices and four-hour unfinished behavior;
- Today history plus episode review, edit, delete, and physical photo removal;
- transactional saving/error states that retain form values.

Tracer bullets:

- `002-before-eating-check-in` proves touch, keyboard, words, save, reload, and
  the pending completion affordance;
- `003-after-eating-check-in` proves pairing, optional context, note limit,
  photo cleanup/failure behavior, and non-judgmental contradictory answers;
- `004-today-correction-and-incomplete` proves local ordering, edit,
  unfinished handling, deletion, reload, and export absence.

Unit proof: episode invariants, timeouts/recall, scale copy, photo constraints,
and delete semantics.

### 3. `feat: surface the first evidence-backed observation`

Deliver the first hypothesis checkpoint:

- pure median/rate helpers and versioned structured insight results;
- four-pair evidence gate for typical-start and typical-end observations;
- honest “Still learning” progress below the gate;
- evidence counts, included episode links, neutral templates, and non-causal
  explanation;
- persisted insight snapshot and Helpful/Not for me feedback; and
- immediate eligibility recomputation after episode edit or deletion.

Tracer bullet: `005-first-week-insight` begins at three pairs, adds the fourth
through the UI, verifies the exact structured observation/evidence disclosure,
records feedback, then proves a deletion removes eligibility.

Unit proof: medians, sparse/constant/outlier suppression, evidence gates,
complete structured results, copy strength, and recomputation.

### 4. `feat: progress through recurring appetite patterns`

Deliver elapsed-time learning and the conservative candidate library:

- day/week progression from captured timezone without streak resets;
- time buckets and optional occasion grouping;
- urgent-start, comfortable-start, difficult/easy context, and self-described
  non-hunger candidates;
- recurring thresholds, effect-size gates, ranking, novelty, and deduplication;
- at most one newly promoted primary observation per seven days; and
- reminder preferences whose displayed cadence tapers by stage.

Tracer bullet: `006-progression-and-recurring-patterns` imports a fixed history,
crosses each week boundary, verifies no missed-day shame/reset, validates a
recurring comparison and its evidence, and confirms reminder taper copy.

Unit proof: DST-safe bucketing, stage boundaries, every candidate/gate,
ranking/deduplication, rate thresholds, and reminder cadence.

### 5. `feat: run one supported noticing experiment`

Deliver the complete optional experiment lifecycle:

- eligibility only from a passed insight gate;
- one-active-experiment invariant and fixed target definition;
- offer, why-this evidence, accept, not-now, replace, pause, and stop paths;
- fixed recent baseline and seven elapsed-day intervention window; and
- “Appeared to change,” “Appeared similar,” and “Still learning” comparisons
  using only the predeclared measure and non-causal wording.

Tracer bullet: `007-experiment-lifecycle` verifies the highest-priority offer,
freedom to decline/replace, one active record, and all three result states from
deterministic fixtures.

Unit proof: offer mapping, ranking, invariant enforcement, window membership,
sample gates, and meaningful-change thresholds.

### 6. `feat: assemble the day-30 Appetite Profile`

Deliver the finite-program payoff:

- progressive Profile cards with honest missing-evidence states;
- day-30 summary containing only supported start, finish, context, reason, and
  experiment sections with per-section counts;
- two or three continuing practices derived only from observed patterns;
- program completion without data lockout; and
- human-readable HTML and structured JSON exports, excluding photos by
  default.

Tracer bullet: `008-day-30-appetite-profile` imports a complete history,
verifies supported and sparse sections, completes the program, exports both
formats, and confirms photos are absent by default.

Unit proof: profile section gates, practice selection, stable export schema,
escaping, and photo redaction.

### 7. `feat: complete privacy, offline, reminders, and support`

Deliver the platform and data-lifecycle contract:

- installable offline application shell and accurate offline status;
- supported schema migration and recoverable unsupported-schema state;
- settings for reminders, scale help, storage, export, pause, and support;
- capability-based in-app/native reminder adapter with no false scheduling
  claims;
- one-entry and deliberate delete-all flows that verify all stores, caches,
  preferences, photos, and scheduled reminders are empty;
- quota-safe photo behavior that preserves the sensation record; and
- calm repeated-extreme-discomfort support card with dismissal/pause.

Tracer bullets:

- `009-persistence-offline-and-privacy` proves reload/offline survival,
  migration, quota degradation, export, individual deletion, delete-all, and
  zero private external requests;
- `011-safety-and-non-judgmental-states` proves the quiet support path, pause,
  dismissal, and forbidden-copy scan; and
- `012-reminder-adapter-and-graceful-degradation` proves user-triggered
  permission, exact adapter payload, tapering, and honest unsupported-browser
  behavior.

Unit proof: migrations, export redaction, cache/store cleanup coordination,
support eligibility/dismissal, and reminder capability/cadence.

### 8. `test: certify the complete accessible MVP journey`

Finish integration without introducing new product scope:

- keyboard and focus restoration across the complete journey;
- polite status announcements and associated error summaries;
- phone portrait/landscape, tablet, desktop, 200% text, reduced motion, forced
  colors, and safe-area checks;
- restrictive application CSP and production fixture-hook exclusion;
- final non-judgmental copy audit and documentation synchronization; and
- complete static production/offline build verification.

Tracer bullet: `010-responsive-and-accessible-journey` completes activation,
paired check-in, insight review, experiment start, and profile review by
keyboard at every required viewport, with layout/target/focus assertions.

Regression proof: scenarios `001–012`, every unit suite, type/Svelte checks,
production build, whitespace validation, clean browser console, and no
unexpected network access.

## MVP completion gate

The pull request is ready for review only when:

- every commit reachable on `feat/mvp` has a successful hosted verification
  run after its final form was pushed;
- the current head has green `Verify` and `Deploy preview` checks;
- the retained preview completes the primary journey without console errors;
- all twelve numbered scenario walkthroughs and reviewed Linux/macOS baselines
  are present;
- the PR description lists delivered scope, deliberate non-goals, migrations,
  privacy behavior, and exact verification commands; and
- a review is explicitly requested without merging the branch.
