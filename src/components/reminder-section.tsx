'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReminderManager } from '@/components/reminder-manager';
import { Reminder, parseReminderSchedule, serializeReminderSchedule, formatReminder } from '@/lib/reminder-utils';
import { useToast } from '@/components/ui/use-toast';
import { Bell, Edit, Loader2 } from 'lucide-react';

interface ReminderSectionProps {
  eventId: string;
  reminderSchedule: string | null;
  canEdit: boolean;
}

export function ReminderSection({ eventId, reminderSchedule, canEdit }: ReminderSectionProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>(() => 
    parseReminderSchedule(reminderSchedule)
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/events/${eventId}/reminders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminderSchedule: reminders,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update reminders');
      }

      toast({
        title: 'Reminders updated',
        description: 'Your reminder schedule has been saved.',
      });

      setIsDialogOpen(false);
    } catch (error) {
      console.error('Update reminders error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update reminders',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const parsedReminders = parseReminderSchedule(reminderSchedule);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Reminder Schedule
              </CardTitle>
              <CardDescription>
                Automated reminders will be sent to guests before the event
              </CardDescription>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReminders(parsedReminders);
                  setIsDialogOpen(true);
                }}
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Reminders
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {parsedReminders.length > 0 ? (
            <div className="space-y-2">
              {parsedReminders
                .sort((a, b) => {
                  if (a.type !== b.type) {
                    return a.type === 'day' ? -1 : 1;
                  }
                  return b.value - a.value;
                })
                .map((reminder, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
                  >
                    <span className="text-sm font-medium">{formatReminder(reminder)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No custom reminders set. Default reminder will be sent 2 days before the event.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Reminder Schedule</DialogTitle>
            <DialogDescription>
              Add, edit, or remove reminders. Reminders will be sent to guests who haven&apos;t responded yet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ReminderManager
              reminders={reminders}
              onChange={setReminders}
              disabled={isSaving}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Reminders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

