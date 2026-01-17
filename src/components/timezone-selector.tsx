'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { COMMON_TIMEZONES, getBrowserTimezone } from '@/lib/timezone';

interface TimezoneSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export function TimezoneSelector({
  value,
  onChange,
  disabled = false,
  label = 'Event Timezone',
}: TimezoneSelectorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set default to browser timezone if not already set
    if (!value) {
      const browserTz = getBrowserTimezone();
      onChange(browserTz);
    }
  }, []);

  // Don't render select during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent>
          {COMMON_TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        Times will be displayed in this timezone
      </p>
    </div>
  );
}
