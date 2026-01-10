'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Megaphone, Loader2, Mail, MessageSquare, Send } from 'lucide-react';

interface BroadcastDialogProps {
  eventId: string;
  stats: {
    total: number;
    attending: number;
    notAttending: number;
    maybe: number;
    pending: number;
  };
}

export function BroadcastDialog({ eventId, stats }: BroadcastDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ATTENDING' | 'NOT_ATTENDING' | 'MAYBE' | 'PENDING'>('ALL');

  const getRecipientCount = () => {
    switch (filterStatus) {
      case 'ATTENDING':
        return stats.attending;
      case 'NOT_ATTENDING':
        return stats.notAttending;
      case 'MAYBE':
        return stats.maybe;
      case 'PENDING':
        return stats.pending;
      default:
        return stats.total;
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please enter a subject and message.',
        variant: 'destructive',
      });
      return;
    }

    if (!sendEmail && !sendSms) {
      toast({
        title: 'Select delivery method',
        description: 'Please select at least one delivery method (Email or SMS).',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const sendVia = sendEmail && sendSms ? 'BOTH' : sendEmail ? 'EMAIL' : 'SMS';

      const response = await fetch(`/api/events/${eventId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message,
          sendVia,
          filterStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send broadcast');
      }

      toast({
        title: 'Broadcast sent!',
        description: `Message sent to ${data.sentTo} guest${data.sentTo !== 1 ? 's' : ''}.`,
      });

      // Reset form and close
      setSubject('');
      setMessage('');
      setSendEmail(true);
      setSendSms(false);
      setFilterStatus('ALL');
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Failed to send',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const recipientCount = getRecipientCount();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Megaphone className="w-4 h-4" />
          Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Send Broadcast
          </DialogTitle>
          <DialogDescription>
            Send an update to your guests via email and/or SMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient Filter */}
          <div className="space-y-2">
            <Label>Send To</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Guests ({stats.total})</SelectItem>
                <SelectItem value="ATTENDING">Attending ({stats.attending})</SelectItem>
                <SelectItem value="PENDING">Pending ({stats.pending})</SelectItem>
                <SelectItem value="MAYBE">Maybe ({stats.maybe})</SelectItem>
                <SelectItem value="NOT_ATTENDING">Not Attending ({stats.notAttending})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Method */}
          <div className="space-y-2">
            <Label>Delivery Method</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(!!checked)}
                  disabled={isLoading}
                />
                <Label htmlFor="send-email" className="flex items-center gap-1 cursor-pointer font-normal">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-sms"
                  checked={sendSms}
                  onCheckedChange={(checked) => setSendSms(!!checked)}
                  disabled={isLoading}
                />
                <Label htmlFor="send-sms" className="flex items-center gap-1 cursor-pointer font-normal">
                  <MessageSquare className="w-4 h-4" />
                  SMS
                </Label>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Important update about the event"
              disabled={isLoading}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              rows={4}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {sendSms && message.length > 160 && (
                <span className="text-amber-600">
                  SMS messages over 160 characters may be split into multiple messages.
                </span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            Will be sent to {recipientCount} guest{recipientCount !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isLoading || recipientCount === 0}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Broadcast
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

