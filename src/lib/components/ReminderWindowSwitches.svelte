<script lang="ts">
  const windows = ['morning', 'midday', 'evening'] as const;

  let {
    selected,
    legend = 'Noticing windows',
    ontoggle
  }: {
    selected: string[];
    legend?: string;
    ontoggle: (window: string) => void;
  } = $props();
</script>

<fieldset class="window-switches">
  <legend>{legend}</legend>
  {#each windows as window}
    <label class="reminder-row">
      <span>{window[0].toUpperCase() + window.slice(1)}</span>
      <span class="switch">
        <input
          type="checkbox"
          aria-label={`${window[0].toUpperCase() + window.slice(1)}, ${selected.includes(window) ? 'on' : 'off'}`}
          checked={selected.includes(window)}
          onchange={() => ontoggle(window)}
        />
        <span class="switch-track" aria-hidden="true"></span>
      </span>
    </label>
  {/each}
</fieldset>

<style>
  .window-switches {
    margin: 18px 0 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 4px;
    font-weight: 700;
  }

  .reminder-row {
    min-height: 50px;
    padding: 0 2px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
  }

  .reminder-row:last-child {
    border-bottom: 0;
  }

  .switch {
    position: relative;
    width: 51px;
    height: 44px;
    flex: 0 0 51px;
    display: grid;
    place-items: center;
  }

  .switch input {
    position: absolute;
    z-index: 1;
    width: 51px;
    height: 44px;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .switch-track {
    position: relative;
    width: 51px;
    height: 31px;
    border-radius: 999px;
    display: block;
    background: #e9e9ea;
    transition: background-color 160ms ease;
  }

  .switch-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 5px rgb(0 0 0 / 20%);
    transition: transform 160ms ease;
  }

  .switch input:checked + .switch-track {
    background: #34c759;
  }

  .switch input:checked + .switch-track::after {
    transform: translateX(20px);
  }

  .switch input:focus-visible + .switch-track {
    outline: 3px solid var(--focus);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .switch-track,
    .switch-track::after {
      transition: none;
    }
  }
</style>
