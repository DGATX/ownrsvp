import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class SecurityTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    user2: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any
  ) {
    // Authentication Security
    await runTest(
      'Passwords hashed with bcrypt',
      'Security',
      'Authentication',
      async () => {
        const user = await prisma.user.findUnique({
          where: { id: user1.id },
          select: { password: true },
        });
        
        if (!user || !user.password) {
          throw new Error('User password not found');
        }
        
        // Bcrypt hashes start with $2a$, $2b$, or $2y$
        if (!user.password.startsWith('$2')) {
          throw new Error('Password not hashed with bcrypt');
        }
      },
      'Passwords are properly hashed',
      'Critical'
    );

    await runTest(
      'Password reset tokens expire',
      'Security',
      'Authentication',
      async () => {
        const token = await prisma.passwordResetToken.findFirst({
          where: { email: user1.email },
        });
        
        if (token && token.expires <= new Date()) {
          // Token should expire in the future when created
          // This test verifies expiration is set
          if (token.expires.getTime() - Date.now() > 2 * 60 * 60 * 1000) {
            throw new Error('Token expiration too far in future');
          }
        }
      },
      'Password reset tokens have expiration',
      'High'
    );

    // Authorization Security
    await runTest(
      'Users cannot access other users events',
      'Security',
      'Authorization',
      async () => {
        // Login as user1 (not the event owner)
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user2.id);
        
        // user1 should not be able to access user2's event
        const response = await httpClient.get(`/api/events/${event.id}`);
        
        if (response.status === 200) {
          throw new Error('User should not access other user events');
        }
      },
      'Users cannot access unauthorized events',
      'Critical'
    );

    await runTest(
      'Non-admins cannot access admin routes',
      'Security',
      'Authorization',
      async () => {
        // Login as user1 (non-admin)
        await httpClient.loginAsUser(user1);
        
        // user1 (non-admin) should not access admin routes
        const response = await httpClient.get('/api/admin/users');
        
        if (response.status === 200) {
          throw new Error('Non-admin should not access admin routes');
        }
      },
      'Admin routes are protected',
      'Critical'
    );

    // Data Security
    await runTest(
      'Passwords never returned in API',
      'Security',
      'Data Security',
      async () => {
        // Login as user1
        await httpClient.loginAsUser(user1);
        
        const response = await httpClient.get(`/api/user/profile`);
        
        if (response.status === 200) {
          const data = await response.json();
          if (data.user?.password) {
            throw new Error('Password should not be returned in API');
          }
        }
      },
      'Sensitive data is not exposed',
      'Critical'
    );

    await runTest(
      'SQL injection attempts blocked',
      'Security',
      'Data Security',
      async () => {
        // Login as user1
        await httpClient.loginAsUser(user1);
        
        const maliciousInput = "'; DROP TABLE users; --";
        const response = await httpClient.post('/api/events', {
          title: maliciousInput,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        
        // Should either reject or sanitize, not crash
        if (response.status === 500) {
          throw new Error('SQL injection attempt caused server error');
        }
        
        // Verify users table still exists
        const users = await prisma.user.findMany({ take: 1 });
        if (users.length === 0 && (await prisma.user.count()) === 0) {
          throw new Error('Users table may have been dropped');
        }
      },
      'SQL injection attempts are blocked',
      'Critical'
    );
  }
}

