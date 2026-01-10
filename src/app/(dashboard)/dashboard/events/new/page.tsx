'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ImageUpload } from '@/components/image-upload';
import { ReminderManager } from '@/components/reminder-manager';
import { Reminder, serializeReminderSchedule } from '@/lib/reminder-utils';

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    time: '',
    endDate: '',
    endTime: '',
    rsvpDeadlineDate: '',
    rsvpDeadlineTime: '',
    coverImage: null as string | null,
    photoAlbumUrl: '',
    reminderSchedule: [] as Reminder[],
    maxGuestsPerInvitee: null as number | null,
    unlimitedGuests: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get form data directly from the form to ensure we have the latest values
      const form = e.currentTarget;
      const formDataObj = new FormData(form);
      const date = formDataObj.get('date') as string;
      const time = formDataObj.get('time') as string;

      // Validate date and time are provided
      if (!date || !time) {
        throw new Error('Date and time are required');
      }

      // Construct date string properly - ensure we have a valid date format
      const dateTimeStr = `${date}T${time}:00`;
      const dateTime = new Date(dateTimeStr);
      
      // Validate the date is valid
      if (isNaN(dateTime.getTime())) {
        throw new Error('Invalid date or time format');
      }
      
      // Check if date seems reasonable (not year 0006)
      if (dateTime.getFullYear() < 1900 || dateTime.getFullYear() > 2100) {
        throw new Error(`Invalid year: ${dateTime.getFullYear()}. Please check your date input.`);
      }

      const endDate = formDataObj.get('endDate') as string;
      const endTime = formDataObj.get('endTime') as string;
      let endDateTime = null;
      if (endDate && endTime) {
        const endDateTimeStr = `${endDate}T${endTime}:00`;
        endDateTime = new Date(endDateTimeStr);
        if (isNaN(endDateTime.getTime())) {
          throw new Error('Invalid end date or time format');
        }
      }

      const rsvpDeadlineDate = formDataObj.get('rsvpDeadlineDate') as string;
      const rsvpDeadlineTime = formDataObj.get('rsvpDeadlineTime') as string;
      let rsvpDeadline = null;
      if (rsvpDeadlineDate && rsvpDeadlineTime) {
        const rsvpDeadlineStr = `${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`;
        rsvpDeadline = new Date(rsvpDeadlineStr);
        if (isNaN(rsvpDeadline.getTime())) {
          throw new Error('Invalid RSVP deadline date or time format');
        }
      }

      const title = formDataObj.get('title') as string;
      const description = formDataObj.get('description') as string;
      const location = formDataObj.get('location') as string;
      const photoAlbumUrl = formDataObj.get('photoAlbumUrl') as string;

      const payload: Record<string, any> = {
        title,
        description,
        location,
        date: dateTime.toISOString(),
        endDate: endDateTime?.toISOString(),
        rsvpDeadline: rsvpDeadline?.toISOString(),
        coverImage: formData.coverImage, // This comes from ImageUpload component state
      };

      if (photoAlbumUrl && photoAlbumUrl.trim() !== '') {
        payload.photoAlbumUrl = photoAlbumUrl;
      }

      const reminderScheduleStr = serializeReminderSchedule(formData.reminderSchedule);
      if (reminderScheduleStr) {
        payload.reminderSchedule = reminderScheduleStr;
      }

      if (!formData.unlimitedGuests && formData.maxGuestsPerInvitee) {
        payload.maxGuestsPerInvitee = formData.maxGuestsPerInvitee;
      } else {
        payload.maxGuestsPerInvitee = null;
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error Response:', JSON.stringify(data, null, 2));
        console.error('Response Status:', response.status);
        const errorMessage = data.error || (data.details ? JSON.stringify(data.details) : 'Failed to create event');
        throw new Error(errorMessage);
      }

      toast({
        title: 'Event created!',
        description: 'Now add guests to send invitations.',
      });

      router.push(`/dashboard/events/${data.event.id}`);
    } catch (error) {
      console.error('Create event error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create event';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Create New Event</CardTitle>
          <CardDescription>
            Fill in the details for your event. You can add guests after creating.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                name="title"
                placeholder="Birthday Party, Team Dinner, etc."
                value={formData.title}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Tell your guests what the event is about..."
                value={formData.description}
                onChange={handleChange}
                rows={4}
                disabled={isLoading}
              />
            </div>

            <ImageUpload
              value={formData.coverImage}
              onChange={(image) => setFormData({ ...formData, coverImage: image })}
              disabled={isLoading}
            />

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="123 Main St, or Virtual (Zoom link)"
                value={formData.location}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photoAlbumUrl">Photo Album Link (optional)</Label>
              <Input
                id="photoAlbumUrl"
                name="photoAlbumUrl"
                type="url"
                placeholder="https://photos.google.com/..."
                value={formData.photoAlbumUrl}
                onChange={handleChange}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Share a link to a Google Photos album or other photo sharing service. A QR code will be generated automatically.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Start Date *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Start Time *</Label>
                <Input
                  id="time"
                  name="time"
                  type="time"
                  value={formData.time}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time (optional)</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rsvpDeadlineDate">RSVP Deadline Date (optional)</Label>
                <Input
                  id="rsvpDeadlineDate"
                  name="rsvpDeadlineDate"
                  type="date"
                  value={formData.rsvpDeadlineDate}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rsvpDeadlineTime">RSVP Deadline Time (optional)</Label>
                <Input
                  id="rsvpDeadlineTime"
                  name="rsvpDeadlineTime"
                  type="time"
                  value={formData.rsvpDeadlineTime}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground -mt-4">
              Set a deadline after which guests can no longer RSVP.
            </p>

            <ReminderManager
              reminders={formData.reminderSchedule}
              onChange={(reminders) => setFormData({ ...formData, reminderSchedule: reminders })}
              disabled={isLoading}
            />

            <div className="space-y-2">
              <Label htmlFor="maxGuestsPerInvitee">Max Guests Per Invitee (Optional)</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="unlimitedGuests"
                    checked={formData.unlimitedGuests}
                    onCheckedChange={(checked) => {
                      setFormData({
                        ...formData,
                        unlimitedGuests: checked as boolean,
                        maxGuestsPerInvitee: checked ? null : 2,
                      });
                    }}
                    disabled={isLoading}
                  />
                  <Label
                    htmlFor="unlimitedGuests"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Unlimited guests allowed
                  </Label>
                </div>
                {!formData.unlimitedGuests && (
                  <div className="space-y-2 pl-6">
                    <Input
                      id="maxGuestsPerInvitee"
                      type="number"
                      min="1"
                      value={formData.maxGuestsPerInvitee || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null;
                        setFormData({
                          ...formData,
                          maxGuestsPerInvitee: value,
                        });
                      }}
                      disabled={isLoading}
                      placeholder="2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Limit the total number of guests each invitee can bring (including themselves). 
                      Example: Limit of 2 = invitee + 1 additional guest.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Event
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

