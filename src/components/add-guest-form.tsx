'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2, Mail, Phone } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface AddGuestFormProps {
  eventId: string;
}

export function AddGuestForm({ eventId }: AddGuestFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [notifyBySms, setNotifyBySms] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (sendInvite && !notifyByEmail && !notifyBySms) {
      toast({
        title: 'Please select a delivery method',
        description: 'Choose email, SMS, or both to send the invitation.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/guests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone: phone || undefined,
          name,
          notifyByEmail,
          notifyBySms,
          sendInvite,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add guest');
      }

      const notifications = [];
      if (sendInvite && notifyByEmail) notifications.push('email');
      if (sendInvite && notifyBySms && phone) notifications.push('SMS');

      toast({
        title: 'Guest added!',
        description: notifications.length > 0
          ? `Invitation sent via ${notifications.join(' and ')}.`
          : 'The guest has been added to the list.',
      });

      setOpen(false);
      setEmail('');
      setPhone('');
      setName('');
      setNotifyByEmail(true);
      setNotifyBySms(false);

      // Refresh to show new guest
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add guest',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Guest
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Guest</DialogTitle>
            <DialogDescription>
              Add a guest to your event. You can send invitations via email and/or SMS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Guest name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="guest@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (for SMS)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Include country code for international numbers
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Send Invitation Via</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Choose how to send the invitation. You can select email, SMS, or both.
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="notifyByEmail"
                  checked={notifyByEmail}
                  onChange={(e) => setNotifyByEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={isLoading}
                />
                <Label htmlFor="notifyByEmail" className="text-sm font-normal flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="notifyBySms"
                  checked={notifyBySms}
                  onChange={(e) => setNotifyBySms(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={isLoading || !phone}
                />
                <Label htmlFor="notifyBySms" className="text-sm font-normal flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  SMS
                  {!phone && <span className="text-xs text-muted-foreground">(add phone number)</span>}
                </Label>
              </div>
              {!notifyByEmail && !notifyBySms && sendInvite && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Please select at least one method to send the invitation.
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="sendInvite"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isLoading}
              />
              <Label htmlFor="sendInvite" className="text-sm font-normal">
                Send invitation immediately
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Guest
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
