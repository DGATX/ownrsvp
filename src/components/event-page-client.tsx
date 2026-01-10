'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Calendar } from 'lucide-react';
import Link from 'next/link';
import { EventGuestSection } from '@/components/event-guest-section';
import { RsvpSummary } from '@/components/rsvp-summary';

interface AdditionalGuest {
  id: string;
  name: string;
}

interface Guest {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  status: string;
  notifyByEmail: boolean;
  notifyBySms: boolean;
  invitedAt: Date;
  respondedAt: Date | null;
  reminderSentAt: Date | null;
  additionalGuests?: AdditionalGuest[];
}

interface Comment {
  id: string;
  authorName: string;
  content: string;
  createdAt: Date;
}

interface EventPageClientProps {
  eventId: string;
  eventSlug: string;
  guests: Guest[];
  comments: Comment[];
  stats: {
    total: number;
    attending: number;
    notAttending: number;
    maybe: number;
    pending: number;
  };
  maxGuestsPerInvitee?: number | null;
}

export function EventPageClient({ eventId, eventSlug, guests, comments, stats, maxGuestsPerInvitee }: EventPageClientProps) {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        <EventGuestSection
          eventId={eventId}
          guests={guests}
          comments={comments}
          stats={stats}
          filterStatus={selectedFilter}
          maxGuestsPerInvitee={maxGuestsPerInvitee}
        />
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-6">
        {/* RSVP Stats */}
        <RsvpSummary stats={stats} selectedFilter={selectedFilter} onFilterChange={setSelectedFilter} />

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/events/${eventSlug}`} target="_blank" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <LinkIcon className="w-4 h-4" />
                View Public Page
              </Button>
            </Link>
            <Link href={`/dashboard/events/${eventId}/edit`} className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Calendar className="w-4 h-4" />
                Edit Event Details
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

