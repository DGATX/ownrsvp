'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RsvpSummaryProps {
  stats: {
    total: number;
    attending: number;
    notAttending: number;
    maybe: number;
    pending: number;
  };
  selectedFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

export function RsvpSummary({ stats, selectedFilter, onFilterChange }: RsvpSummaryProps) {
  const handleCardClick = (status: string) => {
    if (selectedFilter === status) {
      onFilterChange(null); // Toggle off if already selected
    } else {
      onFilterChange(status);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            RSVP Summary
          </CardTitle>
          {selectedFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange(null)}
              className="h-6 px-2 text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          onClick={() => handleCardClick('ATTENDING')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-[3px] border-l-2 border-l-primary border-y border-r border-border bg-primary/[0.06] hover:bg-primary/[0.12] transition-colors cursor-pointer',
            selectedFilter === 'ATTENDING' && 'ring-2 ring-primary bg-primary/[0.12]'
          )}
        >
          <span className="label-mono text-primary">Attending</span>
          <span className="text-2xl font-display font-semibold text-primary">{stats.attending}</span>
        </button>
        <button
          onClick={() => handleCardClick('MAYBE')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-[3px] border-l-2 border-l-accent border-y border-r border-border bg-accent/[0.06] hover:bg-accent/[0.12] transition-colors cursor-pointer',
            selectedFilter === 'MAYBE' && 'ring-2 ring-accent bg-accent/[0.12]'
          )}
        >
          <span className="label-mono text-accent">Maybe</span>
          <span className="text-2xl font-display font-semibold text-accent">{stats.maybe}</span>
        </button>
        <button
          onClick={() => handleCardClick('NOT_ATTENDING')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-[3px] border-l-2 border-l-foreground/40 border-y border-r border-border bg-foreground/[0.04] hover:bg-foreground/[0.08] transition-colors cursor-pointer',
            selectedFilter === 'NOT_ATTENDING' && 'ring-2 ring-foreground/50 bg-foreground/[0.08]'
          )}
        >
          <span className="label-mono text-foreground">Not Attending</span>
          <span className="text-2xl font-display font-semibold text-foreground">{stats.notAttending}</span>
        </button>
        <button
          onClick={() => handleCardClick('PENDING')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-[3px] border-l-2 border-l-border border-y border-r border-border bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer',
            selectedFilter === 'PENDING' && 'ring-2 ring-muted-foreground/40 bg-muted/70'
          )}
        >
          <span className="label-mono text-muted-foreground">Pending</span>
          <span className="text-2xl font-display font-semibold text-muted-foreground">{stats.pending}</span>
        </button>
      </CardContent>
    </Card>
  );
}

