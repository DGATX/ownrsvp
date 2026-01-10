'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, X, HelpCircle, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { validateGuestLimit } from '@/lib/rsvp-validation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';

interface Guest {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: 'PENDING' | 'ATTENDING' | 'NOT_ATTENDING' | 'MAYBE';
  dietaryNotes: string | null;
  additionalGuests: Array<{ id: string; name: string }>;
  maxGuests?: number | null;
  event: {
    id: string;
    title: string;
    date: Date;
    location: string | null;
    slug: string;
    maxGuestsPerInvitee: number | null;
  };
}

export default function EditRsvpPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = params.token as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    additionalGuests: [] as string[],
    dietaryNotes: '',
  });

  // Calculate guest limit validation
  const guestLimitValidation = useMemo(() => {
    if (!guest || selectedStatus !== 'ATTENDING') {
      return { valid: true, remaining: Infinity };
    }
    // Use per-guest limit if set, otherwise use global limit
    return validateGuestLimit(guest.event.maxGuestsPerInvitee, formData.additionalGuests.length, guest.maxGuests);
  }, [guest, guest?.event.maxGuestsPerInvitee, guest?.maxGuests, formData.additionalGuests.length, selectedStatus]);

  const canAddMoreGuests = guestLimitValidation.remaining !== undefined && guestLimitValidation.remaining > 0;

  useEffect(() => {
    async function fetchRsvp() {
      try {
        const response = await fetch(`/api/rsvp/${token}`);
        if (!response.ok) {
          throw new Error('Failed to load RSVP');
        }
        const data = await response.json();
        setGuest(data.guest);
        setSelectedStatus(data.guest.status);
        setFormData({
          name: data.guest.name || '',
          phone: data.guest.phone || '',
          additionalGuests: data.guest.additionalGuests?.map((ag: { name: string }) => ag.name) || [],
          dietaryNotes: data.guest.dietaryNotes || '',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load your RSVP. Please check your link.',
          variant: 'destructive',
        });
        router.push('/events');
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      fetchRsvp();
    }
  }, [token, router, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStatus) {
      toast({
        title: 'Please select your response',
        description: 'Let us know if you can attend.',
        variant: 'destructive',
      });
      return;
    }

    // Validate guest limit before submission
    if (selectedStatus === 'ATTENDING' && guest) {
      const validation = validateGuestLimit(guest.event.maxGuestsPerInvitee, formData.additionalGuests.length, guest.maxGuests);
      if (!validation.valid) {
        toast({
          title: 'Too many guests',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/rsvp/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || null,
          status: selectedStatus,
          additionalGuests: formData.additionalGuests.filter((g) => g.trim().length > 0),
          dietaryNotes: formData.dietaryNotes || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update RSVP');
      }

      toast({
        title: 'RSVP Updated!',
        description: 'Your response has been updated.',
      });

      router.push(`/events/${guest?.event.slug}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update RSVP',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!guest) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <Link href={`/events/${guest.event.slug}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Event
          </Link>

          {/* Event Info */}
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">{guest.event.title}</CardTitle>
              <div className="space-y-2 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{formatDateTime(guest.event.date)}</span>
                </div>
                {guest.event.location && (
                  <div className="flex items-center gap-2">
                    <span>{guest.event.location}</span>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Edit RSVP Form */}
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Edit Your RSVP</CardTitle>
              <CardDescription>
                Update your response and guest information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Response Options */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('ATTENDING')}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                      selectedStatus === 'ATTENDING'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      selectedStatus === 'ATTENDING' ? 'bg-green-500' : 'bg-gray-100'
                    )}>
                      <Check className={cn('w-5 h-5', selectedStatus === 'ATTENDING' ? 'text-white' : 'text-gray-400')} />
                    </div>
                    <span className={cn('font-medium', selectedStatus === 'ATTENDING' ? 'text-green-700' : 'text-gray-600')}>
                      Attending
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('MAYBE')}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                      selectedStatus === 'MAYBE'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-amber-300'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      selectedStatus === 'MAYBE' ? 'bg-amber-500' : 'bg-gray-100'
                    )}>
                      <HelpCircle className={cn('w-5 h-5', selectedStatus === 'MAYBE' ? 'text-white' : 'text-gray-400')} />
                    </div>
                    <span className={cn('font-medium', selectedStatus === 'MAYBE' ? 'text-amber-700' : 'text-gray-600')}>
                      Maybe
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('NOT_ATTENDING')}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                      selectedStatus === 'NOT_ATTENDING'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      selectedStatus === 'NOT_ATTENDING' ? 'bg-red-500' : 'bg-gray-100'
                    )}>
                      <X className={cn('w-5 h-5', selectedStatus === 'NOT_ATTENDING' ? 'text-white' : 'text-gray-400')} />
                    </div>
                    <span className={cn('font-medium', selectedStatus === 'NOT_ATTENDING' ? 'text-red-700' : 'text-gray-600')}>
                      Can&apos;t Go
                    </span>
                  </button>
                </div>

                {/* Guest Info */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={guest.email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (optional, for SMS updates)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>

                {selectedStatus === 'ATTENDING' && (
                  <>
                    {/* Additional Guests */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Additional Guests</Label>
                        {(() => {
                          const effectiveLimit = guest?.maxGuests !== null && guest?.maxGuests !== undefined 
                            ? guest.maxGuests 
                            : guest?.event.maxGuestsPerInvitee;
                          return effectiveLimit !== null && effectiveLimit !== undefined;
                        })() && (
                          <span className="text-xs text-muted-foreground">
                            {guestLimitValidation.remaining === Infinity
                              ? 'Unlimited'
                              : `${guestLimitValidation.remaining} guest${guestLimitValidation.remaining !== 1 ? 's' : ''} remaining`}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          // Use per-guest limit if set, otherwise use global limit
                          const effectiveLimit = guest?.maxGuests !== null && guest?.maxGuests !== undefined 
                            ? guest.maxGuests 
                            : guest?.event.maxGuestsPerInvitee;
                          
                          if (effectiveLimit === null || effectiveLimit === undefined) {
                            return "Add the names of any additional guests you're bringing";
                          }
                          return `You can bring up to ${effectiveLimit - 1} additional guest${effectiveLimit - 1 !== 1 ? 's' : ''} (total of ${effectiveLimit} including yourself)`;
                        })()}
                      </p>
                      {formData.additionalGuests.map((guestName, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder={`Guest ${index + 1} name`}
                            value={guestName}
                            onChange={(e) => {
                              const newGuests = [...formData.additionalGuests];
                              newGuests[index] = e.target.value;
                              setFormData({ ...formData, additionalGuests: newGuests });
                            }}
                            disabled={isSubmitting}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                additionalGuests: formData.additionalGuests.filter((_, i) => i !== index),
                              });
                            }}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            additionalGuests: [...formData.additionalGuests, ''],
                          });
                        }}
                        disabled={isSubmitting || !canAddMoreGuests}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Another Guest
                      </Button>
                      {!canAddMoreGuests && (() => {
                        const effectiveLimit = guest?.maxGuests !== null && guest?.maxGuests !== undefined 
                          ? guest.maxGuests 
                          : guest?.event.maxGuestsPerInvitee;
                        return effectiveLimit !== null && effectiveLimit !== undefined;
                      })() && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          You&apos;ve reached the maximum number of guests allowed ({(() => {
                            const effectiveLimit = guest?.maxGuests !== null && guest?.maxGuests !== undefined 
                              ? guest.maxGuests 
                              : guest?.event.maxGuestsPerInvitee;
                            return effectiveLimit;
                          })()} total including yourself)
                        </p>
                      )}
                    </div>

                    {/* Dietary Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="dietaryNotes">Dietary restrictions or notes (optional)</Label>
                      <Textarea
                        id="dietaryNotes"
                        name="dietaryNotes"
                        placeholder="Any allergies or dietary restrictions..."
                        value={formData.dietaryNotes}
                        onChange={(e) => setFormData({ ...formData, dietaryNotes: e.target.value })}
                        rows={2}
                        disabled={isSubmitting}
                      />
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !selectedStatus}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update RSVP
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

