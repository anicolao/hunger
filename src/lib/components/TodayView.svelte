<script lang="ts">
  import { base } from '$app/paths';
  import { getProgramProgress } from '$lib/domain/progression';
  import type { Program } from '$lib/data/schema';

  let { program, now = Date.now() }: { program: Program; now?: number } = $props();
  let progress = $derived(getProgramProgress(program.startedAt, now));
</script>

<div class="today-page" data-status="ready">
  <header class="page-heading">
    <p class="eyebrow">Day {progress.day} · Week {progress.week}</p>
    <h1>Today</h1>
    <p>Take a moment when it is useful. There is no daily target.</p>
  </header>

  <section class="notice-card" aria-labelledby="notice-title">
    <p class="eyebrow">What do you notice?</p>
    <h2 id="notice-title">Begin with how your body feels.</h2>
    <p>{progress.prompt}</p>
    <a class="primary-button" href={`${base}/check-in/new`}>Check in before eating</a>
  </section>

  <div class="today-grid">
    <section class="plain-card" aria-labelledby="moments-title">
      <p class="eyebrow">Today's moments</p>
      <h2 id="moments-title">No moments yet</h2>
      <p>Check-ins appear here without a quota or streak.</p>
    </section>

    <section class="plain-card" aria-labelledby="focus-title">
      <p class="eyebrow">Week {progress.week} focus</p>
      <h2 id="focus-title">{progress.focus}</h2>
      <p>Notice what is present. A number is a description, not a grade.</p>
    </section>
  </div>

  <section class="empty-history" aria-labelledby="recent-title">
    <h2 id="recent-title">Recent check-ins</h2>
    <p>Your before-and-after moments will stay private on this device.</p>
  </section>

  <p class="build-marker" data-testid="build-marker">Build {import.meta.env.VITE_GIT_HASH}</p>
</div>

<style>
  .page-heading {
    margin-bottom: 32px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--primary);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    text-wrap: pretty;
  }

  h1 {
    margin: 0;
    font-size: clamp(34px, 8vw, 42px);
    line-height: 1.1;
  }

  .page-heading > p:last-child,
  section > p:last-child {
    color: var(--ink-muted);
  }

  .notice-card,
  .plain-card,
  .empty-history {
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
  }

  .notice-card {
    padding: 24px;
    background: var(--primary-soft);
  }

  h2 {
    margin: 0;
    font-size: 22px;
    line-height: 1.25;
  }

  .notice-card > p:not(.eyebrow) {
    margin: 12px 0 0;
    line-height: 1.5;
  }

  .primary-button {
    min-height: 52px;
    margin-top: 24px;
    padding: 0 20px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: white;
    background: var(--primary);
    font-weight: 700;
    text-decoration: none;
  }

  .today-grid {
    margin-top: 20px;
    display: grid;
    gap: 16px;
  }

  .plain-card,
  .empty-history {
    padding: 20px;
  }

  .plain-card p:last-child,
  .empty-history p {
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .empty-history {
    margin-top: 32px;
    border-style: dashed;
  }

  .build-marker {
    margin: 32px 0 0;
    color: var(--ink-muted);
    font-size: 12px;
  }

  @media (min-width: 700px) {
    .today-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
