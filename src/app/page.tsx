import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { HomePageClient } from '@/components/home-page-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Server-side check: if no users exist, redirect to registration
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      redirect('/register');
    }
  } catch {
    // If database check fails, show the page anyway
    // The client-side will handle it
  }

  return <HomePageClient />;
}
