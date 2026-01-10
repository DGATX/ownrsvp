import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { prisma } from '../comprehensive-test';
import {
  sendUserInvitationEmail,
  sendPasswordResetEmail,
  sendInvitation,
  sendReminder,
  sendConfirmation,
  sendEventChangeEmail,
  sendBroadcastEmail,
} from '../../src/lib/email';
import {
  sendSmsInvitation,
  sendSmsReminder,
  sendSmsConfirmation,
  sendEventChangeSms,
  sendBroadcastSms,
} from '../../src/lib/sms';
import type { HTTPClient, delay } from '../comprehensive-test';

export class EmailSMSTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any,
    smtpConfig: any,
    smsConfig: any
  ) {
    // Email Functionality
    await runTest(
      'User invitation email sent',
      'Email & SMS',
      'Email',
      async () => {
        if (!smtpConfig) {
          throw new Error('SMTP not configured - skipping test');
        }
        
        const user = await prisma.user.create({
          data: {
            email: `invite_${nanoid(8)}@test.com`,
            username: `invite_${nanoid(8)}`,
            name: 'Invited User',
            role: 'USER',
            password: await bcrypt.hash('temp', 10),
          },
        });
        
        const invitation = await prisma.userInvitation.create({
          data: {
            email: user.email,
            token: nanoid(32),
            userId: user.id,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invitedBy: admin.id,
          },
        });
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const invitationUrl = `${appUrl}/invite/${invitation.token}`;
        
        await sendUserInvitationEmail({
          to: user.email,
          invitationUrl,
          invitedByName: admin.name,
          role: 'USER',
        });
      },
      'User invitation email can be sent',
      'High'
    );

    await runTest(
      'Event invitation email sent',
      'Email & SMS',
      'Email',
      async () => {
        if (!smtpConfig) {
          throw new Error('SMTP not configured - skipping test');
        }
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, {
          notifyByEmail: true,
        });
        
        await sendInvitation({
          to: guest.email,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            description: event.description,
          },
          rsvpToken: guest.token,
          hostName: user1.name,
        });
      },
      'Event invitation email can be sent',
      'High'
    );

    await runTest(
      'Event reminder email sent',
      'Email & SMS',
      'Email',
      async () => {
        if (!smtpConfig) {
          throw new Error('SMTP not configured - skipping test');
        }
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, {
          notifyByEmail: true,
          status: 'PENDING',
        });
        
        await sendReminder({
          to: guest.email,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            description: event.description,
          },
          rsvpToken: guest.token,
        });
      },
      'Event reminder email can be sent',
      'High'
    );

    await runTest(
      'RSVP confirmation email sent',
      'Email & SMS',
      'Email',
      async () => {
        if (!smtpConfig) {
          throw new Error('SMTP not configured - skipping test');
        }
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, {
          notifyByEmail: true,
          status: 'ATTENDING',
        });
        
        await sendConfirmation({
          to: guest.email,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            description: event.description,
          },
          status: 'ATTENDING',
          rsvpToken: guest.token,
        });
      },
      'RSVP confirmation email can be sent',
      'High'
    );

    // SMS Functionality
    await runTest(
      'Event invitation SMS sent',
      'Email & SMS',
      'SMS',
      async () => {
        if (!smsConfig) {
          throw new Error('SMS not configured - skipping test');
        }
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, {
          phone: TEST_PHONE,
          notifyBySms: true,
        });
        
        const result = await sendSmsInvitation({
          to: guest.phone!,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          rsvpToken: guest.token,
          hostName: user1.name,
        });
        
        if (!result.sent) {
          throw new Error(`SMS not sent: ${result.reason}`);
        }
      },
      'Event invitation SMS can be sent',
      'High'
    );

    await runTest(
      'Event reminder SMS sent',
      'Email & SMS',
      'SMS',
      async () => {
        if (!smsConfig) {
          throw new Error('SMS not configured - skipping test');
        }
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, {
          phone: TEST_PHONE,
          notifyBySms: true,
          status: 'PENDING',
        });
        
        const result = await sendSmsReminder({
          to: guest.phone!,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          rsvpToken: guest.token,
        });
        
        if (!result.sent) {
          throw new Error(`SMS not sent: ${result.reason}`);
        }
      },
      'Event reminder SMS can be sent',
      'High'
    );

    await runTest(
      'RSVP confirmation SMS sent',
      'Email & SMS',
      'SMS',
      async () => {
        if (!smsConfig) {
          throw new Error('SMS not configured - skipping test');
        }
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, {
          phone: TEST_PHONE,
          notifyBySms: true,
          status: 'ATTENDING',
        });
        
        const result = await sendSmsConfirmation({
          to: guest.phone!,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          status: 'ATTENDING',
        });
        
        if (!result.sent) {
          throw new Error(`SMS not sent: ${result.reason}`);
        }
      },
      'RSVP confirmation SMS can be sent',
      'High'
    );
  }
}

import bcrypt from 'bcryptjs';

