<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getRepository } from '$lib/data/repository';
  import type { EatingEpisode, ExperimentRecord } from '$lib/data/schema';
  import { activeExperiment, evaluateExperiment, experimentDaysRemaining, experimentIntervalComplete } from '$lib/domain/experiments';
  import { getProgramProgress, sameLocalCalendarDay } from '$lib/domain/progression';
  import { getSensationLevel } from '$lib/domain/scale';
  import { isOpenEpisodeStale, markEpisodeUnfinished } from '$lib/domain/episodes';
  import type { Program } from '$lib/data/schema';
  import { runtime } from '$lib/platform/runtime';
  import { reconcileStoredReminders } from '$lib/platform/reminders';

  let { program, now = runtime.now() }: { program: Program; now?: number } = $props();
  let progress = $derived(getProgramProgress(program.startedAt, now, program.timeZone));
  let episodes = $state<EatingEpisode[]>([]);
  let experiments = $state<ExperimentRecord[]>([]);
  let loaded = $state(false);
  let openEpisode = $derived(episodes.find((episode) => episode.status === 'open') ?? null);
  let todayCount = $derived(
    episodes.filter(
      (episode) => sameLocalCalendarDay(episode.startedAt, now, program.timeZone)
    ).length
  );
  let currentExperiment = $derived(activeExperiment(experiments));
  let latestCompletedExperiment = $derived(experiments.find((experiment) => experiment.status === 'complete') ?? null);

  onMount(async () => {
    episodes = await getRepository().listEpisodes(program.id);
    experiments = await getRepository().listExperiments(program.id);
    if (currentExperiment && experimentIntervalComplete(currentExperiment, now, program.timeZone)) {
      const completed: ExperimentRecord = {
        ...currentExperiment,
        baselineEpisodeIds: [...currentExperiment.baselineEpisodeIds],
        target: { ...currentExperiment.target },
        status: 'complete',
        endedAt: now,
        result: evaluateExperiment(currentExperiment, episodes, now, program.timeZone)
      };
      await getRepository().append({ type: 'experiment/changed', occurredAt: now, payload: { experiment: completed } });
      experiments = await getRepository().listExperiments(program.id);
    }
    loaded = true;
  });

  async function markUnfinished() {
    if (!openEpisode) return;
    const now = runtime.now();
    await getRepository().append({
      type: 'episode/changed',
      occurredAt: now,
      payload: { episode: markEpisodeUnfinished(openEpisode, now) }
    });
    await reconcileStoredReminders(now);
    episodes = await getRepository().listEpisodes(program.id);
  }

  async function setExperimentStatus(status: 'active' | 'paused' | 'stopped') {
    if (!currentExperiment) return;
    const updated: ExperimentRecord = {
      ...currentExperiment,
      baselineEpisodeIds: [...currentExperiment.baselineEpisodeIds],
      target: { ...currentExperiment.target },
      result: currentExperiment.result ? { ...currentExperiment.result } : null,
      status,
      endedAt: status === 'stopped' ? runtime.now() : null
    };
    const changedAt = runtime.now();
    await getRepository().append({ type: 'experiment/changed', occurredAt: changedAt, payload: { experiment: updated } });
    await reconcileStoredReminders(changedAt);
    experiments = await getRepository().listExperiments(program.id);
  }

  function displayTime(timestamp: number): string {
    return new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: program.timeZone
    }).format(timestamp);
  }
</script>

<div class="today-page" data-status={loaded ? 'ready' : 'loading'}>
  {#if page.url.searchParams.get('saved') === 'before'}
    <p class="status-message" role="status" tabindex="-1">Before check-in saved</p>
  {:else if page.url.searchParams.get('saved') === 'complete'}
    <p class="status-message" role="status" tabindex="-1">Check-in complete</p>
  {/if}
  {#if page.url.searchParams.get('photo') === 'omitted'}
    <p class="status-message photo-warning" role="status" tabindex="-1">
      Your check-in was saved, but the photo was not because this device could not store it.
      <a href={`${base}/settings#manage-data`}>Manage Data</a>
    </p>
  {/if}
  <header class="page-heading">
    <p class="eyebrow">Day {progress.day} · Week {progress.week}</p>
    <h1>Today</h1>
  </header>

  {#if openEpisode}
    <section class="notice-card pending" aria-labelledby="notice-title">
      <p class="eyebrow">Started at {displayTime(openEpisode.startedAt)}</p>
      <h2 id="notice-title">Finish your check-in</h2>
      <p>You began at {openEpisode.beforeLevel} · {getSensationLevel(openEpisode.beforeLevel).phrase}.{#if isOpenEpisodeStale(openEpisode, now)} This may be an earlier moment.{/if}</p>
      <a class="primary-button" href={`${base}/check-in/after?episode=${openEpisode.id}`}>How do you feel now?</a>
      <button class="unfinished-button" onclick={markUnfinished}>Mark unfinished</button>
    </section>
  {:else if program.status === 'paused'}
    <section class="notice-card paused" aria-labelledby="notice-title">
      <p class="eyebrow">Check-ins paused</p>
      <h2 id="notice-title">Your history is still here.</h2>
      <p>Resume whenever check-ins feel useful again.</p>
      <a class="primary-button" href={`${base}/settings`}>Review program settings</a>
    </section>
  {:else}
    <section class="notice-card" aria-labelledby="notice-title">
      <h2 id="notice-title">{program.status === 'complete' ? 'Continue in your own way' : 'What do you notice?'}</h2>
      <p>{progress.prompt}</p>
      <a class="primary-button" aria-label={program.status === 'complete' ? 'Start an occasional check-in' : 'Check in before eating'} href={`${base}/check-in/new`}>{program.status === 'complete' ? 'Check in' : 'Check in'}</a>
    </section>
  {/if}

  <div class="today-grid">
    <section class="plain-card" aria-labelledby="moments-title">
      <span class="summary-icon" aria-hidden="true">{todayCount}</span>
      <div><p>Today's moments</p><h2 id="moments-title">{todayCount === 0 ? 'No moments yet' : `${todayCount} ${todayCount === 1 ? 'moment' : 'moments'} noticed`}</h2></div>
    </section>

    <section class="plain-card" aria-labelledby="focus-title">
      <span class="summary-icon focus" aria-hidden="true"></span>
      <div><p>Week {progress.week} focus</p><h2 id="focus-title">{progress.focus}</h2></div>
    </section>
  </div>

  {#if currentExperiment}
    {@const remainingDays = experimentDaysRemaining(currentExperiment, now, program.timeZone)}
    <section class="experiment-summary" aria-labelledby="experiment-title">
      <p class="eyebrow">Current experiment</p>
      <h2 id="experiment-title">{currentExperiment.target.label}</h2>
      <p>{remainingDays} {remainingDays === 1 ? 'day' : 'days'} until comparison.</p>
      <div class="experiment-actions">
        <a href={`${base}/experiment?insight=${encodeURIComponent(currentExperiment.insightId)}`}>View experiment</a>
        {#if currentExperiment.status === 'paused'}<button onclick={() => setExperimentStatus('active')}>Resume</button>
        {:else}<button onclick={() => setExperimentStatus('paused')}>Pause</button>{/if}
        <button class="stop" onclick={() => setExperimentStatus('stopped')}>Stop</button>
      </div>
    </section>
  {:else if latestCompletedExperiment}
    <section class="experiment-summary" aria-labelledby="experiment-title">
      <p class="eyebrow">Experiment comparison ready</p>
      <h2 id="experiment-title">Your seven-day observation is available.</h2>
      <a class="result-link" href={`${base}/experiment`}>View the comparison</a>
    </section>
  {/if}

  <details class="empty-history">
    <summary id="recent-title">Recent check-ins <span>{episodes.length}</span></summary>
    {#if episodes.length === 0}
      <p>Your before-and-after moments will stay private on this device.</p>
    {:else}
      <ul>
        {#each episodes.slice(0, 6) as episode}
          <li>
            <a href={`${base}/episode?episode=${episode.id}`}>
              <span>{displayTime(episode.startedAt)}{episode.occasion ? ` · ${episode.occasion}` : ''}</span>
              <strong>
                {episode.beforeLevel} → {episode.afterLevel ?? '—'}
                {#if episode.status === 'unfinished'}<small>Unfinished</small>{/if}
                {#if episode.status === 'open'}<small>Open</small>{/if}
              </strong>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </details>

</div>

<style>
  .page-heading { margin-bottom: 14px; }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--primary);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    text-wrap: pretty;
  }

  h1 {
    margin: 0;
    font-size: clamp(34px, 8vw, 40px);
    line-height: 1;
    letter-spacing: -.035em;
  }

  .page-heading > p:last-child,
  section > p:last-child {
    color: var(--ink-muted);
  }

  .notice-card,
  .plain-card,
  .empty-history,
  .experiment-summary {
    border: 1px solid var(--border);
    border-radius: 22px;
    background: var(--glass);
    box-shadow: var(--shadow);
    backdrop-filter: blur(22px) saturate(130%);
  }

  .notice-card {
    padding: 22px;
    border-color: var(--border-strong);
    background: linear-gradient(145deg, var(--primary-soft), var(--glass));
  }

  h2 {
    margin: 0;
    font-size: 21px;
    line-height: 1.25;
  }

  .notice-card > p:not(.eyebrow) {
    margin: 8px 0 0;
    color: var(--ink-muted);
    line-height: 1.4;
  }

  .status-message {
    margin: 0 0 16px;
    padding: 12px 16px;
    border-radius: 10px;
    color: var(--ink);
    background: var(--primary-soft);
    font-weight: 700;
  }
  .status-message a { color: var(--primary); }
  .photo-warning { background: var(--accent-soft); }

  .primary-button {
    min-height: 52px;
    width: 100%;
    margin-top: 18px;
    padding: 0 20px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--on-primary);
    background: var(--primary);
    font-weight: 700;
    text-decoration: none;
  }

  .unfinished-button {
    min-height: 48px;
    margin: 10px 0 0 8px;
    padding: 0 16px;
    border: 0;
    color: var(--primary);
    background: transparent;
    font-weight: 700;
  }

  .today-grid {
    margin-top: 12px;
    display: grid;
    gap: 10px;
  }

  .plain-card,
  .empty-history,
  .experiment-summary {
    padding: 16px;
  }

  .plain-card { min-height: 70px; display: grid; grid-template-columns: 42px 1fr; align-items: center; gap: 12px; box-shadow: none; }
  .plain-card p { margin: 0; color: var(--ink-muted); font-size: 13px; }
  .plain-card h2 { margin-top: 2px; font-size: 17px; }
  .summary-icon { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: var(--on-primary); background: var(--primary); font-weight: 700; }
  .summary-icon.focus { border: 8px solid var(--accent-soft); background: var(--accent); }

  .experiment-summary { margin-top: 12px; border-color: var(--primary); }
  .experiment-summary > p:not(.eyebrow) { color: var(--ink-muted); }
  .experiment-actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
  .experiment-actions a, .experiment-actions button, .result-link { min-height: 46px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 11px; display: inline-flex; align-items: center; color: var(--ink); background: var(--surface); font-weight: 700; }
  .experiment-actions .stop { color: var(--danger); }

  ul {
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }

  .empty-history { margin-top: 12px; }
  .empty-history > summary { min-height: 44px; display: flex; align-items: center; justify-content: space-between; color: var(--ink); font-weight: 700; cursor: pointer; }
  .empty-history > summary span { min-width: 28px; padding: 3px 8px; border-radius: 999px; color: var(--primary); background: var(--primary-soft); text-align: center; }

  li + li {
    border-top: 1px solid var(--border);
  }

  li a {
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--ink);
    text-decoration: none;
  }

  li a > span {
    color: var(--ink-muted);
    text-transform: capitalize;
  }

  li strong {
    display: flex;
    align-items: end;
    gap: 8px;
    font-size: 18px;
  }

  li small {
    color: var(--ink-muted);
    font-size: 12px;
    font-weight: 400;
  }

  .plain-card p:last-child,
  .empty-history p {
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .empty-history { margin-top: 12px; box-shadow: none; }

  @media (min-width: 700px) {
    .today-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
