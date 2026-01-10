'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mail, Phone, Loader2 } from 'lucide-react';
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
  guestPhone,
  guestName,
  guestStatus = 'PENDING',
}: SendInvitationDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [notifyBySms, setNotifyBySms] = useState(false);

  const handleSend = async () => {
    if (!notifyByEmail && !notifyBySms) {
      toast({
        title: 'Please select a delivery method',
        description: 'Choose email, SMS, or both to send the invitation.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/guests/${guestId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyByEmail,
          notifyBySms: notifyBySms && !!guestPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      const notifications = [];
      if (notifyByEmail) notifications.push('email');
      if (notifyBySms && guestPhone) notifications.push('SMS');

      const isResend = guestStatus !== 'PENDING';
      toast({
        title: isResend ? 'Invite link resent!' : 'Invitation sent!',
        description: `${isResend ? 'Invite link' : 'Invitation'} sent via ${notifications.join(' and ')}.`,
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
              ? `Choose how to send the invitation to ${guestName || guestEmail}.`
              : `Resend the invite link to ${guestName || guestEmail}. They can use this link to view or edit their RSVP.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-medium">Send Via</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select email, SMS, or both to send the invitation.
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="inviteEmail"
                checked={notifyByEmail}
                onChange={(e) => setNotifyByEmail(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isLoading}
              />
              <Label htmlFor="inviteEmail" className="text-sm font-normal flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="inviteSms"
                checked={notifyBySms}
                onChange={(e) => setNotifyBySms(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isLoading || !guestPhone}
              />
              <Label htmlFor="inviteSms" className="text-sm font-normal flex items-center gap-2">
                <Phone className="w-4 h-4" />
                SMS
                {!guestPhone && <span className="text-xs text-muted-foreground">(no phone number)</span>}
              </Label>
            </div>
            {!notifyByEmail && !notifyBySms && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Please select at least one method.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isLoading || (!notifyByEmail && !notifyBySms)}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {guestStatus === 'PENDING' ? 'Send Invitation' : 'Resend Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

