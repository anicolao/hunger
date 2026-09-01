<script lang="ts">
  import { sensationLevels } from '$lib/domain/scale';
</script>

<div class="reference" aria-label="Sensation scale reference">
  {#each sensationLevels as sensation}
    <div class="level">
      <strong>{sensation.level}</strong>
      <span><b>{sensation.phrase}</b><small>{sensation.cue}</small></span>
    </div>
  {/each}
</div>

<style>
  .reference { margin-top: 20px; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--surface); }
  .level { min-height: 64px; padding: 10px 14px; border-bottom: 1px solid var(--border); display: grid; grid-template-columns: 42px 1fr; align-items: center; gap: 10px; }
  .level:last-child { border-bottom: 0; }
  .level > strong { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; color: var(--primary); background: var(--primary-soft); font-size: 19px; }
  .level span { display: grid; gap: 2px; }
  .level small { color: var(--ink-muted); font-size: 14px; line-height: 1.35; }
</style>
