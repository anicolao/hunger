<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { EatingEpisode, ExperimentRecord, Program } from '$lib/data/schema';
  import { buildProfile, type AppetiteProfile } from '$lib/domain/profile';
  import { getProgramProgress, type ProgramProgress } from '$lib/domain/progression';
  import { buildExport, downloadText, exportHtml, exportJson } from '$lib/platform/export';
  import { runtime } from '$lib/platform/runtime';

  let program = $state<Program | null>(null);
  let episodes = $state<EatingEpisode[]>([]);
  let experiments = $state<ExperimentRecord[]>([]);
  let profile = $state<AppetiteProfile | null>(null);
  let progress = $state<ProgramProgress | null>(null);
  let ready = $state(false);

  onMount(async () => {
    const repository = getRepository();
    program = await repository.getProgram();
    if (!program) return goto(`${base}/`);
    progress = getProgramProgress(program.startedAt, runtime.now());
    if (progress.complete && program.status !== 'complete') {
      program = { ...program, status: 'complete' };
      await repository.saveProgram(program);
    }
    episodes = await repository.listEpisodes(program.id);
    experiments = await repository.listExperiments(program.id);
    profile = buildProfile(program, episodes, experiments, runtime.now());
    ready = true;
  });

  function download(format: 'json' | 'html') {
    if (!program || !profile) return;
    const data = buildExport(program, profile, episodes, experiments, runtime.now());
    if (format === 'json') downloadText('appetite-profile.json', 'application/json', exportJson(data));
    else downloadText('appetite-profile.html', 'text/html', exportHtml(data));
  }
</script>

<svelte:head><title>Profile — Learn Your Appetite</title></svelte:head>

{#if program && profile && progress}
  <AppShell active="profile">
    <div class="profile-page" data-status={ready ? 'ready' : 'loading'}>
      <p class="eyebrow">Day {progress.day} of 30</p>
      <h1>Your appetite profile</h1>
      {#if progress.complete}
        <p class="intro">Thirty days completes the guided program, not your access. These are the observations your records currently support.</p>
      {:else}
        <p class="intro">Your profile grows only where your paired check-ins provide enough evidence.</p>
      {/if}

      <div class="profile-grid">
        {#each profile.sections as section}
          <section class:sparse={!section.supported}>
            <span>{section.supported ? `Based on ${section.evidenceCount}` : 'Still learning'}</span>
            <h2>{section.title}</h2>
            <p>{section.supported ? section.summary : section.missing}</p>
          </section>
        {/each}
      </div>

      <section class="practices">
        <span>Continue in your own way</span>
        <h2>Practices to keep</h2>
        {#if profile.practices.length}
          <ul>{#each profile.practices as practice}<li>{practice}</li>{/each}</ul>
        {:else}<p>Practices appear only when an observed pattern supports them.</p>{/if}
      </section>

      <section class="export-card">
        <h2>Keep a private copy</h2>
        <p>Download a readable summary or structured data. Photos are excluded by default.</p>
        <div><button onclick={() => download('html')}>Download readable profile</button><button class="secondary" onclick={() => download('json')}>Download JSON</button></div>
      </section>
    </div>
  </AppShell>
{:else}<div data-status="loading" aria-live="polite">Opening your private records…</div>{/if}

<style>
  .eyebrow, section > span { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(34px, 8vw, 44px); }
  .intro { max-width: 680px; color: var(--ink-muted); font-size: 18px; line-height: 1.5; }
  .profile-grid { margin-top: 28px; display: grid; gap: 16px; }
  section { padding: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
  section.sparse { border-style: dashed; background: color-mix(in srgb, var(--surface) 70%, var(--canvas)); }
  h2 { margin: 10px 0 8px; font-size: 22px; }
  section p, li { color: var(--ink-muted); line-height: 1.5; }
  .practices, .export-card { margin-top: 18px; }
  .practices li { margin-block: 10px; }
  .export-card > div { display: flex; flex-wrap: wrap; gap: 10px; }
  button { min-height: 48px; padding: 0 18px; border: 0; border-radius: 12px; color: white; background: var(--primary); font-weight: 700; }
  button.secondary { border: 1px solid var(--border-strong); color: var(--ink); background: var(--surface); }
  @media (min-width: 680px) { .profile-grid { grid-template-columns: 1fr 1fr; } }
</style>
