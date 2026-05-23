import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CalendarHeart, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center aurora-bg p-4">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-[3px] bg-primary flex items-center justify-center shadow-[0_1px_0_hsl(var(--foreground)/0.15)]">
            <CalendarHeart className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <p className="label-mono mb-3">Return to sender</p>
        <h1 className="headline text-7xl text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

