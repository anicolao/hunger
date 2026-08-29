<script lang="ts">
  import { base } from '$app/paths';
</script>

<svelte:head><title>Before eating — Learn Your Appetite</title></svelte:head>

<main data-status="ready" data-e2e-layout>
  <a href={`${base}/`}>← Back to Today</a>
  <p>Before eating</p>
  <h1>How does your body feel?</h1>
  <section>
    <h2>Paired check-ins are next</h2>
    <p>The complete sensation and save flow arrives in the next implementation slice.</p>
  </section>
</main>

<style>
  main { width: min(100% - 32px, 620px); margin: 32px auto; }
  a { min-height: 48px; display: inline-flex; align-items: center; color: var(--primary); font-weight: 700; }
  main > p { margin: 32px 0 8px; color: var(--primary); font-weight: 700; text-transform: uppercase; }
  h1 { margin: 0; font-size: 36px; }
  section { margin-top: 32px; padding: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
  h2 { margin: 0; }
  section p { color: var(--ink-muted); }
</style>
