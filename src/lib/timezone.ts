import { formatInTimeZone } from 'date-fns-tz';

/**
 * Common timezones for the timezone selector
 */
export const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'UTC', label: 'UTC' },
];

/**
 * Get the browser's current timezone
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Format a date in a specific timezone
 * @param date - The date to format (UTC)
 * @param timezone - IANA timezone string (e.g., "America/Chicago")
 * @param formatStr - date-fns format string
 * @returns Formatted date string
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string | null | undefined,
  formatStr: string = "EEEE, MMMM d, yyyy 'at' h:mm a zzz"
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const tz = timezone || 'UTC';

  try {
    return formatInTimeZone(d, tz, formatStr);
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    return formatInTimeZone(d, 'UTC', formatStr);
  }
}

/**
 * Format just the date portion in a timezone
 */
export function formatDateOnlyInTimezone(
  date: Date | string,
  timezone: string | null | undefined
): string {
  return formatDateInTimezone(date, timezone, 'EEEE, MMMM d, yyyy');
}

/**
 * Format just the time portion in a timezone with timezone abbreviation
 */
export function formatTimeInTimezone(
  date: Date | string,
  timezone: string | null | undefined
): string {
  return formatDateInTimezone(date, timezone, 'h:mm a zzz');
}

/**
 * Format date and time for display (e.g., "Tuesday, January 20, 2026 at 3:00 PM CST")
 */
export function formatEventDateTime(
  date: Date | string,
  timezone: string | null | undefined
): string {
  return formatDateInTimezone(date, timezone, "EEEE, MMMM d, yyyy 'at' h:mm a zzz");
}

/**
 * Format a shorter date/time for cards and lists
 */
export function formatEventDateTimeShort(
  date: Date | string,
  timezone: string | null | undefined
): string {
  return formatDateInTimezone(date, timezone, "MMM d, yyyy 'at' h:mm a zzz");
}

/**
 * Get timezone abbreviation for a date
 */
export function getTimezoneAbbreviation(
  date: Date | string,
  timezone: string | null | undefined
): string {
  return formatDateInTimezone(date, timezone, 'zzz');
}

/**
 * Find a timezone in the common list by value
 */
export function findTimezoneLabel(timezoneValue: string): string | undefined {
  const found = COMMON_TIMEZONES.find(tz => tz.value === timezoneValue);
  return found?.label;
}
