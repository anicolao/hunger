<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';

  let ready = $state(false);
  onMount(async () => {
    if (!(await getRepository().getProgram())) return goto(`${base}/`);
    ready = true;
  });
</script>

<svelte:head><title>Settings — Learn Your Appetite</title></svelte:head>

<span id="scale" class="scale-anchor" aria-hidden="true"></span>
{#if ready}
  <AppShell active="settings">
    <div class="settings-page" data-status="ready">
      <h1>Settings</h1>
      <section><h2>Reminders</h2><p>Off · Browser reminders are optional.</p></section>
      <section><h2>Scale and program</h2><p>One scale from urgent hunger to painful fullness.</p></section>
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
</style>
