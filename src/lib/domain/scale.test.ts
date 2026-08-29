import { describe, expect, it } from 'vitest';
import { getSensationLevel, isSensationLevel, sensationLevels } from './scale';

describe('unified sensation scale', () => {
  it('keeps one direction from urgent hunger through neutral to painful fullness', () => {
    expect(sensationLevels).toHaveLength(10);
    expect(getSensationLevel(1).phrase).toBe('Urgent hunger');
    expect(getSensationLevel(5).phrase).toBe('Neutral');
    expect(getSensationLevel(10).phrase).toBe('Painfully full');
  });

  it.each([1, 5, 10])('accepts the valid level %s', (level) => {
    expect(isSensationLevel(level)).toBe(true);
  });

  it.each([0, 11, 2.5, '4', null])('rejects the invalid level %s', (level) => {
    expect(isSensationLevel(level)).toBe(false);
  });
});
