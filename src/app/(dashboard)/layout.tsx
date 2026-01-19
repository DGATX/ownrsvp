import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { DashboardNav } from '@/components/dashboard-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get user role
  const userWithRole = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return (
    <div className="min-h-screen aurora-bg aurora-animated">
      <DashboardNav user={{ ...session.user, role: userWithRole?.role || null }} />
      <main className="relative z-10 pt-16">{children}</main>
    </div>
  );
}
