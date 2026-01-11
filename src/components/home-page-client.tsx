'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Mail, Users, CalendarHeart, ArrowRight, Check, Loader2 } from 'lucide-react';
import { PublicNav } from '@/components/public-nav';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Check if this is a fresh install (no users exist) and redirect to registration
  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch('/api/auth/public-register');
        const data = await res.json();
        if (data.registrationEnabled) {
          // No users exist - redirect to registration
          router.replace('/register');
          return;
        }
      } catch {
        // If check fails, just show the login page
      }
      setIsCheckingSetup(false);
    }
    checkSetup();
  }, [router]);

  // Show loading while checking setup status
  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get('email') as string || email;
    const passwordValue = formData.get('password') as string || password;

    try {
      const result = await signIn('credentials', {
        email: emailValue,
        password: passwordValue,
        redirect: false,
      });

      if (result?.error) {
        toast({
          title: 'Error',
          description: 'Invalid email or password. Please check your credentials and try again.',
          variant: 'destructive',
        });
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: 'Unable to sign in. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Login error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
      <PublicNav />

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left side - Hero content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs font-medium mb-4 animate-fade-in">
                <CalendarHeart className="w-3 h-3" />
                Self-hosted event management
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 animate-slide-up">
                Self-Hosted Event Management
                <br />
                <span className="gradient-text">That Puts You in Control</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                Create beautiful event pages, send invitations, and manage RSVPs with advanced features like co-hosts,
                broadcast updates, and automated reminders—all from your own server. No tracking, no ads, complete privacy.
              </p>
              <p className="text-base font-medium text-violet-600 dark:text-violet-400 max-w-2xl mx-auto lg:mx-0 mb-6 animate-slide-up italic" style={{ animationDelay: '0.15s' }}>
                Because f*ck Evite, that&apos;s why.
              </p>
            </div>

            {/* Right side - Sign in form */}
            <div className="animate-slide-up max-w-sm mx-auto lg:mx-0" style={{ animationDelay: '0.2s' }}>
              <Card className="border-0 shadow-xl">
                <CardHeader className="text-center pb-3 pt-5 px-5">
                  <CardTitle className="text-xl">Sign in to manage your events</CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-3 px-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm">Email or Username</Label>
                      <Input
                        id="email"
                        name="email"
                        type="text"
                        placeholder="Enter your email or username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm">Password</Label>
                        <Link
                          href="/forgot-password"
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <PasswordInput
                        id="password"
                        name="password"
                        placeholder=""
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-9 text-sm"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3 px-5 pb-5">
                    <Button type="submit" className="w-full h-9 text-sm" disabled={isLoading}>
                      {isLoading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                      Sign In
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Don&apos;t have an account?{' '}
                      <Link href="/register" className="text-primary hover:underline font-medium">
                        Sign up
                      </Link>
                    </p>
                  </CardFooter>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Powerful features for modern event management</h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Everything you need to create, manage, and host successful events—with complete control over your data.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Calendar,
                title: 'Event Pages & Calendar',
                description: 'Create beautiful, shareable event pages with cover images. One-click add to calendar for Google, Outlook, Apple, and more.',
              },
              {
                icon: Mail,
                title: 'Invitations & Communication',
                description: 'Send invitations via email or SMS, broadcast updates to all guests, and automatically notify when event details change.',
              },
              {
                icon: Users,
                title: 'Guest Management & Collaboration',
                description: 'Track RSVPs, manage plus-ones, see dietary requirements, export/import guest lists, and invite co-hosts to help manage events.',
              },
              {
                icon: Check,
                title: 'RSVP & Reminders',
                description: 'One-click RSVP with deadlines. Automatically remind guests who haven\'t responded via email or SMS—no account needed.',
              },
              {
                icon: CalendarHeart,
                title: 'Guest Engagement',
                description: 'Let guests leave messages on the guest wall and get excited about the event together.',
              },
              {
                icon: ArrowRight,
                title: 'Self-Hosted & Private',
                description: 'Your data stays on your server. Complete privacy, no tracking, no ads. Deploy with Docker in minutes.',
              },
            ].map((feature, index) => (
              <div
                key={feature.title}
                className="p-5 rounded-xl bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow animate-slide-up"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/50 dark:to-indigo-900/50 flex items-center justify-center mb-3">
                  <feature.icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-base font-semibold mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <CalendarHeart className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">OwnRSVP</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Self-hosted event management. Open source.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function HomePageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
