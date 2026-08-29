<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { Program } from '$lib/data/schema';
  import { getProgramProgress } from '$lib/domain/progression';

  let program = $state<Program | null>(null);
  onMount(async () => {
    program = await getRepository().getProgram();
    if (!program) await goto(`${base}/`);
  });
</script>

<svelte:head><title>Profile — Learn Your Appetite</title></svelte:head>

{#if program}
  {@const progress = getProgramProgress(program.startedAt, Date.now())}
  <AppShell active="profile">
    <div class="profile-page" data-status="ready">
      <p>Day {progress.day} of 30</p>
      <h1>Your appetite profile</h1>
      <section>
        <h2>Your profile will grow with evidence</h2>
        <p>Typical starts, finishes, contexts, and experiments will appear only when your check-ins support them.</p>
      </section>
    </div>
  </AppShell>
{:else}
  <div data-status="loading" aria-live="polite">Opening your private records…</div>
{/if}

<style>
  .profile-page > p { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: 38px; }
  section { margin-top: 28px; padding: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
  h2 { margin: 0; font-size: 22px; }
  section p { color: var(--ink-muted); line-height: 1.5; }
</style>
