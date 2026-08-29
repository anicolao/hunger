import { getRepository } from '$lib/data/repository';
import type { AppSettings, EatingEpisode, ExperimentRecord, Program } from '$lib/data/schema';

export interface E2EFixture {
  version: 1;
  program: Program;
  episodes: EatingEpisode[];
  settings?: AppSettings;
  experiments?: ExperimentRecord[];
}

export function installE2EFixtureBoundary() {
  if (!import.meta.env.DEV || import.meta.env.VITE_GIT_HASH !== 'e2e-test') return;
  window.__HUNGER_E2E__ = {
    importFixture: async (fixture: E2EFixture) => {
      if (fixture.version !== 1) throw new Error(`Unsupported E2E fixture version ${fixture.version}`);
      await getRepository().importFixture(fixture);
    },
    replayEvents: async () => {
      const repository = getRepository();
      const events = await repository.listEvents();
      await repository.rebuildProjection();
      return {
        eventCount: events.length,
        eventTypes: events.map(({ type }) => type)
      };
    }
  };
  document.documentElement.dataset.e2eFixture = 'ready';
}
