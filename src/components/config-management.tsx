'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmailConfig } from './email-config';
import { AppUrlConfig } from './app-url-config';
import { CheckCircle2, XCircle, Loader2, Globe } from 'lucide-react';

export function ConfigManagement() {
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [appUrlConfigured, setAppUrlConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setIsLoading(true);
    try {
      const [configResponse, appUrlResponse] = await Promise.all([
        fetch('/api/admin/config'),
        fetch('/api/admin/config/app'),
      ]);

      if (configResponse.ok) {
        const data = await configResponse.json();
        setEmailConfigured(data.email?.configured || false);
      }

      if (appUrlResponse.ok) {
        const data = await appUrlResponse.json();
        setAppUrlConfigured(data.configured || false);
      }
    } catch (error) {
      logger.error('Failed to load config status:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleConfigChange() {
    loadStatus();
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>Loading configuration status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>App URL</CardTitle>
              <CardDescription>
                Set the public URL for your OwnRSVP instance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {appUrlConfigured ? (
                <Badge variant="default" className="gap-1">
                  <Globe className="w-3 h-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Globe className="w-3 h-3" />
                  Using Default
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AppUrlConfig onConfigChange={handleConfigChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Configure SMTP settings for email notifications
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {emailConfigured ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Email
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="w-3 h-3" />
                  Email
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <EmailConfig onConfigChange={handleConfigChange} />
        </CardContent>
      </Card>
    </div>
  );
}
