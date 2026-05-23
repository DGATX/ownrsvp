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
      <div className="min-h-screen flex items-center justify-center aurora-bg aurora-animated">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
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
    <div className="min-h-screen aurora-bg">
      <PublicNav />

      {/* Hero Section */}
      <section className="relative z-10 pt-28 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            {/* Left side - Hero content */}
            <div className="text-center lg:text-left">
              <p className="label-mono mb-5 animate-slide-up">Open-source · Self-hosted · No tracking</p>
              <h1 className="headline text-5xl md:text-6xl lg:text-7xl mb-6 animate-slide-up">
                Event invitations,
                <br />
                <span className="gradient-text">on your own terms.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-5 animate-slide-up leading-relaxed" style={{ animationDelay: '0.1s' }}>
                Beautiful event pages, invitations, co-hosts, broadcast updates, and automated
                reminders—running entirely on your own server. No tracking, no ads, complete privacy.
              </p>
              <p className="font-display italic text-xl text-primary max-w-xl mx-auto lg:mx-0 animate-slide-up" style={{ animationDelay: '0.15s' }}>
                Because f*ck Evite, that&apos;s why.
              </p>
            </div>

            {/* Right side - Sign in form */}
            <div className="relative z-10 animate-slide-up max-w-sm w-full mx-auto lg:mx-0 lg:justify-self-end" style={{ animationDelay: '0.2s' }}>
              <Card className="card-glow">
                <div className="h-1.5 bg-primary rounded-t-[3px]" />
                <CardHeader className="text-center pb-3 pt-6 px-6">
                  <p className="label-mono mb-2">Hosts only</p>
                  <CardTitle className="text-2xl">Sign in to manage your events</CardTitle>
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
                          className="text-primary hover:underline font-medium"
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

      {/* Features — printed index */}
      <section className="relative z-10 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-2">
            <h2 className="headline text-3xl md:text-4xl max-w-2xl">Everything you need to gather people</h2>
            <span className="label-mono hidden md:block whitespace-nowrap">Contents</span>
          </div>
          <hr className="ink-rule-double mb-10" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-[3px] overflow-hidden">
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
                className="group relative bg-card p-6 transition-colors hover:bg-muted/50 animate-slide-up"
                style={{ animationDelay: `${0.06 * index}s` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="label-mono text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <feature.icon className="w-5 h-5 text-primary opacity-80 transition-transform group-hover:scale-110" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2 leading-tight">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[3px] bg-primary flex items-center justify-center">
              <CalendarHeart className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-base">OwnRSVP</span>
          </div>
          <p className="label-mono">Self-hosted · Open source</p>
        </div>
      </footer>
    </div>
  );
}

export function HomePageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center aurora-bg aurora-animated">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
