'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuestList } from '@/components/guest-list';
import { AddGuestForm } from '@/components/add-guest-form';
import { EventComments } from '@/components/event-comments';
import { PublicCommentForm } from '@/components/public-comment-form';
import { ImportGuestsDialog } from '@/components/import-guests-dialog';
import { BroadcastDialog } from '@/components/broadcast-dialog';
import { GuestLimitEditor } from '@/components/guest-limit-editor';
import { Download, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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

interface EventGuestSectionProps {
  eventId: string;
  guests: Guest[];
  comments: Comment[];
  stats: {
    total: number;
    attending: number;
    notAttending: number;
    maybe: number;
    pending: number;
  };
  filterStatus: string | null;
  maxGuestsPerInvitee?: number | null;
}

export function EventGuestSection({ eventId, guests, comments, stats, filterStatus, maxGuestsPerInvitee }: EventGuestSectionProps) {
  const { toast } = useToast();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/guests/export`);
      if (!response.ok) throw new Error('Failed to export');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'guests.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Export successful',
        description: 'Guest list has been downloaded.',
      });
    } catch {
      toast({
        title: 'Export failed',
        description: 'Could not export guest list.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Guest List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg">Guests ({stats.total})</CardTitle>
              <CardDescription>Manage your guest list and send invitations</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <BroadcastDialog eventId={eventId} stats={stats} />
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <AddGuestForm eventId={eventId} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <GuestLimitEditor eventId={eventId} maxGuestsPerInvitee={maxGuestsPerInvitee ?? null} />
          <GuestList guests={guests} eventId={eventId} filterStatus={filterStatus} globalMaxGuests={maxGuestsPerInvitee} />
        </CardContent>
      </Card>

      {/* Guest Wall */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Guest Wall</CardTitle>
          <CardDescription>Messages from your guests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PublicCommentForm eventId={eventId} />
          <div className="border-t pt-4">
            <EventComments comments={comments} />
          </div>
        </CardContent>
      </Card>

      <ImportGuestsDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        eventId={eventId}
      />
    </div>
  );
}

