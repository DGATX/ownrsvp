'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, User, Sun, Moon, Monitor, Lock, AlertCircle, Bell } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { cn, isValidEmail } from '@/lib/utils';

function ProfilePageContent() {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [name, setName] = useState(session?.user?.name || '');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [notifyOnRsvpChanges, setNotifyOnRsvpChanges] = useState(true);
  const [isSavingNotification, setIsSavingNotification] = useState(false);
  const [mounted, setMounted] = useState(false);
  const showEmailWarning = searchParams.get('updateEmail') === 'true';
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setName(data.user.name || '');
            // Ensure username is set - if null/undefined, generate a default or show error
            if (!data.user.username) {
              logger.warn('User does not have a username. This should not happen after migration.');
              // Try to generate a username from email as fallback
              const emailPrefix = data.user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
              setUsername(emailPrefix);
            } else {
              setUsername(data.user.username);
            }
            setEmail(data.user.email || '');
            setNotifyOnRsvpChanges(data.user.notifyOnRsvpChanges ?? true);
          }
        } else {
          const errorData = await response.json();
          logger.error('Failed to fetch user data:', errorData);
          toast({
            title: 'Error',
            description: errorData.error || 'Failed to load profile data',
            variant: 'destructive',
          });
        }
      } catch (error) {
        logger.error('Failed to fetch user data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile data. Please refresh the page.',
          variant: 'destructive',
        });
      }
    }
    fetchUserData();
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    // Validate email format
    if (!isValidEmail(email)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Validate username format
    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
      toast({
        title: 'Error',
        description: 'Username is required and can only contain letters, numbers, and underscores',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Profile update error:', data);
        throw new Error(data.error || data.details?.[0]?.message || 'Failed to update profile');
      }

      // Update session with new name and email
      await update({ 
        name: data.user.name,
        email: data.user.email,
      });

      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleThemeChange(newTheme: string) {
    setTheme(newTheme);
    setIsSavingTheme(true);

    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });

      toast({
        title: 'Theme updated',
        description: `Theme set to ${newTheme}.`,
      });
    } catch {
      // Theme is already applied locally, just log the error
      logger.error('Failed to save theme preference');
    } finally {
      setIsSavingTheme(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      });
      
      // Clear the form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="space-y-6">
        {/* Email Update Warning */}
        {showEmailWarning && (
          <Card className="border-0 shadow-xl bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Email Address Required
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    A valid email address is required for password reset functionality. Please update your email address below to continue using all features.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Settings */}
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Profile Settings</CardTitle>
                <CardDescription>{session?.user?.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username"
                  disabled={isLoading}
                  required
                  pattern="[a-zA-Z0-9_]+"
                />
                <p className="text-sm text-muted-foreground">
                  Letters, numbers, and underscores only. Used for login along with your email.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  This is the name that will be shown to your guests.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={isLoading}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Must be a valid email address. Required for password reset functionality.
                </p>
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </form>
        </Card>

        {/* Password Settings */}
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handlePasswordChange}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <PasswordInput
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  disabled={isChangingPassword}
                  required
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  disabled={isChangingPassword}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isChangingPassword}
                  required
                />
              </div>

              <Button type="submit" variant="secondary" disabled={isChangingPassword}>
                {isChangingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </CardContent>
          </form>
        </Card>

        {/* Appearance Settings */}
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Appearance</CardTitle>
            <CardDescription>
              Customize how the app looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {mounted && themeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeChange(option.value)}
                    disabled={isSavingTheme}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                      theme === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <option.icon className={cn(
                      'w-6 h-6',
                      theme === option.value ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      theme === option.value ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Select your preferred theme. System will automatically match your device settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Email Notifications</CardTitle>
                <CardDescription>
                  Control when you receive email notifications
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="notifyOnRsvpChanges"
                  checked={notifyOnRsvpChanges}
                  onCheckedChange={async (checked) => {
                    const newValue = checked as boolean;
                    setNotifyOnRsvpChanges(newValue);
                    setIsSavingNotification(true);
                    try {
                      const response = await fetch('/api/user/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notifyOnRsvpChanges: newValue }),
                      });
                      if (response.ok) {
                        toast({
                          title: 'Notification preference updated',
                          description: newValue 
                            ? 'You will receive email notifications when guests RSVP or update their RSVP.'
                            : 'You will no longer receive RSVP change notifications.',
                        });
                      } else {
                        // Revert on error
                        setNotifyOnRsvpChanges(!newValue);
                        throw new Error('Failed to update notification preference');
                      }
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to update notification preference',
                        variant: 'destructive',
                      });
                    } finally {
                      setIsSavingNotification(false);
                    }
                  }}
                  disabled={isSavingNotification}
                />
                <div className="space-y-1 flex-1">
                  <Label
                    htmlFor="notifyOnRsvpChanges"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Receive email notifications when guests RSVP or update their RSVP
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified instantly when guests respond to your events or make changes to their RSVP.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}
