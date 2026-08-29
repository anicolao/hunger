export interface Runtime {
  now(): number;
  createId(): string;
  timeZone(): string;
}

const e2eMode = import.meta.env.DEV && import.meta.env.VITE_GIT_HASH === 'e2e-test';
const e2eNow = Date.UTC(2026, 7, 29, 16, 0, 0);
let e2eSequence = 0;

export const runtime: Runtime = {
  now: () => (e2eMode ? e2eNow : Date.now()),
  createId: () => (e2eMode ? `e2e-${++e2eSequence}` : crypto.randomUUID()),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone
};
