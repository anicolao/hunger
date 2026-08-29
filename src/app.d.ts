declare global {
  namespace App {}

  interface Window {
    __HUNGER_E2E__?: {
      importFixture(fixture: import('$lib/platform/e2e').E2EFixture): Promise<void>;
    };
  }
}

export {};
