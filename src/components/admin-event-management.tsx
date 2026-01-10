'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Trash2, Calendar, Users, CheckSquare, Square, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface Event {
  id: string;
  title: string;
  date: Date;
  host: {
    name: string | null;
    email: string;
  };
  _count: {
    guests: number;
  };
}

interface AdminEventManagementProps {
  events: Event[];
}

export function AdminEventManagement({ events: initialEvents }: AdminEventManagementProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Refresh events when component mounts or after operations
  useEffect(() => {
    router.refresh();
  }, [router]);

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEvents(new Set(events.map((e) => e.id)));
    } else {
      setSelectedEvents(new Set());
    }
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
      const response = await fetch('/api/admin/events/bulk-delete', {
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

  const handleDeleteSingle = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete event');
      }

      toast({
        title: 'Event deleted',
        description: `"${eventTitle}" has been deleted.`,
      });

      // Refresh the page
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete event',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const allSelected = events.length > 0 && selectedEvents.size === events.length;
  const someSelected = selectedEvents.size > 0 && selectedEvents.size < events.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Past Events Management
              </CardTitle>
              <CardDescription>
                Manage and delete past events. Only past events (date &lt; today) are shown here.
              </CardDescription>
            </div>
            {selectedEvents.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''} selected
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
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No past events found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-2 py-2 border-b">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="h-4 w-4 shrink-0"
                />
                <span className="text-sm font-medium text-muted-foreground">
                  Select All ({events.length} events)
                </span>
              </div>

              {/* Events Table */}
              <div className="divide-y">
                {events.map((event) => {
                  const isSelected = selectedEvents.has(event.id);

                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 px-2 py-4 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectEvent(event.id, checked as boolean)}
                        disabled={isLoading}
                        className="h-4 w-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{event.title}</h3>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(event.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {event._count.guests} guest{event._count.guests !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs">
                                Host: {event.host.name || event.host.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Link href={`/dashboard/events/${event.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSingle(event.id, event.title)}
                              disabled={isLoading}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}

