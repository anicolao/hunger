declare global {
  namespace App {}

  interface ImportMetaEnv {
    readonly VITE_NATIVE_SHELL?: 'ios';
  }

  interface Window {
    __HUNGER_E2E__?: {
      importFixture(fixture: import('$lib/platform/e2e').E2EFixture): Promise<void>;
      replayEvents(): Promise<{ eventCount: number; eventTypes: string[] }>;
      failNextPhotoWrite(): void;
    };
  }
}

export {};
