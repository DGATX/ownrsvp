import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all users (we'll check if they need username)
  const users = await prisma.user.findMany();

  console.log(`Found ${users.length} users to migrate`);

  for (const user of users) {
    // Skip if username already exists
    if (user.username) {
      console.log(`User ${user.id} already has username: ${user.username}`);
      continue;
    }
    let username = '';

    // Strategy 1: Use email prefix if email is valid
    if (user.email && user.email.includes('@')) {
      username = user.email.split('@')[0];
      // Clean username: remove special chars, make lowercase
      username = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Strategy 2: Use name if available and email didn't work
    if (!username && user.name) {
      username = user.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Strategy 3: Generate from user ID
    if (!username) {
      username = `user_${user.id.slice(0, 8)}`;
    }

    // Ensure uniqueness by appending number if needed
    let finalUsername = username;
    let counter = 1;
    while (true) {
      const existing = await prisma.user.findUnique({
        where: { username: finalUsername },
      });
      if (!existing || existing.id === user.id) {
        break;
      }
      finalUsername = `${username}${counter}`;
      counter++;
    }

    // Update user with username
    await prisma.user.update({
      where: { id: user.id },
      data: { username: finalUsername },
    });

    console.log(`Updated user ${user.id} (${user.email}) with username: ${finalUsername}`);
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

