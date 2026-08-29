<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import ContextDisclosure from '$lib/components/ContextDisclosure.svelte';
  import SensationScale from '$lib/components/SensationScale.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { EatingEpisode, EatingReason, Occasion, PhotoRecord } from '$lib/data/schema';
  import { updateEpisode } from '$lib/domain/episodes';
  import { getSensationLevel } from '$lib/domain/scale';
  import { runtime } from '$lib/platform/runtime';

  let episode = $state<EatingEpisode | null>(null);
  let editing = $state(false);
  let confirmingDelete = $state(false);
  let deleteUnderstood = $state(false);
  let beforeLevel = $state<number | null>(null);
  let afterLevel = $state<number | null>(null);
  let reason = $state<EatingReason | null>(null);
  let occasion = $state<Occasion | null>(null);
  let note = $state('');
  let photo = $state<PhotoRecord | null>(null);
  let photoUrl = $state('');
  let status = $state<'loading' | 'ready' | 'saving' | 'error'>('loading');
  let message = $state('');

  onMount(async () => {
    const id = page.url.searchParams.get('episode');
    episode = id ? await getRepository().getEpisode(id) : null;
    if (episode) {
      beforeLevel = episode.beforeLevel;
      afterLevel = episode.afterLevel;
      reason = episode.reason;
      occasion = episode.occasion;
      note = episode.note ?? '';
      if (episode.photoId) {
        const storedPhoto = await getRepository().getPhoto(episode.photoId);
        if (storedPhoto) photoUrl = URL.createObjectURL(storedPhoto.blob);
      }
    }
    status = 'ready';
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!episode || beforeLevel === null) return;
    status = 'saving';
    const repository = getRepository();
    try {
      const now = runtime.now();
      const updated = updateEpisode(
        episode,
        { beforeLevel, afterLevel, reason, occasion, note, photoId: photo?.id ?? episode.photoId },
        now
      );
      if (photo) {
        await repository.append(
          { type: 'photo/stored', occurredAt: now, payload: { photo } },
          { type: 'episode/changed', occurredAt: now, payload: { episode: updated } }
        );
      } else {
        await repository.append({
          type: 'episode/changed',
          occurredAt: now,
          payload: { episode: updated }
        });
      }
      episode = updated;
      editing = false;
      message = 'Check-in updated. Your observations may update too.';
      status = 'ready';
    } catch (error) {
      message = error instanceof Error ? error.message : 'The check-in could not be updated.';
      status = 'error';
    }
  }

  async function removeEpisode() {
    if (!episode || !deleteUnderstood) return;
    await getRepository().append({
      type: 'episode/deleted',
      occurredAt: runtime.now(),
      payload: { episodeId: episode.id }
    });
    await goto(`${base}/?deleted=episode`, { replaceState: true });
  }

  function displayDate(timestamp: number): string {
    return new Intl.DateTimeFormat('en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: episode?.capturedTimeZone
    }).format(timestamp);
  }
</script>

<svelte:head><title>Check-in details — Learn Your Appetite</title></svelte:head>

<div class="episode-page" data-status={status} data-e2e-layout>
  <header><a href={`${base}/`}>← Back to Today</a><strong>Check-in details</strong></header>
  <main>
    {#if episode && editing}
      <form onsubmit={save}>
        <p class="eyebrow">Edit check-in</p>
        <h1>Correct this eating moment</h1>
        <SensationScale
          name="before-level"
          value={beforeLevel}
          legend="Before eating"
          onselect={(level) => (beforeLevel = level)}
        />
        {#if episode.status === 'complete'}
          <SensationScale
            name="after-level"
            value={afterLevel}
            legend="After eating"
            onselect={(level) => (afterLevel = level)}
          />
        {/if}
        <ContextDisclosure
          programId={episode.programId}
          includeReason
          {reason}
          {occasion}
          {note}
          onreason={(value) => (reason = value)}
          onoccasion={(value) => (occasion = value)}
          onnote={(value) => (note = value)}
          onphoto={(value) => (photo = value)}
        />
        {#if message}<p role={status === 'error' ? 'alert' : 'status'}>{message}</p>{/if}
        <div class="form-actions">
          <button class="secondary" type="button" onclick={() => (editing = false)}>Cancel</button>
          <button class="primary" type="submit">Save changes</button>
        </div>
      </form>
    {:else if episode}
      <article>
        <p class="eyebrow">{displayDate(episode.startedAt)}</p>
        <h1>{episode.occasion ? `${episode.occasion} check-in` : 'Eating-moment check-in'}</h1>
        {#if message}<p class="notice" role="status">{message}</p>{/if}
        <dl>
          <div><dt>Before</dt><dd>{episode.beforeLevel} · {getSensationLevel(episode.beforeLevel).phrase}</dd></div>
          <div><dt>After</dt><dd>{episode.afterLevel ? `${episode.afterLevel} · ${getSensationLevel(episode.afterLevel).phrase}` : '— · Unfinished'}</dd></div>
          {#if episode.reason}<div><dt>What was present</dt><dd>{episode.reason.replace('-', ' ')}</dd></div>{/if}
          {#if episode.note}<div><dt>Note</dt><dd>{episode.note}</dd></div>{/if}
        </dl>
        {#if photoUrl}<img src={photoUrl} alt="Selected eating moment" />{/if}
        <button class="secondary wide" onclick={() => (editing = true)}>Edit check-in</button>
        <button class="danger wide" onclick={() => (confirmingDelete = true)}>Delete this check-in</button>
        <a class="back-link" href={`${base}/`}>Back to Today</a>
      </article>

      {#if confirmingDelete}
        <div class="confirmation" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <h2 id="delete-title">Delete this check-in?</h2>
          <p>{displayDate(episode.startedAt)} will be removed from your current records and exports. Its local source events remain until you delete everything.</p>
          <label><input type="checkbox" bind:checked={deleteUnderstood} /> I understand this cannot be undone</label>
          <button class="danger wide" disabled={!deleteUnderstood} onclick={removeEpisode}>Delete this check-in</button>
          <button class="secondary wide" onclick={() => (confirmingDelete = false)}>Keep this check-in</button>
        </div>
      {/if}
    {:else if status === 'ready'}
      <section><h1>This check-in was not found</h1><a href={`${base}/`}>Back to Today</a></section>
    {/if}
  </main>
</div>

<style>
  .episode-page { min-height: 100vh; padding: env(safe-area-inset-top) 16px 40px; }
  header { width: min(100%, 720px); min-height: 64px; margin-inline: auto; display: grid; grid-template-columns: 1fr 1fr; align-items: center; }
  header a, .back-link { min-height: 48px; display: inline-flex; align-items: center; color: var(--primary); font-weight: 700; }
  main { position: relative; width: min(100%, 620px); margin: 24px auto; }
  article, form, main > section { padding: clamp(22px, 5vw, 36px); border: 1px solid var(--border); border-radius: 18px; background: var(--surface); }
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0 0 24px; font-size: clamp(30px, 7vw, 38px); text-transform: capitalize; }
  form :global(.scale) { margin-top: 28px; }
  dl { margin: 0 0 24px; }
  dl div { padding: 14px 0; border-bottom: 1px solid var(--border); }
  dt { color: var(--ink-muted); font-size: 13px; }
  dd { margin: 3px 0 0; font-size: 18px; font-weight: 700; text-transform: capitalize; }
  article > img { width: min(100%, 320px); max-height: 260px; margin-bottom: 20px; border-radius: 12px; object-fit: cover; }
  button { min-height: 50px; padding: 0 18px; border-radius: 12px; font-weight: 700; }
  .primary { border: 0; color: white; background: var(--primary); }
  .secondary { border: 1px solid var(--border-strong); color: var(--ink); background: var(--surface); }
  .danger { border: 1px solid var(--danger); color: var(--danger); background: var(--surface); }
  .danger:disabled { opacity: .45; }
  .wide { width: 100%; margin-top: 10px; }
  .back-link { justify-content: center; margin-top: 8px; }
  .form-actions { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .notice { padding: 12px; border-radius: 10px; background: var(--primary-soft); }
  .confirmation { position: fixed; z-index: 30; right: 16px; bottom: 16px; left: 16px; width: min(100% - 32px, 560px); margin-inline: auto; box-shadow: 0 20px 70px rgb(37 49 45 / 25%); }
  .confirmation h2 { margin: 0; }
  .confirmation p { color: var(--ink-muted); line-height: 1.5; }
  .confirmation label { min-height: 48px; display: flex; align-items: center; gap: 10px; }
  .confirmation input { width: 22px; height: 22px; }
  @media (max-width: 520px) {
    .episode-page { padding-right: 0; padding-left: 0; }
    header { padding: 0 16px; }
    main { margin: 0 auto; }
    article, form, main > section { border-right: 0; border-left: 0; border-radius: 0; }
  }
</style>
