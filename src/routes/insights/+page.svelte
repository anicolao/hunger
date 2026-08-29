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

<svelte:head><title>Insights — Learn Your Appetite</title></svelte:head>

{#if ready}
  <AppShell active="insights">
    <div class="empty-page" data-status="ready">
      <p class="eyebrow">Your observations</p>
      <h1>Insights</h1>
      <section>
        <h2>Still learning</h2>
        <p>Four paired check-ins will help compare where you started and finished.</p>
        <strong>0 of 4 paired</strong>
        <small>A pair is a before and after check-in from the same eating moment.</small>
      </section>
    </div>
  </AppShell>
{:else}
  <div data-status="loading" aria-live="polite">Opening your private records…</div>
{/if}

<style>
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  h1 { margin: 0; font-size: 38px; }
  section { margin-top: 28px; padding: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
  h2 { margin: 0; font-size: 22px; }
  section p { color: var(--ink-muted); line-height: 1.5; }
  section strong, section small { display: block; }
  section small { margin-top: 8px; color: var(--ink-muted); }
</style>
