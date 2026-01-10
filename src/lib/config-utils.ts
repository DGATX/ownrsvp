/**
 * Utility functions for configuration management
 * Extracts common patterns used across email and SMS config components
 */

/**
 * Check if a value is a masked secret (contains asterisks)
 * Used to determine if a password/token field should be updated
 *
 * @example
 * if (!isMaskedSecret(password)) {
 *   // Update the password in the request
 * }
 */
export function isMaskedSecret(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.includes('*');
}

/**
 * Mask a secret value for display (e.g., API keys, passwords)
 * Shows first 4 and last 4 characters, masks the middle
 *
 * @example
 * maskSecret('my-secret-password-123') // 'my-s************-123'
 */
export function maskSecret(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return '*'.repeat(value?.length || 8);
  }

  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const masked = '*'.repeat(Math.max(value.length - (visibleChars * 2), 8));

  return `${start}${masked}${end}`;
}

/**
 * Safe localStorage operations with error handling
 * Handles cases where localStorage is unavailable (SSR, privacy mode, etc.)
 */
export const storage = {
  /**
   * Get item from localStorage safely
   */
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },

  /**
   * Set item in localStorage safely
   */
  set(key: string, value: string): boolean {
    if (typeof window === 'undefined') return false;

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Remove item from localStorage safely
   */
  remove(key: string): boolean {
    if (typeof window === 'undefined') return false;

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get JSON value from localStorage
   */
  getJSON<T>(key: string): T | null {
    const value = this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return null;
    }
  },

  /**
   * Set JSON value in localStorage
   */
  setJSON<T>(key: string, value: T): boolean {
    try {
      const jsonString = JSON.stringify(value);
      return this.set(key, jsonString);
    } catch (error) {
      return false;
    }
  },
};

/**
 * Validate email configuration
 */
export function isEmailConfigComplete(config: {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
}): boolean {
  return !!(
    config.host &&
    config.port &&
    config.user &&
    config.password &&
    !isMaskedSecret(config.password)
  );
}

/**
 * Validate SMS configuration (Twilio)
 */
export function isSmsConfigComplete(config: {
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
}): boolean {
  return !!(
    config.accountSid &&
    config.authToken &&
    config.phoneNumber &&
    !isMaskedSecret(config.authToken)
  );
}

/**
 * Format phone number for display
 * Adds formatting to make phone numbers more readable
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX for US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }

  // Format as +X XXX XXX XXXX for international
  if (cleaned.length === 11) {
    return `+${cleaned.substring(0, 1)} ${cleaned.substring(1, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }

  // Return original if doesn't match common formats
  return phone;
}

/**
 * Config keys for localStorage
 * Centralized to avoid typos and make refactoring easier
 */
export const CONFIG_STORAGE_KEYS = {
  EMAIL_PASSWORD: 'smtp_password',
  SMS_TEST_PHONE: 'sms_test_phone',
  EMAIL_TEST_ADDRESS: 'email_test_address',
} as const;
