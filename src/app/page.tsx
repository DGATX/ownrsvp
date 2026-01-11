import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { HomePageClient } from '@/components/home-page-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Server-side check: if no users exist, redirect to registration
  let shouldRedirect = false;

  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      shouldRedirect = true;
    }
  } catch {
    // If database check fails, show the page anyway
  }

  if (shouldRedirect) {
    redirect('/register');
  }

  return <HomePageClient />;
}
