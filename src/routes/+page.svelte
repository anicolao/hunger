<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import TodayView from '$lib/components/TodayView.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { Program } from '$lib/data/schema';

  let program = $state<Program | null>(null);
  let loaded = $state(false);

  onMount(async () => {
    program = await getRepository().getProgram();
    loaded = true;
  });

  const steps = [
    {
      number: '01',
      title: 'Notice',
      body: 'Check in with one clear sensation scale before and after eating.'
    },
    {
      number: '02',
      title: 'Understand',
      body: 'See observations only when your own check-ins provide enough evidence.'
    },
    {
      number: '03',
      title: 'Experiment',
      body: 'Try one small noticing practice, then compare what appeared to change.'
    }
  ];
</script>

<svelte:head>
  <title>Learn Your Appetite — Notice, understand, learn</title>
  <meta
    name="description"
    content="A 30-day program for learning hunger and fullness without counting calories."
  />
</svelte:head>

{#if program}
  <AppShell active="today">
    <TodayView {program} />
  </AppShell>
{:else}
<div class="site-shell" data-status={loaded ? 'ready' : 'loading'} data-e2e-layout>
  <header class="site-header">
    <a class="brand" href={`${base}/`} aria-label="Learn Your Appetite home">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 33V18m0 4c-7 0-11-4-11-10 7 0 11 4 11 10Zm0 5c7 0 11-4 11-10-7 0-11 4-11 10Z" />
      </svg>
      <span>Learn Your Appetite</span>
    </a>
    <span class="privacy-note">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" />
      </svg>
      Private by default
    </span>
  </header>

  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">A 30-day noticing practice</p>
        <h1 id="hero-title">Learn your appetite.</h1>
        <p class="lead">About 10 seconds at a time.</p>
        <p class="promise">
          Notice hunger, fullness, and what shapes your eating—without calorie counting.
        </p>
        <a class="primary-action" href="#approach">
          See how it works
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m8 10 4 4 4-4" />
          </svg>
        </a>
        <p class="gentle-note">No targets. No streaks. Just patterns from your own experience.</p>
      </div>

      <div class="hero-visual" aria-label="One consistent scale from urgent hunger to fullness">
        <svg class="landscape" viewBox="0 0 520 420" aria-hidden="true">
          <circle cx="350" cy="105" r="58" />
          <path class="hill-back" d="M24 321c76-113 151-130 232-50 72-103 145-113 240 25v84H24Z" />
          <path class="hill-front" d="M24 345c92-66 167-63 230 8 68-58 145-60 242-3v30H24Z" />
          <path class="path" d="M253 385c-32-46-14-76 42-102 49-23 62-55 38-98" />
          <path class="stem" d="M132 271v-88m0 34c-34 0-55-19-55-48 34 0 55 19 55 48Zm0 19c33 0 54-19 54-48-33 0-54 19-54 48Z" />
        </svg>
        <div class="scale-card">
          <p>One scale, every time</p>
          <div class="scale-line" aria-hidden="true"><span></span></div>
          <div class="scale-labels">
            <span><strong>1</strong><em>Urgent hunger</em></span>
            <span><strong>5</strong><em>Neutral</em></span>
            <span><strong>10</strong><em>Painfully full</em></span>
          </div>
          <small>Numbers describe a moment. They are not grades.</small>
        </div>
      </div>
    </section>

    <section class="approach" id="approach" aria-labelledby="approach-title" tabindex="-1">
      <div class="section-heading">
        <p class="eyebrow">The learning loop</p>
        <h2 id="approach-title">Check in less. Learn more.</h2>
        <p>The program turns brief moments into explainable personal observations.</p>
      </div>
      <ol class="step-grid">
        {#each steps as step}
          <li>
            <span class="step-number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        {/each}
      </ol>
    </section>

    <section class="principles" aria-labelledby="principles-title">
      <div>
        <p class="eyebrow">Learning, not restriction</p>
        <h2 id="principles-title">Your experience is the evidence.</h2>
      </div>
      <div class="principle-list">
        <p><strong>Only a sensation is required.</strong> Context, notes, and photos stay optional.</p>
        <p><strong>Every insight shows its evidence.</strong> Sparse data is labelled “Still learning.”</p>
        <p><strong>Your records stay local.</strong> The MVP needs no account or cloud food history.</p>
        <a class="begin-action" href={`${base}/onboarding`}>Begin the 30-day program</a>
      </div>
    </section>
  </main>

  <footer>
    <span>Learn Your Appetite</span>
  </footer>
</div>
{/if}

<style>
  .site-shell {
    min-height: 100vh;
    overflow-x: clip;
  }

  .site-header,
  main,
  footer {
    width: min(1180px, calc(100% - 40px));
    margin-inline: auto;
  }

  .site-header {
    min-height: 84px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .brand {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    font-size: 18px;
    font-weight: 700;
    text-decoration: none;
  }

  .brand svg {
    width: 34px;
    height: 34px;
    fill: none;
    stroke: var(--primary);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .privacy-note {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--ink-muted);
    font-size: 14px;
  }

  .privacy-note svg {
    width: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .hero {
    min-height: calc(100vh - 84px);
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(480px, 1.1fr);
    align-items: center;
    gap: clamp(44px, 7vw, 92px);
    padding: 48px 0 80px;
  }

  .hero-copy {
    max-width: 540px;
  }

  .eyebrow {
    margin: 0 0 14px;
    color: var(--primary);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  h1,
  h2,
  h3,
  p {
    text-wrap: pretty;
  }

  h1 {
    max-width: 560px;
    margin: 0;
    font-size: clamp(52px, 7vw, 84px);
    line-height: 0.96;
    letter-spacing: -0.045em;
  }

  .lead {
    margin: 20px 0 0;
    color: var(--primary);
    font-size: clamp(23px, 2.4vw, 31px);
    font-weight: 700;
    line-height: 1.15;
  }

  .promise {
    max-width: 490px;
    margin: 28px 0 0;
    color: var(--ink-muted);
    font-size: 20px;
    line-height: 1.5;
  }

  .primary-action {
    width: fit-content;
    min-height: 52px;
    margin-top: 32px;
    padding: 0 20px 0 24px;
    border-radius: 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #fff;
    background: var(--primary);
    font-size: 17px;
    font-weight: 700;
    text-decoration: none;
    box-shadow: 0 10px 24px rgb(35 107 97 / 18%);
    transition: background 160ms ease-out, transform 160ms ease-out;
  }

  .primary-action:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }

  .primary-action svg {
    width: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .gentle-note {
    max-width: 440px;
    margin: 16px 0 0;
    color: var(--ink-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .hero-visual {
    position: relative;
    min-height: 570px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .landscape {
    width: min(100%, 580px);
    overflow: visible;
  }

  .landscape circle {
    fill: var(--accent-soft);
  }

  .hill-back {
    fill: #cadad1;
  }

  .hill-front {
    fill: #9bbdae;
  }

  .path {
    fill: none;
    stroke: #f7f4ee;
    stroke-width: 20;
    stroke-linecap: round;
  }

  .stem {
    fill: #709888;
    stroke: #527a6b;
    stroke-width: 3;
    stroke-linejoin: round;
  }

  .scale-card {
    position: absolute;
    right: 5%;
    bottom: 8%;
    width: min(360px, 72%);
    padding: 24px;
    border: 1px solid rgb(37 49 45 / 10%);
    border-radius: 18px;
    background: rgb(255 255 255 / 96%);
    box-shadow: 0 22px 55px rgb(37 49 45 / 15%);
  }

  .scale-card > p {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  .scale-line {
    position: relative;
    height: 2px;
    margin: 25px 11px 13px;
    background: var(--primary);
  }

  .scale-line::before,
  .scale-line::after,
  .scale-line span {
    content: '';
    position: absolute;
    top: 50%;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--primary);
    transform: translate(-50%, -50%);
  }

  .scale-line::before {
    left: 0;
  }

  .scale-line::after {
    left: 100%;
  }

  .scale-line span {
    left: 50%;
  }

  .scale-labels {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: var(--ink-muted);
    font-size: 12px;
  }

  .scale-labels span {
    width: 31%;
    display: grid;
    gap: 2px;
  }

  .scale-labels span:nth-child(2) {
    text-align: center;
  }

  .scale-labels span:last-child {
    text-align: right;
  }

  .scale-labels strong {
    color: var(--ink);
    font-size: 16px;
  }

  .scale-labels em {
    font-style: normal;
  }

  .scale-card small {
    display: block;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--border);
    color: var(--ink-muted);
    font-size: 12px;
    line-height: 1.35;
  }

  .approach,
  .principles {
    scroll-margin-top: 24px;
  }

  .approach {
    padding: 100px 0;
  }

  .section-heading {
    max-width: 660px;
  }

  h2 {
    margin: 0;
    font-size: clamp(34px, 4vw, 52px);
    line-height: 1.04;
    letter-spacing: -0.03em;
  }

  .section-heading > p:last-child {
    margin: 20px 0 0;
    color: var(--ink-muted);
    font-size: 18px;
    line-height: 1.5;
  }

  .step-grid {
    margin: 48px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    list-style: none;
  }

  .step-grid li {
    min-height: 250px;
    padding: 24px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
  }

  .step-number {
    width: 46px;
    height: 34px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: var(--accent-ink);
    background: var(--accent-soft);
    font-size: 13px;
    font-weight: 700;
  }

  .step-grid h3 {
    margin: 52px 0 10px;
    font-size: 23px;
  }

  .step-grid p {
    margin: 0;
    color: var(--ink-muted);
    font-size: 16px;
    line-height: 1.5;
  }

  .principles {
    margin-bottom: 100px;
    padding: 56px;
    border-radius: 24px;
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: 64px;
    background: var(--primary-soft);
  }

  .principle-list {
    display: grid;
    gap: 20px;
  }

  .principle-list p {
    margin: 0;
    padding-bottom: 20px;
    border-bottom: 1px solid rgb(35 107 97 / 18%);
    color: var(--ink-muted);
    line-height: 1.5;
  }

  .principle-list p:last-child {
    padding-bottom: 0;
    border: 0;
  }

  .principle-list strong {
    display: block;
    margin-bottom: 3px;
    color: var(--ink);
  }

  .begin-action {
    min-height: 52px;
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

  footer {
    min-height: 84px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    color: var(--ink-muted);
    font-size: 13px;
  }

  @media (max-width: 860px) {
    .hero {
      grid-template-columns: 1fr;
      gap: 12px;
      padding-top: 40px;
    }

    .hero-copy {
      max-width: 650px;
    }

    .hero-visual {
      min-height: 500px;
    }

    .step-grid {
      grid-template-columns: 1fr;
    }

    .step-grid li {
      min-height: 0;
    }

    .step-grid h3 {
      margin-top: 30px;
    }

    .principles {
      grid-template-columns: 1fr;
      gap: 40px;
    }
  }

  @media (max-width: 520px) {
    .site-header,
    main,
    footer {
      width: min(100% - 32px, 1180px);
    }

    .site-header {
      min-height: 72px;
    }

    .brand {
      font-size: 16px;
    }

    .privacy-note {
      width: 44px;
      justify-content: center;
      color: var(--primary);
      font-size: 0;
    }

    .privacy-note svg {
      min-width: 20px;
    }

    .hero {
      min-height: auto;
      padding: 50px 0 72px;
    }

    h1 {
      font-size: clamp(49px, 14vw, 62px);
    }

    .lead {
      font-size: 24px;
    }

    .promise {
      margin-top: 24px;
      font-size: 18px;
    }

    .primary-action {
      width: 100%;
    }

    .hero-visual {
      min-height: 410px;
      margin-top: 10px;
    }

    .landscape {
      width: 116%;
      max-width: none;
    }

    .scale-card {
      right: 0;
      bottom: 0;
      width: 88%;
      padding: 20px;
    }

    .approach {
      padding: 78px 0;
    }

    .principles {
      margin: 0 -16px 72px;
      padding: 48px 24px;
      border-radius: 0;
    }

    footer {
      min-height: 76px;
      align-items: flex-start;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
    }
  }

  @media (forced-colors: active) {
    .primary-action,
    .step-number,
    .principles,
    .scale-card {
      border: 1px solid CanvasText;
    }
  }
</style>
