'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SendInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  eventId: string;
  guestEmail: string;
  guestPhone: string | null;
  guestName: string | null;
  guestStatus?: string;
}

export function SendInvitationDialog({
  open,
  onOpenChange,
  guestId,
  eventId,
  guestEmail,
  guestName,
  guestStatus = 'PENDING',
}: SendInvitationDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/guests/${guestId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyByEmail: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      const isResend = guestStatus !== 'PENDING';
      toast({
        title: isResend ? 'Invite link resent!' : 'Invitation sent!',
        description: `${isResend ? 'Invite link' : 'Invitation'} sent via email.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {guestStatus === 'PENDING' ? 'Send Invitation' : 'Resend Invite Link'}
          </DialogTitle>
          <DialogDescription>
            {guestStatus === 'PENDING'
              ? `Send an invitation email to ${guestName || guestEmail}.`
              : `Resend the invite link to ${guestName || guestEmail}. They can use this link to view or edit their RSVP.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {guestStatus === 'PENDING' ? 'Send Invitation' : 'Resend Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
