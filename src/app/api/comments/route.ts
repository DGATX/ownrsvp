import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const commentSchema = z.object({
  eventId: z.string(),
  authorName: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Message is required').max(1000, 'Message is too long'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = commentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { eventId, authorName, content } = parsed.data;

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        eventId,
        authorName,
        content,
      },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    logger.error('Comment error', error);
    return NextResponse.json(
      { error: 'Failed to post comment' },
      { status: 500 }
    );
  }
}

