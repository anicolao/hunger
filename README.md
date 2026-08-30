# Learn Your Appetite

Learn Your Appetite is a 30-day program for noticing hunger, fullness,
and eating context without counting calories. A check-in takes about ten
seconds; the product earns its place by turning those check-ins into useful,
personal observations and one small experiment at a time.

> Notice → Understand → Experiment → Learn

This repository contains the complete static MVP: onboarding, paired local
check-ins, explainable insights, one noticing experiment, a day-30 Profile,
offline support, private exports and deletion, reminders, and safety controls.

## The MVP promise

> Learn when you are genuinely hungry, what comfortable fullness feels like,
> and what tends to precede uncomfortable fullness—without calorie or nutrient
> tracking.

The important hypothesis is not whether someone will log temporarily. It is
whether four to seven days of lightweight, paired before/after check-ins can
produce a personal insight that feels useful enough to continue.

The MVP therefore prioritizes, in order:

1. clear and fast sensation check-ins;
2. trustworthy, explainable personal insights;
3. one relevant experiment and an honest comparison with the prior pattern;
4. a useful 30-day Appetite Profile; and
5. polish that improves comprehension, accessibility, and confidence.

## What a user does

- Before eating, choose a point on a unified 1–10 hunger/fullness scale.
- After eating, choose a point on the same scale.
- Optionally add why they ate, a short note, an occasion, or a photo.
- Review an early observation as soon as enough paired entries exist.
- Try one small experiment, such as pausing midway through an evening meal.
- At day 30, review an Appetite Profile of recurring and changed patterns.

The same scale is used before and after so its direction never changes:

- `1` means urgent or extreme hunger;
- `5` means neutral—neither hungry nor full;
- `6–7` means satisfied or comfortably full; and
- `10` means painful or sickening fullness.

Every input shows words as well as numbers. The numbers are observations, not
grades, goals, or evidence of eating “right” or “wrong.”

## Product principles

- **Learning, not restriction.** There are no calorie, macro, weight, fasting,
  portion, or food-quality targets.
- **Insight, not surveillance.** Only a sensation score is required. Notes,
  reasons, occasion labels, photos, feedback, and reminders are optional.
- **Evidence before claims.** Every insight states what records support it and
  uses tentative language when data is sparse.
- **One experiment at a time.** Experiments invite noticing; they never tell a
  user to ignore hunger or continue eating through discomfort.
- **Less tracking over time.** Prompts deliberately taper as the user learns.
- **Private by default.** MVP data remains on the device, with export and true
  deletion controls. Notes and photos are never sent to an AI service.
- **Non-judgmental by design.** No shame copy, compliance streaks, moral color
  coding, diagnoses, or congratulation for eating less.

## Scope

The MVP includes onboarding, paired check-ins, Today, Insights, one active
Experiment, the 30-day Appetite Profile, local persistence, optional local
photos, data export/deletion, accessibility, and a safe path to professional
support.

It deliberately excludes calorie and nutrient databases, recipes, weight-loss
targets, social features, wearables, coaching, an AI chat interface, elaborate
journaling, and physiological or diagnostic claims.

## Technical foundation

The neighboring `food` and `games/jaipur` apps establish the workspace's
preferred delivery contract. The implemented MVP follows it where it fits this
product:

- SvelteKit 5, strict TypeScript, Bun, and `@sveltejs/adapter-static`;
- a static installable PWA with a thin native shell only if scheduled local
  notifications are required for the pilot;
- an append-only IndexedDB event sequence as the local source of truth;
- disposable IndexedDB read-model caches rebuilt by deterministic playback;
- local compressed photo blobs carried by the corresponding source events;
- pure, versioned insight and experiment functions—no generative model;
- plain Svelte-scoped CSS with global design tokens;
- Vitest for scale, projection, insight, experiment, and migration rules;
- deterministic Playwright vertical slices with phone-first walkthroughs and
  secondary desktop regression coverage;
- semantic assertions plus zero-pixel visual baselines; and
- one repository verifier that runs checks, tests, build, and whitespace
  validation before a change lands.

Unlike the two realtime reference apps, Learn Your Appetite does not need a
cloud event stream for its first hypothesis. It does retain their core event
sourcing rule locally: user actions append immutable, versioned events, and
all `Program`, `EatingEpisode`, insight, experiment, photo, and settings records
are materialized projections. Application code cannot write those caches.

## Documentation

- [VISION.md](VISION.md) — original product direction and boundaries
- [MVP_DESIGN.md](MVP_DESIGN.md) — flows, screens, data model, insight rules,
  architecture, safety, and delivery slices
- [UX_DESIGN.md](UX_DESIGN.md) — navigation, interaction details, visual system,
  responsive behavior, accessibility, copy, and generated screen mockups
- [E2E_GUIDE.md](E2E_GUIDE.md) — acceptance scenarios and deterministic browser
  test contract
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — coherent commit sequence,
  tracer bullets, and MVP completion gate
- [IOS_DESIGN.md](IOS_DESIGN.md) and
  [IOS_IMPLEMENTATION_PLAN.md](IOS_IMPLEMENTATION_PLAN.md) — offline native
  shell design, tracer bullets, and release gates
- [TESTFLIGHT_SETUP.md](TESTFLIGHT_SETUP.md) — flake-managed Apple handoff,
  signed archive, upload, processing, and internal distribution

## Source material

The product design was informed by:

- `HungerandFullnessScaleJul2023.pdf`, a U.S. Department of Veterans Affairs
  hunger/fullness reference;
- `hunger-and-fullness-signals.pdf`, an Alberta Health Services handout; and
- `Hunger scale.jpg`, an additional scale image of unknown provenance.

These are research inputs, not application assets. The Alberta handout is
marked CC BY-NC-ND 4.0, and the image's reuse rights are unknown. Do not copy
their layouts or wording into the product. MVP copy and artwork must be
original, with clinical and legal review before a public health-related launch.

## PDF review environment

The Nix development shell provides Poppler, QPDF, OCRmyPDF, Tesseract,
ImageMagick, ExifTool, and Ghostscript:

```sh
nix develop
pdfinfo HungerandFullnessScaleJul2023.pdf
pdftotext -layout hunger-and-fullness-signals.pdf -
```

The same locked shell includes Bun and Playwright for application development:

```sh
bun install --frozen-lockfile
bun run dev
bun run verify:change
```

The development server runs at `http://127.0.0.1:5190`.

## Deployments

Every pull request is verified and published to a retained GitHub Pages path at
`https://anicolao.github.io/hunger/pr<PR number>/`. The deployment workflow
creates or updates a clearly marked comment on the pull request so its preview
is always one click away. A new preview replaces the prior build for that PR;
previews for other open PRs remain intact.

After a change lands on `main`, the same verified static build is published to
`https://anicolao.github.io/hunger/`.

Linux visual baselines are reviewed artifacts, not silently accepted by CI.
When a new scenario has no Linux baseline, the first run uploads candidate
screenshots and asks the contributor to inspect and commit them. Later runs
compare against those committed images with a zero-pixel tolerance.

## Safety boundary

Learn Your Appetite is a self-reflection tool, not medical care and not an
eating-disorder treatment. Hunger and fullness signals differ across people
and can be affected by inadequate intake, illness, medication, stress, and
other factors. The app should gently direct someone to a qualified healthcare
professional if eating feels out of control, produces guilt or distress,
regularly ends in extreme discomfort, or if body-signal tracking itself feels
unhelpful.

The app must never diagnose emotional eating, claim to repair hormones or
satiety, or present a personal correlation as a cause.

## License

Original project documentation, code, and generated design mockups are
Copyright (C) 2026 Alex Nicolaou and licensed under the [GNU General Public
License version 3 only](LICENSE).

The research PDFs and `Hunger scale.jpg` are not original project works and are
not relicensed by this repository. Their original notices and terms continue
to apply. In particular, the Alberta Health Services handout is marked
CC BY-NC-ND 4.0, and the JPEG's provenance is unknown.
