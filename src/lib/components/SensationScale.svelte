<script lang="ts">
  import { getSensationLevel, sensationLevels } from '$lib/domain/scale';

  let {
    value = null,
    legend = 'How does your body feel?',
    name = 'sensation-level',
    compact = false,
    onselect
  }: {
    value?: number | null;
    legend?: string;
    name?: string;
    compact?: boolean;
    onselect: (level: number) => void;
  } = $props();

  let selected = $derived(value === null ? null : getSensationLevel(value));
</script>

<fieldset class="scale" aria-describedby="scale-direction">
  <legend class:visually-hidden={compact}>{legend}</legend>
  <p id="scale-direction" class="anchors">
    <span><strong>1</strong> Urgent hunger</span>
    {#if !compact}<span><strong>5</strong> Neutral</span>{/if}
    <span><strong>10</strong> Painfully full</span>
  </p>
  <div class="number-grid">
    {#each sensationLevels as sensation}
      <label class:selected={value === sensation.level}>
        <input
          type="radio"
          {name}
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
    margin-bottom: 10px;
    color: var(--ink);
    font-size: 19px;
    font-weight: 700;
    line-height: 1.25;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .anchors {
    margin: 0 0 9px;
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

  .anchors span:only-child { width: auto; }

  .anchors:has(span:nth-child(2):last-child) span { width: 48%; }

  .anchors span:nth-child(2):not(:last-child) {
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
    min-height: 50px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink);
    background: var(--glass);
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
    min-height: 62px;
    margin-top: 10px;
    padding: 11px 13px;
    border: 1px solid var(--border);
    border-radius: 14px;
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
