<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { AppSettings, Program } from '$lib/data/schema';
  import { getProgramProgress } from '$lib/domain/progression';
  import { reminderCadence } from '$lib/domain/reminders';
  import { runtime } from '$lib/platform/runtime';

  let program = $state<Program | null>(null);
  let settings = $state<AppSettings | null>(null);
  onMount(async () => {
    program = await getRepository().getProgram();
    if (!program) return goto(`${base}/`);
    settings = await getRepository().getSettings();
  });

  async function toggleReminderPause() {
    if (!settings) return;
    const updated = {
      ...settings,
      reminderWindows: [...settings.reminderWindows],
      remindersPaused: !settings.remindersPaused
    };
    await getRepository().saveSettings(updated);
    settings = updated;
  }
</script>

<svelte:head><title>Settings — Learn Your Appetite</title></svelte:head>

<span id="scale" class="scale-anchor" aria-hidden="true"></span>
{#if program && settings}
  {@const progress = getProgramProgress(program.startedAt, runtime.now())}
  <AppShell active="settings">
    <div class="settings-page" data-status="ready">
      <h1>Settings</h1>
      <section>
        <h2>Reminders</h2>
        <p>Week {progress.week} · {reminderCadence(progress.week, settings.remindersPaused)}</p>
        <button aria-pressed={settings.remindersPaused} onclick={toggleReminderPause}>
          {settings.remindersPaused ? 'Resume reminders' : 'Pause reminders'}
        </button>
      </section>
      <section><h2>Scale and program</h2><p>Day {progress.day} of 30 · {progress.focus}. One scale from urgent hunger to painful fullness.</p></section>
      <section><h2>Your data</h2><p>Stored only in this browser on this device.</p></section>
      <section><h2>Support</h2><p>Pause whenever check-ins feel unhelpful.</p></section>
    </div>
  </AppShell>
{:else}
  <div data-status="loading" aria-live="polite">Opening your private records…</div>
{/if}

<style>
  .scale-anchor { position: absolute; }
  h1 { margin: 0 0 28px; font-size: 38px; }
  section { padding: 18px 0; border-top: 1px solid var(--border); }
  h2 { margin: 0; font-size: 19px; }
  p { margin: 4px 0 0; color: var(--ink-muted); }
  button { min-height: 48px; margin-top: 10px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 12px; color: var(--ink); background: var(--surface); font-weight: 700; }
</style>
