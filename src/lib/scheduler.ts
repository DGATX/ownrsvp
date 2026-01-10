import cron from 'node-cron';
import { prisma } from './prisma';
import { sendReminder } from './email';

// Send reminders for events happening in the next 2 days
// to guests who haven't responded yet
async function sendEventReminders() {
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  try {
    // Find upcoming events within 2 days
    const upcomingEvents = await prisma.event.findMany({
      where: {
        date: {
          gte: now,
          lte: twoDaysFromNow,
        },
      },
      include: {
        guests: {
          where: {
            status: 'PENDING',
            reminderSentAt: null,
          },
        },
      },
    });

    for (const event of upcomingEvents) {
      for (const guest of event.guests) {
        try {
          await sendReminder({
            to: guest.email,
            guestName: guest.name,
            event: {
              title: event.title,
              date: event.date,
              location: event.location,
            },
            rsvpToken: guest.token,
          });

          // Update reminder sent timestamp
          await prisma.guest.update({
            where: { id: guest.id },
            data: { reminderSentAt: new Date() },
          });

          console.log(`Sent reminder to ${guest.email} for event: ${event.title}`);
        } catch (error) {
          console.error(`Failed to send reminder to ${guest.email}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendEventReminders:', error);
  }
}

// Initialize scheduler
export function initScheduler() {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', () => {
    console.log('Running scheduled reminder job...');
    sendEventReminders();
  });

  console.log('Scheduler initialized - reminders will be sent daily at 9 AM');
}

// Export for manual triggering
export { sendEventReminders };

