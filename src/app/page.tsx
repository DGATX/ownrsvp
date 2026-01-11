import { HomePageClient } from '@/components/home-page-client';

export const dynamic = 'force-dynamic';

// Fresh install redirect to /register is handled client-side in HomePageClient
// This ensures reliable redirect even when server-side streaming interferes
export default function HomePage() {
  return <HomePageClient />;
}
