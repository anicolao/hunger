import { describe, expect, it } from 'vitest';
import { getProgramProgress } from './progression';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 7, 1, 12);

describe('program progression', () => {
  it.each([
    [0, 1, 1, 'Hunger'],
    [7, 8, 2, 'Fullness'],
    [14, 15, 3, 'Hunger and wanting food'],
    [21, 22, 4, 'Personal patterns'],
    [40, 30, 4, 'Personal patterns']
  ])('uses elapsed day %s without a streak reset', (elapsedDays, day, week, focus) => {
    expect(getProgramProgress(START, START + elapsedDays * DAY)).toMatchObject({ day, week, focus });
  });

  it('does not move before day one when the device clock moves backwards', () => {
    expect(getProgramProgress(START, START - DAY)).toMatchObject({ day: 1, week: 1 });
  });
});
