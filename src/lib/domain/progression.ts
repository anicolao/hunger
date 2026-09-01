export interface ProgramProgress {
  day: number;
  week: 1 | 2 | 3 | 4;
  focus: 'Hunger' | 'Fullness' | 'Hunger and wanting food' | 'Personal patterns';
  prompt: string;
  complete: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localDateParts(timestamp: number, timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return [value('year'), value('month'), value('day')];
}

export function localCalendarDay(timestamp: number, timeZone: string): number {
  const [year, month, day] = localDateParts(timestamp, timeZone);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function sameLocalCalendarDay(left: number, right: number, timeZone: string): boolean {
  return localCalendarDay(left, timeZone) === localCalendarDay(right, timeZone);
}

export function getProgramProgress(
  startedAt: number,
  now: number,
  timeZone = 'UTC'
): ProgramProgress {
  const elapsedDays = Math.max(
    0,
    localCalendarDay(now, timeZone) - localCalendarDay(startedAt, timeZone)
  );
  const day = Math.min(30, elapsedDays + 1);
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

  return { day, week, ...stages[week], complete: elapsedDays >= 29 };
}
