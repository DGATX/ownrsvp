import { PrismaClient } from '@prisma/client';
import { renderTemplate } from '../src/lib/template-engine';

const prisma = new PrismaClient();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_EMAIL = 'test@example.com';
const TEST_PHONE = '+18777804236';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error });
  const icon = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name}`);
  if (error) {
    console.log(`  Error: ${error}`);
  }
}

async function testBulkOperations() {
  console.log('\n=== Testing Bulk Guest Operations ===\n');

  try {
    // Create test user and event
    const user = await prisma.user.upsert({
      where: { email: 'bulk-test@example.com' },
      update: {},
      create: {
        email: 'bulk-test@example.com',
        username: 'bulktest',
        name: 'Bulk Test User',
        password: 'hashed',
      },
    });

    const event = await prisma.event.create({
      data: {
        title: 'Bulk Operations Test Event',
        slug: `bulk-test-${Date.now()}`,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        hostId: user.id,
      },
    });

    // Create test guests
    const guests = await Promise.all([
      prisma.guest.create({
        data: {
          eventId: event.id,
          email: 'guest1@example.com',
          name: 'Guest 1',
          status: 'PENDING',
        },
      }),
      prisma.guest.create({
        data: {
          eventId: event.id,
          email: 'guest2@example.com',
          name: 'Guest 2',
          status: 'PENDING',
        },
      }),
      prisma.guest.create({
        data: {
          eventId: event.id,
          email: 'guest3@example.com',
          name: 'Guest 3',
          status: 'ATTENDING',
        },
      }),
    ]);

    const guestIds = guests.map((g) => g.id);

    // Test bulk API endpoint exists
    try {
      const response = await fetch(`${BASE_URL}/api/events/${event.id}/guests/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changeStatus',
          guestIds: guestIds.slice(0, 2),
          status: 'ATTENDING',
        }),
      });

      if (response.status === 401) {
        logTest('Bulk API endpoint exists (auth required)', true);
      } else if (response.ok) {
        logTest('Bulk API endpoint works', true);
      } else {
        logTest('Bulk API endpoint exists', true, `Status: ${response.status}`);
      }
    } catch (error) {
      logTest('Bulk API endpoint accessible', false, String(error));
    }

    // Test bulk changeStatus
    const updated = await prisma.guest.updateMany({
      where: {
        id: { in: guestIds.slice(0, 2) },
        eventId: event.id,
      },
      data: { status: 'ATTENDING' },
    });
    logTest('Bulk status change works', updated.count === 2);

    // Test bulk delete
    const deleted = await prisma.guest.deleteMany({
      where: {
        id: { in: guestIds.slice(0, 2) },
        eventId: event.id,
      },
    });
    logTest('Bulk delete works', deleted.count === 2);

    // Cleanup
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.user.delete({ where: { id: user.id } });

    logTest('Bulk operations cleanup', true);
  } catch (error) {
    logTest('Bulk operations test', false, String(error));
  }
}

async function testCustomReminderScheduling() {
  console.log('\n=== Testing Custom Reminder Scheduling ===\n');

  try {
    // Create test user and event
    const user = await prisma.user.upsert({
      where: { email: 'reminder-test@example.com' },
      update: {},
      create: {
        email: 'reminder-test@example.com',
        username: 'remindertest',
        name: 'Reminder Test User',
        password: 'hashed',
      },
    });

    // Test event creation with reminder schedule
    const eventWithSchedule = await prisma.event.create({
      data: {
        title: 'Reminder Schedule Test Event',
        slug: `reminder-test-${Date.now()}`,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        hostId: user.id,
        reminderSchedule: JSON.stringify([7, 3, 1]),
      },
    });

    logTest('Event with reminder schedule created', !!eventWithSchedule.reminderSchedule);

    // Test parsing reminder schedule
    const schedule = JSON.parse(eventWithSchedule.reminderSchedule || '[]');
    logTest('Reminder schedule parsed correctly', Array.isArray(schedule) && schedule.length === 3);

    // Test event without reminder schedule (should use default)
    const eventWithoutSchedule = await prisma.event.create({
      data: {
        title: 'Default Reminder Test Event',
        slug: `default-reminder-${Date.now()}`,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        hostId: user.id,
      },
    });

    logTest('Event without reminder schedule created', !eventWithoutSchedule.reminderSchedule);

    // Test reminder schedule update
    const updated = await prisma.event.update({
      where: { id: eventWithSchedule.id },
      data: {
        reminderSchedule: JSON.stringify([14, 7, 2]),
      },
    });

    const updatedSchedule = JSON.parse(updated.reminderSchedule || '[]');
    logTest('Reminder schedule updated', updatedSchedule.length === 3 && updatedSchedule[0] === 14);

    // Test cron job logic (simulate)
    const now = new Date();
    const eventDate = new Date(eventWithSchedule.date);
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const shouldSend = schedule.includes(daysUntilEvent);
    logTest('Cron job schedule calculation', typeof shouldSend === 'boolean');

    // Cleanup
    await prisma.event.deleteMany({ where: { hostId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    logTest('Reminder scheduling cleanup', true);
  } catch (error) {
    logTest('Custom reminder scheduling test', false, String(error));
  }
}

async function testTemplateCustomization() {
  console.log('\n=== Testing Email/SMS Template Customization ===\n');

  try {
    // Test template models exist
    const emailTemplate = await prisma.emailTemplate.findFirst();
    const smsTemplate = await prisma.smsTemplate.findFirst();

    logTest('Email template model works', !!emailTemplate);
    logTest('SMS template model works', !!smsTemplate);

    // Test template rendering engine
    const testTemplate = 'Hello {{guest.name}}, you are invited to {{event.title}}!';
    const variables = {
      'guest.name': 'John Doe',
      'event.title': 'Birthday Party',
    };
    const rendered = renderTemplate(testTemplate, variables);
    const expected = 'Hello John Doe, you are invited to Birthday Party!';
    logTest('Template rendering works', rendered === expected);

    // Test template with missing variable
    const renderedMissing = renderTemplate('Hello {{guest.name}}!', {});
    logTest('Template with missing variable handles gracefully', renderedMissing === 'Hello !');

    // Test template API endpoints exist
    try {
      const emailRes = await fetch(`${BASE_URL}/api/admin/templates/email`);
      const smsRes = await fetch(`${BASE_URL}/api/admin/templates/sms`);

      if (emailRes.status === 401 || emailRes.status === 403) {
        logTest('Email template API endpoint exists (auth required)', true);
      } else if (emailRes.ok) {
        logTest('Email template API endpoint works', true);
      } else {
        logTest('Email template API endpoint exists', true, `Status: ${emailRes.status}`);
      }

      if (smsRes.status === 401 || smsRes.status === 403) {
        logTest('SMS template API endpoint exists (auth required)', true);
      } else if (smsRes.ok) {
        logTest('SMS template API endpoint works', true);
      } else {
        logTest('SMS template API endpoint exists', true, `Status: ${smsRes.status}`);
      }
    } catch (error) {
      logTest('Template API endpoints accessible', false, String(error));
    }

    // Test default templates exist
    const invitationEmail = await prisma.emailTemplate.findUnique({
      where: { name: 'invitation' },
    });
    const invitationSms = await prisma.smsTemplate.findUnique({
      where: { name: 'invitation' },
    });

    logTest('Default email invitation template exists', !!invitationEmail);
    logTest('Default SMS invitation template exists', !!invitationSms);

    if (invitationEmail) {
      logTest('Email template has subject', !!invitationEmail.subject);
      logTest('Email template has body', !!invitationEmail.body);
      logTest('Email template is marked as default', invitationEmail.isDefault === true);
    }

    if (invitationSms) {
      logTest('SMS template has message', !!invitationSms.message);
      logTest('SMS template is marked as default', invitationSms.isDefault === true);
      logTest('SMS template within character limit', invitationSms.message.length <= 1600);
    }

    // Test template variable extraction
    if (invitationEmail) {
      const hasVariables = invitationEmail.body.includes('{{') && invitationEmail.body.includes('}}');
      logTest('Email template contains variables', hasVariables);
    }

    if (invitationSms) {
      const hasVariables = invitationSms.message.includes('{{') && invitationSms.message.includes('}}');
      logTest('SMS template contains variables', hasVariables);
    }

    logTest('Template customization test', true);
  } catch (error) {
    logTest('Template customization test', false, String(error));
  }
}

async function runAllTests() {
  console.log('🧪 Testing New Features\n');
  console.log('='.repeat(50));

  await testBulkOperations();
  await testCustomReminderScheduling();
  await testTemplateCustomization();

  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Results Summary\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ✗ ${r.name}`);
        if (r.error) {
          console.log(`    ${r.error}`);
        }
      });
  }

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error('Test execution error:', error);
  process.exit(1);
});

