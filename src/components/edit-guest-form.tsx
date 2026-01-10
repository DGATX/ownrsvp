'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, Phone, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface AdditionalGuest {
  id: string;
  name: string;
}

interface Guest {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: string;
  dietaryNotes?: string | null;
  notifyByEmail: boolean;
  notifyBySms: boolean;
  additionalGuests?: AdditionalGuest[];
}

interface EditGuestFormProps {
  eventId: string;
  guest: Guest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditGuestForm({ eventId, guest, open, onOpenChange, onSuccess }: EditGuestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(guest.name || '');
  const [email, setEmail] = useState(guest.email);
  const [phone, setPhone] = useState(guest.phone || '');
  const [status, setStatus] = useState(guest.status);
  const [dietaryNotes, setDietaryNotes] = useState(guest.dietaryNotes || '');
  const [notifyByEmail, setNotifyByEmail] = useState(guest.notifyByEmail);
  const [notifyBySms, setNotifyBySms] = useState(guest.notifyBySms);
  const [additionalGuests, setAdditionalGuests] = useState<string[]>(
    guest.additionalGuests?.map((ag) => ag.name) || []
  );

  // Reset form when guest changes
  useEffect(() => {
    if (open) {
      setName(guest.name || '');
      setEmail(guest.email);
      setPhone(guest.phone || '');
      setStatus(guest.status);
      setDietaryNotes(guest.dietaryNotes || '');
      setNotifyByEmail(guest.notifyByEmail);
      setNotifyBySms(guest.notifyBySms);
      setAdditionalGuests(guest.additionalGuests?.map((ag) => ag.name) || []);
    }
  }, [guest, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/guests/${guest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          email: email !== guest.email ? email : undefined,
          phone: phone || null,
          status,
          dietaryNotes: dietaryNotes || null,
          additionalGuests: additionalGuests.filter((g) => g.trim().length > 0),
          notifyByEmail,
          notifyBySms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update guest');
      }

      toast({
        title: 'Guest updated!',
        description: 'The guest information has been updated.',
      });

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update guest',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Guest</DialogTitle>
            <DialogDescription>
              Update guest information, RSVP status, and additional guests.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid sm:grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">RSVP Status</Label>
              <Select value={status} onValueChange={(value: typeof status) => setStatus(value)} disabled={isLoading}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ATTENDING">Attending</SelectItem>
                  <SelectItem value="MAYBE">Maybe</SelectItem>
                  <SelectItem value="NOT_ATTENDING">Not Attending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {status === 'ATTENDING' && (
              <>
                <div className="space-y-3">
                  <Label>Additional Guests</Label>
                  <p className="text-sm text-muted-foreground">
                    Add the names of any additional guests
                  </p>
                  {additionalGuests.map((guestName, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Guest ${index + 1} name`}
                        value={guestName}
                        onChange={(e) => {
                          const newGuests = [...additionalGuests];
                          newGuests[index] = e.target.value;
                          setAdditionalGuests(newGuests);
                        }}
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setAdditionalGuests(additionalGuests.filter((_, i) => i !== index));
                        }}
                        disabled={isLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAdditionalGuests([...additionalGuests, '']);
                    }}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Guest
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dietaryNotes">Dietary Restrictions or Notes</Label>
                  <Textarea
                    id="dietaryNotes"
                    placeholder="Any allergies or dietary restrictions..."
                    value={dietaryNotes}
                    onChange={(e) => setDietaryNotes(e.target.value)}
                    rows={2}
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Notification Preferences</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifyByEmail"
                  checked={notifyByEmail}
                  onCheckedChange={(checked) => setNotifyByEmail(!!checked)}
                  disabled={isLoading}
                />
                <Label htmlFor="notifyByEmail" className="text-sm font-normal flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email notifications
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifyBySms"
                  checked={notifyBySms}
                  onCheckedChange={(checked) => setNotifyBySms(!!checked)}
                  disabled={isLoading || !phone}
                />
                <Label htmlFor="notifyBySms" className="text-sm font-normal flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  SMS notifications
                  {!phone && <span className="text-xs text-muted-foreground">(add phone number)</span>}
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Guest
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

