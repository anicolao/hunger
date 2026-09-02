# Learn Your Appetite — UX Overhaul

Status: proposed direction for approval. This document changes presentation,
navigation depth, and copy density only. It does not authorize implementation
or change the product, evidence, privacy, or event-sourcing contracts in
`MVP_DESIGN.md`.

## 1. Why this overhaul

The current application is functionally complete, but too often reads like a
well-formatted document instead of feeling like a focused iOS app:

- important actions compete with explanatory copy;
- Today and Settings stack several full cards into long pages;
- the check-in repeats its question and uses vertical space for guidance that
  is no longer needed after onboarding;
- Insights exposes history and methodology before the user asks for it;
- Settings expands every concern on one route instead of acting as a hub; and
- the visual hierarchy is calm but flat, formal, and weakly tactile.

The overhaul should make the common loop feel like **glance, tap, done**. It
should preserve calmness without making every screen look like a policy page.

## 2. Desired experience

The application should feel:

- **immediate** — the next useful action is apparent within one glance;
- **compact** — the first viewport contains the decision, its essential
  context, and its primary action;
- **tactile** — controls have depth and clear pressed, selected, and focused
  states;
- **human** — copy is conversational, short, and concrete;
- **personal** — light and dark appearances feel intentionally designed, not
  like one palette inverted by the browser;
- **native-minded** — safe areas, tab navigation, sheets, switches, action
  placement, and hierarchy follow familiar iOS conventions; and
- **quiet** — no streaks, gamification, urgency, food judgment, or ornamental
  animation.

The core loop remains unchanged:

```text
Notice → Understand → Experiment → Learn
```

## 3. Proposed visual direction

![Theme choice and redesigned Today screens](design/ux-overhaul/01-theme-and-today.png)

The first board establishes the install-time appearance choice and the shared
Today hierarchy. Both modes use identical information architecture and
semantics.

### Light — warm liquid glass

Light mode evolves the current warm ivory and teal system:

- a warm, lightly tinted content canvas;
- restrained mint and apricot ambient shapes behind content;
- mostly solid or softly translucent content surfaces;
- liquid-glass treatment on the floating tab bar, primary controls, sheets,
  and other functional layers; and
- deep-teal type and controls with sparing apricot emphasis.

Glass is not a card style applied everywhere. Apple describes Liquid Glass as
a distinct functional layer for controls and navigation, and recommends using
it sparingly rather than throughout the content layer. This proposal follows
that separation. See [Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)
and [Liquid Glass overview](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass).

### Dark — nano-banana glass

“Nano-banana” is a project shorthand, not a formal platform design system. For
this application it means:

- a deep charcoal-forest canvas rather than pure black;
- slow, abstract mint, aqua, and banana-lime light fields;
- frosted functional surfaces with crisp rims and subtle refraction;
- luminous mint actions and tiny lime emphasis;
- enough opaque backing to preserve text contrast; and
- premium depth without neon cyberpunk clutter.

Dark mode may use a richer glass treatment than light mode, but content must
remain readable when transparency is reduced, contrast is increased, or
motion is disabled.

### Material hierarchy

| Layer | Purpose | Treatment |
| --- | --- | --- |
| Canvas | Sense of place | Warm ambient fields in light; restrained luminous fields in dark |
| Content | Reading and evidence | Solid or high-opacity surfaces; minimal blur |
| Controls | Navigation and action | Regular glass, distinct outline, strong foreground |
| Transient UI | Sheets, menus, confirmations | Glass over a dimmed content layer |

The background can infuse controls, but controls may never become difficult to
locate. The most important content remains near the top in reading order, in
line with [Apple's layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout).

## 4. Appearance choice

Appearance is the first explicit choice on first launch and is available later
from Settings.

1. Infer a preview selection from the device appearance.
2. Show two large, live preview tiles: **Light** and **Dark**.
3. Require one clear confirmation action: **Use light mode** or **Use dark
   mode**.
4. State only: **Pick what feels good. Change it anytime.**
5. Continue into the existing scale and learning explanation.

The choice does not activate the program or create a synthetic user event. It
stays in temporary onboarding state until activation, then is recorded through
the authoritative settings event path. Changing it later also appends a
settings event; no projection is edited directly.

There are two product themes, not a third “system” mode. Device appearance is
used only for the initial selection. This keeps the first choice legible and
ensures that a user who deliberately chooses dark does not unexpectedly change
appearance later.

## 5. The decision viewport

The primary design unit is a `393 × 852` point phone viewport including safe
areas and the bottom navigation. Every common task must expose the following
without scrolling at standard text size:

1. where the user is;
2. the one decision being asked;
3. enough context to make it safely; and
4. the primary action.

### Above-fold contract

- A screen with a primary CTA must show the complete CTA before the bottom
  safe area or tab bar.
- The CTA must not depend on scrolling to become enabled or visible.
- A focused task may use a bottom action region, but it cannot cover content.
- At 200% text size, scrolling is allowed; the action remains sticky only when
  it has an opaque/regular-material backing and sufficient content inset.
- Error text appears immediately above the action and never pushes the action
  out of reach.

### Density budget

Within the first viewport, a common screen may contain:

- one page title, normally no more than two lines;
- one primary task surface;
- at most two compact summary rows beneath it;
- one primary filled action; and
- no more than two lines of helper copy at a time.

Anything else is disclosed through a focused route, sheet, collapsed row, or
detail action.

## 6. Core-task mockups

![Compact check-ins and primary insight](design/ux-overhaul/02-check-in-and-insight.png)

### Check-in

The check-in becomes one question, one scale, one interpretation, and one
action:

- remove the duplicate eyebrow and repeated question;
- shorten **Scale help** to **Help** in the navigation bar;
- keep the same accessible 1–10 radio group in a five-by-two grid;
- reduce persistent scale copy to the two endpoints, with full phrases in
  Help;
- show the selected value in one short tactile panel;
- move optional context into a focused sheet rather than expanding it inline;
- keep **Save** or **Finish** fully visible; and
- hide the persistent tab bar during the task.

The scale still has no default. Color does not classify appetite values; the
selected treatment identifies only the user's current choice.

### Insights

Insights opens with one useful statement rather than its methodology:

- one short observation;
- evidence count on the same card;
- one compact chart only when it materially clarifies the sentence;
- **Try an experiment** above the fold when eligible;
- feedback as compact secondary controls; and
- history collapsed into one row.

**Why this?**, source records, algorithm version, changed-source labels, and
the non-causal explanation remain available on the detail route. Evidence is
not removed; it is progressively disclosed.

## 7. Compact destinations

![Settings hub, reminder detail, and Profile](design/ux-overhaul/03-settings-reminders-profile.png)

### Settings becomes a hub

The current single long Settings document becomes one viewport of summary
rows:

- Appearance
- Reminders
- Program & scale
- Your data
- Accessibility
- Support

Each row shows its current state and opens a focused route or sheet. Technical
diagnostics such as projection rebuild and build identity live under **Your
data → Diagnostics**, rather than competing with everyday preferences.

Destructive actions remain in **Your data** and retain deliberate confirmation.
Support retains its safety language, but the full boundary copy appears only
after the user opens Support.

### Reminder detail

Reminder choices get their own focused surface with three labelled switches,
one schedule status, **Save reminders**, and **Pause all**. Permission and
failure explanations appear contextually only when required.

### Profile

Profile leads with the small number of supported things the app knows now.
Evidence details remain one tap away. The export CTA is visible before history
or incomplete sections.

## 8. Screen-by-screen restructure

| Screen | First viewport | Moved behind disclosure |
| --- | --- | --- |
| First launch | Theme previews and one confirmation | No policy content |
| Onboarding promise | One sentence and Continue | Longer product boundary in final privacy step |
| Scale learning | Scale, selected phrase, Continue | Full ten-value reference in Help |
| Privacy | Three one-line promises and Start | Reminder setup in focused sheet; support/data details in links |
| Today | Day/week, primary action, two summary rows | Recent history and week explanation below the fold or behind rows |
| Before/after | One question, scale, selected phrase, CTA | Optional context sheet; scale reference in Help |
| Episode | Values and Edit | Context/photo metadata and Delete in detail/overflow |
| Insights | Primary observation and eligible action | Evidence methodology and history |
| Experiment | Practice, day, measure, current action | Pause/end and full baseline explanation |
| Profile | Current supported summary and Export | Sparse sections, evidence lists, past experiments |
| Settings | Appearance plus six summary rows | Each settings category on a focused surface |
| Support | Core safety sentence and choices | Longer educational boundary only on request |

Scrolling remains valid for history, evidence, legal/privacy explanation,
large text, and destructive confirmations. It is not the default interaction
for completing a check-in or finding a primary action.

## 9. Copy overhaul

The new voice is still careful, but less institutional. Lead with the action or
observation; explain only when requested.

| Current | Proposed |
| --- | --- |
| “Take a moment when it is useful. There is no daily target.” | Remove from the default Today view. |
| “Begin with how your body feels.” | “What do you notice?” |
| “Check in before eating” | “Check in” when the surrounding screen already establishes timing. |
| “Personal observations appear only when your paired check-ins provide enough evidence.” | “Your patterns will show up here.” |
| “For seven local calendar days, observe one predeclared measure.” | “Try this for 7 days. No pass or fail.” |
| “The event log is authoritative; the app can rebuild its editable views…” | Move to **Diagnostics** and say “Rebuild app views from your saved history.” |
| “Storage is not end-to-end encrypted…” | “Saved on this device.” Keep the full warning in **Your data**. |
| “Would a pause or extra support feel useful?” | “Want to pause or find support?” |

Copy limits:

- headings: five words where practical;
- task helper text: one sentence, two lines maximum;
- buttons: one to three words where context makes the result unambiguous;
- cards: one idea each; and
- technical implementation language: Diagnostics only.

Safety, consent, destructive action, permission, storage failure, and evidence
caveats may exceed these limits when accuracy requires it.

## 10. Before and after

The generated boards are direction artifacts, not screenshots or pixel
baselines. The “before” column uses current phone E2E evidence; the “after”
column points to the relevant panel in the new board.

### Today

| Before — stacked explanatory cards | After — one action and two glanceable rows |
| --- | --- |
| ![Current Today](tests/e2e/001-shell-and-onboarding/screenshots/005-today-day-one-phone-darwin.png) | ![Proposed light and dark Today](design/ux-overhaul/01-theme-and-today.png) |

The proposed first viewport removes repeated reassurance, makes **Check in**
the unmistakable action, and turns moments and week focus into compact rows.

### Check-in

| Before — repeated prompt and tall guidance | After — one compact decision viewport |
| --- | --- |
| ![Current before check-in](tests/e2e/002-before-eating-check-in/screenshots/000-before-sensation-phone-darwin.png) | ![Proposed light and dark check-ins](design/ux-overhaul/02-check-in-and-insight.png) |

The required task fits without scroll while optional context leaves the main
flow.

### Insights

| Before — evidence and history expanded | After — conclusion first, detail on demand |
| --- | --- |
| ![Current first insight](tests/e2e/005-first-week-insight/screenshots/001-first-observation-phone-darwin.png) | ![Proposed compact insight](design/ux-overhaul/02-check-in-and-insight.png) |

The evidence contract remains intact, but the default screen communicates the
finding before exposing its audit trail.

### Settings

| Before — all categories expanded in one long page | After — one-screen hub and focused details |
| --- | --- |
| ![Current Settings](tests/e2e/015-settings-and-guidance/screenshots/000-preferences-and-recovery-phone-darwin.png) | ![Proposed Settings hub](design/ux-overhaul/03-settings-reminders-profile.png) |

Settings becomes navigable rather than scroll-searchable. Everyday choices no
longer compete with recovery, support, and developer diagnostics.

## 11. Theme tokens

These are starting values for implementation and contrast review, not final
pixel approvals.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#F7F3EA` | `#061411` |
| Content surface | `rgba(255,255,255,.88)` | `rgba(13,39,35,.82)` |
| Glass control | `rgba(255,255,255,.60)` | `rgba(26,70,62,.54)` |
| Primary ink | `#102923` | `#F3FBF7` |
| Secondary ink | `#53665F` | `#B8CCC5` |
| Primary | `#087466` | `#79E5C6` |
| Small accent | `#F0A266` | `#C7F33F` |
| Border/rim | `rgba(16,41,35,.14)` | `rgba(176,255,232,.32)` |
| Focus | `#0B5FFF` | `#9CC2FF` |

All text and meaningful control boundaries must meet WCAG 2.2 AA in both
themes and with transparency disabled. Forced-colors mode replaces decorative
materials with system colors and borders.

## 12. Shape, type, and motion

- Keep Atkinson Hyperlegible for continuity and offline packaging.
- Reduce phone H1 from the current visual dominance to approximately `30/34`;
  task prompts use `28/32` only when they remain on one or two lines.
- Use `16/22` body and `13–14/18` status copy.
- Use concentric radii: approximately `24px` hero, `18px` rows, and capsule
  actions where the surrounding container supports them.
- Standard content spacing is `12–16px`; reserve `24px` gaps for major groups.
- Use depth from rim, translucency, and a soft shadow, not multiple borders.
- Pressed controls compress or dim subtly; selection changes may use a short
  material highlight.
- Do not animate ambient backgrounds continuously.
- Honor reduced motion by removing scale/translation and shortening fades.

## 13. Interaction patterns

### Focused sheets

Use sheets for optional context, reminder editing, scale help, appearance
change, and short confirmations. Use routes for evidence, data management,
support, and content likely to exceed one screen.

Every sheet:

- has a clear title and close/back action;
- traps and restores focus correctly on web;
- respects the keyboard and safe areas;
- uses regular/opaque material under important text; and
- becomes a full-height route when text enlargement would otherwise clip it.

### Navigation

The four existing destinations remain Today, Insights, Profile, and Settings.
No capability or history is deleted to achieve compactness. The floating tab
bar is a functional glass layer and remains visible only on destination
screens, never during focused check-ins.

### Feedback

- Use inline status near the control that changed.
- Prefer a short toast for successful non-destructive background work.
- Keep save errors persistent above the CTA with **Try again**.
- Use haptics only from native-owned confirmation points, never as the sole
  indication of state.

## 14. Accessibility and privacy constraints

Visual richness cannot weaken the existing contracts:

- 44-point targets and native control semantics remain mandatory;
- transparency-reduction and increased-contrast settings receive a more opaque
  surface and stronger rim;
- dark and light themes expose identical names, reading order, states, and
  actions;
- no essential text or icons live only in the generated raster assets;
- the scale has no value-based red/green gradient;
- theme choice and every later change remain local and event-backed;
- no remote font, texture, image, or animation is introduced; and
- the packaged iOS shell remains fully offline.

## 15. Acceptance criteria for implementation

The direction is implemented only when:

- first launch presents a clear light/dark choice and Settings can change it;
- theme choice survives relaunch through the authoritative event sequence;
- every common-action phone baseline shows its CTA completely above the fold
  at `393 × 852` with standard text;
- onboarding, before check-in, after check-in, reminder editing, and experiment
  acceptance require no scroll at standard text;
- Today exposes its primary action plus moments and week focus in one viewport;
- Settings presents all top-level categories in one standard phone viewport;
- evidence, privacy, and safety detail remain reachable after progressive
  disclosure;
- both themes pass automated contrast, forced-colors, reduced-transparency,
  reduced-motion, keyboard, VoiceOver, and 200% text checks;
- every existing domain, event-replay, offline, native bridge, reminder,
  export, deletion, and migration test remains green; and
- new phone-first E2E scenarios compare light and dark layouts and assert CTA
  visibility geometrically rather than relying only on screenshots.

## 16. Review decisions

Approval of this document approves the following direction:

1. light/dark is a deliberate first-launch choice, with the device theme only
   preselecting a recommendation;
2. light mode uses restrained liquid glass on functional layers;
3. dark mode uses the richer nano-banana glass treatment shown in the boards;
4. Settings becomes a hub with focused detail surfaces;
5. optional context moves out of the main check-in viewport;
6. conclusions precede evidence details on Insights and Profile; and
7. above-fold CTA geometry becomes a tested release requirement.

This approval does not treat generated raster details as exact implementation
specifications. Semantic HTML, contrast, real content, iOS behavior, and the
rules above take precedence.

## 17. Mockup provenance

The three boards were generated with the built-in OpenAI image-generation tool
on 2026-09-02 using the `ui-mockup` workflow. The prompts specified shippable
portrait iOS screens, exact minimal copy, the existing product navigation,
light liquid-glass and dark nano-banana glass treatments, above-fold primary
actions, and exclusions for calorie, weight, food judgment, medical imagery,
emoji, trademarks, and watermarks.

The first board received one targeted edit to correct both generated bottom
navigation bars to **Today**, **Insights**, **Profile**, and **Settings**. No
source PDF, third-party application screenshot, or licensed design asset was
used as an image-generation input.
