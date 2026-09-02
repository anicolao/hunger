<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { AppSettings, EatingEpisode, ExperimentRecord, Program } from '$lib/data/schema';
  import { buildProfile, type AppetiteProfile } from '$lib/domain/profile';
  import { getProgramProgress, type ProgramProgress } from '$lib/domain/progression';
  import { buildExport, encodeExportPhotos, exportHtml, exportJson, shareExport } from '$lib/platform/export';
  import { runtime } from '$lib/platform/runtime';
  import { reconcileStoredReminders } from '$lib/platform/reminders';
  import { reconcileProgramLifecycle } from '$lib/platform/program';

  let program = $state<Program | null>(null);
  let episodes = $state<EatingEpisode[]>([]);
  let experiments = $state<ExperimentRecord[]>([]);
  let profile = $state<AppetiteProfile | null>(null);
  let progress = $state<ProgramProgress | null>(null);
  let ready = $state(false);
  let exportMessage = $state('');
  let settings = $state<AppSettings | null>(null);
  let exporting = $state(false);

  onMount(async () => {
    const repository = getRepository();
    program = await reconcileProgramLifecycle(runtime.now(), repository);
    if (!program) return goto(`${base}/`);
    progress = getProgramProgress(program.startedAt, runtime.now(), program.timeZone);
    if (progress.complete) await reconcileStoredReminders(runtime.now());
    episodes = await repository.listEpisodes(program.id);
    experiments = await repository.listExperiments(program.id);
    settings = await repository.getSettings();
    profile = buildProfile(program, episodes, experiments, runtime.now());
    ready = true;
  });

  async function download(format: 'json' | 'html') {
    if (!program || !profile || !settings || exporting) return;
    exporting = true;
    exportMessage = '';
    try {
      const photos = settings.includePhotosInExport
        ? await encodeExportPhotos(episodes, (id) => getRepository().getPhoto(id))
        : [];
      const data = buildExport(
        program,
        profile,
        episodes,
        experiments,
        runtime.now(),
        photos,
        settings.includePhotosInExport
      );
      const destination = format === 'json'
        ? await shareExport('appetite-profile.json', 'application/json', exportJson(data))
        : await shareExport('appetite-profile.html', 'text/html', exportHtml(data));
      exportMessage = destination === 'native-ios'
        ? 'Private export closed and temporary file removed.'
        : `Private export downloaded${data.photoPolicy.omittedCount ? `; ${data.photoPolicy.omittedCount} photo${data.photoPolicy.omittedCount === 1 ? '' : 's'} omitted by the selected policy or size limit` : ''}.`;
    } catch {
      exportMessage = 'The private export could not be shared. No temporary copy was kept.';
    } finally {
      exporting = false;
    }
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

      <section class="export-card">
        <h2>Keep a private copy</h2>
        <p>Export a readable summary or structured data. {settings?.includePhotosInExport ? 'Photos are included only because you enabled them in Settings.' : 'Photos are excluded by default.'}</p>
        <div><button aria-label="Download readable profile" disabled={exporting} onclick={() => download('html')}>Export profile</button><button class="secondary" disabled={exporting} onclick={() => download('json')}>Download JSON</button></div>
        {#if exportMessage}<p role="status">{exportMessage}</p>{/if}
      </section>

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

    </div>
  </AppShell>
{:else}<div data-status="loading" aria-live="polite">Opening your private records…</div>{/if}

<style>
  .eyebrow, section > span { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(34px, 8vw, 44px); }
  .intro { max-width: 680px; margin: 8px 0 0; color: var(--ink-muted); line-height: 1.4; }
  .profile-grid { margin-top: 14px; display: grid; gap: 12px; }
  section { padding: 20px; border: 1px solid var(--rim); border-radius: 20px; background: var(--glass); box-shadow: var(--shadow); backdrop-filter: blur(22px) saturate(130%); }
  section.sparse { border-style: dashed; background: color-mix(in srgb, var(--surface) 70%, var(--canvas)); }
  h2 { margin: 10px 0 8px; font-size: 22px; }
  section p, li { color: var(--ink-muted); line-height: 1.5; }
  .practices, .export-card { margin-top: 14px; }
  .practices li { margin-block: 10px; }
  .export-card > div { display: flex; flex-wrap: wrap; gap: 10px; }
  button { min-height: 48px; padding: 0 18px; border: 0; border-radius: 14px; color: var(--on-primary); background: var(--primary); font-weight: 700; }
  button.secondary { border: 1px solid var(--border-strong); color: var(--ink); background: var(--glass); }
  .export-card h2 { margin-top: 0; }
  .export-card p { margin: 6px 0 14px; }
  @media (min-width: 680px) { .profile-grid { grid-template-columns: 1fr 1fr; } }
</style>
