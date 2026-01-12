'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Loader2, Mail, Save, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface EmailConfigData {
  host: string;
  port: string;
  user: string;
  password: string;
  from?: string;
}

interface EmailConfigProps {
  onConfigChange?: () => void;
}

export function EmailConfig({ onConfigChange }: EmailConfigProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [config, setConfig] = useState<EmailConfigData>({
    host: '',
    port: '587',
    user: '',
    password: '',
    from: '',
  });
  const [originalConfig, setOriginalConfig] = useState<EmailConfigData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (originalConfig) {
      const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
      setHasChanges(changed);
    }
  }, [config, originalConfig]);

  async function loadConfig() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/config/email');
      if (response.ok) {
        const data = await response.json();
        if (data.configured && data.config) {
          const newConfig = {
            host: data.config.host || '',
            port: data.config.port || '587',
            user: data.config.user || '',
            password: data.config.password || '',
            from: data.config.from || '',
          };
          setConfig(newConfig);
          setOriginalConfig(newConfig);
        } else {
          // Config not set yet - set originalConfig to empty defaults so changes can be detected
          const emptyConfig = {
            host: '',
            port: '587',
            user: '',
            password: '',
            from: '',
          };
          setConfig(emptyConfig);
          setOriginalConfig(emptyConfig);
        }
      }
    } catch (error) {
      logger.error('Failed to load email config:', error);
      // Even if API fails, set originalConfig so save button can work
      const emptyConfig = {
        host: '',
        port: '587',
        user: '',
        password: '',
        from: '',
      };
      setConfig(emptyConfig);
      setOriginalConfig(emptyConfig);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!config.host || !config.port || !config.user || !config.password) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/config/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Configuration saved!',
          description: data.restartRequired
            ? 'Configuration saved. Please restart the server for changes to take effect.'
            : 'Email configuration updated successfully.',
        });
        setOriginalConfig({ ...config });
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

  async function handleTest() {
    if (!testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter an email address to test',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/admin/config/email', {
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
        throw new Error(data.error || data.details || 'Failed to send test email');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
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
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="smtp-host">SMTP Host</Label>
          <Input
            id="smtp-host"
            type="text"
            value={config.host}
            onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
            placeholder="smtp.resend.com"
          />
          <p className="text-xs text-muted-foreground">
            e.g., smtp.resend.com, smtp.gmail.com, smtp.sendgrid.net
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-port">SMTP Port</Label>
          <Input
            id="smtp-port"
            type="text"
            value={config.port}
            onChange={(e) => setConfig(prev => ({ ...prev, port: e.target.value }))}
            placeholder="587"
          />
          <p className="text-xs text-muted-foreground">
            Usually 587 for TLS or 465 for SSL
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-user">SMTP Username</Label>
          <Input
            id="smtp-user"
            type="text"
            value={config.user}
            onChange={(e) => setConfig(prev => ({ ...prev, user: e.target.value }))}
            placeholder="resend or your-email@gmail.com"
          />
          <p className="text-xs text-muted-foreground">
            For Resend use &quot;resend&quot;, for Gmail use your email address
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-password">SMTP Password / API Key</Label>
          <PasswordInput
            id="smtp-password"
            value={config.password}
            onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
            placeholder="API key or app password"
          />
          <p className="text-xs text-muted-foreground">
            For Resend use your API key, for Gmail use an App Password
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-from">From Address</Label>
          <Input
            id="smtp-from"
            type="text"
            value={config.from}
            onChange={(e) => setConfig(prev => ({ ...prev, from: e.target.value }))}
            placeholder="OwnRSVP <noreply@yourdomain.com>"
          />
          <p className="text-xs text-muted-foreground">
            Format: Name &lt;email@yourdomain.com&gt; - must match your verified domain
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
        {hasChanges && (
          <Button
            variant="outline"
            onClick={() => {
              if (originalConfig) {
                setConfig({ ...originalConfig });
                setHasChanges(false);
              }
            }}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>

      <div className="pt-4 border-t space-y-3">
        <div className="space-y-2">
          <Label htmlFor="test-email">Test Email Address</Label>
          <div className="flex gap-2">
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              disabled={isTesting}
            />
            <Button
              onClick={handleTest}
              disabled={isTesting || !testEmail}
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Test
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

