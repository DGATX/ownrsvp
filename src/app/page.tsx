import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { HomePageClient } from '@/components/home-page-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Server-side check: if no users exist, redirect to registration
  const userCount = await prisma.user.count().catch(() => -1);

  if (userCount === 0) {
    return redirect('/register');
  }

  return <HomePageClient />;
}
