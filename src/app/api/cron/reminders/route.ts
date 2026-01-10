import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendReminder } from '@/lib/email';
import { sendSmsReminder } from '@/lib/sms';
import { parseReminderSchedule, shouldSendReminder } from '@/lib/reminder-utils';
import { logger } from '@/lib/logger';

// This endpoint can be called by an external cron service (e.g., cron-job.org)
// or by the built-in scheduler. Protect with a secret in production.
export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    // Check events up to 14 days ahead (for day reminders) and 48 hours ahead (for hour reminders)
    const maxDaysAhead = 14;
    const maxHoursAhead = 48;
    const maxDate = new Date(now.getTime() + Math.max(maxDaysAhead * 24 * 60 * 60 * 1000, maxHoursAhead * 60 * 60 * 1000));

    // Find all upcoming events (we'll filter by reminder schedule below)
    const upcomingEvents = await prisma.event.findMany({
      where: {
        date: {
          gte: now,
          lte: maxDate,
        },
      },
      include: {
        guests: {
          where: {
            status: 'PENDING',
          },
        },
      },
    });

    let emailsSent = 0;
    let smsSent = 0;
    let errorCount = 0;

    // Helper function to check if any reminder should be sent now
    const shouldSendReminderNow = (event: typeof upcomingEvents[0]): boolean => {
      const eventDate = new Date(event.date);
      
      // If event has custom reminder schedule
      if (event.reminderSchedule) {
        const reminders = parseReminderSchedule(event.reminderSchedule);
        if (reminders.length > 0) {
          // Check if any reminder matches the current time
          return reminders.some(reminder => shouldSendReminder(reminder, eventDate, now));
        }
      }

      // Default: send reminder 2 days before event
      const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return daysUntilEvent === 2;
    };

    for (const event of upcomingEvents) {
      // Check if any reminder should be sent now for this event
      if (!shouldSendReminderNow(event)) {
        continue;
      }

      for (const guest of event.guests) {
        const reminderPromises = [];

        // Send email reminder if not already sent
        if (guest.notifyByEmail && !guest.reminderSentAt) {
          reminderPromises.push(
            sendReminder({
              to: guest.email,
              guestName: guest.name,
              event: {
                title: event.title,
                date: event.date,
                location: event.location,
              },
              rsvpToken: guest.token,
            })
              .then(() => {
                emailsSent++;
              })
              .catch((error) => {
                logger.error('Failed to send email reminder', error, { email: guest.email });
                errorCount++;
              })
          );
        }

        // Send SMS reminder if not already sent
        if (guest.notifyBySms && guest.phone && !guest.smsReminderSentAt) {
          reminderPromises.push(
            sendSmsReminder({
              to: guest.phone,
              guestName: guest.name,
              event: {
                title: event.title,
                date: event.date,
                location: event.location,
              },
              rsvpToken: guest.token,
            })
              .then(() => {
                smsSent++;
              })
              .catch((error) => {
                logger.error('Failed to send SMS reminder', error, { phone: guest.phone });
                errorCount++;
              })
          );
        }

        if (reminderPromises.length > 0) {
          await Promise.all(reminderPromises);

          // Update reminder sent timestamps
          await prisma.guest.update({
            where: { id: guest.id },
            data: {
              reminderSentAt: guest.notifyByEmail && !guest.reminderSentAt ? new Date() : undefined,
              smsReminderSentAt: guest.notifyBySms && guest.phone && !guest.smsReminderSentAt ? new Date() : undefined,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      smsSent,
      errors: errorCount,
    });
  } catch (error) {
    logger.error('Cron reminders error', error);
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    );
  }
}
