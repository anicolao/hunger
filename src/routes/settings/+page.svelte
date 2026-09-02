<script lang="ts">
  import { base } from '$app/paths';
  import { animateDetails } from '$lib/actions/animateDetails';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import ReminderWindowSwitches from '$lib/components/ReminderWindowSwitches.svelte';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import { getRepository } from '$lib/data/repository';
  import { SCHEMA_VERSION, type AppSettings, type EatingEpisode, type Program } from '$lib/data/schema';
  import { getProgramProgress } from '$lib/domain/progression';
  import { reminderCadence } from '$lib/domain/reminders';
  import { supportEligible } from '$lib/domain/support';
  import { clearDeviceCaches } from '$lib/platform/offline';
  import { completeNativeDelete } from '$lib/platform/native';
  import { getNativeReminderDiagnostics, openNativeNotificationSettings, reconcileStoredReminders, type NativeReminderDiagnostics } from '$lib/platform/reminders';
  import { runtime } from '$lib/platform/runtime';
  import { reconcileProgramLifecycle } from '$lib/platform/program';
  import { applyAppearance, type Appearance } from '$lib/platform/appearance';

  let program = $state<Program | null>(null);
  let episodes = $state<EatingEpisode[]>([]);
  let settings = $state<AppSettings | null>(null);
  let reminderMessage = $state('');
  let reminderDiagnostics = $state<NativeReminderDiagnostics | null>(null);
  let online = $state(true);
  let deleteDialog = $state<HTMLDialogElement>();
  let deleteConfirmed = $state(false);
  let deleting = $state(false);
  let restartDialog = $state<HTMLDialogElement>();
  let restartConfirmed = $state(false);
  let supportDialog = $state<HTMLDialogElement>();
  let storageSummary = $state('Checking local storage…');
  let recoveryMessage = $state('');
  let preferenceMessage = $state('');
  let settingsWrite = Promise.resolve();
  let remindersOpen = $state(false);
  let programOpen = $state(false);
  let dataOpen = $state(false);
  let accessibilityOpen = $state(false);
  let supportOpen = $state(false);

  onMount(() => {
    dataOpen = location.hash === '#manage-data';
    online = navigator.onLine;
    const updateOnline = () => online = navigator.onLine;
    addEventListener('online', updateOnline); addEventListener('offline', updateOnline);
    void (async () => {
      const repository = getRepository();
      program = await reconcileProgramLifecycle(runtime.now(), repository);
      if (!program) return goto(`${base}/`);
      episodes = await repository.listEpisodes(program.id);
      settings = await repository.getSettings();
      reminderDiagnostics = await getNativeReminderDiagnostics();
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage ?? 0;
        storageSummary = used < 1_000_000
          ? `${Math.max(1, Math.round(used / 1_000))} KB used on this device.`
          : `${(used / 1_000_000).toFixed(1)} MB used on this device.`;
      } else storageSummary = 'Stored privately in this browser profile.';
    })();
    return () => { removeEventListener('online', updateOnline); removeEventListener('offline', updateOnline); };
  });

  async function saveSettings(updated: AppSettings) {
    const plain = { ...updated, reminderWindows: [...updated.reminderWindows] };
    settings = plain;
    settingsWrite = settingsWrite.then(() => getRepository().append({
      type: 'settings/changed',
      occurredAt: runtime.now(),
      payload: { settings: plain }
    }));
    await settingsWrite;
  }
  async function setAppearance(appearance: Appearance) {
    if (!settings || settings.appearance === appearance) return;
    applyAppearance(appearance);
    await saveSettings({ ...settings, appearance });
    preferenceMessage = `${appearance === 'light' ? 'Light' : 'Dark'} appearance saved.`;
  }
  async function toggleReminderPause() {
    if (!settings) return;
    const pausing = !settings.remindersPaused;
    await saveSettings({ ...settings, remindersPaused: pausing });
    const result = await reconcileStoredReminders(runtime.now());
    settings = await getRepository().getSettings();
    reminderDiagnostics = await getNativeReminderDiagnostics();
    reminderMessage = pausing
      ? result.capability === 'native-ios'
        ? 'Private iOS reminders are paused.'
        : 'Reminder preferences are paused.'
      : result.explanation;
  }
  async function toggleWindow(window: string) {
    if (!settings) return;
    if (!settings.reminderWindows.includes(window) && settings.reminderWindows.length >= 2) {
      reminderMessage = 'Choose up to two reminder windows.';
      return;
    }
    const windows = settings.reminderWindows.includes(window) ? settings.reminderWindows.filter((item) => item !== window) : [...settings.reminderWindows, window];
    await saveSettings({ ...settings, reminderWindows: windows });
    const result = await reconcileStoredReminders(runtime.now());
    settings = await getRepository().getSettings();
    reminderDiagnostics = await getNativeReminderDiagnostics();
    reminderMessage = result.explanation;
  }
  async function enableReminders() {
    if (!settings || !program) return;
    if (settings.remindersPaused) await saveSettings({ ...settings, remindersPaused: false });
    const result = await reconcileStoredReminders(runtime.now(), true);
    settings = await getRepository().getSettings();
    reminderDiagnostics = await getNativeReminderDiagnostics();
    reminderMessage = result.explanation;
  }
  async function setProgramStatus(status: 'active' | 'paused') {
    if (!program) return;
    const updated: Program = { ...program, status };
    await getRepository().append({
      type: 'program/status-changed',
      occurredAt: runtime.now(),
      payload: { program: updated }
    });
    program = updated;
    const result = await reconcileStoredReminders(runtime.now());
    reminderMessage = result.explanation;
  }
  async function restartProgram() {
    if (!program || !restartConfirmed) return;
    const now = runtime.now();
    const restarted: Program = {
      id: runtime.createId(),
      startedAt: now,
      timeZone: runtime.timeZone(),
      status: 'active',
      onboardingVersion: program.onboardingVersion,
      schemaVersion: SCHEMA_VERSION
    };
    await getRepository().append({
      type: 'program/started',
      occurredAt: now,
      payload: { program: restarted }
    });
    await reconcileStoredReminders(now);
    location.href = `${base}/`;
  }
  async function dismissSupport() { if (settings) await saveSettings({ ...settings, dismissedSupport: true }); }
  async function restoreSupport() { if (settings) await saveSettings({ ...settings, dismissedSupport: false }); }
  async function setPreference(key: 'reducedPrompts' | 'includePhotosInExport', checked: boolean) {
    if (!settings) return;
    preferenceMessage = '';
    await saveSettings({ ...settings, [key]: checked });
    preferenceMessage = key === 'reducedPrompts'
      ? 'Reduced prompt preference saved.'
      : 'Photo export preference saved.';
  }
  async function rebuildProjection() {
    recoveryMessage = 'Rebuilding local views from the source event log…';
    try {
      await getRepository().rebuildProjection();
      program = await getRepository().getProgram();
      episodes = program ? await getRepository().listEpisodes(program.id) : [];
      settings = await getRepository().getSettings();
      recoveryMessage = 'Local views were rebuilt from the source event log.';
    } catch {
      recoveryMessage = 'Recovery could not finish. Your source event log was not changed.';
    }
  }
  async function deleteEverything() {
    if (!deleteConfirmed) return;
    deleting = true; await getRepository().deleteAll(); await clearDeviceCaches();
    await completeNativeDelete();
    location.href = `${base}/`;
  }
</script>

<svelte:head><title>Settings — Learn Your Appetite</title></svelte:head>

{#if program && settings}
  {@const progress = getProgramProgress(program.startedAt, runtime.now(), program.timeZone)}
  {@const cadence = reminderCadence(progress.week, settings.remindersPaused)}
  <AppShell active="settings">
    <div class="settings-page" data-status="ready">
      <p class="eyebrow">Private on this device</p><h1>Settings</h1>
      <p class="connection">{online ? 'Ready' : 'Available offline'}</p>

      <section class="appearance-section">
        <h2>Appearance</h2>
        <div class="appearance-picker" aria-label="Appearance">
          <button class:active={settings.appearance === 'light'} aria-pressed={settings.appearance === 'light'} onclick={() => setAppearance('light')}>Light</button>
          <button class:active={settings.appearance === 'dark'} aria-pressed={settings.appearance === 'dark'} onclick={() => setAppearance('dark')}>Dark</button>
        </div>
        {#if preferenceMessage.endsWith('appearance saved.')}<p class="diagnostic" role="status">{preferenceMessage}</p>{/if}
      </section>

      <div class="settings-groups">
      <details class="settings-group" bind:open={remindersOpen} use:animateDetails>
        <summary><span><strong>Reminders</strong><small>{settings.reminderWindows.length ? settings.reminderWindows.map((window) => window[0].toUpperCase() + window.slice(1)).join(', ') : 'Off'}</small></span><b aria-hidden="true">›</b></summary>
      <section>
        <div class="section-heading"><div><h2>Reminders</h2><p>Week {progress.week} · {cadence}</p></div><span class="status">{online ? 'App ready online' : 'App ready offline'}</span></div>
        <ReminderWindowSwitches
          selected={settings.reminderWindows}
          legend="In-app noticing windows"
          ontoggle={toggleWindow}
        />
        <div class="actions"><button disabled={!settings.reminderWindows.length} onclick={enableReminders}>Allow iOS reminders</button><button class="secondary" aria-pressed={settings.remindersPaused} onclick={toggleReminderPause}>{settings.remindersPaused ? 'Resume reminders' : 'Pause reminders'}</button>{#if settings.permissionState === 'denied'}<button class="secondary" onclick={openNativeNotificationSettings}>Open notification settings</button>{/if}</div>
        {#if reminderMessage}<p class="notice" role="status">{reminderMessage}</p>{/if}
        {#if reminderDiagnostics}<p class="diagnostic" role="status">iOS has {reminderDiagnostics.scheduled} private reminder{reminderDiagnostics.scheduled === 1 ? '' : 's'} pending.</p>{/if}
      </section></details>

      <details class="settings-group" bind:open={programOpen} use:animateDetails>
        <summary><span><strong>Program &amp; scale</strong><small>Day {progress.day} · {program.status}</small></span><b aria-hidden="true">›</b></summary>
      <section>
        <h2>Scale and program</h2>
        <p>Day {progress.day} of 30 · {progress.focus}. One scale from urgent hunger to painful fullness.</p>
        <a href={`${base}/scale?returnTo=${encodeURIComponent('/settings')}`}>Review all scale words</a>
        {#if program.status === 'paused'}
          <p class="notice">The guided program is paused. Your records remain available and the calendar continues without a streak.</p>
          <button class="secondary program-action" onclick={() => setProgramStatus('active')}>Resume check-ins</button>
        {:else if program.status === 'complete'}
          <p class="notice">The 30-day guide is complete. You can keep occasional check-ins or begin a new program.</p>
          <button class="secondary program-action" onclick={() => restartDialog?.showModal()}>Start a new 30-day program</button>
        {:else}
          <button class="secondary program-action" onclick={() => setProgramStatus('paused')}>Pause check-ins</button>
        {/if}
      </section></details>

      <details class="settings-group" id="manage-data" bind:open={dataOpen} use:animateDetails>
        <summary><span><strong>Your data</strong><small>{episodes.length} moment{episodes.length === 1 ? '' : 's'} · {storageSummary}</small></span><b aria-hidden="true">›</b></summary>
      <section>
        <h2>Your data</h2><p>{episodes.length} local eating moment{episodes.length === 1 ? '' : 's'}. Storage is not end-to-end encrypted and may be visible to someone with this browser profile.</p>
        <p class="diagnostic">{storageSummary}</p>
        <ToggleSwitch
          label="Include photos in exports"
          description={settings.includePhotosInExport ? 'On — exports may be much larger' : 'Off — privacy-preserving default'}
          checked={settings.includePhotosInExport}
          onchange={(checked) => setPreference('includePhotosInExport', checked)}
        />
        {#if preferenceMessage.startsWith('Photo')}<p class="diagnostic" role="status">{preferenceMessage}</p>{/if}
        <div class="actions"><a class="button-link" href={`${base}/profile`}>Export profile and data</a><button class="danger secondary" onclick={() => deleteDialog?.showModal()}>Delete everything</button></div>
        <div class="recovery"><h3>Storage recovery</h3><p>The event log is authoritative; the app can rebuild its editable views without changing source events.</p><button class="secondary" onclick={rebuildProjection}>Rebuild local views</button>{#if recoveryMessage}<p class="notice" role="status">{recoveryMessage}</p>{/if}</div>
      </section></details>

      <details class="settings-group" bind:open={accessibilityOpen} use:animateDetails>
        <summary><span><strong>Accessibility</strong><small>{settings.reducedPrompts ? 'Reduced prompts on' : 'Standard prompts'}</small></span><b aria-hidden="true">›</b></summary>
      <section>
        <h2>Accessibility</h2>
        <p>Text size, contrast, and reduced motion follow this device. Appearance uses your choice above.</p>
        <ToggleSwitch
          label="Reduced prompts"
          description={settings.reducedPrompts ? 'On — check-ins use shorter guidance' : 'Off — check-ins include gentle guidance'}
          checked={settings.reducedPrompts}
          onchange={(checked) => setPreference('reducedPrompts', checked)}
        />
        {#if preferenceMessage.startsWith('Reduced')}<p class="diagnostic" role="status">{preferenceMessage}</p>{/if}
      </section></details>

      <details class="settings-group" bind:open={supportOpen} use:animateDetails>
        <summary><span><strong>Support</strong><small>Available anytime</small></span><b aria-hidden="true">›</b></summary>
      <section>
        <h2>Support</h2>
        {#if supportEligible(episodes) && !settings.dismissedSupport}
          <aside class="support-card"><h3>Would a pause or extra support feel useful?</h3><p>If eating feels out of control, brings guilt or distress, or often ends in extreme discomfort, a qualified healthcare professional can help.</p><p>You can pause this program at any time.</p><div class="actions"><button onclick={() => setProgramStatus('paused')}>Pause check-ins</button><button class="secondary" onclick={() => supportDialog?.showModal()}>Learn about support</button><button class="secondary" onclick={dismissSupport}>Dismiss</button></div></aside>
        {:else}<p>Pause whenever check-ins feel unhelpful. This learning tool cannot diagnose or replace individual care.</p><div class="actions"><button class="secondary" onclick={() => supportDialog?.showModal()}>Learn about support</button>{#if settings.dismissedSupport}<button class="secondary" onclick={restoreSupport}>Show support note again</button>{/if}</div>{/if}
      </section></details>
      </div>

      <footer class="build-information">
        <span>Learn Your Appetite</span>
        <span data-testid="build-marker">Build {import.meta.env.VITE_GIT_HASH}</span>
      </footer>
    </div>
  </AppShell>

  <dialog bind:this={deleteDialog} onclose={() => deleteConfirmed = false}>
    <form method="dialog"><button class="close" aria-label="Close delete dialog">×</button></form>
    <h2>Delete everything on this device?</h2><p>This physically removes source events, check-ins, photos, insights, experiments, settings, reminders, and cached app data. It cannot be undone.</p>
    <label class="confirm"><input type="checkbox" bind:checked={deleteConfirmed} />I understand this cannot be undone</label>
    <button class="danger-button" disabled={!deleteConfirmed || deleting} onclick={deleteEverything}>{deleting ? 'Deleting…' : 'Delete everything'}</button>
  </dialog>
  <dialog bind:this={restartDialog} onclose={() => restartConfirmed = false}>
    <form method="dialog"><button class="close" aria-label="Close restart dialog">×</button></form>
    <h2>Start a new 30-day program?</h2>
    <p>Your earlier source events and records stay on this device until you delete everything. The new program starts at day 1 with no streak or carried-over claims.</p>
    <label class="confirm"><input type="checkbox" bind:checked={restartConfirmed} />I understand this starts a new program</label>
    <button disabled={!restartConfirmed} onclick={restartProgram}>Start new program</button>
  </dialog>
  <dialog bind:this={supportDialog}>
    <form method="dialog"><button class="close" aria-label="Close support information">×</button></form>
    <h2>Support is a valid next step</h2>
    <p>If eating feels out of control, brings guilt or distress, or often ends in extreme discomfort, a qualified healthcare professional can help.</p>
    <p>This app is a private learning tool, not medical advice. It does not diagnose an eating disorder or prescribe how much to eat.</p>
    <p>You can pause this program at any time. Country-specific services are not listed here because they require maintained, locally reviewed information.</p>
    <button onclick={() => { setProgramStatus('paused'); supportDialog?.close(); }}>Pause check-ins</button>
  </dialog>
{:else}<div data-status="loading" aria-live="polite">Opening your private records…</div>{/if}

<style>
  .settings-page { max-width: 720px; margin-inline: auto; }
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0 0 16px; font-size: 38px; letter-spacing: -.035em; }
  .connection { width: fit-content; margin: -8px 0 12px; padding: 4px 9px; border-radius: 999px; color: var(--ink-muted); background: var(--primary-soft); font-size: 13px; }
  section { padding: 20px; }
  h2 { margin: 0; font-size: 21px; } h3 { margin: 0; font-size: 20px; }
  p { margin: 6px 0 0; color: var(--ink-muted); line-height: 1.5; }
  .section-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
  .status { height: fit-content; padding: 5px 9px; border-radius: 999px; background: var(--primary-soft); font-size: 13px; font-weight: 700; }
  .appearance-section { margin-bottom: 12px; border: 1px solid var(--rim); border-radius: 20px; background: var(--glass); box-shadow: var(--shadow); backdrop-filter: blur(22px) saturate(130%); }
  .appearance-picker { margin-top: 12px; padding: 4px; border: 1px solid var(--border); border-radius: 14px; display: grid; grid-template-columns: 1fr 1fr; background: var(--primary-soft); }
  .appearance-picker button { min-height: 44px; border: 0; color: var(--ink); background: transparent; }
  .appearance-picker button.active { color: var(--on-primary); background: var(--primary); }
  .settings-groups { border: 1px solid var(--rim); border-radius: 20px; overflow: hidden; background: var(--glass); box-shadow: var(--shadow); backdrop-filter: blur(22px) saturate(130%); }
  .settings-group + .settings-group { border-top: 1px solid var(--border); }
  .settings-group > summary { min-height: 68px; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; list-style: none; }
  .settings-group > summary::-webkit-details-marker { display: none; }
  .settings-group > summary > span { display: grid; gap: 2px; }
  .settings-group > summary strong { font-size: 17px; }
  .settings-group > summary small { color: var(--ink-muted); font-size: 13px; font-weight: 400; }
  .settings-group > summary b { color: var(--ink-muted); font-size: 26px; font-weight: 400; transition: transform 160ms ease; }
  .settings-group[open] > summary b { transform: rotate(90deg); }
  .settings-group > section { border-top: 1px solid var(--border); background: color-mix(in srgb, var(--glass-strong) 86%, transparent); }
  .actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; }
  button, .button-link, section > a { min-height: 48px; padding: 0 14px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; color: var(--on-primary); background: var(--primary); font-weight: 700; }
  button.secondary, .button-link { border: 1px solid var(--border-strong); color: var(--ink); background: var(--glass); }
  button:disabled { opacity: .5; }
  section > a { width: fit-content; margin-top: 12px; color: var(--primary); background: transparent; }
  .notice { margin-top: 14px; padding: 12px; border-radius: 10px; color: var(--ink); background: var(--primary-soft); }
  .program-action { margin-top: 14px; }
  .diagnostic { font-size: 14px; }
  .support-card { margin-top: 14px; padding: 20px; border: 1px solid var(--border); border-radius: 14px; background: var(--glass); }
  .recovery { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); }
  .danger { color: var(--danger) !important; }
  dialog { width: min(100% - 32px, 520px); padding: 28px; border: 1px solid var(--rim); border-radius: 24px; color: var(--ink); background: var(--glass-strong); box-shadow: var(--shadow); backdrop-filter: blur(24px); }
  dialog::backdrop { background: rgb(20 30 26 / .55); }
  dialog form { float: right; } .close { width: 48px; padding: 0; color: var(--ink); background: transparent; font-size: 26px; }
  .confirm { min-height: 48px; margin: 20px 0; display: flex; align-items: center; gap: 10px; }
  .confirm input[type='checkbox'] { width: 46px; height: 46px; margin: 0; }
  .danger-button { color: white; background: var(--danger); }
  .build-information { padding-top: 24px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; color: var(--ink-muted); font-size: 12px; }
  @media (prefers-reduced-motion: reduce) { .settings-group > summary b { transition: none; } }
</style>
