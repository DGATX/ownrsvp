'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Trash2, Bell } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ImageUpload } from '@/components/image-upload';
import { ReminderManager } from '@/components/reminder-manager';
import { Reminder, parseReminderSchedule, serializeReminderSchedule } from '@/lib/reminder-utils';

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

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
  const [notifyGuests, setNotifyGuests] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const response = await fetch(`/api/events/${params.id}`);
        if (!response.ok) throw new Error('Failed to fetch event');
        
        const { event } = await response.json();
        const date = new Date(event.date);
        const endDate = event.endDate ? new Date(event.endDate) : null;
        const rsvpDeadline = event.rsvpDeadline ? new Date(event.rsvpDeadline) : null;
        
        // Parse reminder schedule (handles both old and new formats)
        const reminderSchedule = parseReminderSchedule(event.reminderSchedule);

        setFormData({
          title: event.title,
          description: event.description || '',
          location: event.location || '',
          date: date.toISOString().split('T')[0],
          time: date.toTimeString().slice(0, 5),
          endDate: endDate ? endDate.toISOString().split('T')[0] : '',
          endTime: endDate ? endDate.toTimeString().slice(0, 5) : '',
          rsvpDeadlineDate: rsvpDeadline ? rsvpDeadline.toISOString().split('T')[0] : '',
          rsvpDeadlineTime: rsvpDeadline ? rsvpDeadline.toTimeString().slice(0, 5) : '',
          coverImage: event.coverImage || null,
          photoAlbumUrl: event.photoAlbumUrl || '',
          reminderSchedule,
          maxGuestsPerInvitee: event.maxGuestsPerInvitee,
          unlimitedGuests: event.maxGuestsPerInvitee === null,
        });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load event',
          variant: 'destructive',
        });
        router.push('/dashboard');
      } finally {
        setIsFetching(false);
      }
    }

    fetchEvent();
  }, [params.id, router, toast]);

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

      const title = formDataObj.get('title') as string;
      const description = formDataObj.get('description') as string;
      const location = formDataObj.get('location') as string;
      const date = formDataObj.get('date') as string;
      const time = formDataObj.get('time') as string;
      const endDate = formDataObj.get('endDate') as string;
      const endTime = formDataObj.get('endTime') as string;
      const rsvpDeadlineDate = formDataObj.get('rsvpDeadlineDate') as string;
      const rsvpDeadlineTime = formDataObj.get('rsvpDeadlineTime') as string;
      const photoAlbumUrl = formDataObj.get('photoAlbumUrl') as string;
      const coverImage = formData.coverImage; // Image is handled via state from ImageUpload component
      const reminderSchedule = formData.reminderSchedule; // Reminder schedule from state

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

      let endDateTime = null;
      if (endDate && endTime) {
        const endDateTimeStr = `${endDate}T${endTime}:00`;
        endDateTime = new Date(endDateTimeStr);
        if (isNaN(endDateTime.getTime())) {
          throw new Error('Invalid end date or time format');
        }
      }

      let rsvpDeadline = null;
      if (rsvpDeadlineDate && rsvpDeadlineTime) {
        const rsvpDeadlineStr = `${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`;
        rsvpDeadline = new Date(rsvpDeadlineStr);
        if (isNaN(rsvpDeadline.getTime())) {
          throw new Error('Invalid RSVP deadline date or time format');
        }
      }

      const response = await fetch(`/api/events/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          location: location || null,
          date: dateTime.toISOString(),
          endDate: endDateTime?.toISOString() || null,
          rsvpDeadline: rsvpDeadline?.toISOString() || null,
          coverImage: coverImage || null,
          photoAlbumUrl: (photoAlbumUrl && photoAlbumUrl.trim() !== '') ? photoAlbumUrl : null,
          reminderSchedule: serializeReminderSchedule(reminderSchedule),
          maxGuestsPerInvitee: !formData.unlimitedGuests && formData.maxGuestsPerInvitee ? formData.maxGuestsPerInvitee : null,
          notifyGuests,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('API Error Response:', JSON.stringify(data, null, 2));
        logger.error('Response Status:', response.status);
        const errorMessage = data.error || (data.details ? JSON.stringify(data.details) : 'Failed to update event');
        throw new Error(errorMessage);
      }
      
      toast({
        title: 'Event updated',
        description: data.changesNotified 
          ? `Your changes have been saved and guests have been notified.`
          : 'Your changes have been saved.',
      });

      router.push(`/dashboard/events/${params.id}`);
    } catch (error) {
      logger.error('Update event error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update event';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/events/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      toast({
        title: 'Event deleted',
        description: 'The event has been permanently deleted.',
      });

      router.push('/dashboard');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href={`/dashboard/events/${params.id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Event
      </Link>

      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Edit Event</CardTitle>
          <CardDescription>
            Update your event details
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                disabled={isLoading}
                data-testid="event-title-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                disabled={isLoading}
                data-testid="event-description-input"
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
                value={formData.location}
                onChange={handleChange}
                disabled={isLoading}
                data-testid="event-location-input"
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
                  data-testid="event-date-input"
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
                  data-testid="event-time-input"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
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
                <Label htmlFor="endTime">End Time</Label>
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
                <Label htmlFor="rsvpDeadlineDate">RSVP Deadline Date</Label>
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
                <Label htmlFor="rsvpDeadlineTime">RSVP Deadline Time</Label>
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
              Set a deadline after which guests can no longer RSVP. Leave empty for no deadline.
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
                        maxGuestsPerInvitee: checked ? null : (formData.maxGuestsPerInvitee || 2),
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

            {/* Notify Guests */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="notifyGuests"
                  checked={notifyGuests}
                  onCheckedChange={(checked) => setNotifyGuests(!!checked)}
                  disabled={isLoading}
                />
                <div className="space-y-1">
                  <Label htmlFor="notifyGuests" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Bell className="w-4 h-4" />
                    Notify guests of changes
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Send an email/SMS notification to all guests if you change the date, time, location, or title.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={isLoading || isDeleting} data-testid="event-submit-button">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading || isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

