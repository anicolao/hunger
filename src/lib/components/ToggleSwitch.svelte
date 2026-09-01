<script lang="ts">
  let {
    label,
    description,
    checked,
    onchange
  }: {
    label: string;
    description: string;
    checked: boolean;
    onchange: (checked: boolean) => void;
  } = $props();
</script>

<label class="toggle-row">
  <span class="copy"><strong>{label}</strong><small>{description}</small></span>
  <span class="switch">
    <input
      type="checkbox"
      aria-label={`${label}, ${checked ? 'on' : 'off'}`}
      {checked}
      onchange={(event) => onchange(event.currentTarget.checked)}
    />
    <span class="track" aria-hidden="true"></span>
  </span>
</label>

<style>
  .toggle-row {
    min-height: 64px;
    padding: 8px 2px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
  }
  .copy { display: grid; gap: 2px; }
  .copy small { color: var(--ink-muted); font-size: 14px; font-weight: 400; line-height: 1.35; }
  .switch { position: relative; width: 51px; height: 44px; flex: 0 0 51px; display: grid; place-items: center; }
  .switch input { position: absolute; z-index: 1; width: 51px; height: 44px; margin: 0; opacity: 0; cursor: pointer; }
  .track { position: relative; width: 51px; height: 31px; border-radius: 999px; display: block; background: #e9e9ea; transition: background-color 160ms ease; }
  .track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: white; box-shadow: 0 2px 5px rgb(0 0 0 / 20%); transition: transform 160ms ease; }
  input:checked + .track { background: #34c759; }
  input:checked + .track::after { transform: translateX(20px); }
  input:focus-visible + .track { outline: 3px solid var(--focus); outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) { .track, .track::after { transition: none; } }
  @media (forced-colors: active) { input:checked + .track { outline: 2px solid Highlight; } }
</style>
