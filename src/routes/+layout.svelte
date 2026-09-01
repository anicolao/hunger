<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { installE2EFixtureBoundary } from '$lib/platform/e2e';
  import {
    installNativeLifecycleBoundary,
    nativeCapabilities,
    type NativeLifecycleEvent
  } from '$lib/platform/native';
  import { reconcileStoredReminders } from '$lib/platform/reminders';
  import { runtime } from '$lib/platform/runtime';
  import { registerOfflineShell } from '$lib/platform/offline';

  let { children } = $props();

  onMount(() => {
    installE2EFixtureBoundary();
    if (import.meta.env.VITE_NATIVE_SHELL === 'ios') {
      installNativeLifecycleBoundary();
      void nativeCapabilities();
      const reconcileOnForeground = (event: Event) => {
        const lifecycle = event as CustomEvent<NativeLifecycleEvent>;
        if (lifecycle.detail.reason === 'foreground') {
          void reconcileStoredReminders(runtime.now());
        }
      };
      addEventListener('hunger:native-lifecycle', reconcileOnForeground);
      return () => removeEventListener('hunger:native-lifecycle', reconcileOnForeground);
    } else {
      void registerOfflineShell();
    }
  });
</script>

{@render children()}
