export function getDeviceTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (typeof timeZone === 'string' && timeZone.trim()) {
      return timeZone.trim();
    }
  } catch {
    // Fall through to UTC.
  }

  return 'UTC';
}
