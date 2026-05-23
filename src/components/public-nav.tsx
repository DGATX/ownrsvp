'use client';

import Link from 'next/link';
import { CalendarHeart } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function PublicNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-[3px] bg-primary flex items-center justify-center shadow-[0_1px_0_hsl(var(--foreground)/0.15)] transition-transform group-hover:-rotate-6">
              <CalendarHeart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-xl tracking-tight">OwnRSVP</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

