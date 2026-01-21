import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, Users, Clock } from 'lucide-react';
import { formatEventDateTimeShort } from '@/lib/timezone';
import { EventCardActions } from '@/components/event-card-actions';
import { PastEventsBulkActions } from '@/components/past-events-bulk-actions';
import { formatAddressOneLine, hasAddress } from '@/lib/address-utils';

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }
  
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  
  const isAdmin = user?.role === 'ADMIN';
  
  // Get events where user is host
  const hostedEvents = await prisma.event.findMany({
    where: isAdmin ? {} : { hostId: session.user.id },
    include: {
      host: {
        select: { name: true, email: true },
      },
      guests: {
        select: {
          id: true,
          status: true,
          additionalGuests: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Get events where user is co-host (only if not admin, since admin sees all)
  const coHostedEvents = isAdmin ? [] : await prisma.event.findMany({
    where: {
      coHosts: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      host: {
        select: { name: true, email: true },
      },
      guests: {
        select: {
          id: true,
          status: true,
          additionalGuests: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Combine and deduplicate events
  const allEventsMap = new Map();
  hostedEvents.forEach((e) => allEventsMap.set(e.id, { ...e, isCoHost: false }));
  coHostedEvents.forEach((e) => {
    if (!allEventsMap.has(e.id)) {
      allEventsMap.set(e.id, { ...e, isCoHost: true });
    }
  });
  
  const events = Array.from(allEventsMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Check permissions for all events
  const eventsWithPermissions = await Promise.all(
    events.map(async (event) => {
      const canManage = await canManageEvent(session.user.id, event.id);
      return { ...event, canManage };
    })
  );

  const upcomingEvents = eventsWithPermissions.filter((e) => new Date(e.date) >= new Date());
  const pastEvents = eventsWithPermissions.filter((e) => new Date(e.date) < new Date());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{isAdmin ? 'All Events' : 'Your Events'}</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Manage all events across the system' : 'Manage your event invitations and track RSVPs'}
          </p>
        </div>
        <Link href="/dashboard/events/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        </Link>
      </div>

      {eventsWithPermissions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-violet-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Create your first event and start inviting guests
            </p>
            <Link href="/dashboard/events/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Your First Event
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {upcomingEvents.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-violet-600" />
                Upcoming Events
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingEvents.map((event) => {
                  const attendingGuests = event.guests.filter((g: typeof event.guests[0]) => g.status === 'ATTENDING');
                  const attending = attendingGuests.reduce((sum: number, guest: typeof attendingGuests[0]) => sum + 1 + (guest.additionalGuests?.length || 0), 0);
                  const pending = event.guests.filter((g: typeof event.guests[0]) => g.status === 'PENDING').length;
                  
                  return (
                    <Card key={event.id} className="h-full hover:shadow-lg transition-shadow group overflow-hidden flex flex-col relative">
                      <EventCardActions eventId={event.id} eventTitle={event.title} canManage={event.canManage} />
                      <Link href={`/dashboard/events/${event.id}`} className="flex-1">
                        {event.coverImage && (
                          <div className="w-full h-40 overflow-hidden">
                            <img
                              src={event.coverImage}
                              alt={event.title}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg group-hover:text-violet-600 transition-colors line-clamp-1 pr-8">
                            {event.title}
                          </CardTitle>
                          <CardDescription>
                            {formatEventDateTimeShort(event.date, event.timezone)}
                            {(isAdmin || event.isCoHost) && event.host && (
                              <span className="block text-xs mt-1">Host: {event.host.name || event.host.email}</span>
                            )}
                            {event.isCoHost && (
                              <Badge variant="secondary" className="mt-1 text-xs">Co-host</Badge>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {hasAddress(event) && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                              {formatAddressOneLine(event)}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-green-600" />
                              <span>{attending} attending</span>
                            </div>
                            {pending > 0 && (
                              <div className="text-amber-600">
                                {pending} pending
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {pastEvents.length > 0 && (
            <PastEventsBulkActions events={pastEvents} isAdmin={isAdmin} />
          )}
        </div>
      )}
    </div>
  );
}

