export interface Runtime {
  now(): number;
  createId(): string;
  timeZone(): string;
}

export const runtime: Runtime = {
  now: () => Date.now(),
  createId: () => crypto.randomUUID(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone
};
