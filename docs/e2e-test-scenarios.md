# E2E Test Scenarios for Claude-in-Chrome

This document defines browser-based test scenarios for OwnRSVP that can be executed using Claude-in-Chrome MCP tools.

## Prerequisites

- App running at http://localhost:3000
- Fresh database (no users) for first-user registration tests
- Chrome browser with Claude-in-Chrome extension

## Test Session Setup

```
1. Get browser tab context: tabs_context_mcp
2. Create new tab or use existing
3. Navigate to http://localhost:3000
```

---

## P0 - Critical Path Tests

### Scenario 1: First-User Registration

**Purpose:** Verify the one-click installation flow works correctly.

**Preconditions:** No users in database (fresh installation)

**Steps:**
1. Navigate to `/register`
2. Verify "Create Admin Account" heading is visible
3. Fill in form:
   - Name: "Test Admin"
   - Username: "admin"
   - Email: "admin@test.com"
   - Password: "password123"
4. Click "Create Admin Account" button
5. Wait for redirect

**Expected Results:**
- Registration form is displayed (not "Registration Closed")
- After submission, redirected to `/login`
- Success toast message appears

**Verification:**
```
read_page with filter "interactive" to find form fields
get_page_text to verify headings
```

---

### Scenario 2: Admin Login

**Purpose:** Verify authentication works after registration.

**Preconditions:** Admin user exists (from Scenario 1)

**Steps:**
1. Navigate to `/login`
2. Enter username: "admin"
3. Enter password: "password123"
4. Click "Sign In" button
5. Wait for redirect

**Expected Results:**
- URL changes to `/dashboard`
- "Your Events" or event list is visible
- "Create Event" button is visible

**Verification:**
```
Check URL contains /dashboard
find "Create Event" button
```

---

### Scenario 3: Event Creation

**Purpose:** Verify events can be created.

**Preconditions:** Logged in as admin

**Steps:**
1. From dashboard, click "Create Event" button
2. Fill in form:
   - Title: "Test Birthday Party"
   - Date: [select future date]
   - Location: "123 Test Street"
   - Description: "A test event for E2E testing"
3. Click "Create Event" or "Save" button
4. Wait for redirect

**Expected Results:**
- Redirected to event detail page
- Event title visible on page
- Guest management section visible

**Verification:**
```
get_page_text to verify event title appears
find "Add Guest" or guest list section
```

---

### Scenario 4: Add Guest to Event

**Purpose:** Verify guests can be added to events.

**Preconditions:** Event exists (from Scenario 3)

**Steps:**
1. On event detail page, find "Add Guest" section
2. Enter guest email: "guest@test.com"
3. Enter guest name: "Test Guest"
4. Click "Add" or submit button
5. Wait for guest to appear in list

**Expected Results:**
- Guest appears in guest list
- Status shows as "Pending"
- Send invitation button is available

**Verification:**
```
find "guest@test.com" in guest list
Check status badge shows "Pending"
```

---

### Scenario 5: RSVP Submission

**Purpose:** Verify public RSVP flow works.

**Preconditions:** Guest exists with known token

**Steps:**
1. Get guest RSVP token from guest list or database
2. Navigate to `/rsvp/[token]`
3. Select "Attending" response
4. Fill in name if required
5. Click submit button
6. Wait for confirmation

**Expected Results:**
- RSVP form is displayed
- After submission, confirmation message shown
- Guest status updates to "Attending"

**Verification:**
```
Navigate back to event detail page
Verify guest status changed from "Pending" to "Attending"
```

---

## P1 - High Priority Tests

### Scenario 6: Send Invitation Email

**Purpose:** Verify email invitations can be sent.

**Preconditions:** SMTP configured, guest exists

**Steps:**
1. Navigate to event detail page
2. Find guest in list
3. Click "Send Invitation" or mail icon
4. Confirm sending
5. Wait for success message

**Expected Results:**
- Success toast appears
- "Invited" timestamp or status updates

---

### Scenario 7: Edit RSVP

**Purpose:** Verify guests can edit their RSVP.

**Preconditions:** Guest has already submitted RSVP

**Steps:**
1. Navigate to `/rsvp/[token]/edit`
2. Change response (e.g., "Attending" to "Maybe")
3. Submit changes

**Expected Results:**
- Edit form shows current response
- Changes are saved
- Confirmation message appears

---

### Scenario 8: Event Editing

**Purpose:** Verify event details can be modified.

**Preconditions:** Event exists, logged in as host

**Steps:**
1. Navigate to event detail page
2. Click "Edit" button
3. Modify title or date
4. Save changes

**Expected Results:**
- Edit form pre-filled with current values
- Changes are saved
- Event detail page shows updated info

---

### Scenario 9: Admin SMTP Configuration

**Purpose:** Verify SMTP can be configured via UI.

**Preconditions:** Logged in as admin

**Steps:**
1. Navigate to `/dashboard/admin` or Admin panel
2. Find Configuration or Email Settings section
3. Enter SMTP details:
   - Host: smtp.test.com
   - Port: 587
   - User: test@test.com
   - Password: testpassword
4. Save configuration
5. Test email sending

**Expected Results:**
- Configuration is saved
- Test email button works (or appropriate error)

---

## P2 - Medium Priority Tests

### Scenario 10: Bulk Guest Import

**Purpose:** Verify CSV import works.

**Steps:**
1. Navigate to event detail page
2. Find import button
3. Upload CSV with multiple guests
4. Confirm import

**Expected Results:**
- All guests from CSV appear in list
- Import summary shows count

---

### Scenario 11: Co-host Management

**Purpose:** Verify co-hosts can be added.

**Steps:**
1. Navigate to event detail page
2. Find co-host section
3. Add co-host by email/username
4. Verify co-host appears

---

### Scenario 12: Comments System

**Purpose:** Verify guests can leave comments.

**Steps:**
1. Navigate to public event page
2. Find comment section
3. Submit a comment
4. Verify comment appears

---

### Scenario 13: Password Reset Flow

**Purpose:** Verify password reset works.

**Steps:**
1. Navigate to `/forgot-password`
2. Enter email
3. Verify success message

---

## Test Execution Tips

### Using Claude-in-Chrome Tools

**Taking Screenshots:**
```
computer action="screenshot"
```

**Reading Page Content:**
```
read_page tabId=XXX
get_page_text tabId=XXX
```

**Finding Elements:**
```
find query="Create Event button" tabId=XXX
find query="email input field" tabId=XXX
```

**Interacting:**
```
form_input ref="ref_X" value="test@test.com" tabId=XXX
computer action="left_click" ref="ref_X" tabId=XXX
```

**Navigation:**
```
navigate url="http://localhost:3000/register" tabId=XXX
```

### Common Issues

1. **Page not loading:** Check if dev server is running
2. **Form submission fails:** Verify all required fields are filled
3. **Redirect not happening:** Wait longer or check for errors
4. **Element not found:** Try scrolling or use different query

### Resetting Test State

To reset for fresh testing:
```bash
# Reset database
docker compose down -v
docker compose up -d

# Or for local dev
rm prisma/dev.db
npm run db:push
```
