<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import '../app.css';
  import { installE2EFixtureBoundary } from '$lib/platform/e2e';
  import {
    installNativeLifecycleBoundary,
    nativeCapabilities,
    signalNativeAppReady,
    type NativeLifecycleEvent
  } from '$lib/platform/native';
  import { reconcileStoredReminders } from '$lib/platform/reminders';
  import { runtime } from '$lib/platform/runtime';
  import { registerOfflineShell } from '$lib/platform/offline';
  import { clearDeviceCaches } from '$lib/platform/offline';
  import { getRepository } from '$lib/data/repository';
  import { downloadText } from '$lib/platform/export';
  import { completeNativeDelete } from '$lib/platform/native';
  import { cancelNativeReminders } from '$lib/platform/reminders';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import { applyAppearance } from '$lib/platform/appearance';

  let { children } = $props();
  let storageFailure = $state(false);
  let resetUnderstood = $state(false);
  let recoveryMessage = $state('');

  onMount(() => {
    installE2EFixtureBoundary();
    const showStorageRecovery = () => (storageFailure = true);
    addEventListener('hunger:storage-error', showStorageRecovery);
    void (async () => {
      const repository = getRepository();
      const [program, settings] = await Promise.all([
        repository.getProgram(),
        repository.getSettings()
      ]);
      if (program) applyAppearance(settings.appearance);
    })().catch(showStorageRecovery);
    if (import.meta.env.VITE_NATIVE_SHELL === 'ios') {
      installNativeLifecycleBoundary();
      void nativeCapabilities().then(() => signalNativeAppReady());
      const reconcileOnForeground = (event: Event) => {
        const lifecycle = event as CustomEvent<NativeLifecycleEvent>;
        if (lifecycle.detail.reason === 'foreground') {
          void reconcileStoredReminders(runtime.now());
        } else if (lifecycle.detail.reason === 'notification' && lifecycle.detail.route === 'today') {
          void goto(`${base}/?reminder=${encodeURIComponent(lifecycle.detail.kind ?? 'window')}`);
        }
      };
      addEventListener('hunger:native-lifecycle', reconcileOnForeground);
      return () => {
        removeEventListener('hunger:native-lifecycle', reconcileOnForeground);
        removeEventListener('hunger:storage-error', showStorageRecovery);
      };
    } else {
      void registerOfflineShell();
      return () => removeEventListener('hunger:storage-error', showStorageRecovery);
    }
  });

  async function exportOriginalData() {
    try {
      downloadText('appetite-original-data.json', 'application/json', await getRepository().exportOriginalData());
      recoveryMessage = 'Original local source events exported without changing them.';
    } catch {
      recoveryMessage = 'The browser could not read the original source events. Do not reset if you need to recover them.';
    }
  }

  async function resetStorage() {
    if (!resetUnderstood) return;
    try {
      await cancelNativeReminders();
      await getRepository().deleteAll();
      await clearDeviceCaches();
      await completeNativeDelete();
      location.href = `${base}/`;
    } catch {
      recoveryMessage = 'Reset could not finish. Your original data has not been reported as removed.';
    }
  }
</script>

{#if !storageFailure}{@render children()}{/if}

{#if storageFailure}
  <div class="recovery-backdrop" role="presentation" data-status="ready" data-e2e-layout>
    <div class="storage-recovery" role="alertdialog" aria-modal="true" aria-labelledby="storage-recovery-title">
      <p class="eyebrow">Local data needs attention</p>
      <h1 id="storage-recovery-title">Your records could not be opened safely.</h1>
      <p>The app stopped instead of guessing how to change them. Export the original source events before considering a reset.</p>
      <button class="primary" onclick={exportOriginalData}>Export Original Data</button>
      <ToggleSwitch
        checked={resetUnderstood}
        label="I exported what I need and understand Reset deletes all local app data"
        description="Reset cannot be undone"
        onchange={(checked) => (resetUnderstood = checked)}
      />
      <button class="danger" disabled={!resetUnderstood} onclick={resetStorage}>Reset local app data</button>
      {#if recoveryMessage}<p role="status">{recoveryMessage}</p>{/if}
    </div>
  </div>
{/if}

<style>
  .recovery-backdrop { position: fixed; z-index: 1000; inset: 0; padding: max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)); display: grid; place-items: center; overflow: auto; background: color-mix(in srgb, var(--canvas) 94%, transparent); }
  .storage-recovery { width: min(100%, 560px); padding: clamp(24px, 6vw, 38px); border: 1px solid var(--border-strong); border-radius: 20px; background: var(--surface); box-shadow: 0 24px 80px rgb(0 0 0 / 22%); }
  .eyebrow { margin: 0 0 8px; color: var(--danger); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(30px, 8vw, 40px); line-height: 1.1; }
  p { color: var(--ink-muted); line-height: 1.5; }
  button { width: 100%; min-height: 50px; margin-top: 12px; padding: 0 18px; border-radius: 12px; font-weight: 700; }
  .primary { border: 0; color: white; background: var(--primary); }
  .danger { border: 1px solid var(--danger); color: var(--danger); background: var(--surface); }
  button:disabled { opacity: .45; }
  .storage-recovery :global(.toggle-row) { margin-top: 16px; }
</style>
