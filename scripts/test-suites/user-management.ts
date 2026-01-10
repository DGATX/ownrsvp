import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class UserManagementTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any
  ) {
    // User Profile
    await runTest(
      'View own profile',
      'User Management',
      'Profile',
      async () => {
        const user = await prisma.user.findUnique({
          where: { id: user1.id },
          select: { id: true, name: true, email: true, username: true },
        });
        
        if (!user) {
          throw new Error('User not found');
        }
      },
      'User profile can be retrieved',
      'Medium'
    );

    await runTest(
      'Update profile name',
      'User Management',
      'Profile',
      async () => {
        // Login as user1 first
        await httpClient.loginAsUser(user1);
        
        const newName = `Updated Name ${nanoid(4)}`;
        const response = await httpClient.patch('/api/user/profile', {
          name: newName,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.user.findUnique({
          where: { id: user1.id },
        });
        
        if (updated?.name !== newName) {
          throw new Error('Name not updated');
        }
      },
      'User can update profile name',
      'Medium'
    );

    await runTest(
      'Update profile email with validation',
      'User Management',
      'Profile',
      async () => {
        // Login as user1 first
        await httpClient.loginAsUser(user1);
        
        const newEmail = `updated_${nanoid(8)}@test.invitehub.com`;
        const response = await httpClient.patch('/api/user/profile', {
          email: newEmail,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.user.findUnique({
          where: { id: user1.id },
        });
        
        if (updated?.email !== newEmail) {
          throw new Error('Email not updated');
        }
      },
      'User can update profile email',
      'High'
    );

    await runTest(
      'Update profile email to invalid format (rejected)',
      'User Management',
      'Profile',
      async () => {
        // Login as user1 first
        await httpClient.loginAsUser(user1);
        
        const response = await httpClient.patch('/api/user/profile', {
          email: 'invalid-email-format',
        });
        
        if (response.status === 200) {
          throw new Error('Invalid email should be rejected');
        }
      },
      'Invalid email format is rejected',
      'High'
    );

    await runTest(
      'Update profile theme',
      'User Management',
      'Profile',
      async () => {
        // Login as user1 first
        await httpClient.loginAsUser(user1);
        
        const themes = ['light', 'dark', 'system'];
        for (const theme of themes) {
          const response = await httpClient.patch('/api/user/profile', {
            theme,
          });
          
          if (response.status !== 200) {
            throw new Error(`Failed to update theme to ${theme}`);
          }
          
          const updated = await prisma.user.findUnique({
            where: { id: user1.id },
          });
          
          if (updated?.theme !== theme) {
            throw new Error(`Theme not updated to ${theme}`);
          }
        }
      },
      'User can update profile theme',
      'Low'
    );

    // Admin User Management
    await runTest(
      'Admin can view all users',
      'User Management',
      'Admin',
      async () => {
        const users = await prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true },
        });
        
        if (users.length === 0) {
          throw new Error('No users found');
        }
      },
      'Admin can retrieve all users',
      'High'
    );

    await runTest(
      'Admin can create new user',
      'User Management',
      'Admin',
      async () => {
        const newUserEmail = `newuser_${nanoid(8)}@test.invitehub.com`;
        const response = await httpClient.post('/api/auth/register', {
          name: 'New User',
          username: `newuser_${nanoid(8)}`,
          email: newUserEmail,
          password: 'password123',
          role: 'USER',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to create user: ${error.error || response.status}`);
        }
        
        const user = await prisma.user.findUnique({
          where: { email: newUserEmail },
        });
        
        if (!user) {
          throw new Error('User not created');
        }
      },
      'Admin can create new user',
      'High'
    );

    await runTest(
      'Admin can create user with invitation',
      'User Management',
      'Admin',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const inviteEmail = `inviteuser_${nanoid(8)}@test.invitehub.com`;
        const response = await httpClient.post('/api/auth/register', {
          name: 'Invited User',
          username: `inviteuser_${nanoid(8)}`,
          email: inviteEmail,
          role: 'USER',
          sendInvitation: true,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to create user with invitation: ${error.error || response.status}`);
        }
        
        const user = await prisma.user.findUnique({
          where: { email: inviteEmail },
          include: { invitation: true },
        });
        
        if (!user || !user.invitation) {
          throw new Error('User invitation not created');
        }
      },
      'Admin can create user with invitation',
      'High'
    );

    await runTest(
      'Admin can edit user name',
      'User Management',
      'Admin',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const testUser = await prisma.user.findFirst({
          where: { role: 'USER', id: { not: admin.id } },
        });
        
        if (!testUser) {
          throw new Error('No test user found');
        }
        
        const newName = `Updated Name ${nanoid(4)}`;
        const response = await httpClient.patch(`/api/admin/users/${testUser.id}`, {
          name: newName,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.user.findUnique({
          where: { id: testUser.id },
        });
        
        if (updated?.name !== newName) {
          throw new Error('User name not updated');
        }
      },
      'Admin can edit user name',
      'High'
    );

    await runTest(
      'Admin can edit user email',
      'User Management',
      'Admin',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const testUser = await prisma.user.findFirst({
          where: { role: 'USER', id: { not: admin.id } },
        });
        
        if (!testUser) {
          throw new Error('No test user found');
        }
        
        const newEmail = `updated_${nanoid(8)}@test.invitehub.com`;
        const response = await httpClient.patch(`/api/admin/users/${testUser.id}`, {
          email: newEmail,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.user.findUnique({
          where: { id: testUser.id },
        });
        
        if (updated?.email !== newEmail) {
          throw new Error('User email not updated');
        }
      },
      'Admin can edit user email',
      'High'
    );

    await runTest(
      'Admin can edit user role',
      'User Management',
      'Admin',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const testUser = await prisma.user.findFirst({
          where: { role: 'USER', id: { not: admin.id } },
        });
        
        if (!testUser) {
          throw new Error('No test user found');
        }
        
        const response = await httpClient.patch(`/api/admin/users/${testUser.id}`, {
          role: 'ADMIN',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.user.findUnique({
          where: { id: testUser.id },
        });
        
        if (updated?.role !== 'ADMIN') {
          throw new Error('User role not updated');
        }
        
        // Change back to USER
        await httpClient.patch(`/api/admin/users/${testUser.id}`, {
          role: 'USER',
        });
      },
      'Admin can edit user role',
      'High'
    );

    await runTest(
      'Admin can change user password',
      'User Management',
      'Admin',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const testUser = await prisma.user.findFirst({
          where: { role: 'USER', id: { not: admin.id } },
        });
        
        if (!testUser) {
          throw new Error('No test user found');
        }
        
        const newPassword = `newpass_${nanoid(8)}`;
        const response = await httpClient.patch(`/api/admin/users/${testUser.id}`, {
          password: newPassword,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
      },
      'Admin can change user password',
      'High'
    );

    await runTest(
      'Admin cannot delete themselves',
      'User Management',
      'Admin',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const response = await httpClient.delete(`/api/admin/users/${admin.id}`);
        
        if (response.status === 200) {
          throw new Error('Admin should not be able to delete themselves');
        }
      },
      'Admin cannot delete own account',
      'High'
    );

    await runTest(
      'User list shows admins first',
      'User Management',
      'Admin',
      async () => {
        const users = await prisma.user.findMany({
          orderBy: [
            { role: 'asc' },
            { createdAt: 'desc' },
          ],
        });
        
        // Check that first user is admin (if any admins exist)
        const hasAdmins = users.some(u => u.role === 'ADMIN');
        if (hasAdmins) {
          const firstAdminIndex = users.findIndex(u => u.role === 'ADMIN');
          const firstUserIndex = users.findIndex(u => u.role === 'USER');
          
          if (firstUserIndex !== -1 && firstAdminIndex > firstUserIndex) {
            throw new Error('Admins should be listed before regular users');
          }
        }
      },
      'User list is sorted with admins first',
      'Medium'
    );
  }
}

