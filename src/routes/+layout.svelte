<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { installE2EFixtureBoundary } from '$lib/platform/e2e';
  import { registerOfflineShell } from '$lib/platform/offline';

  let { children } = $props();

  onMount(() => { installE2EFixtureBoundary(); void registerOfflineShell(); });
</script>

{@render children()}
