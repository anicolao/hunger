export interface ProgramProgress {
  day: number;
  week: 1 | 2 | 3 | 4;
  focus: 'Hunger' | 'Fullness' | 'Hunger and wanting food' | 'Personal patterns';
  prompt: string;
  complete: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getProgramProgress(startedAt: number, now: number): ProgramProgress {
  const elapsed = Math.max(0, now - startedAt);
  const day = Math.min(30, Math.floor(elapsed / DAY_MS) + 1);
  const week = Math.min(4, Math.floor((day - 1) / 7) + 1) as 1 | 2 | 3 | 4;

  const stages = {
    1: {
      focus: 'Hunger' as const,
      prompt: 'A quick check-in before eating helps you learn your starting cues.'
    },
    2: {
      focus: 'Fullness' as const,
      prompt: 'Notice where satisfaction becomes fullness for you.'
    },
    3: {
      focus: 'Hunger and wanting food' as const,
      prompt: 'Notice body hunger and wanting food; either can be present.'
    },
    4: {
      focus: 'Personal patterns' as const,
      prompt: 'Look for what repeats while you try one small experiment.'
    }
  };

  return { day, week, ...stages[week], complete: now >= startedAt + 30 * DAY_MS };
}
