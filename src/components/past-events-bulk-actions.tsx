'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/utils';
import { EventCardActions } from '@/components/event-card-actions';

interface PastEvent {
  id: string;
  title: string;
  date: Date;
  coverImage?: string | null;
  host: {
    name: string | null;
    email: string;
  };
  isCoHost?: boolean;
  canManage: boolean;
  guests: Array<{
    id: string;
    status: string;
    additionalGuests: Array<{ id: string }>;
  }>;
}

interface PastEventsBulkActionsProps {
  events: PastEvent[];
  isAdmin?: boolean;
}

export function PastEventsBulkActions({ events: initialEvents, isAdmin = false }: PastEventsBulkActionsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Filter to only events user can manage
  const manageableEvents = events.filter(e => e.canManage);

  const handleSelectEvent = (eventId: string, checked: boolean) => {
    setSelectedEvents((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(eventId);
      } else {
        newSet.delete(eventId);
      }
      return newSet;
    });
  };

  const handleDeleteAll = async () => {
    if (manageableEvents.length === 0) {
      toast({
        title: 'No events to delete',
        description: 'You have no past events that you can manage.',
        variant: 'destructive',
      });
      return;
    }

    // Set all manageable events as selected and open delete dialog
    setSelectedEvents(new Set(manageableEvents.map((e) => e.id)));
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedEvents.size === 0) {
      toast({
        title: 'No events selected',
        description: 'Please select at least one event to delete.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    setIsBulkDeleting(true);

    try {
      const response = await fetch('/api/events/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: Array.from(selectedEvents),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete events');
      }

      if (data.failedCount > 0) {
        toast({
          title: 'Partial success',
          description: `${data.successCount} event(s) deleted, ${data.failedCount} failed. ${data.errors?.join(' ') || ''}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Events deleted',
          description: `${data.successCount} event(s) have been deleted.`,
        });
      }

      setIsDeleteDialogOpen(false);
      setSelectedEvents(new Set());
      
      // Refresh the page to update the list
      router.refresh();
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete events',
        variant: 'destructive',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };


  if (events.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-muted-foreground">
          Past Events
        </h2>
        {manageableEvents.length > 0 && (
          <div className="flex items-center gap-2">
            {selectedEvents.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedEvents.size} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="gap-2"
                >
                  {isBulkDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Selected
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAll}
              disabled={isBulkDeleting}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete All Past Events
            </Button>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => {
          const attendingGuests = event.guests.filter((g) => g.status === 'ATTENDING');
          const attending = attendingGuests.reduce((sum: number, guest) => sum + 1 + (guest.additionalGuests?.length || 0), 0);
          const isSelected = selectedEvents.has(event.id);
          const showCheckbox = event.canManage;

          return (
            <Card 
              key={event.id} 
              className={`h-full opacity-75 hover:opacity-100 hover:shadow-lg transition-all overflow-hidden flex flex-col relative ${
                isSelected ? 'ring-2 ring-violet-500' : ''
              }`}
            >
              {showCheckbox && (
                <div className="absolute top-3 left-3 z-20">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectEvent(event.id, checked as boolean)}
                    disabled={isBulkDeleting}
                    className="h-5 w-5 bg-white border-2 shadow-sm"
                  />
                </div>
              )}
              <EventCardActions eventId={event.id} eventTitle={event.title} canManage={event.canManage} />
              <Link href={`/dashboard/events/${event.id}`} className="flex-1">
                {event.coverImage && (
                  <div className="w-full h-40 overflow-hidden">
                    <img
                      src={event.coverImage}
                      alt={event.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <CardHeader className={`pb-2 ${showCheckbox ? 'pl-12' : ''}`}>
                  <CardTitle className="text-lg line-clamp-1 pr-8">{event.title}</CardTitle>
                  <CardDescription>
                    {formatDate(event.date)}
                    {(isAdmin || event.isCoHost) && event.host && (
                      <span className="block text-xs mt-1">Host: {event.host.name || event.host.email}</span>
                    )}
                    {event.isCoHost && (
                      <Badge variant="secondary" className="mt-1 text-xs">Co-host</Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-sm">
                    <Users className="w-4 h-4" />
                    <span>{attending} attended</span>
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Selected Events?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''}? 
              This action cannot be undone. All associated guests, comments, and data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          {selectedEvents.size <= 10 && (
            <div className="max-h-48 overflow-y-auto border rounded-md p-3 bg-muted/50">
              <p className="text-sm font-medium mb-2">Events to be deleted:</p>
              <ul className="text-sm space-y-1">
                {Array.from(selectedEvents).map((eventId) => {
                  const event = events.find((e) => e.id === eventId);
                  return (
                    <li key={eventId} className="text-muted-foreground">
                      • {event?.title || eventId}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={isBulkDeleting}
              className="gap-2"
            >
              {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete {selectedEvents.size} Event{selectedEvents.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

