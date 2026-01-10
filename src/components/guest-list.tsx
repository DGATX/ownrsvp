'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Trash2, Send, Clock, Loader2, Phone, Edit, Users, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { EditGuestForm } from '@/components/edit-guest-form';
import { SendInvitationDialog } from '@/components/send-invitation-dialog';
import { PerGuestLimitEditor } from '@/components/per-guest-limit-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  dietaryNotes?: string | null;
  additionalGuests?: AdditionalGuest[];
  maxGuests?: number | null;
}

interface GuestListProps {
  guests: Guest[];
  eventId: string;
  filterStatus?: string | null;
  globalMaxGuests?: number | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
  ATTENDING: { label: 'Attending', className: 'bg-green-100 text-green-700' },
  NOT_ATTENDING: { label: 'Not Attending', className: 'bg-red-100 text-red-700' },
  MAYBE: { label: 'Maybe', className: 'bg-amber-100 text-amber-700' },
};

export function GuestList({ guests, eventId, filterStatus, globalMaxGuests }: GuestListProps) {
  // Filter guests by status if filter is provided
  const filteredGuests = filterStatus
    ? guests.filter((guest) => guest.status === filterStatus)
    : guests;
  const router = useRouter();
  const { toast } = useToast();
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>({});
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [inviteDialogGuest, setInviteDialogGuest] = useState<Guest | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [editingLimitGuestId, setEditingLimitGuestId] = useState<string | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  const setLoading = (guestId: string, action: string) => {
    setLoadingStates((prev) => ({ ...prev, [guestId]: action }));
  };

  const clearLoading = (guestId: string) => {
    setLoadingStates((prev) => {
      const newState = { ...prev };
      delete newState[guestId];
      return newState;
    });
  };

  const openInviteDialog = (guest: Guest) => {
    setInviteDialogGuest(guest);
  };

  const sendReminder = async (guestId: string) => {
    setLoading(guestId, 'remind');
    try {
      const response = await fetch(`/api/events/${eventId}/guests/${guestId}/remind`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }

      toast({
        title: 'Reminder sent!',
        description: 'The guest will receive a reminder email.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to send reminder',
        variant: 'destructive',
      });
    } finally {
      clearLoading(guestId);
    }
  };

  const deleteGuest = async (guestId: string) => {
    if (!confirm('Are you sure you want to remove this guest?')) return;

    setLoading(guestId, 'delete');
    try {
      const response = await fetch(`/api/events/${eventId}/guests/${guestId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove guest');
      }

      toast({
        title: 'Guest removed',
        description: 'The guest has been removed from the list.',
      });

      // Refresh the page to update the list
      router.refresh();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove guest',
        variant: 'destructive',
      });
    } finally {
      clearLoading(guestId);
    }
  };

  // Bulk operations
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGuests(new Set(filteredGuests.map((g) => g.id)));
    } else {
      setSelectedGuests(new Set());
    }
  };

  const handleSelectGuest = (guestId: string, checked: boolean) => {
    const newSelected = new Set(selectedGuests);
    if (checked) {
      newSelected.add(guestId);
    } else {
      newSelected.delete(guestId);
    }
    setSelectedGuests(newSelected);
  };

  const handleBulkAction = async (action: 'invite' | 'remind' | 'delete' | 'changeStatus', status?: string) => {
    if (selectedGuests.size === 0) return;

    if (action === 'delete' && !confirm(`Are you sure you want to delete ${selectedGuests.size} guest(s)?`)) {
      return;
    }

    setIsBulkLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/guests/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          guestIds: Array.from(selectedGuests),
          ...(status && { status }),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process bulk operation');
      }

      const result = await response.json();

      if (result.failedCount > 0) {
        toast({
          title: 'Bulk operation completed with errors',
          description: `${result.successCount} succeeded, ${result.failedCount} failed.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Bulk operation successful',
          description: `${result.successCount} guest(s) processed.`,
        });
      }

      // Clear selection and refresh
      setSelectedGuests(new Set());
      router.refresh();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to process bulk operation',
        variant: 'destructive',
      });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const allSelected = filteredGuests.length > 0 && selectedGuests.size === filteredGuests.length;
  const someSelected = selectedGuests.size > 0 && selectedGuests.size < filteredGuests.length;

  // Early returns for empty states
  if (guests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No guests added yet.</p>
        <p className="text-sm">Add guests using the form above.</p>
      </div>
    );
  }

  if (filteredGuests.length === 0 && filterStatus) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No guests in this category.</p>
        <p className="text-sm">Click on a different category in the RSVP Summary.</p>
      </div>
    );
  }

  const toggleBulkSelectMode = () => {
    if (bulkSelectMode) {
      // Turning off - clear selections
      setSelectedGuests(new Set());
    }
    setBulkSelectMode(!bulkSelectMode);
  };

  // Main render
  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
      {/* Bulk Select Toggle */}
      {filteredGuests.length > 0 && (
        <div className="flex items-center justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleBulkSelectMode}
            className="gap-2"
          >
            {bulkSelectMode ? (
              <>
                <Square className="w-4 h-4" />
                Exit Bulk Select
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                Bulk Select
              </>
            )}
          </Button>
        </div>
      )}

      {/* Bulk Actions Toolbar */}
      {selectedGuests.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {selectedGuests.size} guest{selectedGuests.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('invite')}
              disabled={isBulkLoading}
            >
              <Send className="w-4 h-4 mr-2" />
              Send Invitations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('remind')}
              disabled={isBulkLoading}
            >
              <Clock className="w-4 h-4 mr-2" />
              Send Reminders
            </Button>
            <Select
              onValueChange={(value) => handleBulkAction('changeStatus', value)}
              disabled={isBulkLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Change Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ATTENDING">Attending</SelectItem>
                <SelectItem value="NOT_ATTENDING">Not Attending</SelectItem>
                <SelectItem value="MAYBE">Maybe</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleBulkAction('delete')}
              disabled={isBulkLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedGuests(new Set())}
              disabled={isBulkLoading}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Guest List Header */}
      {filteredGuests.length > 0 && bulkSelectMode && (
        <div className="flex items-center gap-3 py-4 border-b">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            className="h-4 w-4 shrink-0"
          />
          <span className="text-sm font-medium text-muted-foreground">Select All</span>
        </div>
      )}

      <div className="divide-y">
        {filteredGuests.map((guest) => {
        const isLoading = !!loadingStates[guest.id];
        const loadingAction = loadingStates[guest.id];

        return (
          <div key={guest.id} className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {bulkSelectMode && (
                <Checkbox
                  checked={selectedGuests.has(guest.id)}
                  onCheckedChange={(checked) => handleSelectGuest(guest.id, checked as boolean)}
                  disabled={isBulkLoading}
                  className="h-4 w-4 shrink-0"
                />
              )}
              {!bulkSelectMode && <div className="w-4 shrink-0" />}
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-violet-100 text-violet-700">
                  {(guest.name || guest.email).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {guest.name || guest.email}
                </p>
                {guest.name && (
                  <p className="text-sm text-muted-foreground truncate">{guest.email}</p>
                )}
                {guest.phone && (
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {guest.phone}
                  </p>
                )}
                {guest.additionalGuests && guest.additionalGuests.length > 0 && (
                  <div className="text-sm text-muted-foreground mt-1">
                    <p className="font-medium mb-1">Additional Guests:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {guest.additionalGuests.map((ag) => (
                        <li key={ag.id}>{ag.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {guest.maxGuests !== null && guest.maxGuests !== undefined && (
                  <div className="text-xs mt-1">
                    <Badge variant="outline" className="text-xs py-0">
                      Custom limit: {guest.maxGuests - 1} additional guest{guest.maxGuests - 1 !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                )}
                <div className="flex gap-1 mt-1">
                  {guest.notifyByEmail && (
                    <Badge variant="outline" className="text-xs py-0">
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Badge>
                  )}
                  {guest.notifyBySms && guest.phone && (
                    <Badge variant="outline" className="text-xs py-0">
                      <Phone className="w-3 h-3 mr-1" />
                      SMS
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={cn('shrink-0 w-[110px] justify-center text-center', statusConfig[guest.status].className)} variant="secondary">
                {statusConfig[guest.status].label}
              </Badge>
              <div className="flex gap-1">
                {/* Send Invitation / Resend Link button - available for all guests */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openInviteDialog(guest)}
                      disabled={isLoading}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-base font-medium">
                    <p>{guest.status === 'PENDING' ? 'Send Invitation' : 'Resend Invite Link'}</p>
                  </TooltipContent>
                </Tooltip>
                {/* Send Reminder button - only for PENDING guests who haven't received a reminder */}
                {guest.status === 'PENDING' && guest.reminderSentAt === null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => sendReminder(guest.id)}
                        disabled={isLoading}
                      >
                        {loadingAction === 'remind' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-base font-medium">
                      <p>Send Reminder</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingLimitGuestId(guest.id)}
                      disabled={isLoading}
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-base font-medium">
                    <p>Edit Guest Limit</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingGuestId(guest.id)}
                      disabled={isLoading}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-base font-medium">
                    <p>Edit Guest</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteGuest(guest.id)}
                      disabled={isLoading}
                      className="text-destructive hover:text-destructive"
                    >
                      {loadingAction === 'delete' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-base font-medium">
                    <p>Remove Guest</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        );
      })}
      </div>
      {editingGuestId && (
        <EditGuestForm
          eventId={eventId}
          guest={guests.find((g) => g.id === editingGuestId)!}
          open={!!editingGuestId}
          onOpenChange={(open) => {
            if (!open) setEditingGuestId(null);
          }}
          onSuccess={() => {
            setEditingGuestId(null);
            router.refresh();
          }}
        />
      )}

      {editingLimitGuestId && (
        <PerGuestLimitEditor
          eventId={eventId}
          guestId={editingLimitGuestId}
          guestName={guests.find((g) => g.id === editingLimitGuestId)?.name || guests.find((g) => g.id === editingLimitGuestId)?.email || 'Guest'}
          currentMaxGuests={guests.find((g) => g.id === editingLimitGuestId)?.maxGuests}
          globalMaxGuests={globalMaxGuests}
          open={!!editingLimitGuestId}
          onOpenChange={(open) => !open && setEditingLimitGuestId(null)}
        />
      )}
      
      {inviteDialogGuest && (
        <SendInvitationDialog
          open={!!inviteDialogGuest}
          onOpenChange={(open) => !open && setInviteDialogGuest(null)}
          guestId={inviteDialogGuest.id}
          eventId={eventId}
          guestEmail={inviteDialogGuest.email}
          guestPhone={inviteDialogGuest.phone}
          guestName={inviteDialogGuest.name}
          guestStatus={inviteDialogGuest.status}
        />
      )}
      </div>
    </TooltipProvider>
  );
}

