# Fix Plan - rsvp-app-v2 Issues

**Priority**: Fix 2 TypeScript errors introduced by refactoring
**Estimated Time**: 15-30 minutes
**Difficulty**: Easy

---

## Priority 1: Critical Fixes (Refactoring-Related)

### Fix 1: api-response.ts Spread Operator Type Error

**File**: `/src/lib/api-response.ts:39`

**Error**:
```
error TS2698: Spread types may only be created from object types.
```

**Current Code (Line 35-41)**:
```typescript
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: message,
    ...(code && { code }),
    ...(details && { details }),
  };
```

**Fix**:
```typescript
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: message,
  };

  if (code) {
    response.code = code;
  }

  if (details) {
    response.details = details;
  }
```

**Why**: TypeScript doesn't like spreading potentially undefined values inline. Explicit assignment is clearer and type-safe.

---

### Fix 2: Logger Context Parameter Type Errors

**File**: `/src/app/api/events/route.ts:147-149`

**Errors**:
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'LogContext'.
error TS2345: Argument of type 'string[]' is not assignable to parameter of type 'LogContext'.
error TS2345: Argument of type 'string[][]' is not assignable to parameter of type 'LogContext'.
```

**Current Code (Lines 146-149)**:
```typescript
const logData = { ...eventData, image: eventData.image ? '[base64 image]' : null };
logger.info('Creating event with data:', JSON.stringify(logData, null, 2));
logger.info('Event data keys:', Object.keys(eventData));
logger.info('Event data types:', Object.entries(eventData).map(([k, v]) => [k, typeof v, v === null ? 'null' : 'not null']));
```

**Fix**:
```typescript
const logData = { ...eventData, image: eventData.image ? '[base64 image]' : null };
logger.info('Creating event with data', undefined, { data: JSON.stringify(logData, null, 2) });
logger.info('Event data keys', undefined, { keys: Object.keys(eventData) });
logger.info('Event data types', undefined, {
  types: Object.entries(eventData).map(([k, v]) => ({ key: k, type: typeof v, isNull: v === null }))
});
```

**Why**: The logger expects `(message: string, error?: Error, context?: LogContext)`. We need to pass `undefined` for error and use a proper object for context.

---

## Priority 2: Pre-Existing TypeScript Errors (Optional)

These errors existed before refactoring but should be fixed for production:

### Fix 3: SMS Type Definitions

**Files**: `/src/lib/sms.ts` (multiple locations)

**Errors**: Missing `SmsResult` type definition

**Fix**: Add type definition at top of file:
```typescript
export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

Then update all function return types:
```typescript
// Before:
export async function sendInvitationSMS(...): Promise<SmsResult> {

// After: (already correct if type is defined)
```

---

### Fix 4: SMS Config Provider Type

**Files**:
- `/src/lib/sms.ts:32-33`
- `/src/app/api/admin/config/sms/route.ts:275`

**Error**: `SmsConfig` provider can be undefined

**Fix**: Update getSmsConfig to ensure provider is never undefined:

```typescript
// In /src/lib/config.ts
const baseConfig: SmsConfig = {
  provider: provider || 'twilio', // Ensure default
};
```

---

### Fix 5: RSVP Route Property Access

**File**: `/src/app/api/rsvp/[token]/route.ts:37,49`

**Error**: Property 'event' does not exist

**Fix**: Check the Prisma include statement to ensure 'event' is included in the query, or update code to use proper relation access.

---

### Fix 6: Missing Radix UI Type

**File**: `/src/components/ui/radio-group.tsx:4`

**Error**: Cannot find module '@radix-ui/react-radio-group'

**Fix**:
```bash
npm install @radix-ui/react-radio-group
```

---

### Fix 7: Guest Limit Editor Type

**File**: `/src/components/guest-limit-editor.tsx:69`

**Error**: Type 'undefined' not assignable

**Fix**: Add null check:
```typescript
// Before:
setLocalLimit(guest.maxGuests);

// After:
setLocalLimit(guest.maxGuests ?? null);
```

---

### Fix 8: Public RSVP Form Undefined Handling

**File**: `/src/components/public-rsvp-form.tsx:260`

**Error**: 'maxGuestsPerInvitee' is possibly 'undefined'

**Fix**: Add optional chaining or default value:
```typescript
// Before:
if (maxGuestsPerInvitee > 0 && additionalGuests.length >= maxGuestsPerInvitee) {

// After:
if ((maxGuestsPerInvitee ?? 0) > 0 && additionalGuests.length >= (maxGuestsPerInvitee ?? 0)) {
```

---

### Fix 9: Admin Restart Route Comparison

**File**: `/src/app/api/admin/restart/route.ts:55,58`

**Error**: Unintentional comparison - types don't overlap

**Fix**: Check the logic - this might be a bug where wrong values are being compared.

---

## Quick Fix Script

Here's the fastest way to fix the 2 critical issues:

### Step 1: Fix api-response.ts

```bash
cd "/Users/dg/Desktop/demo project/rsvp-app-v2"

# Open the file
code src/lib/api-response.ts  # or use your preferred editor
```

**Replace lines 35-41 with**:
```typescript
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: message,
  };

  if (code) response.code = code;
  if (details) response.details = details;

  logger.error('API Error', undefined, { status, code, message });

  return NextResponse.json(response, { status });
}
```

### Step 2: Fix events/route.ts logger calls

```bash
# Open the file
code src/app/api/events/route.ts
```

**Find lines 146-149 and replace with**:
```typescript
const logData = { ...eventData, image: eventData.image ? '[base64 image]' : null };
logger.debug('Creating event with data', undefined, {
  data: logData,
  keys: Object.keys(eventData)
});
```

### Step 3: Verify Fixes

```bash
# Run TypeScript check
npx tsc --noEmit

# Should show 20 errors (down from 22)
# The 2 refactoring-related errors should be gone

# Run build
npm run build

# Should succeed
```

---

## Testing After Fixes

### 1. Run Automated Tests

```bash
node test-refactored-app.js
```

Expected: All 13 tests pass ✅

### 2. Manual Browser Test

1. Open http://localhost:3005
2. Login with:
   - Username: `admin`
   - Password: `admin`
3. Create a test event
4. Add a guest
5. Check server logs for proper log formatting

### 3. Verify No Console Errors

- Open browser DevTools
- Navigate through the app
- Check for any red errors (should be none)

---

## Summary

### Critical Fixes (Required Before Production)
- [ ] Fix `api-response.ts` spread operator (5 minutes)
- [ ] Fix `events/route.ts` logger calls (5 minutes)
- [ ] Test application after fixes (5 minutes)

**Total Time**: ~15 minutes

### Optional Fixes (Improve Code Quality)
- [ ] Fix pre-existing TypeScript errors (1-2 hours)
- [ ] Add missing type definitions (30 minutes)
- [ ] Install optional SMS provider packages (5 minutes)

---

## After All Fixes

Run complete validation:

```bash
# Type check
npx tsc --noEmit

# Build
npm run build

# Test
node test-refactored-app.js

# Deploy to staging
npm run build && [deploy command]
```

---

**Need Help?** Each fix includes:
- ✅ File location
- ✅ Current code
- ✅ Fixed code
- ✅ Explanation

Just copy-paste the fixes into the specified files!

