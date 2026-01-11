import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, MapPin, Users, MessageSquare, Clock, Navigation } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { formatDistanceToNow, isPast, format } from 'date-fns';
import { PublicRsvpForm } from '@/components/public-rsvp-form';
import { PublicCommentForm } from '@/components/public-comment-form';
import { PublicNav } from '@/components/public-nav';
import { AddToCalendar } from '@/components/add-to-calendar';
import { ManageRsvp } from '@/components/manage-rsvp';
import { QRCode } from '@/components/qr-code';

interface EventPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string }>;
}

export default async function PublicEventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const { email } = await searchParams;
  
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      host: {
        select: { name: true },
      },
      guests: {
        where: { status: 'ATTENDING' },
        select: { 
          name: true, 
          email: true,
          additionalGuests: {
            select: { name: true },
          },
        },
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!event || !event.isPublic) {
    notFound();
  }

  const appUrl = await getAppUrl();

  // Find guest by email if provided
  let guestToken: string | null = null;
  let guestEmail: string | null = null;
  if (email) {
    const guest = await prisma.guest.findUnique({
      where: {
        eventId_email: {
          eventId: event.id,
          email: decodeURIComponent(email),
        },
      },
      select: {
        token: true,
        email: true,
      },
    });
    if (guest) {
      guestToken = guest.token;
      guestEmail = guest.email;
    }
  }

  // Count total attendees including additional guests
  const attendingCount = event.guests.reduce((sum: number, guest) => {
    return sum + 1 + (guest.additionalGuests?.length || 0); // 1 for main guest + additional guests
  }, 0);

  // Check if RSVP deadline has passed
  const rsvpDeadlinePassed = event.rsvpDeadline ? isPast(new Date(event.rsvpDeadline)) : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
      <PublicNav />

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Event Header */}
          <Card className="border-0 shadow-xl overflow-hidden animate-slide-up">
                  {event.coverImage && (
                    <div className="w-full h-[512px] md:h-[640px] overflow-hidden">
                      <img
                        src={event.coverImage}
                        alt={event.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
            <div className="h-3 bg-gradient-to-r from-violet-600 to-indigo-600" />
            <CardHeader className="text-center pb-2">
              <p className="text-sm text-muted-foreground mb-2">
                You&apos;re invited to
              </p>
              <CardTitle className="text-3xl md:text-4xl mb-4">{event.title}</CardTitle>
              <div className="space-y-3 text-base text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  {formatDateTime(event.date)}
                </div>
                {event.location && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center justify-center gap-2">
                      <MapPin className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                      >
                        {event.location}
                      </a>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Get Directions
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <Users className="w-5 h-5" />
                  {attendingCount} {attendingCount === 1 ? 'person' : 'people'} attending
                </div>
                {event.rsvpDeadline && (
                  <div className={`flex items-center justify-center gap-2 ${rsvpDeadlinePassed ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    <Clock className="w-5 h-5" />
                    {rsvpDeadlinePassed 
                      ? 'RSVP deadline has passed'
                      : `RSVP by ${format(new Date(event.rsvpDeadline), 'MMM d, yyyy h:mm a')}`
                    }
                  </div>
                )}
                {event.maxGuestsPerInvitee !== null && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Users className="w-5 h-5" />
                    Each invitee can bring up to {event.maxGuestsPerInvitee - 1} additional guest{event.maxGuestsPerInvitee - 1 !== 1 ? 's' : ''} (total of {event.maxGuestsPerInvitee} including themselves)
                  </div>
                )}
              </div>
              <div className="flex justify-center mt-4">
                <AddToCalendar
                  title={event.title}
                  description={event.description || ''}
                  location={event.location}
                  startDate={event.date}
                  endDate={event.endDate}
                  url={`${appUrl}/events/${event.slug}`}
                />
              </div>
            </CardHeader>
            {event.description && (
              <CardContent className="pt-4">
                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                </div>
              </CardContent>
            )}
            <CardContent className="pt-2 text-center text-sm text-muted-foreground">
              Hosted by {event.host.name || 'Anonymous'}
            </CardContent>
          </Card>

          {/* Photo Album */}
          {event.photoAlbumUrl && (
            <Card className="border-0 shadow-xl animate-slide-up" style={{ animationDelay: '0.05s' }}>
              <CardHeader>
                <CardTitle className="text-xl">Event Photos</CardTitle>
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
                      className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:underline break-all text-lg font-medium"
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

          {/* Manage RSVP */}
          <ManageRsvp 
            eventId={event.id} 
            guestEmail={guestEmail}
            rsvpToken={guestToken}
          />

          {/* RSVP Form */}
          <Card className="border-0 shadow-xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <CardTitle className="text-xl">RSVP</CardTitle>
              <CardDescription>
                {rsvpDeadlinePassed
                  ? 'The RSVP deadline for this event has passed'
                  : 'Let the host know if you can make it'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rsvpDeadlinePassed ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>The RSVP deadline has passed.</p>
                  <p className="text-sm">Contact the host directly if you need to make changes.</p>
                </div>
              ) : (
                <PublicRsvpForm eventId={event.id} slug={slug} maxGuestsPerInvitee={event.maxGuestsPerInvitee} />
              )}
            </CardContent>
          </Card>

          {/* Who's Coming */}
          {event.guests.length > 0 && (
            <Card className="border-0 shadow-xl animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Who&apos;s Coming
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {event.guests.map((guest: typeof event.guests[0], index: number) => {
                    const allGuests = [
                      guest.name || guest.email.split('@')[0],
                      ...(guest.additionalGuests?.map((ag) => ag.name) || []),
                    ];
                    return allGuests.map((name, nameIndex) => (
                      <div
                        key={`${index}-${nameIndex}`}
                        className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/30 rounded-full"
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-green-700 dark:text-green-300">
                          {name}
                        </span>
                      </div>
                    ));
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Guest Wall */}
          <Card className="border-0 shadow-xl animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Guest Wall
              </CardTitle>
              <CardDescription>
                Leave a message for the host and other guests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PublicCommentForm eventId={event.id} />
              
              {event.comments.length > 0 ? (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Messages ({event.comments.length})
                  </h3>
                  {event.comments.map((comment: typeof event.comments[0]) => (
                    <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarFallback className="bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-sm font-medium">
                          {comment.authorName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{comment.authorName}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border-t pt-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet.</p>
                  <p className="text-sm">Be the first to leave a message!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
