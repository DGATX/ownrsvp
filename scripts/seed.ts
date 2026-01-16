import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// Helper to generate random date in the future
function futureDate(daysFromNow: number, hoursOffset = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(date.getHours() + hoursOffset);
  return date;
}

// Helper to generate random date in the past
function pastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

async function main() {
  console.log('🌱 Starting seed...\n');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await prisma.comment.deleteMany();
  await prisma.additionalGuest.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.eventCoHost.deleteMany();
  await prisma.eventUpdate.deleteMany();
  await prisma.event.deleteMany();
  await prisma.userInvitation.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Existing data cleared\n');

  // Create users
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      theme: 'system',
    },
  });
  console.log(`  ✅ Created admin: ${adminUser.email}`);

  const regularUsers = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Sarah Johnson',
        username: 'sarah',
        email: 'sarah@example.com',
        password: hashedPassword,
        role: 'USER',
        theme: 'light',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Mike Chen',
        username: 'mike',
        email: 'mike@example.com',
        password: hashedPassword,
        role: 'USER',
        theme: 'dark',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Emily Davis',
        username: 'emily',
        email: 'emily@example.com',
        password: hashedPassword,
        role: 'USER',
        theme: 'system',
      },
    }),
    prisma.user.create({
      data: {
        name: 'James Wilson',
        username: 'james',
        email: 'james@example.com',
        password: hashedPassword,
        role: 'USER',
      },
    }),
  ]);
  console.log(`  ✅ Created ${regularUsers.length} regular users\n`);

  // Create events
  console.log('📅 Creating events...');

  // Event 1: Admin's Birthday Party (upcoming, lots of guests)
  const birthdayParty = await prisma.event.create({
    data: {
      slug: 'birthday-bash-2026',
      title: "Alex's 30th Birthday Bash",
      description: `Join us for an unforgettable night celebrating Alex's 30th birthday!

We'll have:
- Live DJ and dancing
- Open bar
- Catered dinner
- Photo booth
- Surprise performances

Dress code: Semi-formal / Cocktail attire

Please RSVP by January 20th so we can finalize catering numbers.`,
      location: 'The Grand Ballroom, 123 Party Street, Austin, TX 78701',
      date: futureDate(14, 19), // 7 PM, 2 weeks from now
      endDate: futureDate(14, 23), // 11 PM
      rsvpDeadline: futureDate(7),
      maxGuestsPerInvitee: 2,
      reminderSchedule: JSON.stringify([
        { type: 'day', value: 7 },
        { type: 'day', value: 1 },
      ]),
      hostId: adminUser.id,
      isPublic: true,
    },
  });
  console.log(`  ✅ Created event: ${birthdayParty.title}`);

  // Event 2: Sarah's Wedding (large event with many guests)
  const wedding = await prisma.event.create({
    data: {
      slug: 'johnson-smith-wedding',
      title: 'Sarah & David Wedding Celebration',
      description: `We are thrilled to invite you to celebrate the wedding of Sarah Johnson and David Smith!

Ceremony: 4:00 PM at St. Mary's Chapel
Reception: 6:00 PM at The Vineyard Estate

Dinner and dancing to follow. Please indicate any dietary restrictions when you RSVP.

We kindly request no children under 12 at the reception.

Gift registry available at our wedding website.`,
      location: 'The Vineyard Estate, 456 Wine Country Road, Napa, CA 94558',
      date: futureDate(60, 16), // 4 PM, 2 months from now
      endDate: futureDate(60, 23), // 11 PM
      rsvpDeadline: futureDate(45),
      maxGuestsPerInvitee: 3,
      reminderSchedule: JSON.stringify([
        { type: 'day', value: 30 },
        { type: 'day', value: 7 },
        { type: 'day', value: 1 },
      ]),
      hostId: regularUsers[0].id, // Sarah
      isPublic: true,
    },
  });
  console.log(`  ✅ Created event: ${wedding.title}`);

  // Event 3: Mike's Tech Meetup (corporate event)
  const techMeetup = await prisma.event.create({
    data: {
      slug: 'austin-tech-meetup-jan',
      title: 'Austin Tech Meetup - AI & Machine Learning',
      description: `Monthly Austin Tech Meetup focusing on AI and Machine Learning!

Agenda:
- 6:00 PM: Networking & Refreshments
- 6:30 PM: "Building Production ML Pipelines" - Jane Doe, Senior ML Engineer at TechCorp
- 7:15 PM: "The Future of AI in Healthcare" - Dr. John Smith
- 8:00 PM: Q&A Panel
- 8:30 PM: Networking

Pizza and drinks provided. Bring your business cards!`,
      location: 'Capital Factory, 701 Brazos St, Austin, TX 78701',
      date: futureDate(21, 18), // 6 PM, 3 weeks from now
      endDate: futureDate(21, 21), // 9 PM
      rsvpDeadline: futureDate(19),
      maxGuestsPerInvitee: 1,
      hostId: regularUsers[1].id, // Mike
      isPublic: true,
    },
  });
  console.log(`  ✅ Created event: ${techMeetup.title}`);

  // Event 4: Emily's Book Club (small private event)
  const bookClub = await prisma.event.create({
    data: {
      slug: 'february-book-club',
      title: 'February Book Club - "Project Hail Mary"',
      description: `This month we're reading "Project Hail Mary" by Andy Weir!

Please come prepared to discuss:
- Character development
- Scientific accuracy
- Themes of isolation and friendship
- Your favorite moments

Snacks and wine will be provided. Feel free to bring something to share!`,
      location: "Emily's House, 789 Reading Lane, Austin, TX 78704",
      date: futureDate(28, 19), // 7 PM, 4 weeks from now
      endDate: futureDate(28, 22), // 10 PM
      rsvpDeadline: futureDate(25),
      hostId: regularUsers[2].id, // Emily
      isPublic: false,
    },
  });
  console.log(`  ✅ Created event: ${bookClub.title}`);

  // Event 5: James's BBQ (casual event, no deadline)
  const bbq = await prisma.event.create({
    data: {
      slug: 'summer-kickoff-bbq',
      title: 'Summer Kickoff BBQ',
      description: `Kicking off summer with a good old-fashioned Texas BBQ!

Bringing the brisket, ribs, and sausage. Feel free to bring your favorite sides or desserts to share.

Activities:
- Lawn games (cornhole, horseshoes)
- Pool access
- Live country music
- Kids activities in the backyard

BYOB but we'll have some beer and sodas available.`,
      location: "James's Ranch, 1234 Country Road, Dripping Springs, TX 78620",
      date: futureDate(45, 14), // 2 PM, 6 weeks from now
      endDate: futureDate(45, 22), // 10 PM
      maxGuestsPerInvitee: 5,
      hostId: regularUsers[3].id, // James
      isPublic: true,
    },
  });
  console.log(`  ✅ Created event: ${bbq.title}`);

  // Event 6: Past event (already happened)
  const pastEvent = await prisma.event.create({
    data: {
      slug: 'new-years-eve-2025',
      title: "New Year's Eve Party 2025",
      description: 'Ring in 2026 with style! Champagne toast at midnight.',
      location: 'Downtown Austin Rooftop, 500 Congress Ave, Austin, TX',
      date: pastDate(16), // About 2 weeks ago
      endDate: pastDate(15), // Ended the next day (past midnight)
      rsvpDeadline: pastDate(20),
      hostId: adminUser.id,
      isPublic: true,
    },
  });
  console.log(`  ✅ Created event: ${pastEvent.title}`);

  // Event 7: Event happening today
  const todayEvent = await prisma.event.create({
    data: {
      slug: 'lunch-meetup-today',
      title: 'Team Lunch Meetup',
      description: 'Quick team lunch to discuss Q1 plans. See you there!',
      location: "Terry Black's BBQ, 1003 Barton Springs Rd, Austin, TX",
      date: futureDate(0, 2), // 2 hours from now
      endDate: futureDate(0, 4), // 4 hours from now
      hostId: regularUsers[1].id, // Mike
      isPublic: false,
    },
  });
  console.log(`  ✅ Created event: ${todayEvent.title}\n`);

  // Create co-hosts
  console.log('🤝 Creating co-hosts...');
  await prisma.eventCoHost.create({
    data: {
      eventId: wedding.id,
      userId: adminUser.id,
      role: 'COHOST',
    },
  });
  await prisma.eventCoHost.create({
    data: {
      eventId: wedding.id,
      userId: regularUsers[2].id, // Emily as viewer
      role: 'VIEWER',
    },
  });
  await prisma.eventCoHost.create({
    data: {
      eventId: birthdayParty.id,
      userId: regularUsers[0].id, // Sarah helps with birthday
      role: 'COHOST',
    },
  });
  console.log('  ✅ Created co-host relationships\n');

  // Create guests for each event
  console.log('👤 Creating guests...');

  // Guest names pool
  const guestData = [
    { name: 'John Anderson', email: 'john.anderson@email.com', phone: '+15551234001' },
    { name: 'Maria Garcia', email: 'maria.garcia@email.com', phone: '+15551234002' },
    { name: 'Robert Taylor', email: 'robert.taylor@email.com', phone: '+15551234003' },
    { name: 'Jennifer Martinez', email: 'jennifer.martinez@email.com', phone: '+15551234004' },
    { name: 'William Brown', email: 'william.brown@email.com', phone: '+15551234005' },
    { name: 'Linda Davis', email: 'linda.davis@email.com', phone: '+15551234006' },
    { name: 'Michael Miller', email: 'michael.miller@email.com', phone: '+15551234007' },
    { name: 'Elizabeth Wilson', email: 'elizabeth.wilson@email.com', phone: '+15551234008' },
    { name: 'David Moore', email: 'david.moore@email.com', phone: '+15551234009' },
    { name: 'Susan Jackson', email: 'susan.jackson@email.com', phone: '+15551234010' },
    { name: 'Christopher White', email: 'chris.white@email.com', phone: '+15551234011' },
    { name: 'Karen Harris', email: 'karen.harris@email.com', phone: '+15551234012' },
    { name: 'Daniel Thompson', email: 'daniel.thompson@email.com', phone: '+15551234013' },
    { name: 'Nancy Clark', email: 'nancy.clark@email.com', phone: '+15551234014' },
    { name: 'Matthew Lewis', email: 'matthew.lewis@email.com', phone: '+15551234015' },
    { name: 'Betty Robinson', email: 'betty.robinson@email.com', phone: '+15551234016' },
    { name: 'Anthony Walker', email: 'anthony.walker@email.com', phone: '+15551234017' },
    { name: 'Dorothy Hall', email: 'dorothy.hall@email.com', phone: '+15551234018' },
    { name: 'Mark Allen', email: 'mark.allen@email.com', phone: '+15551234019' },
    { name: 'Sandra Young', email: 'sandra.young@email.com', phone: '+15551234020' },
    { name: 'Steven King', email: 'steven.king@email.com', phone: '+15551234021' },
    { name: 'Ashley Wright', email: 'ashley.wright@email.com', phone: '+15551234022' },
    { name: 'Andrew Scott', email: 'andrew.scott@email.com', phone: '+15551234023' },
    { name: 'Kimberly Green', email: 'kimberly.green@email.com', phone: '+15551234024' },
    { name: 'Joshua Adams', email: 'joshua.adams@email.com', phone: '+15551234025' },
    { name: 'Michelle Baker', email: 'michelle.baker@email.com', phone: '+15551234026' },
    { name: 'Kevin Nelson', email: 'kevin.nelson@email.com', phone: '+15551234027' },
    { name: 'Amanda Carter', email: 'amanda.carter@email.com', phone: '+15551234028' },
    { name: 'Brian Mitchell', email: 'brian.mitchell@email.com', phone: '+15551234029' },
    { name: 'Stephanie Perez', email: 'stephanie.perez@email.com', phone: '+15551234030' },
  ];

  const statuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'MAYBE'];
  const dietaryOptions = [null, 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut allergy', 'Kosher', 'Halal'];

  // Birthday party guests (20 guests)
  const birthdayGuests = [];
  for (let i = 0; i < 20; i++) {
    const guest = guestData[i];
    const status = i < 12 ? 'ACCEPTED' : i < 15 ? 'PENDING' : i < 18 ? 'MAYBE' : 'DECLINED';
    const createdGuest = await prisma.guest.create({
      data: {
        eventId: birthdayParty.id,
        email: guest.email,
        phone: guest.phone,
        name: guest.name,
        status,
        dietaryNotes: dietaryOptions[i % dietaryOptions.length],
        notifyByEmail: true,
        notifyBySms: i % 3 === 0,
        token: nanoid(21),
        respondedAt: status !== 'PENDING' ? pastDate(Math.floor(Math.random() * 5) + 1) : null,
        reminderSentAt: i % 4 === 0 ? pastDate(3) : null,
      },
    });
    birthdayGuests.push(createdGuest);
  }
  console.log(`  ✅ Created ${birthdayGuests.length} guests for Birthday Party`);

  // Wedding guests (30 guests)
  const weddingGuests = [];
  for (let i = 0; i < 30; i++) {
    const guest = guestData[i % guestData.length];
    const email = i < guestData.length ? guest.email : `guest${i}@wedding.com`;
    const status = i < 18 ? 'ACCEPTED' : i < 22 ? 'PENDING' : i < 26 ? 'MAYBE' : 'DECLINED';
    const createdGuest = await prisma.guest.create({
      data: {
        eventId: wedding.id,
        email,
        phone: guest.phone,
        name: i < guestData.length ? guest.name : `Wedding Guest ${i}`,
        status,
        dietaryNotes: dietaryOptions[i % dietaryOptions.length],
        notifyByEmail: true,
        notifyBySms: i % 2 === 0,
        token: nanoid(21),
        respondedAt: status !== 'PENDING' ? pastDate(Math.floor(Math.random() * 10) + 1) : null,
      },
    });
    weddingGuests.push(createdGuest);
  }
  console.log(`  ✅ Created ${weddingGuests.length} guests for Wedding`);

  // Tech meetup guests (15 guests)
  const techGuests = [];
  for (let i = 0; i < 15; i++) {
    const guest = guestData[i];
    const status = i < 10 ? 'ACCEPTED' : i < 12 ? 'PENDING' : 'MAYBE';
    const createdGuest = await prisma.guest.create({
      data: {
        eventId: techMeetup.id,
        email: guest.email,
        name: guest.name,
        status,
        notifyByEmail: true,
        token: nanoid(21),
        respondedAt: status !== 'PENDING' ? pastDate(Math.floor(Math.random() * 3) + 1) : null,
      },
    });
    techGuests.push(createdGuest);
  }
  console.log(`  ✅ Created ${techGuests.length} guests for Tech Meetup`);

  // Book club guests (8 guests)
  const bookGuests = [];
  for (let i = 0; i < 8; i++) {
    const guest = guestData[i];
    const status = i < 6 ? 'ACCEPTED' : 'MAYBE';
    const createdGuest = await prisma.guest.create({
      data: {
        eventId: bookClub.id,
        email: guest.email,
        name: guest.name,
        status,
        notifyByEmail: true,
        token: nanoid(21),
        respondedAt: pastDate(Math.floor(Math.random() * 5) + 1),
      },
    });
    bookGuests.push(createdGuest);
  }
  console.log(`  ✅ Created ${bookGuests.length} guests for Book Club`);

  // BBQ guests (25 guests)
  const bbqGuests = [];
  for (let i = 0; i < 25; i++) {
    const guest = guestData[i % guestData.length];
    const email = i < guestData.length ? guest.email : `bbq.guest${i}@example.com`;
    const status = i < 15 ? 'ACCEPTED' : i < 20 ? 'PENDING' : 'MAYBE';
    const createdGuest = await prisma.guest.create({
      data: {
        eventId: bbq.id,
        email,
        phone: guest.phone,
        name: i < guestData.length ? guest.name : `BBQ Guest ${i}`,
        status,
        dietaryNotes: i % 5 === 0 ? 'Vegetarian' : null,
        notifyByEmail: true,
        notifyBySms: true,
        token: nanoid(21),
        respondedAt: status !== 'PENDING' ? pastDate(Math.floor(Math.random() * 7) + 1) : null,
      },
    });
    bbqGuests.push(createdGuest);
  }
  console.log(`  ✅ Created ${bbqGuests.length} guests for BBQ`);

  // Past event guests (all responded)
  const pastGuests = [];
  for (let i = 0; i < 12; i++) {
    const guest = guestData[i];
    const status = i < 9 ? 'ACCEPTED' : 'DECLINED';
    const createdGuest = await prisma.guest.create({
      data: {
        eventId: pastEvent.id,
        email: guest.email,
        name: guest.name,
        status,
        notifyByEmail: true,
        token: nanoid(21),
        respondedAt: pastDate(20),
      },
    });
    pastGuests.push(createdGuest);
  }
  console.log(`  ✅ Created ${pastGuests.length} guests for Past Event`);

  // Today's event guests
  const todayGuests = [];
  for (let i = 0; i < 5; i++) {
    const guest = guestData[i];
    const createdGuest = await prisma.guest.create({
      data: {
        eventId: todayEvent.id,
        email: guest.email,
        name: guest.name,
        status: 'ACCEPTED',
        notifyByEmail: true,
        token: nanoid(21),
        respondedAt: pastDate(1),
      },
    });
    todayGuests.push(createdGuest);
  }
  console.log(`  ✅ Created ${todayGuests.length} guests for Today's Event\n`);

  // Create additional guests (plus-ones)
  console.log('➕ Creating additional guests (plus-ones)...');

  // Birthday party plus-ones
  const plusOneNames = [
    'Spouse', 'Partner', 'Friend', 'Girlfriend', 'Boyfriend',
    'Wife', 'Husband', 'Date', 'Roommate', 'Colleague'
  ];

  let plusOneCount = 0;
  for (let i = 0; i < 8; i++) {
    const guest = birthdayGuests[i];
    if (guest.status === 'ACCEPTED') {
      await prisma.additionalGuest.create({
        data: {
          guestId: guest.id,
          name: `${guest.name}'s ${plusOneNames[i % plusOneNames.length]}`,
        },
      });
      plusOneCount++;
    }
  }
  console.log(`  ✅ Created ${plusOneCount} plus-ones for Birthday Party`);

  // Wedding plus-ones (many guests bring +1 or +2)
  plusOneCount = 0;
  for (let i = 0; i < 18; i++) {
    const guest = weddingGuests[i];
    if (guest.status === 'ACCEPTED') {
      await prisma.additionalGuest.create({
        data: {
          guestId: guest.id,
          name: `${guest.name}'s Partner`,
        },
      });
      plusOneCount++;

      // Some guests bring kids
      if (i % 4 === 0) {
        await prisma.additionalGuest.create({
          data: {
            guestId: guest.id,
            name: `${guest.name}'s Child`,
          },
        });
        plusOneCount++;
      }
    }
  }
  console.log(`  ✅ Created ${plusOneCount} plus-ones for Wedding`);

  // BBQ plus-ones (families)
  plusOneCount = 0;
  for (let i = 0; i < 10; i++) {
    const guest = bbqGuests[i];
    if (guest.status === 'ACCEPTED') {
      await prisma.additionalGuest.create({
        data: {
          guestId: guest.id,
          name: `${guest.name}'s Partner`,
        },
      });
      plusOneCount++;

      // Many bring kids to BBQ
      if (i % 2 === 0) {
        await prisma.additionalGuest.create({
          data: {
            guestId: guest.id,
            name: `${guest.name}'s Kid 1`,
          },
        });
        await prisma.additionalGuest.create({
          data: {
            guestId: guest.id,
            name: `${guest.name}'s Kid 2`,
          },
        });
        plusOneCount += 2;
      }
    }
  }
  console.log(`  ✅ Created ${plusOneCount} plus-ones for BBQ\n`);

  // Create comments
  console.log('💬 Creating comments...');

  const birthdayComments = [
    { name: 'John Anderson', content: "Can't wait! This is going to be epic! 🎉" },
    { name: 'Maria Garcia', content: 'So excited to celebrate with you! Happy early birthday!' },
    { name: 'Robert Taylor', content: 'Will there be parking available at the venue?' },
    { name: 'Jennifer Martinez', content: "Looking forward to it! Should I bring anything?" },
    { name: 'William Brown', content: 'The venue looks amazing! See you all there!' },
  ];

  for (const comment of birthdayComments) {
    const guest = birthdayGuests.find(g => g.name === comment.name);
    await prisma.comment.create({
      data: {
        eventId: birthdayParty.id,
        guestId: guest?.id,
        authorName: comment.name,
        content: comment.content,
        createdAt: pastDate(Math.floor(Math.random() * 5)),
      },
    });
  }
  console.log(`  ✅ Created ${birthdayComments.length} comments for Birthday Party`);

  const weddingComments = [
    { name: 'John Anderson', content: 'Congratulations Sarah and David! So happy for you both!' },
    { name: 'Maria Garcia', content: 'What a beautiful venue choice! This is going to be magical.' },
    { name: 'Linda Davis', content: 'Is there a hotel block for out of town guests?' },
    { name: 'Michael Miller', content: 'We are so honored to be invited. Counting down the days!' },
    { name: 'Elizabeth Wilson', content: "Can't believe the big day is almost here! So excited!" },
    { name: 'David Moore', content: "Sarah, you're going to be a beautiful bride!" },
    { name: 'Susan Jackson', content: 'Will there be vegetarian options for dinner?' },
    { name: 'Christopher White', content: "Congratulations! Can't wait to celebrate with you!" },
  ];

  for (const comment of weddingComments) {
    const guest = weddingGuests.find(g => g.name === comment.name);
    await prisma.comment.create({
      data: {
        eventId: wedding.id,
        guestId: guest?.id,
        authorName: comment.name,
        content: comment.content,
        createdAt: pastDate(Math.floor(Math.random() * 14)),
      },
    });
  }
  console.log(`  ✅ Created ${weddingComments.length} comments for Wedding`);

  const bbqComments = [
    { name: 'John Anderson', content: 'Yes! Texas BBQ is the best. Count me in!' },
    { name: 'Robert Taylor', content: "I'll bring my famous potato salad!" },
    { name: 'Jennifer Martinez', content: 'Can we bring lawn chairs or will there be seating?' },
    { name: 'William Brown', content: "The kids are so excited about the pool!" },
  ];

  for (const comment of bbqComments) {
    const guest = bbqGuests.find(g => g.name === comment.name);
    await prisma.comment.create({
      data: {
        eventId: bbq.id,
        guestId: guest?.id,
        authorName: comment.name,
        content: comment.content,
        createdAt: pastDate(Math.floor(Math.random() * 7)),
      },
    });
  }
  console.log(`  ✅ Created ${bbqComments.length} comments for BBQ\n`);

  // Create event updates (broadcast messages sent)
  console.log('📢 Creating event updates...');

  await prisma.eventUpdate.create({
    data: {
      eventId: birthdayParty.id,
      subject: 'Venue Update - Parking Info',
      message: 'Hey everyone! Just wanted to let you know that free valet parking will be available at the venue. See you soon!',
      sentVia: 'EMAIL',
      sentTo: 15,
      sentBy: adminUser.id,
      sentAt: pastDate(3),
    },
  });

  await prisma.eventUpdate.create({
    data: {
      eventId: wedding.id,
      subject: 'Hotel Block Information',
      message: 'Dear guests, we have reserved a block of rooms at the Vineyard Inn. Use code SARAHDAVID for 15% off. Book by Feb 1st!',
      sentVia: 'EMAIL',
      sentTo: 28,
      sentBy: regularUsers[0].id,
      sentAt: pastDate(10),
    },
  });

  await prisma.eventUpdate.create({
    data: {
      eventId: wedding.id,
      subject: 'Ceremony Timeline Update',
      message: 'Quick update: The ceremony will now start at 4:30 PM instead of 4:00 PM. Reception time remains the same.',
      sentVia: 'BOTH',
      sentTo: 28,
      sentBy: regularUsers[0].id,
      sentAt: pastDate(5),
    },
  });
  console.log('  ✅ Created event updates\n');

  // Summary
  console.log('📊 Seed Summary:');
  console.log('================');
  console.log(`Users created: ${1 + regularUsers.length}`);
  console.log(`Events created: 7`);
  console.log(`  - Upcoming events: 5`);
  console.log(`  - Past events: 1`);
  console.log(`  - Today's events: 1`);
  console.log(`Guests created: ${birthdayGuests.length + weddingGuests.length + techGuests.length + bookGuests.length + bbqGuests.length + pastGuests.length + todayGuests.length}`);
  console.log(`Comments created: ${birthdayComments.length + weddingComments.length + bbqComments.length}`);
  console.log('\n🎉 Seed completed successfully!\n');

  console.log('📝 Login Credentials:');
  console.log('====================');
  console.log('Admin User:');
  console.log('  Email: admin@example.com');
  console.log('  Password: password123');
  console.log('\nRegular Users:');
  console.log('  Email: sarah@example.com | Password: password123');
  console.log('  Email: mike@example.com | Password: password123');
  console.log('  Email: emily@example.com | Password: password123');
  console.log('  Email: james@example.com | Password: password123');
  console.log('\n🌐 Access the app at: http://localhost:7787');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
