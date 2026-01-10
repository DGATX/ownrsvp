'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, X, Check } from 'lucide-react';
import { Reminder, formatReminder, validateReminders } from '@/lib/reminder-utils';
import { useToast } from '@/components/ui/use-toast';

interface ReminderManagerProps {
  reminders: Reminder[];
  onChange: (reminders: Reminder[]) => void;
  disabled?: boolean;
}

export function ReminderManager({ reminders, onChange, disabled }: ReminderManagerProps) {
  const { toast } = useToast();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newReminder, setNewReminder] = useState<Reminder>({ type: 'day', value: 1 });

  const handleAdd = () => {
    const validation = validateReminders([...reminders, newReminder]);
    if (!validation.valid) {
      toast({
        title: 'Invalid reminder',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    onChange([...reminders, newReminder]);
    setNewReminder({ type: 'day', value: 1 });
    setIsAdding(false);
  };

  const handleEdit = (index: number, updated: Reminder) => {
    const updatedReminders = [...reminders];
    updatedReminders[index] = updated;

    const validation = validateReminders(updatedReminders);
    if (!validation.valid) {
      toast({
        title: 'Invalid reminder',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    onChange(updatedReminders);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    const updatedReminders = reminders.filter((_, i) => i !== index);
    onChange(updatedReminders);
  };

  const sortedReminders = [...reminders].sort((a, b) => {
    // Sort by type first (days before hours), then by value (descending)
    if (a.type !== b.type) {
      return a.type === 'day' ? -1 : 1;
    }
    return b.value - a.value;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Reminder Schedule</Label>
        <p className="text-sm text-muted-foreground">
          Add reminders to send emails/SMS before the event. You can set reminders in days or hours before the event starts.
        </p>
      </div>

      {sortedReminders.length > 0 && (
        <div className="space-y-2">
          {sortedReminders.map((reminder, index) => {
            const originalIndex = reminders.indexOf(reminder);
            const isEditing = editingIndex === originalIndex;

            if (isEditing) {
              return (
                <EditReminderForm
                  key={originalIndex}
                  reminder={reminder}
                  onSave={(updated) => handleEdit(originalIndex, updated)}
                  onCancel={() => setEditingIndex(null)}
                  disabled={disabled}
                />
              );
            }

            return (
              <div
                key={originalIndex}
                className="flex items-center justify-between p-3 border rounded-lg bg-card"
              >
                <span className="text-sm font-medium">{formatReminder(reminder)}</span>
                {!disabled && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingIndex(originalIndex)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(originalIndex)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <>
          {isAdding ? (
            <AddReminderForm
              reminder={newReminder}
              onChange={setNewReminder}
              onSave={handleAdd}
              onCancel={() => {
                setIsAdding(false);
                setNewReminder({ type: 'day', value: 1 });
              }}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAdding(true)}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Reminder
            </Button>
          )}
        </>
      )}

      {reminders.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No reminders set. Default reminder will be sent 2 days before the event.
        </p>
      )}
    </div>
  );
}

interface EditReminderFormProps {
  reminder: Reminder;
  onSave: (reminder: Reminder) => void;
  onCancel: () => void;
  disabled?: boolean;
}

function EditReminderForm({ reminder, onSave, onCancel, disabled }: EditReminderFormProps) {
  const [edited, setEdited] = useState<Reminder>(reminder);

  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg bg-card">
      <Select
        value={edited.type}
        onValueChange={(value: 'day' | 'hour') => setEdited({ ...edited, type: value })}
        disabled={disabled}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Days</SelectItem>
          <SelectItem value="hour">Hours</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        min="1"
        value={edited.value}
        onChange={(e) => setEdited({ ...edited, value: parseInt(e.target.value) || 1 })}
        className="w-20"
        disabled={disabled}
      />
      <span className="text-sm text-muted-foreground">before</span>
      <div className="flex gap-1 ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSave(edited)}
          disabled={disabled}
          className="h-8 w-8 p-0"
        >
          <Check className="w-4 h-4 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={disabled}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

interface AddReminderFormProps {
  reminder: Reminder;
  onChange: (reminder: Reminder) => void;
  onSave: () => void;
  onCancel: () => void;
}

function AddReminderForm({ reminder, onChange, onSave, onCancel }: AddReminderFormProps) {
  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
      <Select
        value={reminder.type}
        onValueChange={(value: 'day' | 'hour') => onChange({ ...reminder, type: value })}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Days</SelectItem>
          <SelectItem value="hour">Hours</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        min="1"
        value={reminder.value}
        onChange={(e) => onChange({ ...reminder, value: parseInt(e.target.value) || 1 })}
        className="w-20"
        placeholder="1"
      />
      <span className="text-sm text-muted-foreground">before</span>
      <div className="flex gap-1 ml-auto">
        <Button variant="ghost" size="sm" onClick={onSave} className="h-8 w-8 p-0">
          <Check className="w-4 h-4 text-green-600" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

