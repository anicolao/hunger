<script lang="ts">
  import { base } from '$app/paths';

  let { compact = false }: { compact?: boolean } = $props();
</script>

<a class:compact class="brand" href={`${base}/`} aria-label="Learn Your Appetite home">
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M20 33V18m0 4c-7 0-11-4-11-10 7 0 11 4 11 10Zm0 5c7 0 11-4 11-10-7 0-11 4-11 10Z" />
  </svg>
  <span>Learn Your Appetite</span>
</a>

<style>
  .brand {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    font-size: 18px;
    font-weight: 700;
    text-decoration: none;
  }

  svg {
    width: 34px;
    height: 34px;
    fill: none;
    stroke: var(--primary);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .compact span {
    font-size: 16px;
  }
</style>
