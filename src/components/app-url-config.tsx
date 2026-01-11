'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Globe } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

interface AppUrlConfigProps {
  onConfigChange?: () => void;
}

export function AppUrlConfig({ onConfigChange }: AppUrlConfigProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [appUrl, setAppUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [source, setSource] = useState<'database' | 'environment'>('environment');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    setHasChanges(appUrl !== originalUrl);
  }, [appUrl, originalUrl]);

  async function loadConfig() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/config/app');
      if (response.ok) {
        const data = await response.json();
        setAppUrl(data.appUrl || '');
        setOriginalUrl(data.appUrl || '');
        setSource(data.source || 'environment');
      }
    } catch (error) {
      logger.error('Failed to load app URL config:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!appUrl) {
      toast({
        title: 'Error',
        description: 'Please enter an app URL',
        variant: 'destructive',
      });
      return;
    }

    // Validate URL format
    try {
      new URL(appUrl);
    } catch {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL (e.g., https://rsvp.example.com)',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/config/app', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'App URL saved!',
          description: 'All invitation and RSVP links will now use this URL.',
        });
        setOriginalUrl(data.appUrl);
        setAppUrl(data.appUrl);
        setSource('database');
        setHasChanges(false);
        onConfigChange?.();
      } else {
        throw new Error(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="app-url">Public App URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="app-url"
              type="url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://rsvp.example.com"
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The public URL where your OwnRSVP instance is accessible. Used for invitation links, RSVP links, and password reset emails.
          {source === 'environment' && !hasChanges && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              Currently using environment variable. Save to override.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
