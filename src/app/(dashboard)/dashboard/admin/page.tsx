import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminUserManagement } from '@/components/admin-user-management';
import { ConfigManagement } from '@/components/config-management';
import { RestartServerButton } from '@/components/restart-server-button';
import { FactoryResetButton } from '@/components/factory-reset-button';
import { Users, Calendar, Shield } from 'lucide-react';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    notFound();
  }

  // Get all users - admins first, then by creation date
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          events: true,
        },
      },
    },
    orderBy: [
      { role: 'asc' }, // ADMIN comes before USER alphabetically
      { createdAt: 'desc' },
    ],
  });

  // Get statistics
  const totalUsers = await prisma.user.count();
  const totalAdmins = await prisma.user.count({ where: { role: 'ADMIN' } });
  const totalEvents = await prisma.event.count();
  const upcomingEvents = await prisma.event.count({
    where: { date: { gte: new Date() } },
  });
  const pastEvents = await prisma.event.count({
    where: { date: { lt: new Date() } },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage users, events, and system-wide settings. Only administrators can access this page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RestartServerButton />
          <FactoryResetButton />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {totalAdmins} administrators
            </p>
          </CardContent>
        </Card>

        <Link href="/dashboard">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEvents}</div>
              <p className="text-xs text-muted-foreground">
                {upcomingEvents} upcoming, {pastEvents} past
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <AdminUserManagement users={users} />

      <div className="mb-8 mt-8">
        <ConfigManagement />
      </div>
    </div>
  );
}

