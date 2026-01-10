'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ManageRsvpProps {
  eventId: string;
  guestEmail?: string | null;
  rsvpToken?: string | null;
}

export function ManageRsvp({ eventId, guestEmail, rsvpToken }: ManageRsvpProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState(guestEmail || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/rsvp/send-edit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, eventId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send edit link');
      }

      toast({
        title: 'Edit link sent!',
        description: 'Check your email for a link to edit your RSVP.',
      });

      setEmail('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send edit link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // If guest has a token, show direct edit button
  if (rsvpToken) {
    return (
      <Card className="border-2 border-violet-200 dark:border-violet-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Manage Your RSVP
          </CardTitle>
          <CardDescription>
            You can edit your RSVP details at any time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href={`/rsvp/${rsvpToken}/edit`}>
            <Button className="w-full gap-2">
              <ExternalLink className="w-4 h-4" />
              Edit Your RSVP
            </Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Manage Your RSVP
        </CardTitle>
        <CardDescription>
          Enter your email to receive a link to edit your RSVP
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendEditLink} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Edit Link
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

