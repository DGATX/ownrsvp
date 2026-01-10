import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { parseReminderSchedule, serializeReminderSchedule, validateReminders } from '@/lib/reminder-utils';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateRemindersSchema = z.object({
  reminderSchedule: z.array(
    z.object({
      type: z.enum(['day', 'hour']),
      value: z.number().positive(),
    })
  ).optional().nullable(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if user can manage this event
    const canManage = await canManageEvent(session.user.id, id);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateRemindersSchema.parse(body);

    // Parse and validate reminders
    let reminders: Array<{ type: 'day' | 'hour'; value: number }> = [];
    
    if (validated.reminderSchedule !== null && validated.reminderSchedule !== undefined) {
      reminders = validated.reminderSchedule;
    }

    // Validate reminders
    const validation = validateReminders(reminders);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Serialize reminders
    const reminderScheduleStr = serializeReminderSchedule(reminders);

    // Update event
    const event = await prisma.event.update({
      where: { id },
      data: {
        reminderSchedule: reminderScheduleStr,
      },
      select: {
        id: true,
        title: true,
        reminderSchedule: true,
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Update reminders error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update reminders' },
      { status: 500 }
    );
  }
}

