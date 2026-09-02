<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ContextDisclosure from '$lib/components/ContextDisclosure.svelte';
  import SensationScale from '$lib/components/SensationScale.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { AppSettings, EatingEpisode, Occasion, PhotoRecord, Program } from '$lib/data/schema';
  import { createOpenEpisode, markEpisodeUnfinished } from '$lib/domain/episodes';
  import { reconcileStoredReminders } from '$lib/platform/reminders';
  import { runtime } from '$lib/platform/runtime';
  import { reconcileProgramLifecycle } from '$lib/platform/program';
  import { storablePhoto } from '$lib/platform/photos';

  let program = $state<Program | null>(null);
  let existing = $state<EatingEpisode | null>(null);
  let settings = $state<AppSettings | null>(null);
  let level = $state<number | null>(null);
  let occasion = $state<Occasion | null>(null);
  let photo = $state<PhotoRecord | null>(null);
  let status = $state<'loading' | 'ready' | 'saving' | 'error'>('loading');
  let errorMessage = $state('');

  onMount(async () => {
    const repository = getRepository();
    program = await reconcileProgramLifecycle(runtime.now(), repository);
    if (!program) return goto(`${base}/onboarding`);
    existing = await repository.getOpenEpisode(program.id);
    settings = await repository.getSettings();
    status = 'ready';
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!program || level === null) return;
    status = 'saving';
    errorMessage = '';
    const repository = getRepository();
    try {
      const now = runtime.now();
      const episode = createOpenEpisode({
        id: runtime.createId(),
        programId: program.id,
        level,
        now,
        timeZone: runtime.timeZone(),
        context: { occasion, photoId: photo?.id ?? null }
      });
      let photoOmitted = false;
      if (photo) {
        try {
          await repository.append(
            { type: 'photo/stored', occurredAt: now, payload: { photo: storablePhoto(photo) } },
            { type: 'episode/started', occurredAt: now, payload: { episode } }
          );
        } catch {
          photoOmitted = true;
          await repository.append({
            type: 'episode/started',
            occurredAt: now,
            payload: { episode: { ...episode, photoId: null } }
          });
        }
      } else {
        await repository.append({
          type: 'episode/started',
          occurredAt: now,
          payload: { episode }
        });
      }
      await reconcileStoredReminders(now);
      await goto(`${base}/?saved=before${photoOmitted ? '&photo=omitted' : ''}`, { replaceState: true });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Your selection could not be saved.';
      status = 'error';
    }
  }

  async function markUnfinished() {
    if (!existing) return;
    const now = runtime.now();
    await getRepository().append({
      type: 'episode/changed',
      occurredAt: now,
      payload: { episode: markEpisodeUnfinished(existing, now) }
    });
    await reconcileStoredReminders(now);
    existing = null;
  }
</script>

<svelte:head><title>Before eating — Learn Your Appetite</title></svelte:head>

<div class="check-in-page" data-status={status} data-e2e-layout>
  <header>
    <a href={`${base}/`}>← Back</a>
    <strong>Before eating</strong>
    <a aria-label="Scale help" href={`${base}/scale?returnTo=${encodeURIComponent('/check-in/new')}`}>Help</a>
  </header>

  <main>
    {#if program?.status === 'paused'}
      <section class="collision" aria-labelledby="paused-title">
        <p class="eyebrow">Check-ins paused</p>
        <h1 id="paused-title">Your program is taking a pause.</h1>
        <p>Your existing records remain available. Resume from Settings whenever this feels useful again.</p>
        <a class="primary" href={`${base}/settings`}>Review program settings</a>
        <a class="text-action" href={`${base}/`}>Go back</a>
      </section>
    {:else if existing}
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
        <h1>How does your body feel?</h1>
        {#if !settings?.reducedPrompts}<p class="intro">Choose the closest description right now. Nothing is preselected.</p>{/if}
        <SensationScale value={level} legend="Choose your sensation before eating" compact onselect={(nextLevel) => (level = nextLevel)} />
        <ContextDisclosure
          programId={program.id}
          reduced={settings?.reducedPrompts}
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
  .check-in-page { min-height: 100svh; padding: env(safe-area-inset-top) 16px calc(14px + env(safe-area-inset-bottom)); }
  header { width: min(100%, 720px); min-height: 64px; margin-inline: auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
  header a { min-width: 44px; min-height: 48px; display: inline-flex; align-items: center; color: var(--primary); font-weight: 700; }
  header a:last-child { justify-self: end; }
  main { width: min(100%, 620px); margin: 6px auto; }
  form, .collision { min-height: min(700px, calc(100svh - 82px - env(safe-area-inset-top) - env(safe-area-inset-bottom))); padding: clamp(18px, 4vw, 30px); border: 1px solid var(--rim); border-radius: 24px; background: var(--glass); box-shadow: var(--shadow); backdrop-filter: blur(24px) saturate(130%); }
  form { display: flex; flex-direction: column; }
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(30px, 7vw, 38px); line-height: 1.1; }
  .intro, .collision > p:not(.eyebrow) { margin: 8px 0 14px; color: var(--ink-muted); line-height: 1.4; }
  .primary, .secondary, .text-action { min-height: 50px; padding: 0 18px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; text-decoration: none; }
  .primary { border: 0; color: var(--on-primary); background: var(--primary); }
  .save { width: 100%; margin-top: auto; }
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
    main { width: 100%; padding: 0 10px; }
    form, .collision { border-radius: 24px; }
  }
</style>
