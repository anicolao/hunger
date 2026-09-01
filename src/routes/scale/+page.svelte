<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import ScaleReference from '$lib/components/ScaleReference.svelte';

  let returnTo = $state('/settings');

  onMount(() => {
    const candidate = new URL(location.href).searchParams.get('returnTo');
    if (
      candidate === '/settings'
      || candidate === '/check-in/new'
      || candidate?.startsWith('/check-in/after?episode=')
    ) returnTo = candidate;
  });
</script>

<svelte:head><title>Scale reference — Learn Your Appetite</title></svelte:head>

<main data-status="ready" data-e2e-layout>
  <a class="back" href={`${base}${returnTo}`}>← Back</a>
  <p class="eyebrow">Scale reference</p>
  <h1>One direction, every time</h1>
  <p class="intro">Choose the closest description. A number describes a body sensation; it is never a grade or a target.</p>
  <ScaleReference />
</main>

<style>
  main { width: min(100% - 32px, 620px); margin: 0 auto; padding: calc(18px + env(safe-area-inset-top)) 0 calc(32px + env(safe-area-inset-bottom)); }
  .back { min-height: 48px; padding: 0; border: 0; display: inline-flex; align-items: center; color: var(--primary); background: transparent; font: inherit; font-weight: 700; }
  .eyebrow { margin: 24px 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(32px, 8vw, 42px); line-height: 1.08; }
  .intro { margin: 12px 0 0; color: var(--ink-muted); line-height: 1.5; }
</style>
