<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { EatingEpisode, ExperimentRecord, Program } from '$lib/data/schema';
  import {
    activeExperiment,
    evaluateExperiment,
    experimentResultCopy,
    offerForInsight,
    type ExperimentOffer
  } from '$lib/domain/experiments';
  import { generatePatternInsights, renderPattern, type PatternInsightResult } from '$lib/domain/patterns';
  import { runtime } from '$lib/platform/runtime';

  let program = $state<Program | null>(null);
  let episodes = $state<EatingEpisode[]>([]);
  let experiments = $state<ExperimentRecord[]>([]);
  let sourceInsight = $state<PatternInsightResult | null>(null);
  let offer = $state<ExperimentOffer | null>(null);
  let ready = $state(false);
  let saving = $state(false);
  let current = $derived(activeExperiment(experiments));

  onMount(async () => {
    const repository = getRepository();
    program = await repository.getProgram();
    if (!program) return goto(`${base}/`);
    episodes = await repository.listEpisodes(program.id);
    experiments = await repository.listExperiments(program.id);
    const requested = new URL(location.href).searchParams.get('insight');
    sourceInsight = generatePatternInsights(episodes).find((insight) => insight.id === requested) ?? null;
    offer = sourceInsight ? offerForInsight(sourceInsight) : null;
    ready = true;
  });

  async function persist(record: ExperimentRecord) {
    const plainRecord = JSON.parse(JSON.stringify(record)) as ExperimentRecord;
    await getRepository().append({
      type: 'experiment/changed',
      occurredAt: runtime.now(),
      payload: { experiment: plainRecord }
    });
    experiments = await getRepository().listExperiments(record.programId);
  }

  async function start() {
    if (!program || !sourceInsight || !offer || saving) return;
    saving = true;
    if (current) await persist({ ...current, status: 'stopped', endedAt: runtime.now() });
    const baselineEpisodeIds = episodes
      .filter((episode) => episode.status === 'complete' && sourceInsight?.evidenceEpisodeIds.includes(episode.id))
      .sort((left, right) => right.startedAt - left.startedAt)
      .slice(0, 7)
      .map((episode) => episode.id);
    await persist({
      id: runtime.createId(),
      programId: program.id,
      insightId: sourceInsight.id,
      kind: offer.kind,
      startedAt: runtime.now(),
      endedAt: null,
      baselineEpisodeIds,
      target: { label: offer.title, measure: offer.measure, direction: offer.direction, days: 7 },
      status: 'active',
      result: null,
      algorithmVersion: 1
    });
    saving = false;
  }

  async function setStatus(status: 'active' | 'paused' | 'stopped') {
    if (!current) return;
    await persist({ ...current, status, endedAt: status === 'stopped' ? runtime.now() : null });
  }

  async function finish() {
    if (!current) return;
    const result = evaluateExperiment(current, episodes, runtime.now());
    await persist({ ...current, status: 'complete', endedAt: runtime.now(), result });
  }
</script>

<svelte:head><title>Noticing experiment — Learn Your Appetite</title></svelte:head>

{#if program}
  <AppShell active="insights">
    <main class="experiment-page" data-status={ready ? 'ready' : 'loading'}>
      <p class="eyebrow">Optional experiment</p>
      <h1>Try one small noticing practice</h1>
      <p class="intro">For seven elapsed days, observe one predeclared measure. There is no target, streak, or pass/fail result.</p>

      {#if current}
        <section class="experiment-card active-card">
          <span class="badge">{current.status === 'paused' ? 'Paused' : 'In progress'}</span>
          <h2>{current.target.label}</h2>
          <p>{offerForInsight(generatePatternInsights(episodes).find((item) => item.id === current?.insightId) as PatternInsightResult)?.practice ?? 'Keep noticing what happens. You can pause or stop at any time.'}</p>
          <p><strong>Comparison:</strong> {current.baselineEpisodeIds.length} recent paired check-ins before this practice, compared with paired check-ins during it.</p>
          <div class="actions">
            {#if current.status === 'paused'}
              <button onclick={() => setStatus('active')}>Resume experiment</button>
            {:else}
              <button class="secondary" onclick={() => setStatus('paused')}>Pause</button>
            {/if}
            <button class="secondary" onclick={finish}>Finish and compare</button>
            <button class="text-button" onclick={() => setStatus('stopped')}>Stop without a result</button>
          </div>
          {#if offer && sourceInsight && current.insightId !== sourceInsight.id}
            <aside class="replace-offer">
              <h3>Another supported option</h3>
              <p>{offer.title}. Starting it will stop the current experiment, so there is still only one active experiment.</p>
              <button class="secondary" onclick={start}>Replace current experiment</button>
            </aside>
          {/if}
        </section>
      {:else if offer && sourceInsight}
        <section class="experiment-card">
          <span class="badge">7 days · optional</span>
          <h2>{offer.title}</h2>
          <p class="practice">{offer.practice}</p>
          <details>
            <summary>Why this experiment?</summary>
            <p>{renderPattern(sourceInsight).finding}</p>
            <p>That observation met the app’s sample and difference gates. It does not prove a cause.</p>
          </details>
          <p><strong>What will be compared:</strong> {offer.measure === 'uncomfortable-ending-rate' ? 'the share ending at 8 or above' : 'the share ending from 5 to 7'}.</p>
          <div class="actions">
            <button disabled={saving} onclick={start}>{saving ? 'Starting…' : 'Start experiment'}</button>
            <a href={`${base}/insights`}>Not now</a>
          </div>
        </section>
      {:else}
        {@const completed = experiments.find((experiment) => experiment.status === 'complete' && experiment.result)}
        {#if completed?.result}
          <section class="experiment-card result-card">
            <span class="badge">7-day comparison</span>
            <h2>{completed.result.state === 'changed' ? 'Appeared to change' : completed.result.state === 'similar' ? 'Appeared similar' : 'Still learning'}</h2>
            <p class="practice">{experimentResultCopy(completed.result)}</p>
            <dl>
              <div><dt>Before</dt><dd>{completed.result.baselineCount} of {completed.result.baselineTotal}</dd></div>
              <div><dt>During</dt><dd>{completed.result.experimentCount} of {completed.result.experimentTotal}</dd></div>
            </dl>
            <p>This comparison is an observation, not proof that the practice caused a change.</p>
            <a href={`${base}/insights`}>Back to insights</a>
          </section>
        {:else}
          <section class="experiment-card"><h2>No experiment offered yet</h2><p>A supported option appears only after a recurring pattern passes its evidence gate.</p><a href={`${base}/insights`}>Back to insights</a></section>
        {/if}
      {/if}
    </main>
  </AppShell>
{:else}
  <div data-status="loading">Opening your private records…</div>
{/if}

<style>
  .experiment-page { max-width: 760px; }
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  h1 { max-width: 680px; margin: 0; font-size: clamp(34px, 8vw, 46px); line-height: 1.05; }
  .intro { max-width: 650px; color: var(--ink-muted); font-size: 18px; line-height: 1.5; }
  .experiment-card { margin-top: 30px; padding: clamp(22px, 6vw, 34px); border: 1px solid var(--border); border-radius: 18px; background: var(--surface); }
  .active-card { border-color: var(--primary); }
  .badge { min-height: 28px; padding: 0 10px; border-radius: 999px; display: inline-flex; align-items: center; color: var(--accent-ink); background: var(--accent-soft); font-weight: 700; font-size: 13px; }
  h2 { margin: 18px 0 8px; font-size: 26px; }
  p { line-height: 1.55; }
  .practice { font-size: 20px; color: var(--ink); }
  details { margin: 22px 0; border-block: 1px solid var(--border); }
  summary { min-height: 52px; display: flex; align-items: center; color: var(--primary); font-weight: 700; cursor: pointer; }
  .actions { margin-top: 26px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  button, .actions a, .result-card > a { min-height: 48px; padding: 0 20px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; background: var(--primary); font-weight: 700; }
  button.secondary { border: 1px solid var(--border-strong); color: var(--ink); background: var(--surface); }
  button.text-button { color: var(--danger); background: transparent; }
  button:disabled { opacity: .65; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .replace-offer { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--border); }
  dl div { padding: 16px; border-radius: 12px; background: var(--primary-soft); }
  dt { color: var(--ink-muted); }
  dd { margin: 4px 0 0; font-size: 24px; font-weight: 700; }
</style>
