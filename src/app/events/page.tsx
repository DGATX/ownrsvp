import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import { formatEventDateTimeShort } from '@/lib/timezone';
import { PublicNav } from '@/components/public-nav';

// Force dynamic rendering to avoid database queries at build time
export const dynamic = 'force-dynamic';

export default async function PublicEventsPage() {
  const events = await prisma.event.findMany({
    where: {
      isPublic: true,
      date: { gte: new Date() },
    },
    include: {
      host: { select: { name: true } },
      guests: {
        where: { status: 'ATTENDING' },
        select: { 
          id: true,
          additionalGuests: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
    take: 20,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
      <PublicNav />

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Upcoming Events</h1>
            <p className="text-lg text-muted-foreground">
              Browse public events and RSVP
            </p>
          </div>

          {events.length === 0 ? (
            <Card className="max-w-md mx-auto text-center">
              <CardContent className="py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
                <p className="text-muted-foreground mb-6">
                  Check back later or create your own event!
                </p>
                <Link href="/register">
                  <Button>Create an Event</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event: typeof events[0]) => (
                <Link key={event.id} href={`/events/${event.slug}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden">
                    {event.coverImage && (
                      <div className="w-full h-48 overflow-hidden">
                        <img
                          src={event.coverImage}
                          alt={event.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="h-1 bg-gradient-to-r from-violet-600 to-indigo-600" />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-2">
                        {event.title}
                      </CardTitle>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatEventDateTimeShort(event.date, event.timezone)}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 line-clamp-1">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <Users className="w-4 h-4" />
                          {event.guests.reduce((sum: number, guest) => sum + 1 + (guest.additionalGuests?.length || 0), 0)} attending
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Hosted by {event.host.name || 'Anonymous'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
