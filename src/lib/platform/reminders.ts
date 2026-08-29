export interface ReminderRequest { windows: string[]; cadence: string; message: 'Want to notice how your body feels?'; }
export interface ReminderResult { capability: 'in-app-only'; request: ReminderRequest; explanation: string; }
export function configureBrowserReminders(windows: string[], cadence: string): ReminderResult {
  return { capability: 'in-app-only', request: { windows: [...windows], cadence, message: 'Want to notice how your body feels?' }, explanation: 'Saved as an in-app prompt. This browser cannot promise a reminder while the app is closed.' };
}
