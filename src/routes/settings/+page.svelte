<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { AppSettings, EatingEpisode, Program } from '$lib/data/schema';
  import { getProgramProgress } from '$lib/domain/progression';
  import { reminderCadence } from '$lib/domain/reminders';
  import { supportEligible } from '$lib/domain/support';
  import { clearDeviceCaches } from '$lib/platform/offline';
  import { cancelNativeReminders, configureReminders } from '$lib/platform/reminders';
  import { runtime } from '$lib/platform/runtime';

  let program = $state<Program | null>(null);
  let episodes = $state<EatingEpisode[]>([]);
  let settings = $state<AppSettings | null>(null);
  let reminderMessage = $state('');
  let online = $state(true);
  let deleteDialog = $state<HTMLDialogElement>();
  let deleteConfirmed = $state(false);
  let deleting = $state(false);

  onMount(() => {
    online = navigator.onLine;
    const updateOnline = () => online = navigator.onLine;
    addEventListener('online', updateOnline); addEventListener('offline', updateOnline);
    void (async () => {
      const repository = getRepository();
      program = await repository.getProgram();
      if (!program) return goto(`${base}/`);
      episodes = await repository.listEpisodes(program.id);
      settings = await repository.getSettings();
    })();
    return () => { removeEventListener('online', updateOnline); removeEventListener('offline', updateOnline); };
  });

  async function saveSettings(updated: AppSettings) {
    const plain = { ...updated, reminderWindows: [...updated.reminderWindows] };
    await getRepository().append({
      type: 'settings/changed',
      occurredAt: runtime.now(),
      payload: { settings: plain }
    });
    settings = plain;
  }
  async function toggleReminderPause() {
    if (!settings) return;
    const pausing = !settings.remindersPaused;
    await saveSettings({ ...settings, remindersPaused: pausing });
    if (pausing && await cancelNativeReminders()) reminderMessage = 'Private iOS reminders are paused.';
  }
  async function toggleWindow(window: string) {
    if (!settings) return;
    const windows = settings.reminderWindows.includes(window) ? settings.reminderWindows.filter((item) => item !== window) : [...settings.reminderWindows, window];
    await saveSettings({ ...settings, reminderWindows: windows }); reminderMessage = '';
  }
  async function enableReminders() {
    if (!settings || !program) return;
    const cadence = reminderCadence(getProgramProgress(program.startedAt, runtime.now()).week, false);
    const result = await configureReminders(settings.reminderWindows, cadence);
    await saveSettings({
      ...settings,
      remindersPaused: false,
      permissionState: result.capability === 'native-ios' ? result.permissionState : 'unsupported'
    });
    reminderMessage = result.explanation;
  }
  async function pauseProgram() {
    if (!program) return;
    const updated: Program = { ...program, status: 'paused' };
    await getRepository().append({
      type: 'program/status-changed',
      occurredAt: runtime.now(),
      payload: { program: updated }
    });
    program = updated;
  }
  async function dismissSupport() { if (settings) await saveSettings({ ...settings, dismissedSupport: true }); }
  async function deleteEverything() {
    if (!deleteConfirmed) return;
    deleting = true; await getRepository().clearAll(); await clearDeviceCaches();
    location.href = `${base}/`;
  }
</script>

<svelte:head><title>Settings — Learn Your Appetite</title></svelte:head>

<span id="scale" class="scale-anchor" aria-hidden="true"></span>
{#if program && settings}
  {@const progress = getProgramProgress(program.startedAt, runtime.now())}
  {@const cadence = reminderCadence(progress.week, settings.remindersPaused)}
  <AppShell active="settings">
    <div class="settings-page" data-status="ready">
      <p class="eyebrow">Private on this device</p><h1>Settings</h1>

      <section>
        <div class="section-heading"><div><h2>Reminders</h2><p>Week {progress.week} · {cadence}</p></div><span class="status">{online ? 'App ready online' : 'App ready offline'}</span></div>
        <fieldset><legend>In-app noticing windows</legend>
          {#each ['morning', 'midday', 'evening'] as window}
            <label><input type="checkbox" checked={settings.reminderWindows.includes(window)} onchange={() => toggleWindow(window)} />{window[0].toUpperCase() + window.slice(1)}</label>
          {/each}
        </fieldset>
        <div class="actions"><button disabled={!settings.reminderWindows.length} onclick={enableReminders}>Use in-app reminders</button><button class="secondary" aria-pressed={settings.remindersPaused} onclick={toggleReminderPause}>{settings.remindersPaused ? 'Resume reminders' : 'Pause reminders'}</button></div>
        {#if reminderMessage}<p class="notice" role="status">{reminderMessage}</p>{/if}
      </section>

      <section><h2>Scale and program</h2><p>Day {progress.day} of 30 · {progress.focus}. One scale from urgent hunger to painful fullness.</p><a href={`${base}/onboarding?step=scale`}>Review all scale words</a>{#if program.status === 'paused'}<p class="notice">The guided program is paused. Your records remain available.</p>{/if}</section>

      <section>
        <h2>Your data</h2><p>{episodes.length} local eating moment{episodes.length === 1 ? '' : 's'}. Storage is not end-to-end encrypted and may be visible to someone with this browser profile.</p>
        <div class="actions"><a class="button-link" href={`${base}/profile`}>Export profile and data</a><button class="danger secondary" onclick={() => deleteDialog?.showModal()}>Delete everything</button></div>
      </section>

      <section>
        <h2>Support</h2>
        {#if supportEligible(episodes) && !settings.dismissedSupport}
          <aside class="support-card"><h3>Would a pause or extra support feel useful?</h3><p>Several recent check-ins ended with strong discomfort. You can pause this guide, change how you use it, or talk with a qualified health professional. This app cannot diagnose what is happening.</p><div class="actions"><button onclick={pauseProgram}>Pause the program</button><button class="secondary" onclick={dismissSupport}>Dismiss this note</button></div></aside>
        {:else}<p>Pause whenever check-ins feel unhelpful. For medical or eating concerns, a qualified health professional can offer individual support.</p>{/if}
      </section>
    </div>
  </AppShell>

  <dialog bind:this={deleteDialog} onclose={() => deleteConfirmed = false}>
    <form method="dialog"><button class="close" aria-label="Close delete dialog">×</button></form>
    <h2>Delete everything on this device?</h2><p>This physically removes source events, check-ins, photos, insights, experiments, settings, reminders, and cached app data. It cannot be undone.</p>
    <label class="confirm"><input type="checkbox" bind:checked={deleteConfirmed} />I understand this cannot be undone</label>
    <button class="danger-button" disabled={!deleteConfirmed || deleting} onclick={deleteEverything}>{deleting ? 'Deleting…' : 'Delete everything'}</button>
  </dialog>
{:else}<div data-status="loading" aria-live="polite">Opening your private records…</div>{/if}

<style>
  .scale-anchor { position: absolute; }
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0 0 28px; font-size: 38px; }
  section { padding: 24px 0; border-top: 1px solid var(--border); }
  h2 { margin: 0; font-size: 21px; } h3 { margin: 0; font-size: 20px; }
  p { margin: 6px 0 0; color: var(--ink-muted); line-height: 1.5; }
  .section-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
  .status { height: fit-content; padding: 5px 9px; border-radius: 999px; background: var(--primary-soft); font-size: 13px; font-weight: 700; }
  fieldset { margin: 18px 0 0; padding: 0; border: 0; } legend { font-weight: 700; }
  fieldset label { min-height: 48px; margin-right: 8px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; background: var(--surface); text-transform: capitalize; }
  input[type='checkbox'] { width: 46px; height: 46px; margin: 0; }
  .actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; }
  button, .button-link, section > a { min-height: 48px; padding: 0 14px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; color: white; background: var(--primary); font-weight: 700; }
  button.secondary, .button-link { border: 1px solid var(--border-strong); color: var(--ink); background: var(--surface); }
  button:disabled { opacity: .5; }
  section > a { width: fit-content; margin-top: 12px; color: var(--primary); background: transparent; }
  .notice { margin-top: 14px; padding: 12px; border-radius: 10px; color: var(--ink); background: var(--primary-soft); }
  .support-card { margin-top: 14px; padding: 20px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
  .danger { color: var(--danger) !important; }
  dialog { width: min(100% - 32px, 520px); padding: 28px; border: 0; border-radius: 18px; color: var(--ink); background: var(--surface); }
  dialog::backdrop { background: rgb(20 30 26 / .55); }
  dialog form { float: right; } .close { width: 48px; padding: 0; color: var(--ink); background: transparent; font-size: 26px; }
  .confirm { min-height: 48px; margin: 20px 0; display: flex; align-items: center; gap: 10px; }
  .danger-button { color: white; background: var(--danger); }
</style>
