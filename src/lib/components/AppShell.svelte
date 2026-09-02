<script lang="ts">
  import { base } from '$app/paths';
  import type { Snippet } from 'svelte';
  import gearIcon from '$lib/assets/gear.svg?no-inline';
  import todayIcon from '$lib/assets/today.svg?no-inline';
  import insightsIcon from '$lib/assets/insights.svg?no-inline';
  import profileIcon from '$lib/assets/profile.svg?no-inline';
  import Brand from './Brand.svelte';

  let {
    active,
    children
  }: {
    active: 'today' | 'insights' | 'profile' | 'settings';
    children: Snippet;
  } = $props();

  const destinations = [
    { id: 'today' as const, label: 'Today', href: `${base}/`, icon: todayIcon },
    { id: 'insights' as const, label: 'Insights', href: `${base}/insights`, icon: insightsIcon },
    { id: 'profile' as const, label: 'Profile', href: `${base}/profile`, icon: profileIcon },
    { id: 'settings' as const, label: 'Settings', href: `${base}/settings`, icon: gearIcon }
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
          aria-label={destination.label}
          aria-current={active === destination.id ? 'page' : undefined}
        >
          <span class="svg-icon" data-icon={destination.id} style={`--icon: url("${destination.icon}")`} aria-hidden="true"></span>
          {destination.label}
        </a>
      {/each}
    </nav>
    <p class="private-note">Private on this device</p>
  </aside>

  <div class="content-frame">
    <header class="mobile-header">
      <Brand compact />
    </header>
    <main id="main-content">
      {@render children()}
    </main>
    <nav class="bottom-nav" aria-label="Primary">
      {#each destinations as destination}
        <a
          class:active={active === destination.id}
          href={destination.href}
          aria-label={destination.label}
          aria-current={active === destination.id ? 'page' : undefined}
        >
          <span class="svg-icon" data-icon={destination.id} style={`--icon: url("${destination.icon}")`} aria-hidden="true"></span>
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
    min-height: 100svh;
  }

  .sidebar {
    display: none;
  }

  .content-frame {
    min-height: 100svh;
    padding-bottom: calc(92px + var(--shell-safe-area-bottom));
  }

  .mobile-header {
    display: none;
  }

  .svg-icon {
    width: 20px;
    height: 20px;
    display: block;
    background: currentColor;
    -webkit-mask: var(--icon) center / contain no-repeat;
    mask: var(--icon) center / contain no-repeat;
  }

  main {
    width: min(100% - 24px, 720px);
    margin-inline: auto;
    padding: max(22px, env(safe-area-inset-top)) 0 28px;
  }

  .bottom-nav {
    position: fixed;
    z-index: 20;
    right: max(12px, env(safe-area-inset-right));
    bottom: max(8px, var(--shell-safe-area-bottom));
    left: max(12px, env(safe-area-inset-left));
    height: 70px;
    padding: 5px;
    border: 1px solid var(--rim);
    border-radius: 24px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--glass-strong);
    box-shadow: var(--shadow);
    backdrop-filter: blur(24px) saturate(135%);
  }

  nav a {
    min-height: 48px;
    border-radius: 18px;
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
    color: var(--primary);
    background: var(--primary-soft);
    font-weight: 700;
  }

  nav small {
    font-size: 11px;
  }

  @media (max-height: 500px) and (orientation: landscape) and (max-width: 959px) {
    .content-frame { padding-bottom: 82px; }
    .bottom-nav { bottom: 6px; }
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
      background: var(--glass-strong);
      backdrop-filter: blur(24px) saturate(130%);
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

    .bottom-nav {
      display: none;
    }

    main {
      width: min(100% - 64px, 1040px);
      padding: 56px 0 80px;
    }
  }
</style>
