import { describe, expect, it } from 'vitest';
import { configureBrowserReminders } from './reminders';
describe('browser reminder adapter', () => { it('returns the exact local payload without a false scheduling claim', () => expect(configureBrowserReminders(['morning'], 'up to twice daily')).toEqual({ capability: 'in-app-only', request: { windows: ['morning'], cadence: 'up to twice daily', message: 'Want to notice how your body feels?' }, explanation: 'Saved as an in-app prompt. This browser cannot promise a reminder while the app is closed.' })); });
