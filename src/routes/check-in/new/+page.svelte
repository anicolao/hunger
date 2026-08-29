<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ContextDisclosure from '$lib/components/ContextDisclosure.svelte';
  import SensationScale from '$lib/components/SensationScale.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { EatingEpisode, Occasion, PhotoRecord, Program } from '$lib/data/schema';
  import { createOpenEpisode, markEpisodeUnfinished } from '$lib/domain/episodes';
  import { runtime } from '$lib/platform/runtime';

  let program = $state<Program | null>(null);
  let existing = $state<EatingEpisode | null>(null);
  let level = $state<number | null>(null);
  let occasion = $state<Occasion | null>(null);
  let photo = $state<PhotoRecord | null>(null);
  let status = $state<'loading' | 'ready' | 'saving' | 'error'>('loading');
  let errorMessage = $state('');

  onMount(async () => {
    const repository = getRepository();
    program = await repository.getProgram();
    if (!program) return goto(`${base}/onboarding`);
    existing = await repository.getOpenEpisode(program.id);
    status = 'ready';
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!program || level === null) return;
    status = 'saving';
    errorMessage = '';
    const repository = getRepository();
    let storedPhotoId: string | null = null;
    try {
      if (photo) {
        try {
          await repository.savePhoto(photo);
          storedPhotoId = photo.id;
        } catch {
          storedPhotoId = null;
        }
      }
      const episode = createOpenEpisode({
        id: runtime.createId(),
        programId: program.id,
        level,
        now: runtime.now(),
        timeZone: runtime.timeZone(),
        context: { occasion, photoId: storedPhotoId }
      });
      await repository.saveEpisode(episode);
      await goto(`${base}/?saved=before`, { replaceState: true });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Your selection could not be saved.';
      status = 'error';
    }
  }

  async function markUnfinished() {
    if (!existing) return;
    await getRepository().saveEpisode(markEpisodeUnfinished(existing, runtime.now()));
    existing = null;
  }
</script>

<svelte:head><title>Before eating — Learn Your Appetite</title></svelte:head>

<div class="check-in-page" data-status={status} data-e2e-layout>
  <header>
    <a href={`${base}/`}>← Back</a>
    <strong>Before eating</strong>
    <a href={`${base}/settings#scale`}>Scale help</a>
  </header>

  <main>
    {#if existing}
      <section class="collision" aria-labelledby="open-title">
        <p class="eyebrow">Open eating moment</p>
        <h1 id="open-title">Finish the check-in you started?</h1>
        <p>
          Your before value was {existing.beforeLevel}. Choose what happened so a new moment is
          never paired with the wrong check-in.
        </p>
        <a class="primary" href={`${base}/check-in/after?episode=${existing.id}`}>Finish</a>
        <button class="secondary" onclick={markUnfinished}>Mark unfinished</button>
        <a class="text-action" href={`${base}/`}>Go back</a>
      </section>
    {:else if program}
      <form onsubmit={save}>
        <p class="eyebrow">Before eating</p>
        <h1>How does your body feel?</h1>
        <p class="intro">Choose the closest description right now. Nothing is preselected.</p>
        <SensationScale value={level} onselect={(nextLevel) => (level = nextLevel)} />
        <ContextDisclosure
          programId={program.id}
          {occasion}
          onoccasion={(nextOccasion) => (occasion = nextOccasion)}
          onphoto={(nextPhoto) => (photo = nextPhoto)}
        />
        {#if errorMessage}<p class="error" role="alert" tabindex="-1">{errorMessage}</p>{/if}
        <button class="primary save" type="submit" disabled={level === null || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </form>
    {:else}
      <p aria-live="polite">Opening your private records…</p>
    {/if}
  </main>
</div>

<style>
  .check-in-page { min-height: 100vh; padding: env(safe-area-inset-top) 16px calc(24px + env(safe-area-inset-bottom)); }
  header { width: min(100%, 720px); min-height: 64px; margin-inline: auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
  header a { min-height: 48px; display: inline-flex; align-items: center; color: var(--primary); font-weight: 700; }
  header a:last-child { justify-self: end; }
  main { width: min(100%, 620px); margin: 24px auto; }
  form, .collision { padding: clamp(22px, 5vw, 36px); border: 1px solid var(--border); border-radius: 18px; background: var(--surface); }
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(30px, 7vw, 38px); line-height: 1.1; }
  .intro, .collision > p:not(.eyebrow) { margin: 12px 0 24px; color: var(--ink-muted); line-height: 1.5; }
  .primary, .secondary, .text-action { min-height: 50px; padding: 0 18px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; text-decoration: none; }
  .primary { border: 0; color: white; background: var(--primary); }
  .save { width: 100%; margin-top: 20px; }
  .primary:disabled { opacity: .5; }
  .collision { display: grid; gap: 10px; }
  .collision .primary, .collision .secondary, .collision .text-action { width: 100%; }
  .secondary { border: 1px solid var(--border-strong); color: var(--ink); background: var(--surface); }
  .text-action { color: var(--primary); }
  .error { color: var(--danger); }
  @media (max-width: 520px) {
    .check-in-page { padding-right: 0; padding-left: 0; }
    header { padding: 0 16px; }
    main { margin: 0 auto; }
    form, .collision { border-right: 0; border-left: 0; border-radius: 0; }
  }
</style>
