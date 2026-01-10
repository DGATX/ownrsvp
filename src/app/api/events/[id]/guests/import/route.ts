import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { z } from 'zod';
import { sendInvitation } from '@/lib/email';
import { sendSmsInvitation } from '@/lib/sms';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const guestRowSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().optional(),
  phone: z.string().optional(),
});

const importSchema = z.object({
  guests: z.array(z.object({
    email: z.string().email('Invalid email'),
    name: z.string().optional(),
    phone: z.string().optional(),
  })),
  sendInvites: z.boolean().optional().default(false),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can manage this event
    const canManage = await canManageEvent(session.user.id, eventId);
    if (!canManage) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { guests, sendInvites } = parsed.data;

    // Get existing guests to check for duplicates
    const existingGuests = await prisma.guest.findMany({
      where: { eventId },
      select: { email: true },
    });
    const existingEmails = new Set(existingGuests.map((g) => g.email.toLowerCase()));

    // Process each guest
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const guestData of guests) {
      // Validate individual guest
      const guestParsed = guestRowSchema.safeParse(guestData);
      if (!guestParsed.success) {
        results.errors.push(`Invalid data for ${guestData.email || 'unknown'}: ${guestParsed.error.errors[0].message}`);
        continue;
      }

      const { email, name, phone } = guestParsed.data;

      // Check for duplicate
      if (existingEmails.has(email.toLowerCase())) {
        results.skipped++;
        continue;
      }

      try {
        await prisma.guest.create({
          data: {
            eventId,
            email: email.toLowerCase(),
            name: name || null,
            phone: phone || null,
            notifyByEmail: true,
            notifyBySms: !!phone,
          },
        });
        
        existingEmails.add(email.toLowerCase());
        results.imported++;
      } catch (error) {
        results.errors.push(`Failed to add ${email}`);
      }
    }

    // Send invitations to imported guests if requested
    if (sendInvites && results.imported > 0) {
      console.log(`Sending invitations to ${results.imported} newly imported guests`);

      // Fetch the newly imported guests with their tokens
      const newlyImportedGuests = await prisma.guest.findMany({
        where: {
          eventId,
          email: {
            in: guests
              .map((g) => g.email.toLowerCase())
              .filter((email) => !existingEmails.has(email) || existingEmails.size === 0),
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          token: true,
          notifyByEmail: true,
          notifyBySms: true,
        },
      });

      // Get event details including host name
      const eventWithHost = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          host: {
            select: { name: true },
          },
        },
      });

      if (!eventWithHost) {
        console.error('Event not found after import');
        return NextResponse.json({
          success: true,
          results,
          invitationsSent: false,
          invitationsError: 'Event not found',
        });
      }

      // Send invitations to all newly imported guests
      const invitationResults = {
        emailsSent: 0,
        emailsFailed: 0,
        smsSent: 0,
        smsFailed: 0,
      };

      await Promise.all(
        newlyImportedGuests.map(async (guest) => {
          const promises: Promise<void>[] = [];

          // Send email invitation
          if (guest.notifyByEmail) {
            promises.push(
              sendInvitation({
                to: guest.email,
                guestName: guest.name,
                event: {
                  title: eventWithHost.title,
                  date: eventWithHost.date,
                  location: eventWithHost.location,
                  description: eventWithHost.description,
                },
                rsvpToken: guest.token,
                hostName: eventWithHost.host.name,
              })
                .then(() => {
                  invitationResults.emailsSent++;
                })
                .catch((error) => {
                  console.error(`Failed to send email invitation to ${guest.email}:`, error);
                  invitationResults.emailsFailed++;
                })
            );
          }

          // Send SMS invitation
          if (guest.notifyBySms && guest.phone) {
            promises.push(
              sendSmsInvitation({
                to: guest.phone,
                guestName: guest.name,
                event: {
                  title: eventWithHost.title,
                  date: eventWithHost.date,
                  location: eventWithHost.location,
                },
                rsvpToken: guest.token,
                hostName: eventWithHost.host.name,
              })
                .then((result) => {
                  if (result.sent) {
                    invitationResults.smsSent++;
                  } else {
                    invitationResults.smsFailed++;
                    console.log(`SMS not sent to ${guest.phone}: ${result.reason}`);
                  }
                })
                .catch((error) => {
                  console.error(`Failed to send SMS invitation to ${guest.phone}:`, error);
                  invitationResults.smsFailed++;
                })
            );
          }

          await Promise.all(promises);
        })
      );

      console.log('Invitation results:', invitationResults);

      return NextResponse.json({
        success: true,
        results,
        invitationsSent: true,
        invitationResults,
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Import guests error:', error);
    return NextResponse.json(
      { error: 'Failed to import guests' },
      { status: 500 }
    );
  }
}

