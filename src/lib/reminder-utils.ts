export type ReminderType = 'day' | 'hour';
export type Reminder = { type: ReminderType; value: number };

/**
 * Parse reminder schedule from JSON string, handling both old and new formats
 * Old format: [7, 3, 1] (array of numbers = days)
 * New format: [{type: "day", value: 7}, {type: "hour", value: 2}]
 */
export function parseReminderSchedule(schedule: string | null): Reminder[] {
  if (!schedule) {
    return [];
  }

  try {
    const parsed = JSON.parse(schedule);

    // Handle old format: array of numbers (days)
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Check if it's old format (all numbers)
      if (typeof parsed[0] === 'number') {
        // Migrate old format to new format
        return parsed.map((day: number) => ({
          type: 'day' as ReminderType,
          value: day,
        }));
      }

      // New format: array of objects
      if (typeof parsed[0] === 'object' && parsed[0].type && parsed[0].value !== undefined) {
        return parsed as Reminder[];
      }
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Format a reminder for display
 */
export function formatReminder(reminder: Reminder): string {
  if (reminder.type === 'day') {
    return `${reminder.value} day${reminder.value !== 1 ? 's' : ''} before`;
  } else {
    return `${reminder.value} hour${reminder.value !== 1 ? 's' : ''} before`;
  }
}

/**
 * Validate reminders array - check for duplicates and valid values
 */
export function validateReminders(reminders: Reminder[]): { valid: boolean; error?: string } {
  // Check for duplicates (same type and value)
  const seen = new Set<string>();
  for (const reminder of reminders) {
    const key = `${reminder.type}:${reminder.value}`;
    if (seen.has(key)) {
      return { valid: false, error: `Duplicate reminder: ${formatReminder(reminder)}` };
    }
    seen.add(key);

    // Check for positive values
    if (reminder.value <= 0) {
      return { valid: false, error: `Reminder value must be positive: ${formatReminder(reminder)}` };
    }

    // Check for valid type
    if (reminder.type !== 'day' && reminder.type !== 'hour') {
      return { valid: false, error: `Invalid reminder type: ${reminder.type}` };
    }
  }

  return { valid: true };
}

/**
 * Check if a reminder should be sent at the current time
 */
export function shouldSendReminder(reminder: Reminder, eventDate: Date, now: Date): boolean {
  const timeUntilEvent = eventDate.getTime() - now.getTime();

  if (reminder.type === 'day') {
    // Calculate days until event (rounded up)
    const daysUntilEvent = Math.ceil(timeUntilEvent / (24 * 60 * 60 * 1000));
    return daysUntilEvent === reminder.value;
  } else {
    // Calculate hours until event (rounded up)
    const hoursUntilEvent = Math.ceil(timeUntilEvent / (60 * 60 * 1000));
    return hoursUntilEvent === reminder.value;
  }
}

/**
 * Serialize reminders to JSON string for storage
 */
export function serializeReminderSchedule(reminders: Reminder[]): string | null {
  if (reminders.length === 0) {
    return null;
  }
  return JSON.stringify(reminders);
}

