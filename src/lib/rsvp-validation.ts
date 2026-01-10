/**
 * Validate guest limit for RSVP submissions
 * @param globalMaxGuests - Global maximum total guests allowed (including invitee), null for unlimited
 * @param additionalGuestsCount - Number of additional guests being brought
 * @param guestMaxGuests - Optional per-guest override limit (takes priority over global)
 * @returns Validation result with error message and remaining guest slots
 */
export function validateGuestLimit(
  globalMaxGuests: number | null,
  additionalGuestsCount: number,
  guestMaxGuests?: number | null
): { valid: boolean; error?: string; remaining?: number } {
  // Priority: per-guest limit > global limit > unlimited
  const maxGuestsPerInvitee = guestMaxGuests !== undefined && guestMaxGuests !== null 
    ? guestMaxGuests 
    : globalMaxGuests;
  
  if (maxGuestsPerInvitee === null) {
    return { valid: true, remaining: Infinity };
  }
  
  const totalGuests = 1 + additionalGuestsCount;
  const remaining = maxGuestsPerInvitee - totalGuests;
  
  if (totalGuests > maxGuestsPerInvitee) {
    return {
      valid: false,
      error: `You can only bring ${maxGuestsPerInvitee - 1} additional guest${maxGuestsPerInvitee - 1 !== 1 ? 's' : ''} (total of ${maxGuestsPerInvitee} including yourself)`,
      remaining: 0
    };
  }
  
  return { valid: true, remaining };
}

