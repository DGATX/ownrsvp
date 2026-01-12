import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/config';
import { canManageEvent, getEventRole } from '@/lib/event-access';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, Clock, Link as LinkIcon, Edit, Navigation } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { EventPageClient } from '@/components/event-page-client';
import { CopyButton } from '@/components/copy-button';
import { AddToCalendar } from '@/components/add-to-calendar';
import { DeleteEventButton } from '@/components/delete-event-button';
import { ManageCoHosts } from '@/components/manage-cohosts';
import { QRCode } from '@/components/qr-code';
import { ReminderSection } from '@/components/reminder-section';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  // Check if user can manage this event (host, co-host, or admin)
  const canManage = await canManageEvent(session.user.id, id);
  if (!canManage) {
    notFound();
  }

  // Get user's role for this event
  const userRole = await getEventRole(session.user.id, id);
  const isHost = userRole === 'HOST';
  const isAdmin = userRole === 'ADMIN';

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      host: {
        select: { id: true, name: true, email: true },
      },
      guests: {
        orderBy: { invitedAt: 'desc' },
        include: {
          additionalGuests: true,
        },
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        include: {
          guest: {
            select: { name: true, email: true },
          },
        },
      },
      coHosts: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      updates: {
        orderBy: { sentAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!event) {
    notFound();
  }

  // Calculate total attendees including additional guests
  const attendingGuests = event.guests.filter((g: typeof event.guests[0]) => g.status === 'ATTENDING');
  const totalAttendees = attendingGuests.reduce((sum: number, guest) => {
    return sum + 1 + (guest.additionalGuests?.length || 0); // 1 for main guest + additional guests
  }, 0);

  const stats = {
    total: event.guests.length,
    attending: totalAttendees, // Total number of people attending (including additional guests)
    notAttending: event.guests.filter((g: typeof event.guests[0]) => g.status === 'NOT_ATTENDING').length,
    maybe: event.guests.filter((g: typeof event.guests[0]) => g.status === 'MAYBE').length,
    pending: event.guests.filter((g: typeof event.guests[0]) => g.status === 'PENDING').length,
  };

  const appUrl = await getAppUrl();
  const publicUrl = `${appUrl}/events/${event.slug}`;

  // Check RSVP deadline
  const rsvpDeadlinePassed = event.rsvpDeadline ? isPast(new Date(event.rsvpDeadline)) : false;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <div className="space-y-6">
        {/* Event Header */}
        <Card className="border-0 shadow-xl overflow-hidden">
          {event.coverImage && (
            <div className="w-full h-[512px] md:h-[640px] overflow-hidden">
              <img
                src={event.coverImage}
                alt={event.title}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="h-2 bg-gradient-to-r from-violet-600 to-indigo-600" />
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-semibold leading-none tracking-tight">{event.title}</h1>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/events/${event.id}/edit`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                    </Link>
                    {(isAdmin || isHost) && (
                      <DeleteEventButton eventId={event.id} eventTitle={event.title} />
                    )}
                  </div>
                </div>
                <div className="space-y-2 pt-2 text-sm text-muted-foreground">
                  {(isAdmin || !isHost) && (
                    <div className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-2">
                      Host: {event.host.name || event.host.email}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDateTime(event.date)}
                    {event.endDate && ` - ${formatDateTime(event.endDate)}`}
                  </div>
                  {event.location && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          {event.location}
                        </a>
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors w-fit"
                      >
                        <Navigation className="w-4 h-4" />
                        Get Directions
                      </a>
                    </div>
                  )}
                  {event.rsvpDeadline && (
                    <div className={`flex items-center gap-2 ${rsvpDeadlinePassed ? 'text-red-600' : 'text-amber-600'}`}>
                      <Clock className="w-4 h-4" />
                      {rsvpDeadlinePassed 
                        ? 'RSVP deadline passed'
                        : `RSVP deadline: ${format(new Date(event.rsvpDeadline), 'MMM d, yyyy h:mm a')}`
                      }
                    </div>
                  )}
                </div>
              </div>
              <AddToCalendar
                title={event.title}
                description={event.description || ''}
                location={event.location}
                startDate={event.date}
                endDate={event.endDate}
                url={publicUrl}
              />
            </div>
          </CardHeader>
          {event.description && (
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </CardContent>
          )}
        </Card>

        {/* Reminder Schedule */}
        {(isHost || isAdmin || userRole === 'COHOST') && (
          <ReminderSection
            eventId={event.id}
            reminderSchedule={event.reminderSchedule}
            canEdit={isHost || isAdmin || userRole === 'COHOST'}
          />
        )}

        {/* Photo Album */}
        {event.photoAlbumUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Photos</CardTitle>
              <CardDescription>
                View and share photos from this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="flex-shrink-0">
                  <QRCode value={event.photoAlbumUrl} size={180} />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <a
                    href={event.photoAlbumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all text-lg font-medium"
                  >
                    {event.photoAlbumUrl}
                  </a>
                  <p className="text-sm text-muted-foreground mt-2">
                    Scan the QR code or click the link to view the photo album
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shareable Link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Public Event Link
            </CardTitle>
            <CardDescription>
              Share this link with guests who weren&apos;t directly invited
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg text-sm overflow-x-auto">
                {publicUrl}
              </code>
              <CopyButton text={publicUrl} />
            </div>
          </CardContent>
        </Card>

        {/* Co-hosts Section */}
        <ManageCoHosts
          eventId={event.id}
          coHosts={event.coHosts}
          isHost={isHost || isAdmin}
        />

        <EventPageClient
          eventId={event.id}
          eventSlug={event.slug}
          guests={event.guests}
          comments={event.comments}
          stats={stats}
          maxGuestsPerInvitee={event.maxGuestsPerInvitee}
          appUrl={appUrl}
        />
      </div>
    </div>
  );
}

