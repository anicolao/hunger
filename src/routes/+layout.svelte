<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { installE2EFixtureBoundary } from '$lib/platform/e2e';

  let { children } = $props();

  onMount(installE2EFixtureBoundary);
</script>

{@render children()}
