export function reminderCadence(week: 1 | 2 | 3 | 4, paused: boolean): string {
  if (paused) return 'Paused';
  if (week === 1) return 'Up to two chosen windows plus an open check-in reminder';
  if (week === 2) return 'One chosen window plus an open check-in reminder';
  if (week === 3) return 'Context-focused reminders only when enabled';
  return 'Experiment reminder only';
}
