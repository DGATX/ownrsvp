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
      <CardContent className="space-y-4">
        <button
          onClick={() => handleCardClick('ATTENDING')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors cursor-pointer',
            selectedFilter === 'ATTENDING' && 'ring-2 ring-green-500 bg-green-100'
          )}
        >
          <span className="text-green-700 font-medium">Attending</span>
          <span className="text-2xl font-bold text-green-700">{stats.attending}</span>
        </button>
        <button
          onClick={() => handleCardClick('MAYBE')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer',
            selectedFilter === 'MAYBE' && 'ring-2 ring-amber-500 bg-amber-100'
          )}
        >
          <span className="text-amber-700 font-medium">Maybe</span>
          <span className="text-2xl font-bold text-amber-700">{stats.maybe}</span>
        </button>
        <button
          onClick={() => handleCardClick('NOT_ATTENDING')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors cursor-pointer',
            selectedFilter === 'NOT_ATTENDING' && 'ring-2 ring-red-500 bg-red-100'
          )}
        >
          <span className="text-red-700 font-medium">Not Attending</span>
          <span className="text-2xl font-bold text-red-700">{stats.notAttending}</span>
        </button>
        <button
          onClick={() => handleCardClick('PENDING')}
          className={cn(
            'w-full flex justify-between items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer',
            selectedFilter === 'PENDING' && 'ring-2 ring-gray-500 bg-gray-100'
          )}
        >
          <span className="text-gray-700 font-medium">Pending</span>
          <span className="text-2xl font-bold text-gray-700">{stats.pending}</span>
        </button>
      </CardContent>
    </Card>
  );
}

