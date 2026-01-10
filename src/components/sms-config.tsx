'use client';

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
import { Loader2, MessageSquare, Save, X, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

type SmsProvider = 'twilio' | 'aws-sns' | 'vonage' | 'messagebird' | 'generic';

interface SmsConfigData {
  provider?: SmsProvider;
  // Twilio
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  // AWS SNS
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  // Vonage
  apiKey?: string;
  apiSecret?: string;
  from?: string;
  // MessageBird
  originator?: string;
  // Generic
  webhookUrl?: string;
  customHeaders?: Record<string, string>;
}

interface SmsConfigProps {
  onConfigChange?: () => void;
}

export function SmsConfig({ onConfigChange }: SmsConfigProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  // Load test phone from localStorage on mount
  const [testPhone, setTestPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sms_test_phone') || '';
    }
    return '';
  });
  const [provider, setProvider] = useState<SmsProvider>('twilio');
  const [config, setConfig] = useState<SmsConfigData>({
    provider: 'twilio',
    accountSid: '',
    authToken: '',
    phoneNumber: '',
  });
  const [originalConfig, setOriginalConfig] = useState<SmsConfigData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  // Save test phone to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && testPhone) {
      localStorage.setItem('sms_test_phone', testPhone);
    }
  }, [testPhone]);

  useEffect(() => {
    if (originalConfig) {
      const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
      setHasChanges(changed);
    } else {
      // If no original config exists, check if user has entered any values
      // For Twilio, check if all required fields have values
      if (provider === 'twilio') {
        const hasValues = !!(config.accountSid || config.authToken || config.phoneNumber);
        setHasChanges(hasValues);
      } else if (provider === 'aws-sns') {
        const hasValues = !!(config.accessKeyId || config.secretAccessKey || config.region);
        setHasChanges(hasValues);
      } else if (provider === 'vonage') {
        const hasValues = !!(config.apiKey || config.apiSecret || config.from);
        setHasChanges(hasValues);
      } else if (provider === 'messagebird') {
        const hasValues = !!(config.apiKey || config.originator);
        setHasChanges(hasValues);
      } else if (provider === 'generic') {
        const hasValues = !!config.webhookUrl;
        setHasChanges(hasValues);
      } else {
        setHasChanges(false);
      }
    }
  }, [config, originalConfig, provider]);

  async function loadConfig() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/config/sms');
      if (response.ok) {
        const data = await response.json();
        if (data.configured && data.config) {
          const providerType = (data.provider || data.config.provider || 'twilio') as SmsProvider;
          setProvider(providerType);
          
          // Build config object based on provider
          const newConfig: SmsConfigData = {
            provider: providerType,
          };

          if (providerType === 'twilio') {
            newConfig.accountSid = data.config.accountSid || '';
            // If token is masked, preserve the current value in state instead of clearing
            newConfig.authToken = data.config.authToken?.includes('*') 
              ? (config.authToken || '') // Keep existing value if masked
              : (data.config.authToken || '');
            newConfig.phoneNumber = data.config.phoneNumber || '';
          } else if (providerType === 'aws-sns') {
            newConfig.accessKeyId = data.config.accessKeyId || '';
            // If secret is masked, preserve the current value in state instead of clearing
            newConfig.secretAccessKey = data.config.secretAccessKey?.includes('*') 
              ? (config.secretAccessKey || '') // Keep existing value if masked
              : (data.config.secretAccessKey || '');
            newConfig.region = data.config.region || 'us-east-1';
            newConfig.phoneNumber = data.config.phoneNumber || '';
          } else if (providerType === 'vonage') {
            newConfig.apiKey = data.config.apiKey || '';
            // If secret is masked, preserve the current value in state instead of clearing
            newConfig.apiSecret = data.config.apiSecret?.includes('*') 
              ? (config.apiSecret || '') // Keep existing value if masked
              : (data.config.apiSecret || '');
            newConfig.from = data.config.from || '';
          } else if (providerType === 'messagebird') {
            newConfig.apiKey = data.config.apiKey || '';
            newConfig.originator = data.config.originator || '';
          } else if (providerType === 'generic') {
            newConfig.webhookUrl = data.config.webhookUrl || '';
            // If API key is masked, preserve the current value in state instead of clearing
            newConfig.apiKey = data.config.apiKey?.includes('*') 
              ? (config.apiKey || '') // Keep existing value if masked
              : (data.config.apiKey || '');
            newConfig.customHeaders = data.config.customHeaders || {};
          }

          setConfig(newConfig);
          setOriginalConfig(newConfig);
        } else {
          // No config - set defaults
          setProvider('twilio');
          setConfig({ provider: 'twilio' });
          setOriginalConfig(null); // Explicitly set to null for first-time setup
        }
      }
    } catch (error) {
      console.error('Failed to load SMS config:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    // Validate based on provider
    if (provider === 'twilio') {
      if (!config.accountSid || !config.authToken || !config.phoneNumber) {
        toast({
          title: 'Error',
          description: 'Please fill in all required Twilio fields',
          variant: 'destructive',
        });
        return;
      }
      if (!config.phoneNumber.startsWith('+')) {
        toast({
          title: 'Error',
          description: 'Phone number must include country code (e.g., +15551234567)',
          variant: 'destructive',
        });
        return;
      }
    } else if (provider === 'aws-sns') {
      if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
        toast({
          title: 'Error',
          description: 'Please fill in all required AWS SNS fields',
          variant: 'destructive',
        });
        return;
      }
    } else if (provider === 'vonage') {
      if (!config.apiKey || !config.apiSecret || !config.from) {
        toast({
          title: 'Error',
          description: 'Please fill in all required Vonage fields',
          variant: 'destructive',
        });
        return;
      }
    } else if (provider === 'messagebird') {
      if (!config.apiKey || !config.originator) {
        toast({
          title: 'Error',
          description: 'Please fill in all required MessageBird fields',
          variant: 'destructive',
        });
        return;
      }
    } else if (provider === 'generic') {
      if (!config.webhookUrl) {
        toast({
          title: 'Error',
          description: 'Please provide a webhook URL',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/config/sms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          provider,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Configuration saved!',
          description: data.restartRequired
            ? 'Configuration saved. Please restart the server for changes to take effect.'
            : 'SMS configuration updated successfully.',
        });
        // Update originalConfig with current values (including unmasked tokens)
        // This preserves the actual values in the form fields
        setOriginalConfig({ ...config, provider });
        setHasChanges(false);
        // Don't reload config after saving - it would mask the tokens
        // onConfigChange?.();
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
    if (!testPhone) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number to test',
        variant: 'destructive',
      });
      return;
    }

    if (!testPhone.startsWith('+')) {
      toast({
        title: 'Error',
        description: 'Phone number must include country code (e.g., +15551234567)',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/admin/config/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPhone }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Test SMS sent!',
          description: `Test SMS sent to ${testPhone}. Please check your phone.`,
        });
        // Keep the phone number in the field for easy re-testing
      } else {
        throw new Error(data.error || data.details || 'Failed to send test SMS');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test SMS',
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
          <Label htmlFor="sms-provider">SMS Provider</Label>
          <Select value={provider} onValueChange={(value) => {
            const newProvider = value as SmsProvider;
            setProvider(newProvider);
            setConfig(prev => ({ ...prev, provider: newProvider }));
            setHasChanges(true);
          }}>
            <SelectTrigger id="sms-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="twilio">
                <div className="flex items-center gap-2">
                  <span>Twilio</span>
                  <span className="text-xs text-muted-foreground">(Recommended)</span>
                </div>
              </SelectItem>
              <SelectItem value="aws-sns">AWS SNS</SelectItem>
              <SelectItem value="vonage">Vonage</SelectItem>
              <SelectItem value="messagebird">MessageBird</SelectItem>
              <SelectItem value="generic">Generic/Webhook</SelectItem>
            </SelectContent>
          </Select>
          {provider === 'twilio' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-md text-sm flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-blue-800 dark:text-blue-200">
                Twilio is the default and recommended SMS provider. It's optimized for performance and reliability.
              </p>
            </div>
          )}
        </div>

        {/* Twilio Configuration */}
        {provider === 'twilio' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Twilio Account SID</Label>
              <Input
                id="twilio-account-sid"
                type="text"
                value={config.accountSid || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, accountSid: e.target.value }))}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Found in your Twilio Console dashboard
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilio-auth-token">Twilio Auth Token</Label>
              <PasswordInput
                id="twilio-auth-token"
                value={config.authToken || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder="Enter your auth token"
              />
              <p className="text-xs text-muted-foreground">
                Found in your Twilio Console dashboard (keep this secret)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilio-phone-number">Twilio Phone Number</Label>
              <Input
                id="twilio-phone-number"
                type="tel"
                value={config.phoneNumber || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="+15551234567"
              />
              <p className="text-xs text-muted-foreground">
                Must include country code (e.g., +1 for US, +44 for UK)
              </p>
            </div>
          </>
        )}

        {/* AWS SNS Configuration */}
        {provider === 'aws-sns' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="aws-access-key-id">AWS Access Key ID</Label>
              <Input
                id="aws-access-key-id"
                type="text"
                value={config.accessKeyId || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, accessKeyId: e.target.value }))}
                placeholder="AKIAIOSFODNN7EXAMPLE"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aws-secret-access-key">AWS Secret Access Key</Label>
              <PasswordInput
                id="aws-secret-access-key"
                value={config.secretAccessKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                placeholder="Enter your secret access key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aws-region">AWS Region</Label>
              <Input
                id="aws-region"
                type="text"
                value={config.region || 'us-east-1'}
                onChange={(e) => setConfig(prev => ({ ...prev, region: e.target.value }))}
                placeholder="us-east-1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aws-phone-number">Phone Number (Optional)</Label>
              <Input
                id="aws-phone-number"
                type="tel"
                value={config.phoneNumber || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="+15551234567"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Default phone number for sending SMS
              </p>
            </div>
          </>
        )}

        {/* Vonage Configuration */}
        {provider === 'vonage' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="vonage-api-key">Vonage API Key</Label>
              <Input
                id="vonage-api-key"
                type="text"
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter your API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vonage-api-secret">Vonage API Secret</Label>
              <PasswordInput
                id="vonage-api-secret"
                value={config.apiSecret || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                placeholder="Enter your API secret"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vonage-from">From Number/Sender ID</Label>
              <Input
                id="vonage-from"
                type="text"
                value={config.from || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, from: e.target.value }))}
                placeholder="+15551234567 or OwnRSVP"
              />
              <p className="text-xs text-muted-foreground">
                Phone number or alphanumeric sender ID
              </p>
            </div>
          </>
        )}

        {/* MessageBird Configuration */}
        {provider === 'messagebird' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="messagebird-api-key">MessageBird API Key</Label>
              <Input
                id="messagebird-api-key"
                type="text"
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter your API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="messagebird-originator">Originator</Label>
              <Input
                id="messagebird-originator"
                type="text"
                value={config.originator || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, originator: e.target.value }))}
                placeholder="+15551234567 or OwnRSVP"
              />
              <p className="text-xs text-muted-foreground">
                Phone number or alphanumeric sender ID
              </p>
            </div>
          </>
        )}

        {/* Generic/Webhook Configuration */}
        {provider === 'generic' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="generic-webhook-url">Webhook URL</Label>
              <Input
                id="generic-webhook-url"
                type="url"
                value={config.webhookUrl || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                placeholder="https://api.example.com/sms/send"
              />
              <p className="text-xs text-muted-foreground">
                Your custom SMS API endpoint that accepts POST requests with `to` and `message` fields
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="generic-api-key">API Key (Optional)</Label>
              <PasswordInput
                id="generic-api-key"
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter API key if required"
              />
              <p className="text-xs text-muted-foreground">
                Will be sent as Bearer token in Authorization header
              </p>
            </div>
          </>
        )}
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
                  setProvider(originalConfig.provider || 'twilio');
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
          <Label htmlFor="test-phone">Test Phone Number</Label>
          <div className="flex gap-2">
            <Input
              id="test-phone"
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+15551234567"
              disabled={isTesting}
            />
            <Button
              onClick={handleTest}
              disabled={isTesting || !testPhone}
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Test
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Make sure to include country code (e.g., +1 for US)
          </p>
        </div>
      </div>
    </div>
  );
}

