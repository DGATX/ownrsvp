'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    // Read directly from form to ensure we get the actual input values
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
          description: 'Invalid email/username or password. Please check your credentials and try again.',
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
    <div className="min-h-screen flex items-center justify-center aurora-bg p-4">
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-10 h-10 rounded-[3px] bg-primary flex items-center justify-center shadow-[0_1px_0_hsl(var(--foreground)/0.15)] transition-transform group-hover:-rotate-6">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-2xl tracking-tight">OwnRSVP</span>
          </Link>
        </div>

        <Card className="card-glow">
          <div className="h-1.5 bg-primary rounded-t-[3px]" />
          <CardHeader className="text-center pb-4 pt-6">
            <p className="label-mono mb-2">Welcome back</p>
            <CardTitle className="text-2xl">Sign in to your events</CardTitle>
            <CardDescription>Manage invitations, guests, and RSVPs</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email or Username</Label>
                <Input
                  id="email"
                  name="email"
                  type="text"
                  placeholder="Enter your email or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline font-medium"
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
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign In
              </Button>
              <p className="text-sm text-muted-foreground text-center">
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
  );
}

