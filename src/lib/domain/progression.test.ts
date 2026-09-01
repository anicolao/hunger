import { describe, expect, it } from 'vitest';
import { getProgramProgress, sameLocalCalendarDay } from './progression';

describe('calendar program progression', () => {
  const day = 24 * 60 * 60 * 1000;
  const start = Date.UTC(2026, 7, 1, 12);

  it.each([
    [0, 1, 1, 'Hunger'],
    [7, 8, 2, 'Fullness'],
    [14, 15, 3, 'Hunger and wanting food'],
    [21, 22, 4, 'Personal patterns'],
    [40, 30, 4, 'Personal patterns']
  ])('uses local elapsed day %s without a streak reset', (elapsedDays, programDay, week, focus) => {
    expect(getProgramProgress(start, start + elapsedDays * day, 'UTC')).toMatchObject({
      day: programDay,
      week,
      focus
    });
  });

  it('does not move before day one when the device clock moves backwards', () => {
    expect(getProgramProgress(start, start - day, 'UTC')).toMatchObject({ day: 1, week: 1 });
  });

  it('advances by Toronto calendar day across the 23-hour spring transition', () => {
    const before = Date.parse('2026-03-07T17:00:00Z');
    const after = Date.parse('2026-03-08T16:00:00Z');
    expect(getProgramProgress(before, after, 'America/Toronto').day).toBe(2);
  });

  it('advances by Toronto calendar day across the 25-hour fall transition', () => {
    const before = Date.parse('2026-10-31T16:00:00Z');
    const after = Date.parse('2026-11-01T17:00:00Z');
    expect(getProgramProgress(before, after, 'America/Toronto').day).toBe(2);
  });

  it('completes on local calendar day 30 and clamps later days', () => {
    const startedAt = Date.parse('2026-08-01T16:00:00Z');
    const day29 = Date.parse('2026-08-29T16:00:00Z');
    const day30 = Date.parse('2026-08-30T16:00:00Z');
    expect(getProgramProgress(startedAt, day29, 'America/Toronto')).toMatchObject({ day: 29, complete: false });
    expect(getProgramProgress(startedAt, day30, 'America/Toronto')).toMatchObject({ day: 30, complete: true });
    expect(getProgramProgress(startedAt, Date.parse('2026-09-15T16:00:00Z'), 'America/Toronto')).toMatchObject({ day: 30, complete: true });
  });

  it('compares dates in the program timezone rather than the host timezone', () => {
    expect(sameLocalCalendarDay(
      Date.parse('2026-08-29T03:30:00Z'),
      Date.parse('2026-08-29T05:30:00Z'),
      'America/Toronto'
    )).toBe(false);
  });
});
