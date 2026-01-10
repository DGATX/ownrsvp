import { getEmailConfig } from './config';

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

export async function isEmailConfigured(): Promise<boolean> {
  const config = await validateSmtpConfig();
  return config.isValid;
}
