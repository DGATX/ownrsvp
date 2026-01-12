import { prisma } from './prisma';
import { logger } from './logger';

export interface EmailConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  from?: string;
}

/**
 * Get email configuration from database, fallback to environment variables
 */
export async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    const configs = await prisma.appConfig.findMany({
      where: { category: 'email' },
    });

    if (configs.length > 0) {
      const configMap = new Map(configs.map(c => [c.key, c.value]));
      // Use nullish coalescing (??) to preserve empty strings, but treat them as unset for 'from'
      const fromValue = configMap.get('SMTP_FROM');
      return {
        host: configMap.get('SMTP_HOST') || process.env.SMTP_HOST || '',
        port: configMap.get('SMTP_PORT') || process.env.SMTP_PORT || '587',
        user: configMap.get('SMTP_USER') || process.env.SMTP_USER || '',
        password: configMap.get('SMTP_PASSWORD') || process.env.SMTP_PASSWORD || '',
        from: (fromValue && fromValue.trim()) ? fromValue : (process.env.SMTP_FROM || undefined),
      };
    }
  } catch (error) {
    logger.error('Error reading email config from database', error);
  }

  // Fallback to environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || '587',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM,
    };
  }

  return null;
}

/**
 * Update email configuration in database
 */
export async function updateEmailConfig(config: Partial<EmailConfig>, userId?: string): Promise<void> {
  const emailConfigs = [
    { key: 'SMTP_HOST', value: config.host },
    { key: 'SMTP_PORT', value: config.port },
    { key: 'SMTP_USER', value: config.user },
    { key: 'SMTP_PASSWORD', value: config.password },
    // Only save SMTP_FROM if it has a non-empty value
    { key: 'SMTP_FROM', value: config.from?.trim() || undefined },
  ].filter(item => item.value !== undefined);

  for (const item of emailConfigs) {
    await prisma.appConfig.upsert({
      where: {
        category_key: {
          category: 'email',
          key: item.key,
        },
      },
      update: {
        value: item.value!,
        updatedBy: userId,
      },
      create: {
        category: 'email',
        key: item.key,
        value: item.value!,
        encrypted: item.key === 'SMTP_PASSWORD',
        updatedBy: userId,
      },
    });
  }

  // If SMTP_FROM was cleared (empty or undefined), delete it from database
  if (!config.from?.trim()) {
    await prisma.appConfig.deleteMany({
      where: {
        category: 'email',
        key: 'SMTP_FROM',
      },
    });
  }
}

/**
 * Sync configuration from database to .env file
 */
export async function syncToEnvFile(): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    const emailConfig = await getEmailConfig();

    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    // Read existing .env file
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch (error) {
      // File doesn't exist, that's okay
    }

    // Update or add SMTP config
    if (emailConfig) {
      const smtpLines = [
        'SMTP_HOST="' + emailConfig.host + '"',
        'SMTP_PORT="' + emailConfig.port + '"',
        'SMTP_USER="' + emailConfig.user + '"',
        'SMTP_PASSWORD="' + emailConfig.password + '"',
        emailConfig.from ? 'SMTP_FROM="' + emailConfig.from + '"' : '',
      ].filter(Boolean);

      // Remove existing SMTP lines
      envContent = envContent.replace(/^SMTP_.*$/gm, '');
      envContent = envContent.replace(/\n\n+/g, '\n\n'); // Clean up extra newlines

      // Add new SMTP config
      if (!envContent.endsWith('\n')) envContent += '\n';
      envContent += '\n# SMTP Configuration\n';
      envContent += smtpLines.join('\n') + '\n';
    }

    // Write back to file
    await fs.writeFile(envPath, envContent.trim() + '\n', 'utf-8');
  } catch (error) {
    logger.error('Error syncing config to .env file', error);
    throw error;
  }
}

/**
 * Migrate existing .env values to database
 */
export async function migrateEnvToDatabase(userId?: string): Promise<void> {
  const emailConfig = await getEmailConfig();

  // Only migrate if we have env vars but no database entries
  const dbEmailConfigs = await prisma.appConfig.findMany({
    where: { category: 'email' },
  });

  if (emailConfig && dbEmailConfigs.length === 0) {
    await updateEmailConfig(emailConfig, userId);
  }
}

/**
 * Get the public app URL from database, fallback to environment variable
 */
export async function getAppUrl(): Promise<string> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: {
        category_key: {
          category: 'app',
          key: 'APP_URL',
        },
      },
    });
    if (config?.value) {
      return config.value;
    }
  } catch (error) {
    logger.error('Error reading app URL from database', error);
  }

  // Fallback to environment variable or default
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Update the public app URL in database
 */
export async function updateAppUrl(appUrl: string, userId?: string): Promise<void> {
  // Normalize URL - remove trailing slash
  const normalizedUrl = appUrl.replace(/\/+$/, '');

  await prisma.appConfig.upsert({
    where: {
      category_key: {
        category: 'app',
        key: 'APP_URL',
      },
    },
    update: {
      value: normalizedUrl,
      updatedBy: userId,
    },
    create: {
      category: 'app',
      key: 'APP_URL',
      value: normalizedUrl,
      encrypted: false,
      updatedBy: userId,
    },
  });
}
