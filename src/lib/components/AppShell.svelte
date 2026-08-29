<script lang="ts">
  import { base } from '$app/paths';
  import type { Snippet } from 'svelte';
  import Brand from './Brand.svelte';

  let {
    active,
    children
  }: {
    active: 'today' | 'insights' | 'profile' | 'settings';
    children: Snippet;
  } = $props();

  const destinations = [
    { id: 'today' as const, label: 'Today', href: `${base}/`, icon: '○' },
    { id: 'insights' as const, label: 'Insights', href: `${base}/insights`, icon: '◇' },
    { id: 'profile' as const, label: 'Profile', href: `${base}/profile`, icon: '◒' },
    { id: 'settings' as const, label: 'Settings', href: `${base}/settings`, icon: '⚙' }
  ];
</script>

<a class="skip-link" href="#main-content">Skip to content</a>
<div class="app-frame" data-e2e-layout>
  <aside class="sidebar">
    <Brand />
    <nav aria-label="Primary">
      {#each destinations as destination}
        <a
          class:active={active === destination.id}
          href={destination.href}
          aria-current={active === destination.id ? 'page' : undefined}
        >
          <span aria-hidden="true">{destination.icon}</span>
          {destination.label}
        </a>
      {/each}
    </nav>
    <p class="private-note">Private on this device</p>
  </aside>

  <div class="content-frame">
    <header class="mobile-header">
      <Brand compact />
      <a class="settings-link" href={`${base}/settings`} aria-label="Settings">⚙</a>
    </header>
    <main id="main-content">
      {@render children()}
    </main>
    <nav class="bottom-nav" aria-label="Primary">
      {#each destinations.slice(0, 3) as destination}
        <a
          class:active={active === destination.id}
          href={destination.href}
          aria-current={active === destination.id ? 'page' : undefined}
        >
          <span aria-hidden="true">{destination.icon}</span>
          <small>{destination.label}</small>
        </a>
      {/each}
    </nav>
  </div>
</div>

<style>
  .skip-link {
    position: fixed;
    z-index: 100;
    top: 8px;
    left: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    background: var(--primary);
    transform: translateY(-150%);
  }

  .skip-link:focus-visible {
    transform: translateY(0);
  }

  .app-frame {
    min-height: 100vh;
  }

  .sidebar {
    display: none;
  }

  .content-frame {
    min-height: 100vh;
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
  }

  .mobile-header {
    min-height: calc(68px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 16px 0;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: color-mix(in srgb, var(--canvas) 94%, transparent);
  }

  .settings-link {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink);
    font-size: 20px;
    text-decoration: none;
  }

  main {
    width: min(100% - 32px, 720px);
    margin-inline: auto;
    padding: 32px 0 48px;
  }

  .bottom-nav {
    position: fixed;
    z-index: 20;
    right: 0;
    bottom: 0;
    left: 0;
    height: calc(64px + env(safe-area-inset-bottom));
    padding: 4px max(12px, env(safe-area-inset-right)) env(safe-area-inset-bottom)
      max(12px, env(safe-area-inset-left));
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: color-mix(in srgb, var(--surface) 96%, transparent);
  }

  nav a {
    min-height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    color: var(--ink-muted);
    text-decoration: none;
  }

  .bottom-nav a {
    flex-direction: column;
  }

  nav a.active {
    color: var(--ink);
    background: var(--primary-soft);
    font-weight: 700;
  }

  nav small {
    font-size: 12px;
  }

  @media (max-height: 500px) and (orientation: landscape) and (max-width: 959px) {
    .content-frame { padding-bottom: 0; }
    .bottom-nav { position: static; }
  }

  @media (min-width: 960px) {
    .app-frame {
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
    }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 28px 20px;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      background: var(--surface);
    }

    .sidebar nav {
      margin-top: 44px;
      display: grid;
      gap: 8px;
    }

    .sidebar nav a {
      padding: 0 14px;
      justify-content: flex-start;
    }

    .private-note {
      margin: auto 0 0;
      color: var(--ink-muted);
      font-size: 13px;
    }

    .content-frame {
      padding-bottom: 0;
    }

    .mobile-header,
    .bottom-nav {
      display: none;
    }

    main {
      width: min(100% - 64px, 1040px);
      padding: 56px 0 80px;
    }
  }
</style>
