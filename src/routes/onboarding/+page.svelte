<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import Brand from '$lib/components/Brand.svelte';
  import SensationScale from '$lib/components/SensationScale.svelte';
  import { getRepository } from '$lib/data/repository';
  import { SCHEMA_VERSION, type Program } from '$lib/data/schema';
  import { runtime } from '$lib/platform/runtime';

  let step = $state(1);
  let selectedLevel = $state<number | null>(null);
  let reminderChoice = $state<'setup' | 'later' | null>(null);
  let status = $state<'loading' | 'ready' | 'saving' | 'error'>('loading');
  let errorMessage = $state('');
  let heading = $state<HTMLHeadingElement>();

  onMount(async () => {
    const existing = await getRepository().getProgram();
    if (existing) {
      await goto(`${base}/`);
      return;
    }
    status = 'ready';
  });

  async function moveTo(nextStep: number) {
    step = nextStep;
    await tick();
    heading?.focus();
  }

  async function activate() {
    status = 'saving';
    errorMessage = '';
    const program: Program = {
      id: runtime.createId(),
      startedAt: runtime.now(),
      timeZone: runtime.timeZone(),
      status: 'active',
      onboardingVersion: 1,
      schemaVersion: SCHEMA_VERSION
    };

    try {
      const repository = getRepository();
      const settings = await repository.getSettings();
      await repository.append(
        { type: 'program/started', occurredAt: program.startedAt, payload: { program } },
        {
          type: 'settings/changed',
          occurredAt: program.startedAt,
          payload: {
            settings: {
              ...settings,
              reminderWindows: reminderChoice === 'setup' ? ['09:00', '18:00'] : []
            }
          }
        }
      );
      await goto(`${base}/`, { replaceState: true });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Your program could not be started.';
      status = 'error';
    }
  }
</script>

<svelte:head>
  <title>Get started — Learn Your Appetite</title>
</svelte:head>

<div class="onboarding" data-status={status} data-e2e-layout>
  <header>
    <Brand compact />
    <span>{step} of 4</span>
  </header>

  <main>
    {#if step === 1}
      <section class="step promise-step">
        <div class="illustration" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <p class="eyebrow">A 30-day noticing practice</p>
        <h1 bind:this={heading} tabindex="-1">Learn your appetite</h1>
        <p class="lead">30 days. About 10 seconds at a time.</p>
        <p class="body">Notice hunger, fullness, and what shapes your eating—without counting.</p>
        <button class="primary" onclick={() => moveTo(2)}>Begin</button>
      </section>
    {:else if step === 2}
      <section class="step scale-step">
        <p class="eyebrow">One scale</p>
        <h1 bind:this={heading} tabindex="-1">One scale, every time</h1>
        <p class="body">Numbers describe a moment. They are not grades.</p>
        <p class="practice-note">
          <strong>Practice only—not a check-in.</strong>
          Try a number to learn the scale, or continue without choosing. Nothing on this screen is saved.
        </p>
        <SensationScale
          value={selectedLevel}
          legend="Try the scale (optional)"
          name="onboarding-practice-level"
          onselect={(level) => (selectedLevel = level)}
        />
        <div class="actions">
          <button class="back" onclick={() => moveTo(1)}>Back</button>
          <button class="primary" onclick={() => moveTo(3)}>Continue</button>
        </div>
      </section>
    {:else if step === 3}
      <section class="step">
        <p class="eyebrow">How learning works</p>
        <h1 bind:this={heading} tabindex="-1">Small moments become patterns</h1>
        <ol class="learning-steps">
          <li><span>1</span><strong>Check in before</strong><small>Notice your starting cues.</small></li>
          <li><span>2</span><strong>Check in after</strong><small>Notice how the moment ended.</small></li>
          <li><span>3</span><strong>See what repeats</strong><small>Every observation shows its evidence.</small></li>
        </ol>
        <p class="body">
          When there is enough evidence, you will see what the app noticed and which check-ins
          support it.
        </p>
        <div class="actions">
          <button class="back" onclick={() => moveTo(2)}>Back</button>
          <button class="primary" onclick={() => moveTo(4)}>Continue</button>
        </div>
      </section>
    {:else}
      <section class="step privacy-step">
        <p class="eyebrow">Privacy and choice</p>
        <h1 bind:this={heading} tabindex="-1">Private by default</h1>
        <div class="privacy-list">
          <p><strong>Records stay on this device.</strong> The MVP has no account or cloud food history.</p>
          <p><strong>Only a sensation is required.</strong> Context and photos remain optional.</p>
          <p><strong>You are in control of tracking.</strong> Pause or delete everything at any time.</p>
        </div>
        <p class="support-note">
          This is a learning tool, not medical care. If tracking feels unhelpful, you can stop and
          seek support from a qualified healthcare professional.
        </p>
        <fieldset class="reminder-choice">
          <legend>Would you like reminder options?</legend>
          <button
            class:selected={reminderChoice === 'setup'}
            aria-pressed={reminderChoice === 'setup'}
            onclick={() => (reminderChoice = 'setup')}>Set up reminders</button
          >
          <button
            class:selected={reminderChoice === 'later'}
            aria-pressed={reminderChoice === 'later'}
            onclick={() => (reminderChoice = 'later')}>Not now</button
          >
        </fieldset>
        {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
        <div class="actions">
          <button class="back" onclick={() => moveTo(3)}>Back</button>
          <button class="primary" disabled={status === 'saving'} onclick={activate}>
            {status === 'saving' ? 'Starting…' : 'Start day 1'}
          </button>
        </div>
      </section>
    {/if}
  </main>
</div>

<style>
  .onboarding {
    min-height: 100vh;
    padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom);
  }

  header {
    width: min(100%, 720px);
    min-height: 72px;
    margin-inline: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  header > span {
    color: var(--ink-muted);
    font-size: 14px;
  }

  main {
    width: min(100%, 620px);
    margin: clamp(28px, 7vh, 70px) auto 48px;
  }

  .step {
    min-height: 620px;
    padding: clamp(24px, 5vw, 40px);
    border: 1px solid var(--border);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    box-shadow: 0 20px 50px rgb(37 49 45 / 7%);
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--primary);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(31px, 8vw, 42px);
    line-height: 1.08;
    letter-spacing: -0.025em;
  }

  h1:focus {
    outline: none;
  }

  .lead {
    margin: 18px 0 0;
    color: var(--primary);
    font-size: 22px;
    font-weight: 700;
  }

  .body,
  .support-note,
  .privacy-list p {
    color: var(--ink-muted);
    line-height: 1.5;
  }

  .body {
    margin: 16px 0 0;
  }

  .practice-note {
    margin: 16px 0 20px;
    padding: 12px 14px;
    border-radius: 12px;
    color: var(--ink-muted);
    background: var(--primary-soft);
    line-height: 1.4;
  }

  .practice-note strong {
    display: block;
    color: var(--ink);
  }

  .illustration {
    height: 150px;
    margin: -8px 0 32px;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    align-items: end;
    justify-content: center;
    gap: 8px;
    background: var(--primary-soft);
  }

  .illustration span {
    width: 32%;
    height: 44%;
    border-radius: 70% 70% 0 0;
    background: #9bbdae;
  }

  .illustration span:nth-child(2) {
    height: 70%;
    background: #cadecf;
  }

  .primary,
  .back,
  .reminder-choice button {
    min-height: 48px;
    border-radius: 12px;
    padding: 0 18px;
    font-weight: 700;
    cursor: pointer;
  }

  .primary {
    margin-top: auto;
    border: 0;
    color: white;
    background: var(--primary);
  }

  .primary:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .actions {
    margin-top: auto;
    padding-top: 28px;
    display: grid;
    grid-template-columns: auto minmax(160px, 1fr);
    gap: 12px;
  }

  .actions .primary {
    margin: 0;
  }

  .back,
  .reminder-choice button {
    border: 1px solid var(--border-strong);
    color: var(--ink);
    background: var(--surface);
  }

  .learning-steps {
    margin: 32px 0 0;
    padding: 0;
    display: grid;
    gap: 14px;
    list-style: none;
  }

  .learning-steps li {
    min-height: 74px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    display: grid;
    grid-template-columns: 44px 1fr;
    align-items: center;
  }

  .learning-steps li > span {
    grid-row: span 2;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--accent-ink);
    background: var(--accent-soft);
    font-weight: 700;
  }

  .learning-steps small {
    color: var(--ink-muted);
    font-size: 14px;
  }

  .privacy-list {
    margin-top: 24px;
    display: grid;
    gap: 2px;
  }

  .privacy-list p {
    margin: 0;
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
  }

  .privacy-list strong {
    display: block;
    color: var(--ink);
  }

  .support-note {
    padding: 14px;
    border-radius: 12px;
    background: var(--canvas);
    font-size: 14px;
  }

  .reminder-choice {
    margin: 8px 0 0;
    padding: 0;
    border: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .reminder-choice legend {
    margin-bottom: 8px;
    font-weight: 700;
  }

  .reminder-choice button.selected {
    border: 2px solid var(--primary);
    background: var(--primary-soft);
  }

  .error {
    color: var(--danger);
  }

  @media (max-width: 520px) {
    main {
      margin-top: 12px;
    }

    .step {
      min-height: calc(100vh - 108px - env(safe-area-inset-top));
      padding: 24px 20px;
      border-right: 0;
      border-left: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .scale-step {
      min-height: 680px;
    }
  }
</style>
