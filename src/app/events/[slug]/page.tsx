import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, MapPin, Users, MessageSquare, Clock, Navigation } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { formatEventDateTime, formatEventDateTimeShort } from '@/lib/timezone';
import { PublicRsvpForm } from '@/components/public-rsvp-form';
import { PublicCommentForm } from '@/components/public-comment-form';
import { PublicNav } from '@/components/public-nav';
import { AddToCalendar } from '@/components/add-to-calendar';
import { ManageRsvp } from '@/components/manage-rsvp';
import { QRCode } from '@/components/qr-code';
import { formatAddressOneLine, formatAddressMultiLine, formatAddressForMaps, hasAddress } from '@/lib/address-utils';

interface EventPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string; token?: string; success?: string; error?: string }>;
}

export default async function PublicEventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const { email, token } = await searchParams;
  
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

  // Find guest by token or email if provided
  let guestToken: string | null = null;
  let guestEmail: string | null = null;
  let prefillData: {
    name: string | null;
    email: string;
    phone: string | null;
    dietaryNotes: string | null;
    token: string;
  } | null = null;

  if (token) {
    // Token-based lookup (from email links) - fetch full guest data for prefilling
    const guest = await prisma.guest.findUnique({
      where: { token },
      select: {
        token: true,
        email: true,
        name: true,
        phone: true,
        dietaryNotes: true,
        eventId: true,
      },
    });
    if (guest && guest.eventId === event.id) {
      guestToken = guest.token;
      guestEmail = guest.email;
      prefillData = {
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        dietaryNotes: guest.dietaryNotes,
        token: guest.token,
      };
    }
  } else if (email) {
    // Email-based lookup (legacy support)
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
    <div className="min-h-screen aurora-bg">
      <PublicNav />

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Event Header — the invitation */}
          <Card className="border border-border overflow-hidden animate-slide-up">
            {event.coverImage && (
              <div className="w-full max-h-[520px] overflow-hidden bg-foreground/[0.04] flex items-center justify-center border-b border-border">
                <img
                  src={event.coverImage}
                  alt={event.title}
                  className="w-full max-h-[520px] object-contain"
                />
              </div>
            )}
            <div className="h-1.5 bg-primary" />
            <CardHeader className="text-center pb-2 pt-8">
              <p className="label-mono mb-4">— You&apos;re invited to —</p>
              <CardTitle className="text-4xl md:text-5xl mb-5 leading-[1.05]">{event.title}</CardTitle>

              <hr className="ink-rule-double w-24 mx-auto mb-6" />

              <div className="space-y-4 text-base text-muted-foreground">
                <div>
                  <p className="label-mono mb-1">When</p>
                  <p className="flex items-center justify-center gap-2 text-foreground font-medium">
                    <Calendar className="w-4 h-4 text-primary" />
                    {formatEventDateTime(event.date, event.timezone)}
                  </p>
                </div>
                {hasAddress(event) && (
                  <div className="flex flex-col items-center gap-2">
                    <p className="label-mono mb-1">Where</p>
                    <div className="flex items-center justify-center gap-2">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddressForMaps(event))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground font-medium hover:text-primary hover:underline text-center whitespace-pre-line"
                      >
                        {formatAddressMultiLine(event)}
                      </a>
                    </div>
                    {formatAddressForMaps(event) && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatAddressForMaps(event))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-[3px] border border-foreground/25 bg-transparent hover:bg-foreground hover:text-background transition-colors"
                      >
                        <Navigation className="w-4 h-4" />
                        Get Directions
                      </a>
                    )}
                  </div>
                )}
                {event.rsvpDeadline && (
                  <div>
                    <p className="label-mono mb-1">Respond by</p>
                    <p className={`flex items-center justify-center gap-2 font-medium ${rsvpDeadlinePassed ? 'text-destructive' : 'text-accent'}`}>
                      <Clock className="w-4 h-4" />
                      {rsvpDeadlinePassed
                        ? 'RSVP deadline has passed'
                        : formatEventDateTimeShort(event.rsvpDeadline, event.timezone)
                      }
                    </p>
                  </div>
                )}
                {event.maxGuestsPerInvitee !== null && (
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Each invitee may bring up to {event.maxGuestsPerInvitee - 1} additional guest{event.maxGuestsPerInvitee - 1 !== 1 ? 's' : ''} ({event.maxGuestsPerInvitee} total, including themselves).
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <span className="stamp stamp-skew text-primary border-primary animate-stamp">
                  <Users className="w-3.5 h-3.5" />
                  {attendingCount} {attendingCount === 1 ? 'guest' : 'guests'} attending
                </span>
                <AddToCalendar
                  title={event.title}
                  description={event.description || ''}
                  location={formatAddressOneLine(event)}
                  startDate={event.date}
                  endDate={event.endDate}
                  url={`${appUrl}/events/${event.slug}`}
                />
              </div>
            </CardHeader>
            {event.description && (
              <CardContent className="pt-6">
                <div className="border-l-2 border-primary pl-5 py-1">
                  <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">{event.description}</p>
                </div>
              </CardContent>
            )}
            <CardContent className="pt-4 pb-8 text-center">
              <p className="label-mono">Hosted by</p>
              <p className="font-display text-lg text-foreground mt-1">{event.host.name || 'Anonymous'}</p>
            </CardContent>
          </Card>

          {/* Photo Album */}
          {event.photoAlbumUrl && (
            <Card className="border border-border animate-slide-up" style={{ animationDelay: '0.05s' }}>
              <CardHeader>
                <CardTitle className="text-xl">Event Photos</CardTitle>
                <CardDescription>
                  View and share photos from this event
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="flex-shrink-0 p-2 bg-card border border-border rounded-[3px]">
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

          {/* Manage RSVP */}
          <ManageRsvp 
            eventId={event.id} 
            guestEmail={guestEmail}
            rsvpToken={guestToken}
          />

          {/* RSVP Form */}
          <Card className="border border-border animate-slide-up perf-top" style={{ animationDelay: '0.1s' }}>
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
                <PublicRsvpForm eventId={event.id} slug={slug} maxGuestsPerInvitee={event.maxGuestsPerInvitee} prefillData={prefillData} />
              )}
            </CardContent>
          </Card>

          {/* Who's Coming */}
          {event.guests.length > 0 && (
            <Card className="border border-border animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Who&apos;s Coming
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {event.guests.map((guest: typeof event.guests[0], index: number) => {
                    const allGuests = [
                      guest.name || guest.email.split('@')[0],
                      ...(guest.additionalGuests?.map((ag) => ag.name).filter((n): n is string => !!n) || []),
                    ];
                    return allGuests.filter(Boolean).map((name, nameIndex) => (
                      <div
                        key={`${index}-${nameIndex}`}
                        className="flex items-center gap-2 pl-1 pr-3 py-1 bg-muted border border-border rounded-[3px]"
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground">
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
          <Card className="border border-border animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
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
                        <AvatarFallback className="bg-accent/15 text-accent text-sm font-semibold">
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
