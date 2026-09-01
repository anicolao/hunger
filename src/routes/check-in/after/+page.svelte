<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import ContextDisclosure from '$lib/components/ContextDisclosure.svelte';
  import SensationScale from '$lib/components/SensationScale.svelte';
  import { getRepository } from '$lib/data/repository';
  import type {
    EatingEpisode,
    EatingReason,
    Occasion,
    PhotoRecord,
    Program
  } from '$lib/data/schema';
  import { completeEpisode } from '$lib/domain/episodes';
  import { getSensationLevel } from '$lib/domain/scale';
  import { reconcileStoredReminders } from '$lib/platform/reminders';
  import { runtime } from '$lib/platform/runtime';
  import { reconcileProgramLifecycle } from '$lib/platform/program';

  let program = $state<Program | null>(null);
  let episode = $state<EatingEpisode | null>(null);
  let level = $state<number | null>(null);
  let reason = $state<EatingReason | null>(null);
  let occasion = $state<Occasion | null>(null);
  let note = $state('');
  let photo = $state<PhotoRecord | null>(null);
  let status = $state<'loading' | 'ready' | 'saving' | 'error'>('loading');
  let errorMessage = $state('');

  onMount(async () => {
    const repository = getRepository();
    program = await reconcileProgramLifecycle(runtime.now(), repository);
    const episodeId = page.url.searchParams.get('episode');
    episode = episodeId ? await repository.getEpisode(episodeId) : null;
    if (!program) return goto(`${base}/onboarding`);
    status = 'ready';
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!episode || level === null) return;
    status = 'saving';
    errorMessage = '';
    const repository = getRepository();
    try {
      const now = runtime.now();
      const completed = completeEpisode(episode, level, now, {
        reason,
        occasion,
        note,
        photoId: photo?.id ?? episode.photoId
      });
      if (photo) {
        try {
          await repository.append(
            { type: 'photo/stored', occurredAt: now, payload: { photo } },
            { type: 'episode/changed', occurredAt: now, payload: { episode: completed } }
          );
        } catch {
          await repository.append({
            type: 'episode/changed',
            occurredAt: now,
            payload: { episode: { ...completed, photoId: episode.photoId } }
          });
        }
      } else {
        await repository.append({
          type: 'episode/changed',
          occurredAt: now,
          payload: { episode: completed }
        });
      }
      await reconcileStoredReminders(now);
      await goto(`${base}/?saved=complete`, { replaceState: true });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Your check-in could not be completed.';
      status = 'error';
    }
  }
</script>

<svelte:head><title>After eating — Learn Your Appetite</title></svelte:head>

<div class="check-in-page" data-status={status} data-e2e-layout>
  <header>
    <a href={`${base}/`}>← Back</a>
    <strong>After eating</strong>
    <a href={`${base}/settings#scale`}>Scale help</a>
  </header>

  <main>
    {#if episode && program}
      <form onsubmit={save}>
        <p class="before-summary">
          You began at <strong>{episode.beforeLevel} · {getSensationLevel(episode.beforeLevel).phrase}</strong>
        </p>
        <h1>How does your body feel now?</h1>
        <p class="intro">Use the same scale in the same direction.</p>
        <SensationScale
          value={level}
          legend="Choose your sensation after eating"
          onselect={(nextLevel) => (level = nextLevel)}
        />
        <ContextDisclosure
          programId={program.id}
          includeReason
          {reason}
          {occasion}
          {note}
          onreason={(nextReason) => (reason = nextReason)}
          onoccasion={(nextOccasion) => (occasion = nextOccasion)}
          onnote={(nextNote) => (note = nextNote)}
          onphoto={(nextPhoto) => (photo = nextPhoto)}
        />
        {#if errorMessage}<p class="error" role="alert" tabindex="-1">{errorMessage}</p>{/if}
        <button class="primary" type="submit" disabled={level === null || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Finish check-in'}
        </button>
      </form>
    {:else if status === 'ready'}
      <section class="missing">
        <h1>This eating moment was not found</h1>
        <p>It may have been completed or deleted in another tab.</p>
        <a href={`${base}/`}>Back to Today</a>
      </section>
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
  form, .missing { padding: clamp(22px, 5vw, 36px); border: 1px solid var(--border); border-radius: 18px; background: var(--surface); }
  .before-summary { margin: 0 0 18px; padding: 12px 14px; border-radius: 10px; color: var(--ink-muted); background: var(--canvas); }
  .before-summary strong { color: var(--ink); }
  h1 { margin: 0; font-size: clamp(30px, 7vw, 38px); line-height: 1.1; }
  .intro { margin: 12px 0 24px; color: var(--ink-muted); }
  .primary { width: 100%; min-height: 52px; margin-top: 20px; border: 0; border-radius: 12px; color: white; background: var(--primary); font-weight: 700; }
  .primary:disabled { opacity: .5; }
  .error { color: var(--danger); }
  .missing a { min-height: 48px; display: inline-flex; align-items: center; color: var(--primary); font-weight: 700; }
  @media (max-width: 520px) {
    .check-in-page { padding-right: 0; padding-left: 0; }
    header { padding: 0 16px; }
    main { margin: 0 auto; }
    form, .missing { border-right: 0; border-left: 0; border-radius: 0; }
  }
</style>
