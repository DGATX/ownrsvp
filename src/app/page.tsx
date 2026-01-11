import { HomePageClient } from '@/components/home-page-client';

export const dynamic = 'force-dynamic';

// Redirect to /register when no users exist is handled by middleware
export default function HomePage() {
  return <HomePageClient />;
}
