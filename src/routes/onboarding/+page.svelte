<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import Brand from '$lib/components/Brand.svelte';
  import ReminderWindowSwitches from '$lib/components/ReminderWindowSwitches.svelte';
  import SensationScale from '$lib/components/SensationScale.svelte';
  import { getRepository } from '$lib/data/repository';
  import { SCHEMA_VERSION, type Program } from '$lib/data/schema';
  import { deriveReminderSchedule } from '$lib/domain/reminders';
  import { applyAppearance, preferredAppearance, type Appearance } from '$lib/platform/appearance';
  import { cancelNativeReminders, reconcileReminders } from '$lib/platform/reminders';
  import { runtime } from '$lib/platform/runtime';

  let step = $state(0);
  let appearance = $state<Appearance>('light');
  let selectedLevel = $state<number | null>(null);
  let reminderChoice = $state<'setup' | 'later' | null>(null);
  let reminderWindows = $state<string[]>([]);
  let status = $state<'loading' | 'ready' | 'saving' | 'error'>('loading');
  let errorMessage = $state('');
  let heading = $state<HTMLHeadingElement>();
  let reminderDialog = $state<HTMLDialogElement>();
  let dataDialog = $state<HTMLDialogElement>();
  let supportDialog = $state<HTMLDialogElement>();

  onMount(async () => {
    const existing = await getRepository().getProgram();
    if (existing) {
      await goto(`${base}/`);
      return;
    }
    appearance = preferredAppearance();
    applyAppearance(appearance);
    status = 'ready';
  });

  function previewAppearance(next: Appearance) {
    appearance = next;
    applyAppearance(next);
  }

  async function moveTo(nextStep: number) {
    step = nextStep;
    await tick();
    heading?.focus();
  }

  function chooseReminderPath(choice: 'setup' | 'later') {
    reminderChoice = choice;
    if (choice === 'later') {
      reminderWindows = [];
    } else {
      reminderDialog?.showModal();
    }
  }

  function closeReminderSetup() {
    if (reminderWindows.length === 0) reminderChoice = null;
    reminderDialog?.close();
  }

  function toggleReminderWindow(window: string) {
    if (!reminderWindows.includes(window) && reminderWindows.length >= 2) return;
    reminderWindows = reminderWindows.includes(window)
      ? reminderWindows.filter((item) => item !== window)
      : [...reminderWindows, window];
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

    let scheduledNativeReminders = false;
    try {
      const repository = getRepository();
      const settings = await repository.getSettings();
      let activatedSettings = {
        ...settings,
        appearance,
        reminderWindows: reminderChoice === 'setup' ? [...reminderWindows] : []
      };

      if (reminderChoice === 'setup') {
        const result = await reconcileReminders(deriveReminderSchedule({
          program,
          settings: activatedSettings,
          episodes: [],
          experiments: [],
          now: program.startedAt
        }), true);
        scheduledNativeReminders = result.capability !== 'browser-unavailable' && result.scheduled > 0;
        activatedSettings = {
          ...activatedSettings,
          remindersPaused: false,
          permissionState: result.permissionState
        };
      }

      await repository.append(
        { type: 'program/started', occurredAt: program.startedAt, payload: { program } },
        {
          type: 'settings/changed',
          occurredAt: program.startedAt,
          payload: { settings: activatedSettings }
        }
      );
      await goto(`${base}/`, { replaceState: true });
    } catch (error) {
      if (scheduledNativeReminders) {
        try {
          await cancelNativeReminders();
        } catch {
          // Keep the original activation error visible; cancellation is best effort.
        }
      }
      errorMessage = error instanceof Error ? error.message : 'Your program could not be started.';
      status = 'error';
    }
  }
</script>

<svelte:head><title>Get started — Learn Your Appetite</title></svelte:head>

<div class="onboarding" data-status={status} data-stage={step} data-e2e-layout>
  <header>
    <Brand compact />
    {#if step > 0}<span>{step} of 4</span>{/if}
  </header>

  <main>
    {#if step === 0}
      <section class="step appearance-step">
        <p class="eyebrow">Make it yours</p>
        <h1 bind:this={heading} tabindex="-1">Choose your look</h1>
        <p class="lead">Pick what feels good. Change it anytime.</p>
        <div class="theme-options" role="radiogroup" aria-label="Appearance">
          <button class:selected={appearance === 'light'} role="radio" aria-checked={appearance === 'light'} onclick={() => previewAppearance('light')}>
            <span class="theme-preview light-preview" aria-hidden="true"><i></i><i></i><i></i></span>
            <strong>Light</strong><small>Warm and clear</small>
          </button>
          <button class:selected={appearance === 'dark'} role="radio" aria-checked={appearance === 'dark'} onclick={() => previewAppearance('dark')}>
            <span class="theme-preview dark-preview" aria-hidden="true"><i></i><i></i><i></i></span>
            <strong>Dark</strong><small>Deep and luminous</small>
          </button>
        </div>
        <button class="primary" onclick={() => moveTo(1)}>Use {appearance} mode</button>
      </section>
    {:else if step === 1}
      <section class="step promise-step">
        <div class="illustration" aria-hidden="true"><span class="path"></span><span class="sprout"></span></div>
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
        <SensationScale value={selectedLevel} legend="Try the scale (optional)" name="onboarding-practice-level" onselect={(level) => (selectedLevel = level)} />
        <p class="practice-note"><strong>Practice only—not a check-in.</strong> Nothing here is saved.</p>
        <div class="actions"><button class="back" onclick={() => moveTo(1)}>Back</button><button class="primary" onclick={() => moveTo(3)}>Continue</button></div>
      </section>
    {:else if step === 3}
      <section class="step learning-step">
        <p class="eyebrow">How learning works</p>
        <h1 bind:this={heading} tabindex="-1">Small moments become patterns</h1>
        <ol class="learning-steps">
          <li><span>1</span><div><strong>Check in before</strong><small>Notice your starting cues.</small></div></li>
          <li><span>2</span><div><strong>Check in after</strong><small>Notice how the moment ended.</small></div></li>
          <li><span>3</span><div><strong>See what repeats</strong><small>Every observation shows its evidence.</small></div></li>
        </ol>
        <p class="body">When there is enough evidence, you will see what the app noticed.</p>
        <div class="actions"><button class="back" onclick={() => moveTo(2)}>Back</button><button class="primary" onclick={() => moveTo(4)}>Continue</button></div>
      </section>
    {:else}
      <section class="step privacy-step">
        <p class="eyebrow">Privacy and choice</p>
        <h1 bind:this={heading} tabindex="-1">Private by default</h1>
        <div class="privacy-list">
          <p><span aria-hidden="true">✓</span><strong>Saved on this device</strong></p>
          <p><span aria-hidden="true">✓</span><strong>Only a sensation is required</strong></p>
          <p><span aria-hidden="true">✓</span><strong>Pause or delete anytime</strong></p>
        </div>
        <div class="detail-links"><button onclick={() => dataDialog?.showModal()}>Your data</button><button onclick={() => supportDialog?.showModal()}>Support</button></div>
        <fieldset class="reminder-choice">
          <legend>Would you like reminders?</legend>
          <button class:selected={reminderChoice === 'setup'} aria-pressed={reminderChoice === 'setup'} onclick={() => chooseReminderPath('setup')}>Set up reminders</button>
          <button class:selected={reminderChoice === 'later'} aria-pressed={reminderChoice === 'later'} onclick={() => chooseReminderPath('later')}>Not now</button>
        </fieldset>
        {#if errorMessage}<p class="error" role="alert" tabindex="-1">{errorMessage}</p>{/if}
        <div class="actions">
          <button class="back" onclick={() => moveTo(3)}>Back</button>
          <button class="primary" disabled={status === 'saving' || reminderChoice === null || (reminderChoice === 'setup' && reminderWindows.length === 0)} onclick={activate}>
            {status === 'saving' ? 'Starting…' : reminderChoice === 'setup' ? 'Allow reminders and start' : 'Start day 1'}
          </button>
        </div>
      </section>
    {/if}
  </main>
</div>

<dialog class="sheet" bind:this={reminderDialog} aria-labelledby="reminder-sheet-title" onclose={() => { if (reminderWindows.length === 0) reminderChoice = null; }}>
  <div class="sheet-handle" aria-hidden="true"></div>
  <p class="eyebrow">Optional</p><h2 id="reminder-sheet-title">Choose reminder windows</h2>
  <p>Pick up to two. Changing a switch will not ask for permission. iOS asks only when you choose Allow reminders and start.</p>
  <ReminderWindowSwitches selected={reminderWindows} legend="Reminder windows" ontoggle={toggleReminderWindow} />
  <button class="sheet-primary" disabled={reminderWindows.length === 0} onclick={closeReminderSetup}>Done</button>
  <button class="sheet-cancel" onclick={() => reminderDialog?.close()}>Cancel</button>
</dialog>

<dialog class="detail-dialog" bind:this={dataDialog}>
  <form method="dialog"><button class="dialog-close" aria-label="Close data details">×</button></form>
  <h2>Your data stays local</h2><p>Check-ins and photos stay on this device. There is no account or cloud food history. Export and deletion remain available in Settings.</p>
</dialog>

<dialog class="detail-dialog" bind:this={supportDialog}>
  <form method="dialog"><button class="dialog-close" aria-label="Close support details">×</button></form>
  <h2>Support is always valid</h2><p>This is a learning tool, not medical care. If tracking feels unhelpful, pause or stop and seek support from a qualified healthcare professional.</p>
</dialog>

<style>
  .onboarding { min-height: 100svh; padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom); }
  header { width: min(100%, 720px); min-height: 58px; margin-inline: auto; display: flex; align-items: center; justify-content: space-between; }
  header > span { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; color: var(--primary); background: var(--glass); font-size: 14px; font-weight: 700; backdrop-filter: blur(18px) saturate(120%); }
  main { width: min(100%, 620px); margin: 8px auto 16px; }
  .step { min-height: min(720px, calc(100svh - 82px - env(safe-area-inset-top) - env(safe-area-inset-bottom))); padding: clamp(20px, 5vw, 34px); border: 1px solid var(--rim); border-radius: 28px; display: flex; flex-direction: column; background: var(--glass); box-shadow: var(--shadow); backdrop-filter: blur(24px) saturate(130%); }
  .eyebrow { margin: 0 0 7px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(30px, 7.7vw, 40px); line-height: 1.02; letter-spacing: -.03em; }
  h1:focus { outline: none; }
  .lead { margin: 12px 0 0; color: var(--ink-muted); font-size: 18px; line-height: 1.35; }
  .body { margin: 10px 0 0; color: var(--ink-muted); line-height: 1.4; }
  .primary, .back, .reminder-choice button, .sheet-primary, .sheet-cancel { min-height: 50px; border-radius: 16px; padding: 0 18px; font-weight: 700; cursor: pointer; }
  .primary, .sheet-primary { margin-top: auto; border: 1px solid color-mix(in srgb, var(--primary) 72%, white); color: var(--on-primary); background: var(--primary); box-shadow: 0 10px 30px color-mix(in srgb, var(--primary) 28%, transparent); }
  .primary:disabled, .sheet-primary:disabled { cursor: not-allowed; opacity: .45; }
  .actions { margin-top: auto; padding-top: 14px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; }
  .actions .primary { margin: 0; }
  .back, .reminder-choice button, .sheet-cancel { border: 1px solid var(--border-strong); color: var(--ink); background: var(--glass); }
  .theme-options { margin: 26px 0 22px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .theme-options button { min-height: 234px; padding: 9px; border: 1px solid var(--border-strong); border-radius: 20px; display: flex; flex-direction: column; gap: 3px; color: var(--ink); background: var(--glass); }
  .theme-options button.selected { border: 3px solid var(--primary); padding: 7px; box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent); }
  .theme-options strong { margin-top: 5px; font-size: 18px; }
  .theme-options small { color: var(--ink-muted); }
  .theme-preview { position: relative; width: 100%; height: 166px; border-radius: 14px; overflow: hidden; display: block; }
  .light-preview { background: #f7f2e8; }
  .dark-preview { background: radial-gradient(circle at 90% 8%, #667814, transparent 42%), #071917; }
  .theme-preview i { position: absolute; display: block; border-radius: 999px 999px 0 0; }
  .theme-preview i:nth-child(1) { right: -12%; bottom: -8%; width: 80%; height: 48%; background: #a9d8c5; }
  .theme-preview i:nth-child(2) { left: -15%; bottom: -12%; width: 80%; height: 62%; background: #cce2d3; }
  .theme-preview i:nth-child(3) { top: 28px; right: 22px; width: 42px; height: 42px; border-radius: 50%; background: #ffb47d; }
  .dark-preview i:nth-child(1) { background: #0d4c42; border: 1px solid #53d5b5; }
  .dark-preview i:nth-child(2) { background: #103b35; }
  .dark-preview i:nth-child(3) { background: #d9ef48; box-shadow: 0 0 24px #d9ef48; }
  .illustration { position: relative; height: clamp(120px, 22vh, 178px); margin-bottom: 18px; border: 1px solid var(--border); border-radius: 22px; overflow: hidden; background: radial-gradient(circle at 55% 42%, color-mix(in srgb, var(--primary) 24%, transparent), transparent 25%), linear-gradient(150deg, var(--primary-soft), transparent); }
  .path { position: absolute; bottom: -42px; left: 40%; width: 54px; height: 190px; border: 3px solid var(--primary); border-top-color: transparent; border-bottom-color: transparent; border-radius: 50%; transform: rotate(64deg); }
  .sprout { position: absolute; top: 25%; left: 53%; width: 38px; height: 46px; border-bottom: 3px solid var(--primary); }
  .sprout::before, .sprout::after { content: ''; position: absolute; width: 20px; height: 30px; border-radius: 100% 0 100% 0; background: var(--primary); }
  .sprout::before { left: 1px; transform: rotate(-35deg); }
  .sprout::after { right: 0; transform: scaleX(-1) rotate(-35deg); }
  .scale-step :global(.scale) { margin-top: 14px; }
  .scale-step :global(.scale legend) { margin-bottom: 8px; font-size: 17px; }
  .scale-step :global(.anchors) { margin-bottom: 8px; }
  .scale-step :global(.number-grid label) { min-height: 48px; }
  .practice-note { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--border); border-radius: 14px; color: var(--ink-muted); background: var(--primary-soft); font-size: 14px; }
  .practice-note strong { color: var(--ink); }
  .learning-steps { margin: 20px 0 0; padding: 12px 16px; border: 1px solid var(--border); border-radius: 20px; display: grid; background: var(--primary-soft); list-style: none; }
  .learning-steps li { min-height: 72px; padding: 10px 0; display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 10px; }
  .learning-steps li + li { border-top: 1px solid var(--border); }
  .learning-steps li > span { width: 38px; height: 38px; border: 1px solid var(--border-strong); border-radius: 50%; display: grid; place-items: center; color: var(--primary); font-weight: 700; background: var(--glass); }
  .learning-steps li div { display: grid; gap: 2px; }
  .learning-steps small { color: var(--ink-muted); font-size: 14px; }
  .privacy-list { margin-top: 18px; padding: 4px 14px; border: 1px solid var(--border); border-radius: 18px; background: var(--primary-soft); }
  .privacy-list p { min-height: 52px; margin: 0; display: flex; align-items: center; gap: 11px; }
  .privacy-list p + p { border-top: 1px solid var(--border); }
  .privacy-list span { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: var(--on-primary); background: var(--primary); }
  .detail-links { display: flex; justify-content: space-between; gap: 10px; }
  .detail-links button { min-height: 44px; border: 0; color: var(--primary); background: transparent; text-decoration: underline; text-underline-offset: 4px; }
  .reminder-choice { margin: 2px 0 0; padding: 12px; border: 1px solid var(--border); border-radius: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: var(--glass); }
  .reminder-choice legend { padding: 0 4px; font-weight: 700; }
  .reminder-choice button { min-width: 0; padding-inline: 9px; }
  .reminder-choice button.selected { border-color: var(--primary); color: var(--on-primary); background: var(--primary); }
  .error { margin: 8px 0 0; color: var(--danger); }
  dialog { width: min(calc(100% - 24px), 520px); padding: 24px; border: 1px solid var(--rim); border-radius: 26px; color: var(--ink); background: var(--glass-strong); box-shadow: var(--shadow); backdrop-filter: blur(30px) saturate(140%); }
  dialog::backdrop { background: rgb(0 16 14 / 62%); backdrop-filter: blur(4px); }
  .sheet { margin-bottom: max(10px, env(safe-area-inset-bottom)); }
  .sheet-handle { width: 42px; height: 5px; margin: -10px auto 18px; border-radius: 999px; background: var(--border-strong); }
  dialog h2 { margin: 0; font-size: 25px; }
  dialog p { color: var(--ink-muted); line-height: 1.4; }
  .sheet-primary { width: 100%; margin-top: 16px; }
  .sheet-cancel { width: 100%; margin-top: 8px; }
  .dialog-close { float: right; width: 44px; height: 44px; border: 0; color: var(--ink); background: transparent; font-size: 26px; }
  @media (max-width: 520px) { .onboarding { padding-right: 10px; padding-left: 10px; } .step { border-radius: 24px; } }
  @media (max-height: 740px) { .step { min-height: 650px; } .illustration { height: 110px; } }
  @media (forced-colors: active) { .step, .learning-steps, .privacy-list, .reminder-choice { border: 1px solid CanvasText; } .theme-options button.selected, .reminder-choice button.selected { outline: 3px solid Highlight; } }
</style>
