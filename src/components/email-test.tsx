'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function EmailTest() {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [configStatus, setConfigStatus] = useState<{
    configured: boolean;
    missing: string[];
    warnings: string[];
    config: {
      host: string;
      port: string;
      user: string;
      from: string;
    } | null;
  } | null>(null);

  useEffect(() => {
    checkConfig();
  }, []);

  async function checkConfig() {
    setIsCheckingConfig(true);
    try {
      const response = await fetch('/api/test-email');
      if (response.ok) {
        const data = await response.json();
        setConfigStatus(data);
      } else {
        setConfigStatus({
          configured: false,
          missing: [],
          warnings: [],
          config: null,
        });
      }
    } catch (error) {
      console.error('Failed to check email config:', error);
      setConfigStatus({
        configured: false,
        missing: [],
        warnings: [],
        config: null,
      });
    } finally {
      setIsCheckingConfig(false);
    }
  }

  async function handleTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Test email sent!',
          description: `Test email sent to ${testEmail}. Please check your inbox.`,
        });
        setTestEmail('');
      } else {
        toast({
          title: 'Failed to send test email',
          description: data.error || data.details || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isCheckingConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>Checking SMTP configuration...</CardDescription>
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
            <CardTitle>Email Configuration Test</CardTitle>
            <CardDescription>
              Test your Gmail SMTP configuration by sending a test email
            </CardDescription>
          </div>
          {configStatus?.configured ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configStatus?.configured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  SMTP Not Configured
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  Please configure SMTP environment variables in your <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">.env</code> file:
                </p>
                <ul className="text-sm text-amber-800 dark:text-amber-200 list-disc list-inside space-y-1">
                  {configStatus?.missing.map((varName) => (
                    <li key={varName}>
                      <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">{varName}</code>
                    </li>
                  ))}
                </ul>
                {configStatus?.warnings && configStatus.warnings.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Warnings:</p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                      {configStatus.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                    SMTP Configured
                  </h3>
                  <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                    <p><strong>Host:</strong> {configStatus.config?.host}</p>
                    <p><strong>Port:</strong> {configStatus.config?.port}</p>
                    <p><strong>User:</strong> {configStatus.config?.user}</p>
                    <p><strong>From:</strong> {configStatus.config?.from}</p>
                  </div>
                  {configStatus.warnings && configStatus.warnings.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Note:</p>
                      <ul className="text-sm text-green-700 dark:text-green-300 list-disc list-inside">
                        {configStatus.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleTestEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testEmail">Test Email Address</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-email@gmail.com"
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter an email address to send a test invitation email
                </p>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
            </form>
          </>
        )}

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={checkConfig}
            disabled={isCheckingConfig}
            className="w-full"
          >
            {isCheckingConfig ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              'Refresh Configuration Status'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

