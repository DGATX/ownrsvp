import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// Sample data
const userData = [
  { name: 'Sarah Johnson', username: 'sarahj', email: 'sarah.johnson@example.com', role: 'USER' },
  { name: 'Michael Chen', username: 'mchen', email: 'michael.chen@example.com', role: 'USER' },
  { name: 'Emily Rodriguez', username: 'emilyr', email: 'emily.rodriguez@example.com', role: 'ADMIN' },
  { name: 'David Thompson', username: 'dthompson', email: 'david.thompson@example.com', role: 'USER' },
  { name: 'Jessica Martinez', username: 'jmartinez', email: 'jessica.martinez@example.com', role: 'USER' },
  { name: 'Robert Williams', username: 'rwilliams', email: 'robert.williams@example.com', role: 'USER' },
  { name: 'Amanda Davis', username: 'adavis', email: 'amanda.davis@example.com', role: 'USER' },
  { name: 'James Wilson', username: 'jwilson', email: 'james.wilson@example.com', role: 'USER' },
  { name: 'Lisa Anderson', username: 'landerson', email: 'lisa.anderson@example.com', role: 'USER' },
  { name: 'Christopher Brown', username: 'cbrown', email: 'christopher.brown@example.com', role: 'USER' },
];

const eventTemplates = [
  {
    title: 'Summer BBQ Party',
    description: 'Join us for a fun-filled summer barbecue with great food, music, and company!',
    location: '123 Park Avenue, Central Park, New York, NY',
  },
  {
    title: 'Birthday Celebration',
    description: 'Come celebrate another year of life with cake, drinks, and dancing!',
    location: 'The Grand Ballroom, 456 Main Street, Los Angeles, CA',
  },
  {
    title: 'Corporate Team Building',
    description: 'Annual team building event with activities, workshops, and networking opportunities.',
    location: 'Conference Center, 789 Business Blvd, San Francisco, CA',
  },
  {
    title: 'Wedding Reception',
    description: 'Join us as we celebrate our special day with family and friends.',
    location: 'Garden Venue, 321 Wedding Lane, Miami, FL',
  },
  {
    title: 'Holiday Party',
    description: 'Festive gathering to celebrate the holiday season with food, drinks, and cheer!',
    location: 'Downtown Event Hall, 654 Holiday Drive, Chicago, IL',
  },
  {
    title: 'Graduation Ceremony',
    description: 'Celebrating academic achievements with family, friends, and faculty.',
    location: 'University Auditorium, 987 College Ave, Boston, MA',
  },
  {
    title: 'Networking Mixer',
    description: 'Professional networking event for industry professionals to connect and collaborate.',
    location: 'Rooftop Lounge, 147 Networking Way, Seattle, WA',
  },
  {
    title: 'Charity Fundraiser',
    description: 'Raising funds for a great cause with auctions, entertainment, and dinner.',
    location: 'Elegant Banquet Hall, 258 Charity Street, Austin, TX',
  },
  {
    title: 'Product Launch Event',
    description: 'Exclusive preview of our latest product with demos, Q&A, and refreshments.',
    location: 'Innovation Hub, 369 Tech Boulevard, Denver, CO',
  },
  {
    title: 'Anniversary Dinner',
    description: 'Celebrating a milestone anniversary with an elegant dinner party.',
    location: 'Fine Dining Restaurant, 741 Anniversary Plaza, Portland, OR',
  },
];

const guestNames = [
  'Alice Cooper', 'Bob Smith', 'Carol White', 'Daniel Lee', 'Eva Green',
  'Frank Miller', 'Grace Kelly', 'Henry Ford', 'Iris Johnson', 'Jack Black',
  'Kate Winslet', 'Liam Neeson', 'Maria Garcia', 'Noah Taylor', 'Olivia Brown',
  'Paul Walker', 'Quinn Harris', 'Rachel Green', 'Samuel Jackson', 'Tina Turner',
  'Uma Thurman', 'Victor Chen', 'Wendy Williams', 'Xavier Woods', 'Yara Shahidi',
  'Zoe Saldana', 'Adam Sandler', 'Bella Swan', 'Chris Evans', 'Diana Prince',
  'Ethan Hunt', 'Fiona Apple', 'George Clooney', 'Hannah Montana', 'Ian McKellen',
  'Jennifer Lawrence', 'Kevin Hart', 'Lucy Liu', 'Mark Ruffalo', 'Natalie Portman',
  'Oscar Isaac', 'Penelope Cruz', 'Quentin Tarantino', 'Ryan Reynolds', 'Scarlett Johansson',
  'Tom Hanks', 'Uma Thurman', 'Vin Diesel', 'Will Smith', 'Zendaya',
];

const additionalGuestNames = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
  'Sage', 'River', 'Phoenix', 'Skylar', 'Cameron', 'Dakota', 'Emery', 'Finley',
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomPastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function randomFutureDate(daysAhead: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
}

async function main() {
  console.log('🌱 Starting demo data population...\n');

  // Get existing admin user (try email first, then username)
  let adminUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin' },
        { username: 'admin' },
        { role: 'ADMIN' },
      ],
    },
  });

  if (!adminUser) {
    console.log('⚠️  Admin user not found. Creating default admin user...');
    const hashedPassword = await bcrypt.hash('admin', 12);
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@ownrsvp.com',
        username: 'admin',
        name: 'Administrator',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log('✅ Created default admin user');
  }

  // Create 10 new users
  console.log('👥 Creating users...');
  const createdUsers = [];
  const defaultPassword = await bcrypt.hash('password123', 12);

  for (const userInfo of userData) {
    try {
      const user = await prisma.user.create({
        data: {
          name: userInfo.name,
          username: userInfo.username,
          email: userInfo.email,
          password: defaultPassword,
          role: userInfo.role,
        },
      });
      createdUsers.push(user);
      console.log(`  ✓ Created user: ${userInfo.name} (${userInfo.email})`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        // User already exists, fetch it
        const existingUser = await prisma.user.findUnique({
          where: { email: userInfo.email },
        });
        if (existingUser) {
          createdUsers.push(existingUser);
          console.log(`  ℹ️  User already exists: ${userInfo.name}`);
        }
      } else {
        console.error(`  ✗ Error creating user ${userInfo.name}:`, error);
      }
    }
  }

  const allUsers = [adminUser, ...createdUsers];
  console.log(`\n✅ Created/found ${allUsers.length} users\n`);

  // Create 50 events
  console.log('📅 Creating events...');
  const createdEvents = [];
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const sixMonthsAhead = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 50; i++) {
    const host = getRandomElement(allUsers);
    const template = getRandomElement(eventTemplates);
    const isPast = i < 15; // First 15 events are in the past
    const eventDate = isPast
      ? randomDate(oneYearAgo, new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000))
      : randomDate(now, sixMonthsAhead);

    const endDate = new Date(eventDate);
    endDate.setHours(eventDate.getHours() + Math.floor(Math.random() * 6) + 2);

    const rsvpDeadline = isPast ? null : new Date(eventDate);
    if (rsvpDeadline) {
      rsvpDeadline.setDate(rsvpDeadline.getDate() - Math.floor(Math.random() * 7) + 1);
    }

    const reminderSchedule = Math.random() > 0.5
      ? JSON.stringify([7, 3, 1])
      : JSON.stringify([14, 7, 2]);

    try {
      const event = await prisma.event.create({
        data: {
          slug: `${generateSlug(template.title)}-${nanoid(6)}`,
          title: `${template.title} ${i + 1}`,
          description: template.description,
          location: template.location,
          date: eventDate,
          endDate: Math.random() > 0.3 ? endDate : null,
          rsvpDeadline: rsvpDeadline && Math.random() > 0.4 ? rsvpDeadline : null,
          reminderSchedule: Math.random() > 0.5 ? reminderSchedule : null,
          hostId: host.id,
          isPublic: Math.random() > 0.2,
        },
      });
      createdEvents.push(event);
      console.log(`  ✓ Created event: ${event.title} (${isPast ? 'PAST' : 'FUTURE'})`);
    } catch (error) {
      console.error(`  ✗ Error creating event ${i + 1}:`, error);
    }
  }

  console.log(`\n✅ Created ${createdEvents.length} events\n`);

  // Create guests for each event
  console.log('👥 Creating guests...');
  let totalGuests = 0;
  let totalAdditionalGuests = 0;

  for (const event of createdEvents) {
    const guestCount = Math.floor(Math.random() * 30) + 10; // 10-40 guests per event
    const availableGuests = getRandomElements(guestNames, guestCount);

    for (let i = 0; i < guestCount; i++) {
      const guestName = availableGuests[i];
      const email = `${guestName.toLowerCase().replace(/\s+/g, '.')}@example.com`;
      const phone = Math.random() > 0.5 ? `+1${Math.floor(Math.random() * 9000000000) + 1000000000}` : null;

      const statuses = ['PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE'];
      const weights = [0.2, 0.4, 0.2, 0.2]; // 40% attending, 20% each for others
      const random = Math.random();
      let status = 'PENDING';
      let cumulative = 0;
      for (let j = 0; j < statuses.length; j++) {
        cumulative += weights[j];
        if (random < cumulative) {
          status = statuses[j];
          break;
        }
      }

      const respondedAt = status !== 'PENDING' && event.date < now
        ? randomDate(event.date, now)
        : null;

      const reminderSentAt = status === 'PENDING' && Math.random() > 0.6
        ? randomDate(event.date, now)
        : null;

      try {
        const guest = await prisma.guest.create({
          data: {
            eventId: event.id,
            email,
            phone,
            name: guestName,
            status,
            notifyByEmail: true,
            notifyBySms: phone ? Math.random() > 0.5 : false,
            respondedAt,
            reminderSentAt: reminderSentAt && Math.random() > 0.5 ? reminderSentAt : null,
            smsReminderSentAt: reminderSentAt && Math.random() > 0.3 ? reminderSentAt : null,
            dietaryNotes: Math.random() > 0.7
              ? getRandomElement([
                  'Vegetarian',
                  'Vegan',
                  'Gluten-free',
                  'Nut allergy',
                  'No dairy',
                  'Kosher',
                  'Halal',
                ])
              : null,
          },
        });
        totalGuests++;

        // Add additional guests for attending guests
        if (status === 'ATTENDING' && Math.random() > 0.6) {
          const additionalCount = Math.floor(Math.random() * 3) + 1; // 1-3 additional guests
          const additionalNames = getRandomElements(additionalGuestNames, additionalCount);

          for (const additionalName of additionalNames) {
            await prisma.additionalGuest.create({
              data: {
                guestId: guest.id,
                name: additionalName,
              },
            });
            totalAdditionalGuests++;
          }
        }
      } catch (error: any) {
        if (error.code !== 'P2002') {
          // Ignore duplicate email errors
          console.error(`  ✗ Error creating guest ${guestName} for event ${event.title}:`, error);
        }
      }
    }
  }

  console.log(`\n✅ Created ${totalGuests} guests with ${totalAdditionalGuests} additional guests\n`);

  // Create co-hosts for some events
  console.log('🤝 Creating co-hosts...');
  let totalCoHosts = 0;

  for (const event of createdEvents) {
    if (Math.random() > 0.6) {
      // 40% of events have co-hosts
      const coHostCount = Math.floor(Math.random() * 3) + 1; // 1-3 co-hosts
      const availableCoHosts = getRandomElements(
        allUsers.filter(u => u.id !== event.hostId),
        coHostCount
      );

      for (const coHostUser of availableCoHosts) {
        try {
          await prisma.eventCoHost.create({
            data: {
              eventId: event.id,
              userId: coHostUser.id,
              role: Math.random() > 0.3 ? 'COHOST' : 'VIEWER',
            },
          });
          totalCoHosts++;
        } catch (error: any) {
          if (error.code !== 'P2002') {
            console.error(`  ✗ Error creating co-host for event ${event.title}:`, error);
          }
        }
      }
    }
  }

  console.log(`\n✅ Created ${totalCoHosts} co-host relationships\n`);

  // Create comments for some events
  console.log('💬 Creating comments...');
  let totalComments = 0;

  for (const event of createdEvents) {
    if (Math.random() > 0.5) {
      // 50% of events have comments
      const commentCount = Math.floor(Math.random() * 5) + 1; // 1-5 comments
      const eventGuests = await prisma.guest.findMany({
        where: { eventId: event.id },
        take: commentCount,
      });

      const commentTexts = [
        'Looking forward to this!',
        'Can\'t wait to see everyone!',
        'Thanks for organizing!',
        'This is going to be great!',
        'Excited to attend!',
        'See you there!',
        'Thanks for the invitation!',
        'Will be there with bells on!',
      ];

      for (let i = 0; i < Math.min(commentCount, eventGuests.length); i++) {
        const guest = eventGuests[i];
        const isAnonymous = Math.random() > 0.7;

        try {
          await prisma.comment.create({
            data: {
              eventId: event.id,
              guestId: isAnonymous ? null : guest.id,
              authorName: isAnonymous
                ? getRandomElement(['Anonymous', 'Guest', 'Friend'])
                : (guest.name || guest.email.split('@')[0]),
              content: getRandomElement(commentTexts),
              createdAt: randomDate(event.date, now),
            },
          });
          totalComments++;
        } catch (error) {
          console.error(`  ✗ Error creating comment for event ${event.title}:`, error);
        }
      }
    }
  }

  console.log(`\n✅ Created ${totalComments} comments\n`);

  // Summary
  console.log('📊 Summary:');
  console.log(`  • Users: ${allUsers.length}`);
  console.log(`  • Events: ${createdEvents.length}`);
  console.log(`  • Guests: ${totalGuests}`);
  console.log(`  • Additional Guests: ${totalAdditionalGuests}`);
  console.log(`  • Co-hosts: ${totalCoHosts}`);
  console.log(`  • Comments: ${totalComments}`);
  console.log('\n✅ Demo data population complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

