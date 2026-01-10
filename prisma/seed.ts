import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin' },
  });

  if (!existingAdmin) {
    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin', 12);
    
    await prisma.user.create({
      data: {
        email: 'admin',
        username: 'admin',
        name: 'Administrator',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log('✅ Default admin user created (email: admin, password: admin)');
  } else {
    console.log('ℹ️  Admin user already exists');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

