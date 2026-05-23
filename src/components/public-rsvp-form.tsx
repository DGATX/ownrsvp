'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { validateGuestLimit } from '@/lib/rsvp-validation';
import { cn } from '@/lib/utils';

interface PublicRsvpFormProps {
  eventId: string;
  slug: string;
  maxGuestsPerInvitee?: number | null;
  prefillData?: {
    name: string | null;
    email: string;
    phone: string | null;
    dietaryNotes: string | null;
    token?: string;
  } | null;
}

export function PublicRsvpForm({ eventId, slug, maxGuestsPerInvitee, prefillData }: PublicRsvpFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Check if email came from a token-based prefill (should be read-only)
  const isEmailFromToken = Boolean(prefillData?.token && prefillData?.email);

  const [formData, setFormData] = useState({
    name: prefillData?.name || '',
    email: prefillData?.email || '',
    phone: prefillData?.phone || '',
    additionalGuests: [] as string[], // Array of additional guest names
    dietaryNotes: prefillData?.dietaryNotes || '',
  });

  // Calculate guest limit validation
  const guestLimitValidation = useMemo(() => {
    if (selectedStatus !== 'ATTENDING') {
      return { valid: true, remaining: Infinity };
    }
    return validateGuestLimit(maxGuestsPerInvitee ?? null, formData.additionalGuests.length);
  }, [maxGuestsPerInvitee, formData.additionalGuests.length, selectedStatus]);

  const canAddMoreGuests = guestLimitValidation.remaining !== undefined && guestLimitValidation.remaining > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStatus) {
      toast({
        title: 'Please select your response',
        description: 'Let us know if you can attend.',
        variant: 'destructive',
      });
      return;
    }

    // Validate guest limit before submission
    if (selectedStatus === 'ATTENDING') {
      const validation = validateGuestLimit(maxGuestsPerInvitee ?? null, formData.additionalGuests.length);
      if (!validation.valid) {
        toast({
          title: 'Too many guests',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          ...formData,
          status: selectedStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit RSVP');
      }

      toast({
        title: 'RSVP Submitted!',
        description: 'Your response has been recorded.',
      });

      // Redirect to event page with email parameter so they can see edit button
      if (slug) {
        window.location.href = `/events/${slug}?email=${encodeURIComponent(formData.email)}`;
      } else {
        setSubmitted(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit RSVP',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="stamp stamp-skew text-primary border-primary mx-auto mb-4 animate-stamp text-sm py-2 px-3">
          <Check className="w-5 h-5" />
          Recorded
        </div>
        <h3 className="text-lg font-semibold mb-2">Thanks for responding!</h3>
        <p className="text-muted-foreground">
          {selectedStatus === 'ATTENDING'
            ? "We're excited to see you there!"
            : selectedStatus === 'MAYBE'
            ? 'We hope you can make it!'
            : 'Sorry you can\'t make it. Maybe next time!'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Response Options */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatus('ATTENDING')}
          data-testid="rsvp-status-attending"
          className={cn(
            'p-4 rounded-[3px] border-2 transition-all flex flex-col items-center gap-2',
            selectedStatus === 'ATTENDING'
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50'
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-[3px] flex items-center justify-center transition-colors',
            selectedStatus === 'ATTENDING' ? 'bg-primary' : 'bg-muted'
          )}>
            <Check className={cn('w-5 h-5', selectedStatus === 'ATTENDING' ? 'text-primary-foreground' : 'text-muted-foreground')} />
          </div>
          <span className={cn('font-medium', selectedStatus === 'ATTENDING' ? 'text-primary' : 'text-muted-foreground')}>
            Attending
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('MAYBE')}
          data-testid="rsvp-status-maybe"
          className={cn(
            'p-4 rounded-[3px] border-2 transition-all flex flex-col items-center gap-2',
            selectedStatus === 'MAYBE'
              ? 'border-accent bg-accent/10'
              : 'border-border hover:border-accent/50'
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-[3px] flex items-center justify-center transition-colors',
            selectedStatus === 'MAYBE' ? 'bg-accent' : 'bg-muted'
          )}>
            <HelpCircle className={cn('w-5 h-5', selectedStatus === 'MAYBE' ? 'text-accent-foreground' : 'text-muted-foreground')} />
          </div>
          <span className={cn('font-medium', selectedStatus === 'MAYBE' ? 'text-accent' : 'text-muted-foreground')}>
            Maybe
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('NOT_ATTENDING')}
          data-testid="rsvp-status-not-attending"
          className={cn(
            'p-4 rounded-[3px] border-2 transition-all flex flex-col items-center gap-2',
            selectedStatus === 'NOT_ATTENDING'
              ? 'border-foreground bg-foreground/5'
              : 'border-border hover:border-foreground/40'
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-[3px] flex items-center justify-center transition-colors',
            selectedStatus === 'NOT_ATTENDING' ? 'bg-foreground' : 'bg-muted'
          )}>
            <X className={cn('w-5 h-5', selectedStatus === 'NOT_ATTENDING' ? 'text-background' : 'text-muted-foreground')} />
          </div>
          <span className={cn('font-medium', selectedStatus === 'NOT_ATTENDING' ? 'text-foreground' : 'text-muted-foreground')}>
            Can&apos;t Go
          </span>
        </button>
      </div>

      {/* Guest Info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="Your name"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={isLoading}
            data-testid="rsvp-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isLoading || isEmailFromToken}
            readOnly={isEmailFromToken}
            className={isEmailFromToken ? 'bg-muted cursor-not-allowed' : ''}
            data-testid="rsvp-email-input"
          />
          {isEmailFromToken && (
            <p className="text-xs text-muted-foreground">
              Email is linked to your invitation and cannot be changed
            </p>
          )}
        </div>
      </div>

      {/* Phone Number */}
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number (optional, for SMS updates)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={formData.phone}
          onChange={handleChange}
          disabled={isLoading}
          data-testid="rsvp-phone-input"
        />
      </div>

      {selectedStatus === 'ATTENDING' && (
        <>
          {/* Additional Guests */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Additional Guests</Label>
              {maxGuestsPerInvitee !== null && (
                <span className="text-xs text-muted-foreground">
                  {guestLimitValidation.remaining === Infinity
                    ? 'Unlimited'
                    : `${guestLimitValidation.remaining} guest${guestLimitValidation.remaining !== 1 ? 's' : ''} remaining`}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {(maxGuestsPerInvitee === null || maxGuestsPerInvitee === undefined)
                ? "Add the names of any additional guests you're bringing"
                : `You can bring up to ${maxGuestsPerInvitee - 1} additional guest${maxGuestsPerInvitee - 1 !== 1 ? 's' : ''} (total of ${maxGuestsPerInvitee} including yourself)`}
            </p>
            {formData.additionalGuests.map((guestName, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Guest ${index + 1} name`}
                  value={guestName}
                  onChange={(e) => {
                    const newGuests = [...formData.additionalGuests];
                    newGuests[index] = e.target.value;
                    setFormData({ ...formData, additionalGuests: newGuests });
                  }}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const newGuests = formData.additionalGuests.filter((_, i) => i !== index);
                    setFormData({ ...formData, additionalGuests: newGuests });
                  }}
                  disabled={isLoading}
                  data-testid={`rsvp-remove-guest-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  ...formData,
                  additionalGuests: [...formData.additionalGuests, ''],
                });
              }}
              disabled={isLoading || !canAddMoreGuests}
              className="w-full"
              data-testid="rsvp-add-guest-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Guest
            </Button>
            {!canAddMoreGuests && maxGuestsPerInvitee !== null && maxGuestsPerInvitee !== undefined && (
              <p className="text-xs text-accent">
                You&apos;ve reached the maximum number of guests allowed ({maxGuestsPerInvitee} total including yourself)
              </p>
            )}
          </div>

          {/* Dietary Notes */}
          <div className="space-y-2">
            <Label htmlFor="dietaryNotes">Dietary restrictions or notes (optional)</Label>
            <Textarea
              id="dietaryNotes"
              name="dietaryNotes"
              placeholder="Any allergies or dietary restrictions..."
              value={formData.dietaryNotes}
              onChange={handleChange}
              rows={2}
              disabled={isLoading}
              data-testid="rsvp-dietary-input"
            />
          </div>
        </>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={isLoading || !selectedStatus} data-testid="rsvp-submit-button">
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Submit RSVP
      </Button>
    </form>
  );
}

