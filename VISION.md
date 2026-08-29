# Learn Your Appetite — MVP

The MVP should be a **30-day “learn your appetite” program**, not a generic food tracker.

## Core Promise

> **Learn when you’re genuinely hungry, what comfortable fullness feels like, and what tends to make you overeat — without counting calories.**

## MVP Flow

The app should ask users for very lightweight check-ins around eating.

### Before Eating

- Hunger: **1–10**

### After Eating

- Fullness: **1–10**
- Optional reason for eating:
  - Physical hunger
  - Craving
  - Emotion
  - Boredom
  - Habit
  - Social/contextual eating
- Very short optional note
- Optional meal photo

There should be **no calorie or nutrient entry**.

A check-in should take roughly **10 seconds**.

## Critical Feature: Personalized Insights

The MVP cannot just collect scores. It needs to periodically turn the data into simple observations about the user's own behavior.

Examples:

> “When you start dinner extremely hungry, you usually finish uncomfortably full.”

> “Most of your evening snacks happen without physical hunger.”

> “You tend to feel comfortably satisfied when you begin eating around 4/10 hunger.”

This is the main product value.

## Turn Insights Into Experiments

The app should suggest **one small experiment at a time**, based on patterns it detects.

Examples:

> “This week, try eating a little earlier on workdays.”

> “Pause halfway through dinner and rate your fullness.”

> “Before an evening snack, check whether you feel stomach hunger or simply want something to eat.”

The app should then show whether the experiment appears to have changed the pattern.

The core loop is:

**Notice → Understand → Experiment → Learn**

rather than:

**Log → Log → Log → Quit**

## 30-Day Progression

### Week 1 — Hunger

Learn:

- What different hunger levels feel like
- When the user normally begins eating
- Whether they regularly wait until they are extremely hungry

### Week 2 — Fullness

Learn:

- What comfortable satisfaction feels like
- Where “satisfied” ends and “overfull” begins
- Which meals tend to end in overeating

### Week 3 — Hunger vs. Wanting Food

Learn to distinguish physical hunger from:

- Cravings
- Boredom
- Emotion
- Habit
- Social/contextual eating

### Week 4 — Your Patterns

Surface the user's strongest patterns and test one or two behavioral changes.

## End-of-Program Appetite Profile

At the end of the 30 days, give the user a personalized **Appetite Profile** containing:

- Typical hunger level when meals begin
- Typical fullness level when meals end
- Situations associated with overeating
- Common non-hunger eating triggers
- Meals or times of day where appetite regulation is easy
- Meals or times of day where appetite regulation is difficult
- Patterns the user has successfully changed
- A small number of personalized recommendations to continue using

## Minimum Screen Set

### 1. Onboarding

Explain:

- The 30-day goal
- The hunger scale
- The fullness scale
- That the goal is learning rather than calorie restriction

### 2. Check-In

Fast before- and after-eating entry.

### 3. Today

Show:

- Recent check-ins
- Today's progress
- Current suggested action or experiment

### 4. Insights

Show patterns detected from the user's history.

### 5. Experiment

Show the current behavior the user is trying and why it was suggested.

### 6. Progress / Appetite Profile

Show what the user has learned about their appetite over time.

## Notifications

Notifications should prompt useful check-ins, especially early in the program.

However, the app should deliberately require **less tracking over time**, not more.

The goal is to teach a skill rather than create permanent dependence on the tracker.

## Do Not Build in V1

Avoid adding:

- Calorie database
- Macro tracking
- Recipes
- Weight-loss targets
- Social feed
- Wearable integration
- Coaching marketplace
- Elaborate journaling
- AI chat interface
- Large educational-content library

Also avoid:

- Diagnosing emotional eating
- Claims about fixing hunger hormones
- Claims about repairing or recalibrating someone's physiological satiety system

The product should focus on **awareness, patterns, and behavior**.

## Core MVP Hypothesis

The MVP is **not** primarily testing:

> “Will people log hunger and fullness?”

People will probably do that temporarily.

The important hypothesis is:

> **If people spend about 10 seconds logging hunger and fullness around meals, can the app show them personalized insights within the first week that feel valuable enough to keep going?**

That is the make-or-break question.

## Product Priority

Prioritize the **pattern and insight engine** over almost everything else.

A polished tracker that produces weak insights is unlikely to succeed.

A rough prototype that tells someone something genuinely useful about their own eating behavior could validate the entire opportunity.