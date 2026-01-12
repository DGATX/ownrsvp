'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { PublicNav } from '@/components/public-nav';

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [hasTemporaryUsername, setHasTemporaryUsername] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await fetch(`/api/auth/invite/${token}`);
        const data = await response.json();

        if (!data.valid) {
          setIsValid(false);
          setError(data.error || 'Invalid invitation link');
          if (data.alreadyAccepted) {
            setAlreadyAccepted(true);
          }
        } else {
          setIsValid(true);
          setEmail(data.email);
          setRole(data.role);
          setHasTemporaryUsername(data.hasTemporaryUsername || false);
          // Pre-fill name and username if available (username only if not temporary)
          setFormData((prev) => ({
            ...prev,
            name: data.name || '',
            username: data.hasTemporaryUsername ? '' : (data.username || ''),
          }));
        }
      } catch (error) {
        setIsValid(false);
        setError('Failed to verify invitation link');
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      verifyToken();
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    // Validate username format
    if (!formData.username || !/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      toast({
        title: 'Error',
        description: 'Username is required and can only contain letters, numbers, and underscores',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      toast({
        title: 'Success!',
        description: 'Your account has been set up. Signing you in...',
      });

      // Auto-login with the new credentials
      const signInResult = await signIn('credentials', {
        email: email, // Can use email or username
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // If auto-login fails, redirect to login page
        router.push('/login?message=Account setup complete. Please sign in.');
      } else {
        // Successfully logged in, go to dashboard
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
        <PublicNav />
        <div className="flex items-center justify-center min-h-screen pt-16">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </div>
    );
  }

  if (!isValid || alreadyAccepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
        <PublicNav />
        <div className="pt-24 pb-16 px-4">
          <div className="max-w-md mx-auto">
            <Card className="border-0 shadow-xl">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  {alreadyAccepted ? (
                    <CheckCircle2 className="w-16 h-16 text-green-600" />
                  ) : (
                    <AlertCircle className="w-16 h-16 text-red-600" />
                  )}
                </div>
                <CardTitle className="text-2xl">
                  {alreadyAccepted ? 'Invitation Already Accepted' : 'Invalid Invitation'}
                </CardTitle>
                <CardDescription>
                  {error || 'This invitation link is no longer valid.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                {alreadyAccepted ? (
                  <p className="text-muted-foreground mb-4">
                    This invitation has already been used. You can sign in with your account.
                  </p>
                ) : (
                  <p className="text-muted-foreground mb-4">
                    The invitation link may have expired or is invalid. Please contact an administrator for a new invitation.
                  </p>
                )}
                <Link href="/login">
                  <Button>Go to Sign In</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
      <PublicNav />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-md mx-auto">
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl">Accept Invitation</CardTitle>
              <CardDescription>
                Set up your account to get started with OwnRSVP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{email}</p>
                {role && (
                  <>
                    <p className="text-sm text-muted-foreground mb-1 mt-3">Role</p>
                    <p className="font-medium">{role === 'ADMIN' ? 'Administrator' : 'User'}</p>
                  </>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Choose your username *</Label>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    placeholder="Choose a username"
                    required
                    disabled={isSubmitting}
                    pattern="[a-zA-Z0-9_]+"
                    autoFocus={hasTemporaryUsername}
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters, numbers, and underscores only. This will be your login username.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <PasswordInput
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirm your password"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Accept Invitation & Create Account
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-4">
                By accepting this invitation, you agree to set up your account.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

