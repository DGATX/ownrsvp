import { PrismaClient } from '@prisma/client';
import { updateEmailConfig, updateSmsConfig } from '../src/lib/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrating environment variables to database...');

  // Get admin user for updatedBy field
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  const adminId = admin?.id || 'system';

  // Check if config already exists in database
  const existingEmailConfig = await prisma.appConfig.findFirst({
    where: { category: 'email' },
  });

  const existingSmsConfig = await prisma.appConfig.findFirst({
    where: { category: 'sms' },
  });

  // Migrate email config if env vars exist and DB is empty
  if (!existingEmailConfig && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    console.log('📧 Migrating email configuration...');
    await updateEmailConfig(
      {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || '587',
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
        from: process.env.SMTP_FROM,
      },
      adminId
    );
    console.log('✅ Email configuration migrated');
  } else if (existingEmailConfig) {
    console.log('ℹ️  Email configuration already exists in database');
  } else {
    console.log('ℹ️  No email configuration found in environment variables');
  }

  // Migrate SMS config if env vars exist and DB is empty
  if (!existingSmsConfig && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    console.log('📱 Migrating SMS configuration...');
    await updateSmsConfig(
      {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER,
      },
      adminId
    );
    console.log('✅ SMS configuration migrated');
  } else if (existingSmsConfig) {
    console.log('ℹ️  SMS configuration already exists in database');
  } else {
    console.log('ℹ️  No SMS configuration found in environment variables');
  }

  console.log('✅ Migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

