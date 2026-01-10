import { prisma } from './prisma';

export interface EmailConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  from?: string;
}

export interface SmsConfig {
  provider?: 'twilio' | 'aws-sns' | 'vonage' | 'messagebird' | 'generic';
  // Twilio config (default)
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  // AWS SNS config
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  // Vonage config
  apiKey?: string;
  apiSecret?: string;
  from?: string;
  // MessageBird config
  originator?: string;
  // Generic/Webhook config
  webhookUrl?: string;
  customHeaders?: Record<string, string>;
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
      return {
        host: configMap.get('SMTP_HOST') || process.env.SMTP_HOST || '',
        port: configMap.get('SMTP_PORT') || process.env.SMTP_PORT || '587',
        user: configMap.get('SMTP_USER') || process.env.SMTP_USER || '',
        password: configMap.get('SMTP_PASSWORD') || process.env.SMTP_PASSWORD || '',
        from: configMap.get('SMTP_FROM') || process.env.SMTP_FROM || undefined,
      };
    }
  } catch (error) {
    console.error('Error reading email config from database:', error);
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
 * Get SMS configuration from database, fallback to environment variables
 * Defaults to Twilio if no provider is specified
 */
export async function getSmsConfig(): Promise<SmsConfig | null> {
  try {
    const configs = await prisma.appConfig.findMany({
      where: { category: 'sms' },
    });

    if (configs.length > 0) {
      const configMap = new Map(configs.map(c => [c.key, c.value]));
      const provider = (configMap.get('SMS_PROVIDER') || 'twilio') as SmsConfig['provider'];
      
      const baseConfig: SmsConfig = {
        provider,
      };

      // Twilio config (default)
      if (provider === 'twilio' || !provider) {
        baseConfig.accountSid = configMap.get('TWILIO_ACCOUNT_SID') || process.env.TWILIO_ACCOUNT_SID || '';
        baseConfig.authToken = configMap.get('TWILIO_AUTH_TOKEN') || process.env.TWILIO_AUTH_TOKEN || '';
        baseConfig.phoneNumber = configMap.get('TWILIO_PHONE_NUMBER') || process.env.TWILIO_PHONE_NUMBER || '';
      }

      // AWS SNS config
      if (provider === 'aws-sns') {
        baseConfig.accessKeyId = configMap.get('AWS_ACCESS_KEY_ID') || process.env.AWS_ACCESS_KEY_ID || '';
        baseConfig.secretAccessKey = configMap.get('AWS_SECRET_ACCESS_KEY') || process.env.AWS_SECRET_ACCESS_KEY || '';
        baseConfig.region = configMap.get('AWS_REGION') || process.env.AWS_REGION || 'us-east-1';
        baseConfig.phoneNumber = configMap.get('AWS_SNS_PHONE_NUMBER') || process.env.AWS_SNS_PHONE_NUMBER || '';
      }

      // Vonage config
      if (provider === 'vonage') {
        baseConfig.apiKey = configMap.get('VONAGE_API_KEY') || process.env.VONAGE_API_KEY || '';
        baseConfig.apiSecret = configMap.get('VONAGE_API_SECRET') || process.env.VONAGE_API_SECRET || '';
        baseConfig.from = configMap.get('VONAGE_FROM') || process.env.VONAGE_FROM || '';
      }

      // MessageBird config
      if (provider === 'messagebird') {
        baseConfig.apiKey = configMap.get('MESSAGEBIRD_API_KEY') || process.env.MESSAGEBIRD_API_KEY || '';
        baseConfig.originator = configMap.get('MESSAGEBIRD_ORIGINATOR') || process.env.MESSAGEBIRD_ORIGINATOR || '';
      }

      // Generic/Webhook config
      if (provider === 'generic') {
        baseConfig.webhookUrl = configMap.get('GENERIC_WEBHOOK_URL') || process.env.GENERIC_WEBHOOK_URL || '';
        baseConfig.apiKey = configMap.get('GENERIC_API_KEY') || process.env.GENERIC_API_KEY || '';
        const customHeaders = configMap.get('GENERIC_CUSTOM_HEADERS');
        if (customHeaders) {
          try {
            baseConfig.customHeaders = JSON.parse(customHeaders);
          } catch {
            baseConfig.customHeaders = {};
          }
        }
      }

      return baseConfig;
    }
  } catch (error) {
    console.error('Error reading SMS config from database:', error);
  }

  // Fallback to environment variables (Twilio default)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    return {
      provider: 'twilio',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
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
    { key: 'SMTP_FROM', value: config.from },
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
}

/**
 * Update SMS configuration in database
 * Defaults to Twilio if no provider specified
 */
export async function updateSmsConfig(config: Partial<SmsConfig>, userId?: string): Promise<void> {
  const provider = config.provider || 'twilio'; // Default to Twilio

  // Store provider type
  await prisma.appConfig.upsert({
    where: {
      category_key: {
        category: 'sms',
        key: 'SMS_PROVIDER',
      },
    },
    update: {
      value: provider,
      updatedBy: userId,
    },
    create: {
      category: 'sms',
      key: 'SMS_PROVIDER',
      value: provider,
      encrypted: false,
      updatedBy: userId,
    },
  });

  // Store provider-specific config
  const smsConfigs: Array<{ key: string; value: string; encrypted: boolean }> = [];

  if (provider === 'twilio' || !config.provider) {
    // Twilio config
    if (config.accountSid !== undefined) smsConfigs.push({ key: 'TWILIO_ACCOUNT_SID', value: config.accountSid, encrypted: false });
    if (config.authToken !== undefined) smsConfigs.push({ key: 'TWILIO_AUTH_TOKEN', value: config.authToken, encrypted: true });
    if (config.phoneNumber !== undefined) smsConfigs.push({ key: 'TWILIO_PHONE_NUMBER', value: config.phoneNumber, encrypted: false });
  }

  if (provider === 'aws-sns') {
    // AWS SNS config
    if (config.accessKeyId !== undefined) smsConfigs.push({ key: 'AWS_ACCESS_KEY_ID', value: config.accessKeyId, encrypted: false });
    if (config.secretAccessKey !== undefined) smsConfigs.push({ key: 'AWS_SECRET_ACCESS_KEY', value: config.secretAccessKey, encrypted: true });
    if (config.region !== undefined) smsConfigs.push({ key: 'AWS_REGION', value: config.region, encrypted: false });
    if (config.phoneNumber !== undefined) smsConfigs.push({ key: 'AWS_SNS_PHONE_NUMBER', value: config.phoneNumber, encrypted: false });
  }

  if (provider === 'vonage') {
    // Vonage config
    if (config.apiKey !== undefined) smsConfigs.push({ key: 'VONAGE_API_KEY', value: config.apiKey, encrypted: false });
    if (config.apiSecret !== undefined) smsConfigs.push({ key: 'VONAGE_API_SECRET', value: config.apiSecret, encrypted: true });
    if (config.from !== undefined) smsConfigs.push({ key: 'VONAGE_FROM', value: config.from, encrypted: false });
  }

  if (provider === 'messagebird') {
    // MessageBird config
    if (config.apiKey !== undefined) smsConfigs.push({ key: 'MESSAGEBIRD_API_KEY', value: config.apiKey, encrypted: false });
    if (config.originator !== undefined) smsConfigs.push({ key: 'MESSAGEBIRD_ORIGINATOR', value: config.originator, encrypted: false });
  }

  if (provider === 'generic') {
    // Generic/Webhook config
    if (config.webhookUrl !== undefined) smsConfigs.push({ key: 'GENERIC_WEBHOOK_URL', value: config.webhookUrl, encrypted: false });
    if (config.apiKey !== undefined) smsConfigs.push({ key: 'GENERIC_API_KEY', value: config.apiKey, encrypted: true });
    if (config.customHeaders !== undefined) smsConfigs.push({ key: 'GENERIC_CUSTOM_HEADERS', value: JSON.stringify(config.customHeaders), encrypted: false });
  }

  for (const item of smsConfigs) {
    await prisma.appConfig.upsert({
      where: {
        category_key: {
          category: 'sms',
          key: item.key,
        },
      },
      update: {
        value: item.value,
        encrypted: item.encrypted,
        updatedBy: userId,
      },
      create: {
        category: 'sms',
        key: item.key,
        value: item.value,
        encrypted: item.encrypted,
        updatedBy: userId,
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
    const smsConfig = await getSmsConfig();

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
      envContent += '\n# Gmail SMTP Configuration\n';
      envContent += smtpLines.join('\n') + '\n';
    }

    // Update or add Twilio config
    if (smsConfig) {
      const twilioLines = [
        'TWILIO_ACCOUNT_SID="' + smsConfig.accountSid + '"',
        'TWILIO_AUTH_TOKEN="' + smsConfig.authToken + '"',
        'TWILIO_PHONE_NUMBER="' + smsConfig.phoneNumber + '"',
      ];

      // Remove existing Twilio lines
      envContent = envContent.replace(/^TWILIO_.*$/gm, '');
      envContent = envContent.replace(/\n\n+/g, '\n\n');

      // Add new Twilio config
      if (!envContent.endsWith('\n')) envContent += '\n';
      envContent += '\n# Twilio SMS Configuration\n';
      envContent += twilioLines.join('\n') + '\n';
    }

    // Write back to file
    await fs.writeFile(envPath, envContent.trim() + '\n', 'utf-8');
  } catch (error) {
    console.error('Error syncing config to .env file:', error);
    throw error;
  }
}

/**
 * Migrate existing .env values to database
 */
export async function migrateEnvToDatabase(userId?: string): Promise<void> {
  const emailConfig = await getEmailConfig();
  const smsConfig = await getSmsConfig();

  // Only migrate if we have env vars but no database entries
  const dbEmailConfigs = await prisma.appConfig.findMany({
    where: { category: 'email' },
  });

  const dbSmsConfigs = await prisma.appConfig.findMany({
    where: { category: 'sms' },
  });

  if (emailConfig && dbEmailConfigs.length === 0) {
    await updateEmailConfig(emailConfig, userId);
  }

  if (smsConfig && dbSmsConfigs.length === 0) {
    await updateSmsConfig(smsConfig, userId);
  }
}

