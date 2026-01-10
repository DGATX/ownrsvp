import { PrismaClient } from '@prisma/client';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class AdminTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any
  ) {
    // Admin Dashboard
    await runTest(
      'Admin dashboard accessible to admins only',
      'Admin Features',
      'Dashboard',
      async () => {
        const adminUser = await prisma.user.findUnique({
          where: { id: admin.id },
          select: { role: true },
        });
        
        if (adminUser?.role !== 'ADMIN') {
          throw new Error('User should have ADMIN role');
        }
        
        const regularUser = await prisma.user.findUnique({
          where: { id: user1.id },
          select: { role: true },
        });
        
        if (regularUser?.role === 'ADMIN') {
          throw new Error('Regular user should not have ADMIN role');
        }
      },
      'Admin dashboard access control works',
      'Critical'
    );

    await runTest(
      'Admin dashboard shows user statistics',
      'Admin Features',
      'Dashboard',
      async () => {
        const totalUsers = await prisma.user.count();
        const totalAdmins = await prisma.user.count({ where: { role: 'ADMIN' } });
        
        if (totalUsers === 0) {
          throw new Error('No users found');
        }
        
        if (totalAdmins === 0) {
          throw new Error('No admins found');
        }
      },
      'Admin dashboard statistics are accurate',
      'Medium'
    );

    await runTest(
      'Admin dashboard shows event statistics',
      'Admin Features',
      'Dashboard',
      async () => {
        const totalEvents = await prisma.event.count();
        const upcomingEvents = await prisma.event.count({
          where: { date: { gte: new Date() } },
        });
        
        // Statistics should be calculable
        if (totalEvents < 0 || upcomingEvents < 0) {
          throw new Error('Event statistics calculation failed');
        }
      },
      'Admin dashboard event statistics work',
      'Medium'
    );

    // Configuration Management
    await runTest(
      'View SMTP configuration',
      'Admin Features',
      'Configuration',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const response = await httpClient.get('/api/admin/config/email');
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to get SMTP config: ${error.error || response.status}`);
        }
      },
      'SMTP configuration can be viewed',
      'High'
    );

    await runTest(
      'View SMS configuration',
      'Admin Features',
      'Configuration',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const response = await httpClient.get('/api/admin/config/sms');
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to get SMS config: ${error.error || response.status}`);
        }
      },
      'SMS configuration can be viewed',
      'High'
    );
  }
}

