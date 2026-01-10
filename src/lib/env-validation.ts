import { getEmailConfig, getSmsConfig } from './config';

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateAuthConfig(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET === 'dev-secret-key-change-in-production-abc123xyz') {
    missing.push('AUTH_SECRET');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

export async function validateSmtpConfig(): Promise<EnvValidationResult> {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check database first
  const dbConfig = await getEmailConfig();
  
  if (dbConfig) {
    // Validate database config
    if (!dbConfig.host || dbConfig.host.trim() === '') missing.push('SMTP_HOST');
    if (!dbConfig.port || dbConfig.port.trim() === '') missing.push('SMTP_PORT');
    if (!dbConfig.user || dbConfig.user.trim() === '') missing.push('SMTP_USER');
    if (!dbConfig.password || dbConfig.password.trim() === '') missing.push('SMTP_PASSWORD');
    
    if (!dbConfig.from || dbConfig.from.trim() === '') {
      warnings.push('SMTP_FROM not set, will use SMTP_USER as sender');
    }
  } else {
    // Fallback to environment variables
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
    for (const varName of requiredVars) {
      if (!process.env[varName] || process.env[varName]?.trim() === '') {
        missing.push(varName);
      }
    }

    if (!process.env.SMTP_FROM || process.env.SMTP_FROM?.trim() === '') {
      warnings.push('SMTP_FROM not set, will use SMTP_USER as sender');
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

export async function validateSmsConfig(): Promise<EnvValidationResult> {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check database first
  const dbConfig = await getSmsConfig();
  
  if (dbConfig) {
    // Validate database config
    if (!dbConfig.accountSid || dbConfig.accountSid.trim() === '') missing.push('TWILIO_ACCOUNT_SID');
    if (!dbConfig.authToken || dbConfig.authToken.trim() === '') missing.push('TWILIO_AUTH_TOKEN');
    if (!dbConfig.phoneNumber || dbConfig.phoneNumber.trim() === '') missing.push('TWILIO_PHONE_NUMBER');
  } else {
    // Fallback to environment variables
    const hasAnySmsVar = process.env.TWILIO_ACCOUNT_SID ||
                         process.env.TWILIO_AUTH_TOKEN ||
                         process.env.TWILIO_PHONE_NUMBER;

    if (hasAnySmsVar) {
      // If any SMS var is set, all must be set
      if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
      if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
      if (!process.env.TWILIO_PHONE_NUMBER) missing.push('TWILIO_PHONE_NUMBER');
    } else {
      warnings.push('SMS not configured - all Twilio variables are empty');
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

export async function isEmailConfigured(): Promise<boolean> {
  const config = await validateSmtpConfig();
  return config.isValid;
}

export async function isSmsConfigured(): Promise<boolean> {
  const config = await validateSmsConfig();
  return config.isValid;
}
