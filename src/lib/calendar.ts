/**
 * Generate calendar event data for different calendar formats
 */

interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date | null;
  url?: string;
}

/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const start = formatDateForGoogle(event.startDate);
  const end = event.endDate ? formatDateForGoogle(event.endDate) : formatDateForGoogle(addHours(event.startDate, 2));
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description || '',
    location: event.location || '',
  });

  if (event.url) {
    params.append('ctz', 'America/New_York');
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook Calendar URL
 */
export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const start = formatDateForOutlook(event.startDate);
  const end = event.endDate ? formatDateForOutlook(event.endDate) : formatDateForOutlook(addHours(event.startDate, 2));
  
  const params = new URLSearchParams({
    subject: event.title,
    startdt: start,
    enddt: end,
    body: event.description,
    location: event.location || '',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate iCal (.ics) file content
 */
export function generateIcalContent(event: CalendarEvent): string {
  const start = formatDateForIcal(event.startDate);
  const end = event.endDate ? formatDateForIcal(event.endDate) : formatDateForIcal(addHours(event.startDate, 2));
  
  const description = escapeIcalText(event.description);
  const location = escapeIcalText(event.location || '');
  const title = escapeIcalText(event.title);
  const url = event.url ? escapeIcalText(event.url) : '';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OwnRSVP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUid()}`,
    `DTSTAMP:${formatDateForIcal(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}${url ? `\\n\\nEvent Link: ${url}` : ''}`,
    `LOCATION:${location}`,
    ...(url ? [`URL:${url}`] : []),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Download iCal file
 */
export function downloadIcalFile(event: CalendarEvent, filename: string = 'event.ics'): void {
  const content = generateIcalContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Helper functions

function formatDateForGoogle(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatDateForOutlook(date: Date): string {
  return date.toISOString();
}

function formatDateForIcal(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function generateUid(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@ownrsvp`;
}

