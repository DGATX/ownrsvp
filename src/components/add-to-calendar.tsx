'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, ChevronDown } from 'lucide-react';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl, downloadIcalFile } from '@/lib/calendar';

interface AddToCalendarProps {
  title: string;
  description: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  url?: string;
}

export function AddToCalendar({
  title,
  description,
  location,
  startDate,
  endDate,
  url,
}: AddToCalendarProps) {
  const handleGoogleCalendar = () => {
    const googleUrl = generateGoogleCalendarUrl({
      title,
      description,
      location: location || '',
      startDate,
      endDate,
      url,
    });
    window.open(googleUrl, '_blank');
  };

  const handleOutlookCalendar = () => {
    const outlookUrl = generateOutlookCalendarUrl({
      title,
      description,
      location: location || '',
      startDate,
      endDate,
      url,
    });
    window.open(outlookUrl, '_blank');
  };

  const handleIcalDownload = () => {
    downloadIcalFile(
      {
        title,
        description,
        location: location || '',
        startDate,
        endDate,
        url,
      },
      `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="w-4 h-4" />
          Add to Calendar
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Choose Calendar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleGoogleCalendar}>
          <div className="flex flex-col">
            <span className="font-medium">Google Calendar</span>
            <span className="text-xs text-muted-foreground">Opens in browser</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOutlookCalendar}>
          <div className="flex flex-col">
            <span className="font-medium">Outlook</span>
            <span className="text-xs text-muted-foreground">Opens in browser</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleIcalDownload}>
          <div className="flex flex-col">
            <span className="font-medium">iCal / Apple Calendar</span>
            <span className="text-xs text-muted-foreground">Downloads .ics file</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

