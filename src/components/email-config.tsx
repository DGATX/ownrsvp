'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    host: 'smtp.gmail.com',
    port: '587',
    user: '',
    password: '',
    from: '',
  });
  const [originalConfig, setOriginalConfig] = useState<EmailConfigData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Immediately populate password from localStorage on mount
    const storedPassword = localStorage.getItem('smtp_password');
    if (storedPassword) {
      setConfig(prev => ({ ...prev, password: storedPassword }));
    }
    // Then load full config from API
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
      // Always check localStorage first for the password - prioritize stored value
      const storedPassword = localStorage.getItem('smtp_password');

      const response = await fetch('/api/admin/config/email');
      if (response.ok) {
        const data = await response.json();
        if (data.configured && data.config) {
          // Always use stored password from localStorage if available
          // The API always returns masked password, so localStorage is our source of truth
          const password = storedPassword || '';

          // If we have a stored password, use it; otherwise leave empty (user needs to enter it)
          // Don't use the masked password from API (contains *)

          const newConfig = {
            host: data.config.host || 'smtp.gmail.com',
            port: data.config.port || '587',
            user: data.config.user || '',
            password: password,
            from: data.config.from || '',
          };
          setConfig(newConfig);
          setOriginalConfig(newConfig);
        } else {
          // Config not set yet - set originalConfig to empty defaults so changes can be detected
          const emptyConfig = {
            host: 'smtp.gmail.com',
            port: '587',
            user: '',
            password: storedPassword || '',
            from: '',
          };
          setConfig(emptyConfig);
          setOriginalConfig(emptyConfig);
        }
      }
    } catch (error) {
      logger.error('Failed to load email config:', error);
      // Even if API fails, set originalConfig so save button can work
      const storedPassword = localStorage.getItem('smtp_password');
      const emptyConfig = {
        host: 'smtp.gmail.com',
        port: '587',
        user: '',
        password: storedPassword || '',
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
        // Store password in localStorage so it persists after refresh
        localStorage.setItem('smtp_password', config.password);
        
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

  function handleHostChange(host: string) {
    setConfig(prev => {
      const newConfig = { ...prev, host };
      // Auto-set port based on host
      if (host === 'smtp.gmail.com') {
        newConfig.port = '587';
      } else if (host === 'smtp.sendgrid.net') {
        newConfig.port = '587';
      } else if (host === 'smtp.mailgun.org') {
        newConfig.port = '587';
      }
      return newConfig;
    });
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
          <Select value={config.host} onValueChange={handleHostChange}>
            <SelectTrigger id="smtp-host">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smtp.gmail.com">Gmail (smtp.gmail.com)</SelectItem>
              <SelectItem value="smtp.sendgrid.net">SendGrid (smtp.sendgrid.net)</SelectItem>
              <SelectItem value="smtp.mailgun.org">Mailgun (smtp.mailgun.org)</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {config.host === 'custom' && (
            <Input
              placeholder="Enter custom SMTP host"
              value={config.host === 'custom' ? '' : config.host}
              onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
            />
          )}
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
          <Label htmlFor="smtp-user">SMTP User (Email)</Label>
          <Input
            id="smtp-user"
            type="email"
            value={config.user}
            onChange={(e) => setConfig(prev => ({ ...prev, user: e.target.value }))}
            placeholder="your-email@gmail.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-password">SMTP Password</Label>
          <PasswordInput
            id="smtp-password"
            value={config.password}
            onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Enter app password"
          />
          <p className="text-xs text-muted-foreground">
            For Gmail, use an App Password (not your regular password)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-from">From Address (Optional)</Label>
          <Input
            id="smtp-from"
            type="text"
            value={config.from}
            onChange={(e) => setConfig(prev => ({ ...prev, from: e.target.value }))}
            placeholder="OwnRSVP <your-email@gmail.com>"
          />
          <p className="text-xs text-muted-foreground">
            Format: Name &lt;email@example.com&gt; or just email@example.com
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

