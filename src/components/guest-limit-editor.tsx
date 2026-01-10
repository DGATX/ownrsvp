'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Edit, Save, X, Users, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface GuestLimitEditorProps {
  eventId: string;
  maxGuestsPerInvitee: number | null | undefined;
}

type LimitMode = 'global' | 'individual';

export function GuestLimitEditor({ eventId, maxGuestsPerInvitee: initialMaxGuestsPerInvitee }: GuestLimitEditorProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [limitMode, setLimitMode] = useState<LimitMode>('global');
  const normalizedInitial = initialMaxGuestsPerInvitee ?? null;
  const [maxGuestsPerInvitee, setMaxGuestsPerInvitee] = useState<number | null>(normalizedInitial);
  const [unlimitedGuests, setUnlimitedGuests] = useState(normalizedInitial === null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxGuestsPerInvitee: unlimitedGuests ? null : maxGuestsPerInvitee,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update guest limit');
      }

      toast({
        title: 'Guest limit updated',
        description: unlimitedGuests 
          ? 'Guests can now bring unlimited additional guests.'
          : `Each invitee can now bring up to ${maxGuestsPerInvitee! - 1} additional guest${maxGuestsPerInvitee! - 1 !== 1 ? 's' : ''}.`,
      });

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      logger.error('Update guest limit error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update guest limit',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setMaxGuestsPerInvitee(initialMaxGuestsPerInvitee ?? null);
    setUnlimitedGuests(initialMaxGuestsPerInvitee === null || initialMaxGuestsPerInvitee === undefined);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Limit Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={limitMode === 'global' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLimitMode('global')}
                disabled={isSaving}
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-2" />
                Apply to all
              </Button>
              <Button
                type="button"
                variant={limitMode === 'individual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLimitMode('individual')}
                disabled={isSaving}
                className="flex-1"
              >
                <User className="w-4 h-4 mr-2" />
                Individual limits
              </Button>
            </div>
          </div>

          {limitMode === 'global' && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="unlimitedGuests"
                  checked={unlimitedGuests}
                  onCheckedChange={(checked) => {
                    setUnlimitedGuests(checked as boolean);
                    if (checked) {
                      setMaxGuestsPerInvitee(null);
                    } else {
                      setMaxGuestsPerInvitee(maxGuestsPerInvitee || 2);
                    }
                  }}
                  disabled={isSaving}
                />
                <Label
                  htmlFor="unlimitedGuests"
                  className="text-sm font-normal cursor-pointer"
                >
                  Unlimited guests allowed
                </Label>
              </div>
              {!unlimitedGuests && (
                <div className="space-y-2 pl-6">
                  <Input
                    type="number"
                    min="1"
                    value={maxGuestsPerInvitee || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : null;
                      setMaxGuestsPerInvitee(value);
                    }}
                    disabled={isSaving}
                    placeholder="2"
                    className="max-w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit the total number of guests each invitee can bring (including themselves). 
                    Example: Limit of 2 = invitee + 1 additional guest.
                  </p>
                </div>
              )}
            </div>
          )}

          {limitMode === 'individual' && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Individual limits can be set for each guest in the guest list below. 
                Click the edit icon next to any guest to set their custom limit.
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={limitMode === 'global' ? handleSave : () => setIsEditing(false)}
            disabled={isSaving || (limitMode === 'global' && !unlimitedGuests && (!maxGuestsPerInvitee || maxGuestsPerInvitee < 1))}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {limitMode === 'global' ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Close
                  </>
                )}
              </>
            )}
          </Button>
          {limitMode === 'global' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  const displayValue = maxGuestsPerInvitee ?? null;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
      <div className="flex-1">
        <Label className="text-sm font-medium">Guest Limit Per Invitee</Label>
        <p className="text-sm text-muted-foreground mt-1">
          {displayValue === null
            ? 'Unlimited guests allowed'
            : `Each invitee can bring up to ${displayValue - 1} additional guest${displayValue - 1 !== 1 ? 's' : ''} (total of ${displayValue} including themselves)`}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsEditing(true)}
        className="gap-2"
      >
        <Edit className="w-4 h-4" />
        Edit
      </Button>
    </div>
  );
}

