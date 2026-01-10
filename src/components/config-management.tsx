'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmailConfig } from './email-config';
import { SmsConfig } from './sms-config';
import { Mail, MessageSquare, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConfigManagement() {
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [smsConfigured, setSmsConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/config');
      if (response.ok) {
        const data = await response.json();
        setEmailConfigured(data.email?.configured || false);
        setSmsConfigured(data.sms?.configured || false);
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
          <CardTitle>Email & SMS Configuration</CardTitle>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Email & SMS Configuration</CardTitle>
            <CardDescription>
              Configure SMTP and Twilio settings for email and SMS notifications
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
            {smsConfigured ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                SMS
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />
                SMS
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="w-4 h-4" />
              Email (SMTP)
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              SMS
            </TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="mt-6">
            <EmailConfig onConfigChange={handleConfigChange} />
          </TabsContent>
          <TabsContent value="sms" className="mt-6">
            <SmsConfig onConfigChange={handleConfigChange} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

