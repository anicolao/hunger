<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import { getRepository } from '$lib/data/repository';
  import type { EatingEpisode, InsightSnapshot, Program } from '$lib/data/schema';
  import {
    generateEarlyInsights,
    pairedEpisodes,
    remainingForFirstInsight,
    renderInsight,
    type InsightResult
  } from '$lib/domain/insights';
  import { runtime } from '$lib/platform/runtime';

  let program = $state<Program | null>(null);
  let episodes = $state<EatingEpisode[]>([]);
  let snapshots = $state<InsightSnapshot[]>([]);
  let ready = $state(false);
  let results = $derived(generateEarlyInsights(episodes));
  let pairedCount = $derived(pairedEpisodes(episodes).length);
  let remaining = $derived(remainingForFirstInsight(episodes));

  onMount(async () => {
    const repository = getRepository();
    program = await repository.getProgram();
    if (!program) return goto(`${base}/`);
    episodes = await repository.listEpisodes(program.id);
    snapshots = await repository.listInsightSnapshots(program.id);

    for (const result of generateEarlyInsights(episodes)) {
      const id = `${program.id}-${result.id}`;
      if (!snapshots.some((snapshot) => snapshot.id === id)) {
        await repository.saveInsightSnapshot({
          id,
          programId: program.id,
          shownAt: runtime.now(),
          algorithmVersion: result.algorithmVersion,
          copyVersion: 1,
          result,
          feedback: null,
          sourceChanged: false
        });
      }
    }
    snapshots = await repository.listInsightSnapshots(program.id);
    ready = true;
  });

  function snapshotFor(result: InsightResult): InsightSnapshot | undefined {
    return snapshots.find((snapshot) => snapshot.id.endsWith(result.id));
  }

  async function recordFeedback(result: InsightResult, feedback: 'helpful' | 'not-for-me') {
    const snapshot = snapshotFor(result);
    if (!snapshot) return;
    const updated: InsightSnapshot = {
      ...snapshot,
      result: JSON.parse(JSON.stringify(snapshot.result)) as InsightResult,
      feedback
    };
    await getRepository().saveInsightSnapshot(updated);
    snapshots = snapshots.map((item) => (item.id === updated.id ? updated : item));
  }

  function episodeFor(id: string): EatingEpisode | undefined {
    return episodes.find((episode) => episode.id === id);
  }

  function shortDate(timestamp: number): string {
    return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(timestamp);
  }
</script>

<svelte:head><title>Insights — Learn Your Appetite</title></svelte:head>

{#if program}
  <AppShell active="insights">
    <div class="insights-page" data-status={ready ? 'ready' : 'loading'}>
      <header class="page-heading">
        <p class="eyebrow">Your observations</p>
        <h1>Insights</h1>
        <p>Personal observations appear only when your paired check-ins provide enough evidence.</p>
      </header>

      {#if results.length === 0}
        <section class="learning-card" aria-labelledby="learning-title">
          <span class="badge">Still learning</span>
          <h2 id="learning-title">
            {remaining} more paired {remaining === 1 ? 'check-in' : 'check-ins'} will help compare where you started and finished.
          </h2>
          <div class="progress" aria-label={`${pairedCount} of 4 paired`}>
            <span style={`width: ${Math.min(100, (pairedCount / 4) * 100)}%`}></span>
          </div>
          <strong>{pairedCount} of 4 paired</strong>
          <p>A before and after check-in from the same eating moment.</p>
        </section>
      {:else}
        <div class="insight-list">
          {#each results as result, index}
            {@const rendered = renderInsight(result)}
            {@const snapshot = snapshotFor(result)}
            <article class:primary={index === 0}>
              <span class="badge">{result.strength === 'early' ? 'Early observation' : 'Recurring pattern'}</span>
              <h2>{rendered.title}</h2>
              <p class="finding">{rendered.finding}</p>
              <div class="range" aria-label={`Observed values from ${result.metrics.minimum} to ${result.metrics.maximum}, middle ${result.metrics.median}`}>
                <span style={`left: ${(result.metrics.minimum - 1) / 9 * 100}%`}></span>
                <strong style={`left: ${(result.metrics.median - 1) / 9 * 100}%`}>{result.metrics.median}</strong>
                <span style={`left: ${(result.metrics.maximum - 1) / 9 * 100}%`}></span>
              </div>
              <p class="evidence-count">{rendered.evidence}</p>
              <details>
                <summary>Why you're seeing this</summary>
                <p>{rendered.explanation}</p>
                <p>This is an observation, not proof of cause.</p>
                <ul>
                  {#each result.evidenceEpisodeIds as id}
                    {@const source = episodeFor(id)}
                    {#if source}
                      <li><a href={`${base}/episode?episode=${id}`}>{shortDate(source.startedAt)} · {source.beforeLevel} → {source.afterLevel}</a></li>
                    {/if}
                  {/each}
                </ul>
              </details>
              <div class="feedback" aria-label="Was this observation useful?">
                <span>Was this useful?</span>
                <button
                  class:selected={snapshot?.feedback === 'helpful'}
                  aria-pressed={snapshot?.feedback === 'helpful'}
                  onclick={() => recordFeedback(result, 'helpful')}>Helpful</button
                >
                <button
                  class:selected={snapshot?.feedback === 'not-for-me'}
                  aria-pressed={snapshot?.feedback === 'not-for-me'}
                  onclick={() => recordFeedback(result, 'not-for-me')}>Not for me</button
                >
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </AppShell>
{:else}
  <div data-status="loading" aria-live="polite">Opening your private records…</div>
{/if}

<style>
  .page-heading { max-width: 650px; }
  .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  h1 { margin: 0; font-size: clamp(34px, 8vw, 42px); }
  .page-heading > p:last-child { color: var(--ink-muted); line-height: 1.5; }
  .learning-card, article { margin-top: 28px; padding: clamp(22px, 5vw, 30px); border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
  .badge { width: fit-content; min-height: 28px; padding: 0 10px; border-radius: 999px; display: inline-flex; align-items: center; color: var(--accent-ink); background: var(--accent-soft); font-size: 13px; font-weight: 700; }
  h2 { margin: 18px 0 0; font-size: 23px; line-height: 1.25; }
  .learning-card p, article p { color: var(--ink-muted); line-height: 1.5; }
  .progress { height: 8px; margin: 24px 0 10px; border-radius: 999px; overflow: hidden; background: var(--primary-soft); }
  .progress span { height: 100%; display: block; background: var(--primary); }
  .learning-card > strong { display: block; }
  .insight-list { display: grid; gap: 18px; }
  article.primary { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); }
  .finding { color: var(--ink); font-size: 20px; font-weight: 700; }
  .range { position: relative; height: 28px; margin: 28px 10px 18px; border-top: 2px solid var(--primary); }
  .range span, .range strong { position: absolute; top: -6px; transform: translateX(-50%); }
  .range span { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
  .range strong { top: 7px; color: var(--primary); }
  .evidence-count { font-weight: 700; }
  details { border-top: 1px solid var(--border); }
  summary { min-height: 48px; display: flex; align-items: center; color: var(--primary); font-weight: 700; cursor: pointer; }
  ul { padding-left: 22px; }
  li a { min-height: 44px; display: inline-flex; align-items: center; color: var(--primary); }
  .feedback { margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .feedback > span { width: 100%; font-size: 14px; font-weight: 700; }
  .feedback button { min-height: 44px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 999px; color: var(--ink); background: var(--surface); }
  .feedback button.selected { border: 2px solid var(--primary); background: var(--primary-soft); }
  @media (min-width: 760px) { .insight-list { grid-template-columns: 1fr 1fr; } }
</style>
