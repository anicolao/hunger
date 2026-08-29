<script lang="ts">
  import { getSensationLevel, sensationLevels } from '$lib/domain/scale';

  let {
    value = null,
    legend = 'How does your body feel?',
    onselect
  }: {
    value?: number | null;
    legend?: string;
    onselect: (level: number) => void;
  } = $props();

  let selected = $derived(value === null ? null : getSensationLevel(value));
</script>

<fieldset class="scale" aria-describedby="scale-direction">
  <legend>{legend}</legend>
  <p id="scale-direction" class="anchors">
    <span><strong>1</strong> Urgent hunger</span>
    <span><strong>5</strong> Neutral</span>
    <span><strong>10</strong> Painfully full</span>
  </p>
  <div class="number-grid">
    {#each sensationLevels as sensation}
      <label class:selected={value === sensation.level}>
        <input
          type="radio"
          name="sensation-level"
          value={sensation.level}
          checked={value === sensation.level}
          aria-label={`${sensation.level}, ${sensation.phrase}`}
          onchange={() => onselect(sensation.level)}
        />
        <span>{sensation.level}</span>
      </label>
    {/each}
  </div>
  <div class="description" aria-live="polite">
    {#if selected}
      <strong>{selected.level} · {selected.phrase}</strong>
      <span>{selected.cue}</span>
    {:else}
      <strong>Choose the closest description</strong>
      <span>Your experience may differ from day to day.</span>
    {/if}
  </div>
</fieldset>

<style>
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    width: 100%;
    margin-bottom: 16px;
    color: var(--ink);
    font-size: 22px;
    font-weight: 700;
    line-height: 1.25;
  }

  .anchors {
    margin: 0 0 14px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--ink-muted);
    font-size: 12px;
    line-height: 1.25;
  }

  .anchors span {
    width: 32%;
    display: grid;
  }

  .anchors span:nth-child(2) {
    text-align: center;
  }

  .anchors span:last-child {
    text-align: right;
  }

  .anchors strong {
    color: var(--ink);
    font-size: 15px;
  }

  .number-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(52px, 1fr));
    gap: 8px;
  }

  label {
    position: relative;
    min-width: 52px;
    min-height: 56px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink);
    background: var(--surface);
    cursor: pointer;
  }

  label:hover {
    border-color: var(--primary);
  }

  label.selected {
    border: 2px solid var(--primary);
    background: var(--primary-soft);
  }

  input {
    position: absolute;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  label:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  label span {
    font-size: 21px;
    font-weight: 700;
  }

  .description {
    min-height: 84px;
    margin-top: 16px;
    padding: 16px;
    border-radius: 12px;
    display: grid;
    align-content: center;
    gap: 3px;
    background: var(--primary-soft);
  }

  .description strong {
    font-size: 16px;
  }

  .description span {
    color: var(--ink-muted);
    font-size: 14px;
  }

  @media (max-width: 360px) {
    .number-grid {
      gap: 6px;
    }

    label {
      min-width: 0;
      min-height: 52px;
    }
  }

  @media (forced-colors: active) {
    label.selected {
      outline: 3px solid Highlight;
    }
  }
</style>
