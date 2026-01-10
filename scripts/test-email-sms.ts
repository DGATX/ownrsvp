#!/usr/bin/env tsx

/**
 * Comprehensive Email and SMS Testing Script
 * 
 * This script creates test data and tests all email and SMS functionality
 * while preserving existing SMTP and SMS configurations.
 */

import { PrismaClient } from '@prisma/client';
import { getEmailConfig, getSmsConfig } from '../src/lib/config';
import {
  sendUserInvitationEmail,
  sendPasswordResetEmail,
  sendInvitation,
  sendReminder,
  sendConfirmation,
  sendEventChangeEmail,
  sendBroadcastEmail,
} from '../src/lib/email';
import {
  sendSmsInvitation,
  sendSmsReminder,
  sendSmsConfirmation,
  sendEventChangeSms,
  sendBroadcastSms,
} from '../src/lib/sms';
import { generateSlug } from '../src/lib/utils';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Test recipients
const TEST_EMAIL = 'david.griffus@gmail.com';
const TEST_PHONE = '+18777804236';

// Event images from Unsplash
const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800',
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
  'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800',
  'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800',
];

// Test results tracking
interface TestResult {
  name: string;
  function: string;
  recipient: string;
  expected: string;
  actual: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

const testResults: TestResult[] = [];

// Helper to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to log test result
function logTest(
  name: string,
  functionName: string,
  recipient: string,
  expected: string,
  actual: string,
  success: boolean,
  error?: string
) {
  const result: TestResult = {
    name,
    function: functionName,
    recipient,
    expected,
    actual,
    success,
    error,
    timestamp: new Date(),
  };
  testResults.push(result);
  const status = success ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (!success && error) {
    console.log(`   Error: ${error}`);
  }
}

// Verify configurations
async function verifyConfigurations() {
  console.log('\n📋 Verifying Configurations...\n');
  
  const smtpConfig = await getEmailConfig();
  const smsConfig = await getSmsConfig();
  
  if (!smtpConfig) {
    console.warn('⚠️  SMTP not configured - email tests will be skipped');
  } else {
    console.log('✅ SMTP configuration found and preserved');
  }
  
  if (!smsConfig) {
    console.warn('⚠️  SMS not configured - SMS tests will be skipped');
  } else {
    console.log(`✅ SMS configuration found (provider: ${smsConfig.provider || 'twilio'}) and preserved`);
  }
  
  return { smtpConfig, smsConfig };
}

// Create test users
async function createTestUsers() {
  console.log('\n👥 Creating Test Users...\n');
  
  const users = [];
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  
  // Admin users
  const adminUsers = [
    { name: 'Admin One', email: 'admin1@test.invitehub.com', username: 'admin1', role: 'ADMIN' },
    { name: 'Admin Two', email: 'admin2@test.invitehub.com', username: 'admin2', role: 'ADMIN' },
  ];
  
  // Regular users
  const regularUsers = [
    { name: 'User One', email: 'user1@test.invitehub.com', username: 'user1', role: 'USER' },
    { name: 'User Two', email: 'user2@test.invitehub.com', username: 'user2', role: 'USER' },
    { name: 'User Three', email: 'user3@test.invitehub.com', username: 'user3', role: 'USER' },
    { name: 'User Four', email: 'user4@test.invitehub.com', username: 'user4', role: 'USER' },
  ];
  
  for (const userData of [...adminUsers, ...regularUsers]) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });
    
    if (existing) {
      console.log(`⏭️  User ${userData.email} already exists, skipping`);
      users.push(existing);
    } else {
      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
        },
      });
      console.log(`✅ Created user: ${userData.email} (${userData.role})`);
      users.push(user);
    }
  }
  
  return users;
}

// Create test events
async function createTestEvents(users: any[]) {
  console.log('\n📅 Creating Test Events...\n');
  
  const events = [];
  const now = new Date();
  
  const eventTemplates = [
    { title: 'Summer BBQ Party', description: 'Join us for a fun summer barbecue!', location: 'Central Park, New York' },
    { title: 'Tech Conference 2024', description: 'Annual technology conference', location: 'Convention Center, San Francisco' },
    { title: 'Wedding Celebration', description: 'Celebrate with us on our special day', location: 'Garden Venue, Los Angeles' },
    { title: 'Networking Mixer', description: 'Professional networking event', location: 'Downtown Hotel, Chicago' },
    { title: 'Birthday Bash', description: 'Come celebrate!', location: 'Private Residence, Miami' },
  ];
  
  for (const user of users) {
    for (let i = 0; i < 5; i++) {
      const template = eventTemplates[i];
      const daysOffset = (i - 2) * 30; // Mix of past, present, and future
      const eventDate = new Date(now);
      eventDate.setDate(eventDate.getDate() + daysOffset);
      
      const rsvpDeadline = new Date(eventDate);
      rsvpDeadline.setDate(rsvpDeadline.getDate() - 7);
      
      const baseSlug = generateSlug(template.title);
      let slug = baseSlug;
      let counter = 0;
      
      while (await prisma.event.findUnique({ where: { slug } })) {
        counter++;
        slug = `${baseSlug}-${nanoid(4)}`;
      }
      
      // Assign image to 50% of events
      const coverImage = i % 2 === 0 
        ? EVENT_IMAGES[Math.floor(Math.random() * EVENT_IMAGES.length)]
        : null;
      
      const event = await prisma.event.create({
        data: {
          title: `${template.title} - ${user.name}`,
          slug,
          description: template.description,
          location: template.location,
          date: eventDate,
          rsvpDeadline: rsvpDeadline > now ? rsvpDeadline : null,
          coverImage,
          photoAlbumUrl: i % 3 === 0 ? 'https://photos.google.com/album/test' : null,
          hostId: user.id,
          isPublic: true,
        },
      });
      
      console.log(`✅ Created event: ${event.title}${coverImage ? ' (with image)' : ''}`);
      events.push(event);
    }
  }
  
  return events;
}

// Create test guests
async function createTestGuests(events: any[]) {
  console.log('\n👤 Creating Test Guests...\n');
  
  const allGuests = [];
  const statuses = ['PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE'];
  
  for (const event of events) {
    const guestCount = 5 + Math.floor(Math.random() * 6); // 5-10 guests
    const guests = [];
    
    for (let i = 0; i < guestCount; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const notifyByEmail = Math.random() > 0.2; // 80% email
      const notifyBySms = Math.random() > 0.3; // 70% SMS
      
      // Use test email/phone for some guests
      const useTestEmail = i === 0; // First guest uses test email
      const useTestPhone = i === 1; // Second guest uses test phone
      
      const email = useTestEmail ? TEST_EMAIL : `guest${i}_${event.id.slice(0, 8)}@test.invitehub.com`;
      const phone = useTestPhone ? TEST_PHONE : (notifyBySms ? `+1555${Math.floor(1000000 + Math.random() * 9000000)}` : null);
      
      const guest = await prisma.guest.create({
        data: {
          eventId: event.id,
          email,
          phone,
          name: `Guest ${i + 1}`,
          status,
          notifyByEmail,
          notifyBySms: !!phone,
          respondedAt: status !== 'PENDING' ? new Date() : null,
        },
      });
      
      guests.push(guest);
    }
    
    allGuests.push(...guests);
    console.log(`✅ Created ${guestCount} guests for event: ${event.title}`);
  }
  
  return allGuests;
}

// Test email functions
async function testEmailFunctions(smtpConfig: any, users: any[], events: any[], guests: any[]) {
  console.log('\n📧 Testing Email Functions...\n');
  
  if (!smtpConfig) {
    console.log('⏭️  Skipping email tests - SMTP not configured');
    return;
  }
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // 1. User Invitation Email
  try {
    const admin = users.find(u => u.role === 'ADMIN');
    if (admin) {
      // Check if test user exists, if not create one
      let testUser = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      
      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            email: TEST_EMAIL,
            username: `testuser_${nanoid(8)}`,
            name: 'Test User',
            role: 'USER',
            password: await bcrypt.hash('temp', 10),
          },
        });
      }
      
      // Check if invitation already exists
      const existingInvitation = await prisma.userInvitation.findUnique({
        where: { userId: testUser.id },
      });
      
      let invitation;
      if (existingInvitation) {
        invitation = existingInvitation;
      } else {
        invitation = await prisma.userInvitation.create({
          data: {
            email: TEST_EMAIL,
            token: nanoid(32),
            userId: testUser.id,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invitedBy: admin.id,
          },
        });
      }
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const invitationUrl = `${appUrl}/invite/${invitation.token}`;
      
      await sendUserInvitationEmail({
        to: TEST_EMAIL,
        invitationUrl,
        invitedByName: admin.name,
        role: 'USER',
      });
      
      logTest(
        'User Invitation Email',
        'sendUserInvitationEmail',
        TEST_EMAIL,
        'Email sent successfully',
        'Email sent successfully',
        true
      );
    }
  } catch (error: any) {
    logTest(
      'User Invitation Email',
      'sendUserInvitationEmail',
      TEST_EMAIL,
      'Email sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(1000);
  
  // 2. Password Reset Email
  try {
    const resetToken = await prisma.passwordResetToken.create({
      data: {
        email: TEST_EMAIL,
        token: nanoid(32),
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken.token}`;
    
    await sendPasswordResetEmail(
      TEST_EMAIL,
      resetUrl,
      'Test User'
    );
    
    logTest(
      'Password Reset Email',
      'sendPasswordResetEmail',
      TEST_EMAIL,
      'Email sent successfully',
      'Email sent successfully',
      true
    );
  } catch (error: any) {
    logTest(
      'Password Reset Email',
      'sendPasswordResetEmail',
      TEST_EMAIL,
      'Email sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(1000);
  
  // 3. Event Invitation Email
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.email === TEST_EMAIL);
    
    if (guest) {
      await sendInvitation({
        to: TEST_EMAIL,
        guestName: guest.name,
        event: {
          title: event.title,
          date: event.date,
          location: event.location,
          description: event.description,
        },
        rsvpToken: guest.token,
        hostName: users.find(u => u.id === event.hostId)?.name || 'Host',
      });
      
      logTest(
        'Event Invitation Email',
        'sendInvitation',
        TEST_EMAIL,
        'Email sent successfully',
        'Email sent successfully',
        true
      );
    }
  } catch (error: any) {
    logTest(
      'Event Invitation Email',
      'sendInvitation',
      TEST_EMAIL,
      'Email sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(1000);
  
  // 4. Event Reminder Email
  try {
    const event = events.find(e => e.date > new Date());
    if (event) {
      const guest = guests.find(g => g.eventId === event.id && g.email === TEST_EMAIL);
      
      if (guest) {
        await sendReminder({
          to: TEST_EMAIL,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            description: event.description,
          },
          rsvpToken: guest.token,
        });
        
        logTest(
          'Event Reminder Email',
          'sendReminder',
          TEST_EMAIL,
          'Email sent successfully',
          'Email sent successfully',
          true
        );
      }
    }
  } catch (error: any) {
    logTest(
      'Event Reminder Email',
      'sendReminder',
      TEST_EMAIL,
      'Email sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(1000);
  
  // 5. RSVP Confirmation Email
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.email === TEST_EMAIL);
    
    if (guest) {
      await sendConfirmation({
        to: TEST_EMAIL,
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
      
      logTest(
        'RSVP Confirmation Email (ATTENDING)',
        'sendConfirmation',
        TEST_EMAIL,
        'Email sent successfully',
        'Email sent successfully',
        true
      );
    }
  } catch (error: any) {
    logTest(
      'RSVP Confirmation Email',
      'sendConfirmation',
      TEST_EMAIL,
      'Email sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(1000);
  
  // 6. Event Change Notification Email
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.email === TEST_EMAIL);
    
    if (guest) {
      await sendEventChangeEmail({
        to: TEST_EMAIL,
        guestName: guest.name,
        eventTitle: event.title,
        changes: [
          { field: 'Date', oldValue: '2024-01-01', newValue: '2024-01-15' },
          { field: 'Location', oldValue: 'Old Location', newValue: 'New Location' },
        ],
        rsvpToken: guest.token,
      });
      
      logTest(
        'Event Change Notification Email',
        'sendEventChangeEmail',
        TEST_EMAIL,
        'Email sent successfully',
        'Email sent successfully',
        true
      );
    }
  } catch (error: any) {
    logTest(
      'Event Change Notification Email',
      'sendEventChangeEmail',
      TEST_EMAIL,
      'Email sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(1000);
  
  // 7. Broadcast Email
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.email === TEST_EMAIL);
    
    if (guest) {
      await sendBroadcastEmail({
        to: TEST_EMAIL,
        guestName: guest.name,
        subject: 'Test Broadcast',
        message: 'This is a test broadcast message',
        eventTitle: event.title,
      });
      
      logTest(
        'Broadcast Email',
        'sendBroadcastEmail',
        TEST_EMAIL,
        'Email sent successfully',
        'Email sent successfully',
        true
      );
    }
  } catch (error: any) {
    logTest(
      'Broadcast Email',
      'sendBroadcastEmail',
      TEST_EMAIL,
      'Email sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
}

// Test SMS functions
async function testSmsFunctions(smsConfig: any, events: any[], guests: any[]) {
  console.log('\n📱 Testing SMS Functions...\n');
  
  if (!smsConfig) {
    console.log('⏭️  Skipping SMS tests - SMS not configured');
    return;
  }
  
  // Add delay between SMS sends to respect rate limits
  const smsDelay = 2000;
  
  // 1. Event Invitation SMS
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.phone === TEST_PHONE);
    
    if (guest) {
      const result = await sendSmsInvitation({
        to: TEST_PHONE,
        guestName: guest.name,
        event: {
          title: event.title,
          date: event.date,
          location: event.location,
        },
        rsvpToken: guest.token,
        hostName: 'Test Host',
      });
      
      logTest(
        'Event Invitation SMS',
        'sendSmsInvitation',
        TEST_PHONE,
        'SMS sent successfully',
        result.sent ? 'SMS sent successfully' : 'Failed to send',
        result.sent,
        result.reason
      );
    }
  } catch (error: any) {
    logTest(
      'Event Invitation SMS',
      'sendSmsInvitation',
      TEST_PHONE,
      'SMS sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(smsDelay);
  
  // 2. Event Reminder SMS
  try {
    const event = events.find(e => e.date > new Date());
    if (event) {
      const guest = guests.find(g => g.eventId === event.id && g.phone === TEST_PHONE);
      
      if (guest) {
        const result = await sendSmsReminder({
          to: TEST_PHONE,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          rsvpToken: guest.token,
        });
        
        logTest(
          'Event Reminder SMS',
          'sendSmsReminder',
          TEST_PHONE,
          'SMS sent successfully',
          result.sent ? 'SMS sent successfully' : 'Failed to send',
          result.sent,
          result.reason
        );
      }
    }
  } catch (error: any) {
    logTest(
      'Event Reminder SMS',
      'sendSmsReminder',
      TEST_PHONE,
      'SMS sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(smsDelay);
  
  // 3. RSVP Confirmation SMS
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.phone === TEST_PHONE);
    
    if (guest) {
      const result = await sendSmsConfirmation({
        to: TEST_PHONE,
        guestName: guest.name,
        event: {
          title: event.title,
          date: event.date,
          location: event.location,
        },
        status: 'ATTENDING',
      });
      
      logTest(
        'RSVP Confirmation SMS (ATTENDING)',
        'sendSmsConfirmation',
        TEST_PHONE,
        'SMS sent successfully',
        result.sent ? 'SMS sent successfully' : 'Failed to send',
        result.sent,
        result.reason
      );
    }
  } catch (error: any) {
    logTest(
      'RSVP Confirmation SMS',
      'sendSmsConfirmation',
      TEST_PHONE,
      'SMS sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(smsDelay);
  
  // 4. Event Change Notification SMS
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.phone === TEST_PHONE);
    
    if (guest) {
      const result = await sendEventChangeSms({
        to: TEST_PHONE,
        guestName: guest.name,
        eventTitle: event.title,
        changes: ['Date: 2024-01-01 → 2024-01-15', 'Location: Old → New'],
      });
      
      logTest(
        'Event Change Notification SMS',
        'sendEventChangeSms',
        TEST_PHONE,
        'SMS sent successfully',
        result.sent ? 'SMS sent successfully' : 'Failed to send',
        result.sent,
        result.reason
      );
    }
  } catch (error: any) {
    logTest(
      'Event Change Notification SMS',
      'sendEventChangeSms',
      TEST_PHONE,
      'SMS sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
  
  await delay(smsDelay);
  
  // 5. Broadcast SMS
  try {
    const event = events[0];
    const guest = guests.find(g => g.eventId === event.id && g.phone === TEST_PHONE);
    
    if (guest) {
      const result = await sendBroadcastSms({
        to: TEST_PHONE,
        guestName: guest.name,
        message: 'This is a test broadcast message',
        eventTitle: event.title,
      });
      
      logTest(
        'Broadcast SMS',
        'sendBroadcastSms',
        TEST_PHONE,
        'SMS sent successfully',
        result.sent ? 'SMS sent successfully' : 'Failed to send',
        result.sent,
        result.reason
      );
    }
  } catch (error: any) {
    logTest(
      'Broadcast SMS',
      'sendBroadcastSms',
      TEST_PHONE,
      'SMS sent successfully',
      'Error occurred',
      false,
      error.message
    );
  }
}

// Generate test report
function generateReport() {
  console.log('\n📊 Test Report\n');
  console.log('='.repeat(80));
  
  const total = testResults.length;
  const passed = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;
  const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  
  console.log(`\nSummary:`);
  console.log(`  Total Tests: ${total}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`  Success Rate: ${successRate}%`);
  
  if (failed > 0) {
    console.log(`\nFailed Tests:`);
    testResults.filter(r => !r.success).forEach(result => {
      console.log(`  ❌ ${result.name}`);
      console.log(`     Function: ${result.function}`);
      console.log(`     Recipient: ${result.recipient}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
  }
  
  console.log(`\nDetailed Results:`);
  testResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.name}`);
    console.log(`     Function: ${result.function}`);
    console.log(`     Recipient: ${result.recipient}`);
    console.log(`     Expected: ${result.expected}`);
    console.log(`     Actual: ${result.actual}`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
    console.log(`     Timestamp: ${result.timestamp.toISOString()}`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    summary: {
      total,
      passed,
      failed,
      successRate: `${successRate}%`,
    },
    results: testResults,
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

// Main execution
async function main() {
  console.log('🚀 Starting Comprehensive Email and SMS Testing\n');
  console.log('='.repeat(80));
  
  try {
    // Verify configurations
    const { smtpConfig, smsConfig } = await verifyConfigurations();
    
    // Create test data
    const users = await createTestUsers();
    const events = await createTestEvents(users);
    const guests = await createTestGuests(events);
    
    console.log(`\n✅ Test Data Created:`);
    console.log(`   - ${users.length} users`);
    console.log(`   - ${events.length} events (${events.filter(e => e.coverImage).length} with images)`);
    console.log(`   - ${guests.length} guests`);
    
    // Test email functions
    await testEmailFunctions(smtpConfig, users, events, guests);
    
    // Test SMS functions
    await testSmsFunctions(smsConfig, events, guests);
    
    // Generate report
    generateReport();
    
    console.log('\n✅ Testing Complete!\n');
    
  } catch (error: any) {
    console.error('\n❌ Error during testing:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();

