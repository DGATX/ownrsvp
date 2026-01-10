'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Users, Plus, Trash2, Loader2, Shield, Eye } from 'lucide-react';

interface CoHost {
  id: string;
  role: string;
  invitedAt: string | Date;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface ManageCoHostsProps {
  eventId: string;
  coHosts: CoHost[];
  isHost: boolean;
}

export function ManageCoHosts({ eventId, coHosts: initialCoHosts, isHost }: ManageCoHostsProps) {
  const { toast } = useToast();
  const [coHosts, setCoHosts] = useState<CoHost[]>(initialCoHosts);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'COHOST' | 'VIEWER'>('COHOST');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddCoHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/cohosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add co-host');
      }

      setCoHosts([...coHosts, data.coHost]);
      setEmail('');
      setRole('COHOST');
      setIsDialogOpen(false);

      toast({
        title: 'Co-host added!',
        description: `${data.coHost.user.name || data.coHost.user.email} can now help manage this event.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add co-host',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCoHost = async (cohostId: string, userName: string) => {
    if (!confirm(`Remove ${userName} as a co-host?`)) return;

    setDeletingId(cohostId);

    try {
      const response = await fetch(`/api/events/${eventId}/cohosts/${cohostId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove co-host');
      }

      setCoHosts(coHosts.filter((ch) => ch.id !== cohostId));

      toast({
        title: 'Co-host removed',
        description: `${userName} has been removed from this event.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove co-host',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Co-hosts
            </CardTitle>
            <CardDescription>
              People who can help manage this event
            </CardDescription>
          </div>
          {isHost && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Co-host
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddCoHost}>
                  <DialogHeader>
                    <DialogTitle>Add Co-host</DialogTitle>
                    <DialogDescription>
                      Add another user to help manage this event.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="cohost@example.com"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={role}
                        onValueChange={(value: 'COHOST' | 'VIEWER') => setRole(value)}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COHOST">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Co-host (Full access)
                            </div>
                          </SelectItem>
                          <SelectItem value="VIEWER">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              Viewer (View only)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Co-hosts can manage guests and send invitations. Viewers can only see the guest list.
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3">
                      <p className="text-xs text-blue-900 dark:text-blue-200">
                        <strong>Note:</strong> Co-hosts must already be registered users in the system. If someone needs an account, please contact an administrator to add them.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add Co-host
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {coHosts.length === 0 ? (
          <div className="space-y-3">
            <div className="text-center py-4 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No co-hosts yet</p>
              {isHost && (
                <p className="text-xs mt-1">Add co-hosts to help manage this event</p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 border p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Co-hosts must be registered users.</strong> If someone needs an account, please contact an administrator to add them to the system first.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {coHosts.map((coHost) => (
              <div
                key={coHost.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-violet-100 text-violet-700">
                      {(coHost.user.name || coHost.user.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {coHost.user.name || coHost.user.email}
                    </p>
                    {coHost.user.name && (
                      <p className="text-xs text-muted-foreground">{coHost.user.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {coHost.role === 'COHOST' ? (
                      <><Shield className="w-3 h-3 mr-1" /> Co-host</>
                    ) : (
                      <><Eye className="w-3 h-3 mr-1" /> Viewer</>
                    )}
                  </Badge>
                  {isHost && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveCoHost(coHost.id, coHost.user.name || coHost.user.email)}
                      disabled={deletingId === coHost.id}
                    >
                      {deletingId === coHost.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

