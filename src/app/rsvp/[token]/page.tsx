import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

interface RsvpTokenPageProps {
  params: Promise<{ token: string }>;
}

export default async function RsvpTokenPage({ params }: RsvpTokenPageProps) {
  const { token } = await params;
  
  const guest = await prisma.guest.findUnique({
    where: { token },
    include: {
      event: {
        select: { slug: true },
      },
    },
  });

  if (!guest) {
    notFound();
  }

  // Redirect to the public event page with token for prefilling guest data
  redirect(`/events/${guest.event.slug}?token=${token}`);
}

