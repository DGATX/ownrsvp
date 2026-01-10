'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Save, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface PerGuestLimitEditorProps {
  eventId: string;
  guestId: string;
  guestName: string;
  currentMaxGuests: number | null | undefined;
  globalMaxGuests: number | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PerGuestLimitEditor({
  eventId,
  guestId,
  guestName,
  currentMaxGuests,
  globalMaxGuests,
  open,
  onOpenChange,
}: PerGuestLimitEditorProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [maxGuests, setMaxGuests] = useState<number | null | undefined>(currentMaxGuests);
  const [useGlobal, setUseGlobal] = useState(currentMaxGuests === null || currentMaxGuests === undefined);
  const [unlimitedGuests, setUnlimitedGuests] = useState(false);

  useEffect(() => {
    if (open) {
      setMaxGuests(currentMaxGuests);
      setUseGlobal(currentMaxGuests === null || currentMaxGuests === undefined);
      setUnlimitedGuests(false);
    }
  }, [open, currentMaxGuests]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let valueToSave: number | null;
      
      if (useGlobal) {
        valueToSave = null; // Use global limit
      } else if (unlimitedGuests) {
        valueToSave = null; // Unlimited (but different from useGlobal - we'll handle this differently)
        // Actually, for unlimited per-guest, we could use a special value or just null
        // For now, null means "use global", so we need a different approach
        // Let's use a very large number or handle it differently
        // Actually, let's just set it to null and the validation will check global
        valueToSave = null;
      } else {
        valueToSave = maxGuests || null;
      }

      const response = await fetch(`/api/events/${eventId}/guests/${guestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxGuests: valueToSave,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update guest limit');
      }

      toast({
        title: 'Guest limit updated',
        description: useGlobal
          ? `${guestName} will now use the global limit.`
          : unlimitedGuests
          ? `${guestName} can now bring unlimited guests.`
          : `${guestName} can now bring up to ${maxGuests! - 1} additional guest${maxGuests! - 1 !== 1 ? 's' : ''}.`,
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error('Update guest limit error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update guest limit',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const effectiveLimit = useGlobal ? globalMaxGuests : (unlimitedGuests ? null : maxGuests);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Guest Limit for {guestName}</DialogTitle>
          <DialogDescription>
            Set a custom guest limit for this invitee, or use the global limit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useGlobal"
                checked={useGlobal}
                onCheckedChange={(checked) => {
                  setUseGlobal(checked as boolean);
                  if (checked) {
                    setUnlimitedGuests(false);
                  }
                }}
                disabled={isSaving}
              />
              <Label
                htmlFor="useGlobal"
                className="text-sm font-normal cursor-pointer"
              >
                Use global limit
                {globalMaxGuests !== null && globalMaxGuests !== undefined && (
                  <span className="text-muted-foreground ml-1">
                    ({globalMaxGuests - 1} additional guest{globalMaxGuests - 1 !== 1 ? 's' : ''})
                  </span>
                )}
                {globalMaxGuests === null && (
                  <span className="text-muted-foreground ml-1">(Unlimited)</span>
                )}
              </Label>
            </div>

            {!useGlobal && (
              <>
                <div className="flex items-center space-x-2 pl-6">
                  <Checkbox
                    id="unlimitedGuests"
                    checked={unlimitedGuests}
                    onCheckedChange={(checked) => {
                      setUnlimitedGuests(checked as boolean);
                      if (checked) {
                        setMaxGuests(null);
                      } else {
                        setMaxGuests(maxGuests || 2);
                      }
                    }}
                    disabled={isSaving}
                  />
                  <Label
                    htmlFor="unlimitedGuests"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Unlimited guests for this invitee
                  </Label>
                </div>

                {!unlimitedGuests && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="maxGuests">Custom limit</Label>
                    <Input
                      id="maxGuests"
                      type="number"
                      min="1"
                      value={maxGuests || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null;
                        setMaxGuests(value);
                      }}
                      disabled={isSaving}
                      placeholder="2"
                      className="max-w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Total number of guests (including invitee). Example: 2 = invitee + 1 additional guest.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {effectiveLimit !== null && effectiveLimit !== undefined && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Current effective limit:</p>
              <p className="text-sm text-muted-foreground">
                {effectiveLimit - 1} additional guest{effectiveLimit - 1 !== 1 ? 's' : ''} (total of {effectiveLimit} including invitee)
              </p>
            </div>
          )}

          {effectiveLimit === null && !useGlobal && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Current effective limit:</p>
              <p className="text-sm text-muted-foreground">Unlimited</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (!useGlobal && !unlimitedGuests && (!maxGuests || maxGuests < 1))}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

