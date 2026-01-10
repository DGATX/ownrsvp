/**
 * Get or create an AUTH_SECRET for NextAuth.
 *
 * This module is imported by auth.ts which runs in both Edge Runtime (middleware)
 * and Node.js Runtime (API routes). We must handle both cases.
 *
 * Priority:
 * 1. Environment variable AUTH_SECRET (if set and not 'auto')
 * 2. Auto-generated secret (persisted in Node.js runtime only)
 */

// Cache the secret in memory for the lifetime of the process
let cachedSecret: string | null = null;

/**
 * Generate a random secret using Web Crypto API (works in both Edge and Node.js)
 */
function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * Try to read persisted secret from file system (Node.js only)
 */
function tryReadPersistedSecret(): string | null {
  // Only attempt file operations in Node.js runtime
  if (typeof process === 'undefined' || !process.cwd) {
    return null;
  }

  try {
    // Dynamic imports to avoid Edge Runtime errors
    const fs = require('fs');
    const path = require('path');

    const secretsDir = path.join(process.cwd(), '.secrets');
    const secretFile = path.join(secretsDir, 'auth-secret');

    if (fs.existsSync(secretFile)) {
      const secret = fs.readFileSync(secretFile, 'utf-8').trim();
      if (secret && secret.length > 10) {
        return secret;
      }
    }
  } catch {
    // File operations not available or failed
  }

  return null;
}

/**
 * Try to persist secret to file system (Node.js only)
 */
function tryPersistSecret(secret: string): void {
  // Only attempt file operations in Node.js runtime
  if (typeof process === 'undefined' || !process.cwd) {
    return;
  }

  try {
    const fs = require('fs');
    const path = require('path');

    const secretsDir = path.join(process.cwd(), '.secrets');
    const secretFile = path.join(secretsDir, 'auth-secret');

    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    console.log('[Auth] Persisted AUTH_SECRET to .secrets/auth-secret');
  } catch (e) {
    console.warn('[Auth] Could not persist AUTH_SECRET:', e);
  }
}

/**
 * Get or create an AUTH_SECRET.
 *
 * For Docker one-click deployment:
 * - If AUTH_SECRET is not set or is 'auto', generates one automatically
 * - In Node.js runtime, persists to .secrets/auth-secret for container restarts
 * - In Edge Runtime, uses cached or newly generated secret
 */
export function getOrCreateAuthSecret(): string {
  // Return cached secret if available
  if (cachedSecret) {
    return cachedSecret;
  }

  // Check environment variable first
  const envSecret = process.env.AUTH_SECRET;
  if (envSecret && envSecret !== 'auto' && envSecret.length > 10) {
    cachedSecret = envSecret;
    return cachedSecret;
  }

  // Try to read persisted secret (Node.js only)
  const persistedSecret = tryReadPersistedSecret();
  if (persistedSecret) {
    console.log('[Auth] Using persisted AUTH_SECRET');
    cachedSecret = persistedSecret;
    return cachedSecret;
  }

  // Generate new secret
  console.log('[Auth] Generating new AUTH_SECRET');
  cachedSecret = generateSecret();

  // Try to persist it (Node.js only)
  tryPersistSecret(cachedSecret);

  return cachedSecret;
}
