export interface SensationLevel {
  level: number;
  phrase: string;
  cue: string;
}

export const sensationLevels: readonly SensationLevel[] = [
  { level: 1, phrase: 'Urgent hunger', cue: 'Weak, shaky, or dizzy may be present.' },
  { level: 2, phrase: 'Strong hunger', cue: 'Empty, irritable, or eager to eat.' },
  { level: 3, phrase: 'Clear hunger', cue: 'Ready to eat without urgency.' },
  { level: 4, phrase: 'Early hunger', cue: 'Subtle body cues or more thoughts of food.' },
  { level: 5, phrase: 'Neutral', cue: 'Neither hungry nor full.' },
  { level: 6, phrase: 'Satisfied and comfortable', cue: 'Hunger has eased.' },
  { level: 7, phrase: 'Comfortably full', cue: 'Little interest in more food.' },
  { level: 8, phrase: 'Too full', cue: 'Pressure or mild discomfort.' },
  { level: 9, phrase: 'Very full', cue: 'Marked discomfort.' },
  { level: 10, phrase: 'Painfully full', cue: 'Nauseated or unwell may be present.' }
] as const;

export function isSensationLevel(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10;
}

export function getSensationLevel(level: number): SensationLevel {
  const sensation = sensationLevels.find((item) => item.level === level);
  if (!sensation) throw new RangeError(`Sensation level must be from 1 to 10; received ${level}`);
  return sensation;
}
