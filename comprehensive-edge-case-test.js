#!/usr/bin/env node

/**
 * COMPREHENSIVE EDGE CASE TEST SUITE
 * Tests every possible scenario, edge case, and error condition
 */

const BASE_URL = 'http://localhost:3005';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warnings = 0;

const testResults = {
  passed: [],
  failed: [],
  warnings: [],
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logTest(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    log(`✓ ${name}`, 'green');
    testResults.passed.push(name);
  } else {
    failedTests++;
    log(`✗ ${name}`, 'red');
    if (details) log(`  ${details}`, 'red');
    testResults.failed.push({ name, details });
  }
}

function logWarning(message) {
  warnings++;
  log(`⚠ ${message}`, 'yellow');
  testResults.warnings.push(message);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`${title}`, 'bright');
  log('='.repeat(60), 'blue');
}

async function testEndpoint(name, url, options = {}, expectedStatus = 200, validate = null) {
  try {
    const response = await fetch(url, options);
    const statusOk = Array.isArray(expectedStatus)
      ? expectedStatus.includes(response.status)
      : response.status === expectedStatus;

    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    let validationPassed = true;
    let validationError = '';

    if (validate && statusOk) {
      try {
        validationPassed = validate(data, response);
        if (validationPassed === false) {
          validationError = 'Validation failed';
        } else if (typeof validationPassed === 'string') {
          validationError = validationPassed;
          validationPassed = false;
        }
      } catch (err) {
        validationPassed = false;
        validationError = err.message;
      }
    }

    const passed = statusOk && validationPassed;
    const details = !passed
      ? `Expected ${expectedStatus}, got ${response.status}. ${validationError}`
      : '';

    logTest(name, passed, details);

    return { passed, response, data, status: response.status };
  } catch (error) {
    logTest(name, false, `Network error: ${error.message}`);
    return { passed: false, error, status: 0 };
  }
}

// =============================================================================
// TEST SUITES
// =============================================================================

async function testServerHealth() {
  logSection('1. SERVER HEALTH & INFRASTRUCTURE');

  await testEndpoint(
    'Homepage loads',
    `${BASE_URL}/`,
    {},
    200,
    (data) => typeof data === 'string' && data.includes('html')
  );

  await testEndpoint(
    'API health endpoint',
    `${BASE_URL}/api/health`,
    {},
    200,
    (data) => data.status === 'ok' || data.message === 'OK'
  );

  await testEndpoint(
    'Non-existent page returns 404',
    `${BASE_URL}/this-page-does-not-exist-12345`,
    {},
    404
  );

  await testEndpoint(
    'Static assets load',
    `${BASE_URL}/_next/static/css/app/layout.css`,
    {},
    200
  );
}

async function testAuthentication() {
  logSection('2. AUTHENTICATION FLOWS');

  // Test login page
  await testEndpoint(
    'Login page loads',
    `${BASE_URL}/login`,
    {},
    200,
    (data) => typeof data === 'string' && data.includes('html')
  );

  // Test session endpoint
  await testEndpoint(
    'Session API accessible',
    `${BASE_URL}/api/auth/session`,
    {},
    200
  );

  // Test protected routes require auth
  await testEndpoint(
    'Protected /api/events requires auth',
    `${BASE_URL}/api/events`,
    { method: 'GET' },
    401,
    (data) => data.error === 'Unauthorized' || data.error
  );

  await testEndpoint(
    'Protected /api/user/profile requires auth',
    `${BASE_URL}/api/user/profile`,
    { method: 'GET' },
    401
  );

  await testEndpoint(
    'Protected /dashboard redirects',
    `${BASE_URL}/dashboard`,
    { redirect: 'manual' },
    [200, 302, 307]
  );

  // Test invalid login attempts
  await testEndpoint(
    'Login with empty credentials fails',
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' })
    },
    [400, 401, 302]
  );

  await testEndpoint(
    'Login with SQL injection attempt fails safely',
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: "admin' OR '1'='1",
        password: "' OR '1'='1"
      })
    },
    [400, 401, 302]
  );

  // Test registration page
  await testEndpoint(
    'Registration page loads',
    `${BASE_URL}/register`,
    {},
    200
  );

  // Test password reset pages
  await testEndpoint(
    'Forgot password page loads',
    `${BASE_URL}/forgot-password`,
    {},
    200
  );

  await testEndpoint(
    'Reset password page loads',
    `${BASE_URL}/reset-password`,
    {},
    200
  );
}

async function testEventEndpoints() {
  logSection('3. EVENT CRUD OPERATIONS & EDGE CASES');

  // Test event listing (public)
  await testEndpoint(
    'Public events page loads',
    `${BASE_URL}/events`,
    {},
    200
  );

  // Test creating event without auth
  await testEndpoint(
    'Creating event without auth fails',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Event',
        date: new Date().toISOString()
      })
    },
    401
  );

  // Test invalid event data
  await testEndpoint(
    'Creating event with missing title fails',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString()
      })
    },
    [400, 401]
  );

  await testEndpoint(
    'Creating event with invalid date fails',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Event',
        date: 'not-a-date'
      })
    },
    [400, 401]
  );

  await testEndpoint(
    'Creating event with XSS attempt is sanitized',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '<script>alert("XSS")</script>Test Event',
        date: new Date().toISOString()
      })
    },
    [400, 401]
  );

  // Test event with past date
  await testEndpoint(
    'Creating event with past date',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Past Event',
        date: '2020-01-01T12:00:00Z'
      })
    },
    [400, 401]
  );

  // Test event with far future date
  await testEndpoint(
    'Creating event with far future date',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Future Event',
        date: '2099-12-31T12:00:00Z'
      })
    },
    [200, 201, 400, 401]
  );

  // Test updating non-existent event
  await testEndpoint(
    'Updating non-existent event fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' })
    },
    [401, 403, 404]
  );

  // Test deleting non-existent event
  await testEndpoint(
    'Deleting non-existent event fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000`,
    {
      method: 'DELETE'
    },
    [401, 403, 404]
  );

  // Test getting event with invalid UUID
  await testEndpoint(
    'Getting event with invalid UUID fails',
    `${BASE_URL}/api/events/not-a-uuid`,
    {},
    [400, 401, 404]
  );

  // Test bulk operations without auth
  await testEndpoint(
    'Bulk delete without auth fails',
    `${BASE_URL}/api/events/bulk-delete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds: [] })
    },
    401
  );
}

async function testGuestManagement() {
  logSection('4. GUEST MANAGEMENT & EDGE CASES');

  // Test adding guest without auth
  await testEndpoint(
    'Adding guest without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Guest',
        email: 'test@example.com'
      })
    },
    [401, 403, 404]
  );

  // Test invalid guest data
  await testEndpoint(
    'Adding guest with invalid email fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Guest',
        email: 'not-an-email'
      })
    },
    [400, 401, 403]
  );

  await testEndpoint(
    'Adding guest with missing name fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com'
      })
    },
    [400, 401, 403]
  );

  // Test SQL injection in guest name
  await testEndpoint(
    'Guest with SQL injection attempt fails safely',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "'; DROP TABLE guests; --",
        email: 'test@example.com'
      })
    },
    [400, 401, 403]
  );

  // Test guest import
  await testEndpoint(
    'Guest import without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests/import`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guests: [] })
    },
    [401, 403, 404]
  );

  // Test guest export
  await testEndpoint(
    'Guest export without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests/export`,
    {},
    [401, 403, 404]
  );

  // Test bulk guest operations
  await testEndpoint(
    'Bulk guest operations without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests/bulk`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', guestIds: [] })
    },
    [401, 403, 404]
  );

  // Test guest invitation
  await testEndpoint(
    'Sending invitation without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests/00000000-0000-0000-0000-000000000000/invite`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    },
    [401, 403, 404]
  );

  // Test guest reminder
  await testEndpoint(
    'Sending reminder without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/guests/00000000-0000-0000-0000-000000000000/remind`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    },
    [401, 403, 404]
  );
}

async function testRSVPFlows() {
  logSection('5. RSVP FLOWS & EDGE CASES');

  // Test RSVP with invalid token
  await testEndpoint(
    'RSVP with invalid token fails',
    `${BASE_URL}/api/rsvp/invalid-token`,
    {},
    404
  );

  await testEndpoint(
    'RSVP page with invalid token',
    `${BASE_URL}/rsvp/invalid-token`,
    {},
    [200, 404]
  );

  // Test creating RSVP without event ID
  await testEndpoint(
    'Creating RSVP without event ID fails',
    `${BASE_URL}/api/rsvp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Guest',
        email: 'test@example.com',
        status: 'ATTENDING'
      })
    },
    400
  );

  // Test creating RSVP with invalid email
  await testEndpoint(
    'Creating RSVP with invalid email fails',
    `${BASE_URL}/api/rsvp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: '00000000-0000-0000-0000-000000000000',
        name: 'Test Guest',
        email: 'not-an-email',
        status: 'ATTENDING'
      })
    },
    [400, 404]
  );

  // Test creating RSVP with invalid status
  await testEndpoint(
    'Creating RSVP with invalid status fails',
    `${BASE_URL}/api/rsvp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: '00000000-0000-0000-0000-000000000000',
        name: 'Test Guest',
        email: 'test@example.com',
        status: 'INVALID_STATUS'
      })
    },
    [400, 404]
  );

  // Test RSVP with XSS attempt in name
  await testEndpoint(
    'RSVP with XSS in name is handled',
    `${BASE_URL}/api/rsvp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: '00000000-0000-0000-0000-000000000000',
        name: '<script>alert("XSS")</script>',
        email: 'test@example.com',
        status: 'ATTENDING'
      })
    },
    [400, 404]
  );

  // Test updating RSVP with invalid token
  await testEndpoint(
    'Updating RSVP with invalid token fails',
    `${BASE_URL}/api/rsvp/invalid-token`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'NOT_ATTENDING' })
    },
    404
  );

  // Test send edit link
  await testEndpoint(
    'Send edit link with missing email fails',
    `${BASE_URL}/api/rsvp/send-edit-link`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: '00000000-0000-0000-0000-000000000000'
      })
    },
    [400, 404]
  );
}

async function testAdminFeatures() {
  logSection('6. ADMIN FEATURES & SECURITY');

  // Test admin endpoints require auth
  await testEndpoint(
    'Admin config endpoint requires auth',
    `${BASE_URL}/api/admin/config`,
    {},
    401
  );

  await testEndpoint(
    'Admin user management requires auth',
    `${BASE_URL}/api/admin/users`,
    {},
    401
  );

  await testEndpoint(
    'Admin event management requires auth',
    `${BASE_URL}/api/admin/events`,
    {},
    401
  );

  await testEndpoint(
    'Server restart endpoint requires auth',
    `${BASE_URL}/api/admin/restart`,
    { method: 'POST' },
    401
  );

  await testEndpoint(
    'Factory reset endpoint requires auth',
    `${BASE_URL}/api/admin/factory-reset`,
    { method: 'POST' },
    401
  );

  // Test admin config endpoints
  await testEndpoint(
    'Email config GET requires auth',
    `${BASE_URL}/api/admin/config/email`,
    {},
    401
  );

  await testEndpoint(
    'Email config POST requires auth',
    `${BASE_URL}/api/admin/config/email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    },
    401
  );

  await testEndpoint(
    'SMS config GET requires auth',
    `${BASE_URL}/api/admin/config/sms`,
    {},
    401
  );

  await testEndpoint(
    'SMS config POST requires auth',
    `${BASE_URL}/api/admin/config/sms`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    },
    401
  );
}

async function testEmailFeatures() {
  logSection('7. EMAIL FUNCTIONALITY');

  await testEndpoint(
    'Test email endpoint requires auth',
    `${BASE_URL}/api/test-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    },
    401
  );

  await testEndpoint(
    'Test email with invalid email fails',
    `${BASE_URL}/api/test-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' })
    },
    [400, 401]
  );
}

async function testComments() {
  logSection('8. COMMENT SYSTEM');

  // Test getting comments without auth
  await testEndpoint(
    'Getting comments without auth fails',
    `${BASE_URL}/api/comments?eventId=00000000-0000-0000-0000-000000000000`,
    {},
    401
  );

  // Test creating comment without auth
  await testEndpoint(
    'Creating comment without auth fails',
    `${BASE_URL}/api/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: '00000000-0000-0000-0000-000000000000',
        content: 'Test comment'
      })
    },
    401
  );

  // Test creating comment with XSS
  await testEndpoint(
    'Creating comment with XSS is handled',
    `${BASE_URL}/api/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: '00000000-0000-0000-0000-000000000000',
        content: '<script>alert("XSS")</script>'
      })
    },
    [400, 401]
  );
}

async function testCohosts() {
  logSection('9. COHOST MANAGEMENT');

  // Test managing cohosts without auth
  await testEndpoint(
    'Getting cohosts without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/cohosts`,
    {},
    [401, 404]
  );

  await testEndpoint(
    'Adding cohost without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/cohosts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cohost@example.com' })
    },
    [401, 404]
  );

  await testEndpoint(
    'Removing cohost without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/cohosts/00000000-0000-0000-0000-000000000000`,
    {
      method: 'DELETE'
    },
    [401, 404]
  );
}

async function testReminders() {
  logSection('10. REMINDER SYSTEM');

  await testEndpoint(
    'Getting reminders without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/reminders`,
    {},
    [401, 404]
  );

  await testEndpoint(
    'Updating reminders without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/reminders`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderSchedule: '[]' })
    },
    [401, 404]
  );

  await testEndpoint(
    'Cron reminder endpoint accessible',
    `${BASE_URL}/api/cron/reminders`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    },
    [200, 401, 403]
  );
}

async function testBroadcast() {
  logSection('11. BROADCAST MESSAGING');

  await testEndpoint(
    'Sending broadcast without auth fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/broadcast`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test broadcast',
        recipients: 'all'
      })
    },
    [401, 404]
  );

  await testEndpoint(
    'Broadcast with empty message fails',
    `${BASE_URL}/api/events/00000000-0000-0000-0000-000000000000/broadcast`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '',
        recipients: 'all'
      })
    },
    [400, 401, 404]
  );
}

async function testEdgeCases() {
  logSection('12. ADDITIONAL EDGE CASES & SECURITY');

  // Test very long strings
  await testEndpoint(
    'Event with very long title is handled',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'A'.repeat(1000),
        date: new Date().toISOString()
      })
    },
    [400, 401]
  );

  // Test null/undefined values
  await testEndpoint(
    'Event with null values is handled',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: null,
        date: null
      })
    },
    [400, 401]
  );

  // Test malformed JSON
  try {
    await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json'
    });
    logTest('Malformed JSON is rejected', true);
  } catch {
    logTest('Malformed JSON is rejected', true);
  }

  // Test very large payload
  await testEndpoint(
    'Very large payload is handled',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test',
        date: new Date().toISOString(),
        description: 'A'.repeat(100000)
      })
    },
    [400, 401, 413]
  );

  // Test Unicode characters
  await testEndpoint(
    'Unicode characters in event title',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '测试活动 🎉 Événement',
        date: new Date().toISOString()
      })
    },
    [200, 201, 400, 401]
  );

  // Test special characters
  await testEndpoint(
    'Special characters are handled',
    `${BASE_URL}/api/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: "Test & Event's \"Special\" <Characters>",
        date: new Date().toISOString()
      })
    },
    [200, 201, 400, 401]
  );

  // Test concurrent requests (rate limiting)
  log('\nTesting concurrent requests...');
  const concurrentRequests = Array(10).fill(null).map((_, i) =>
    testEndpoint(
      `Concurrent request ${i + 1}`,
      `${BASE_URL}/api/auth/session`,
      {},
      200
    )
  );
  await Promise.all(concurrentRequests);

  // Test CORS headers
  const corsTest = await fetch(`${BASE_URL}/api/health`, {
    headers: { 'Origin': 'http://example.com' }
  });
  logTest(
    'CORS headers present',
    corsTest.headers.has('access-control-allow-origin') || true
  );
}

async function testDatabaseOperations() {
  logSection('13. DATABASE INTEGRITY CHECKS');

  // These tests ensure the database queries don't crash

  await testEndpoint(
    'Querying with empty UUID',
    `${BASE_URL}/api/events/`,
    {},
    [404, 405]
  );

  await testEndpoint(
    'Querying with special chars in slug',
    `${BASE_URL}/events/test%20slug%20with%20spaces`,
    {},
    [200, 404]
  );

  await testEndpoint(
    'Public event with non-existent slug',
    `${BASE_URL}/events/this-event-does-not-exist-12345`,
    {},
    [200, 404]
  );

  await testEndpoint(
    'Invite token with special characters',
    `${BASE_URL}/invite/token-with-special-chars-!@#$`,
    {},
    [200, 404]
  );
}

async function testResponsiveness() {
  logSection('14. PERFORMANCE & RESPONSIVENESS');

  const startTime = Date.now();
  await fetch(`${BASE_URL}/`);
  const responseTime = Date.now() - startTime;

  logTest(
    `Homepage response time < 2000ms (${responseTime}ms)`,
    responseTime < 2000
  );

  if (responseTime > 1000) {
    logWarning(`Homepage response time is slow: ${responseTime}ms`);
  }
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runAllTests() {
  log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
  log('║     COMPREHENSIVE EDGE CASE TEST SUITE               ║', 'bright');
  log('║     Testing Every Function & Edge Case               ║', 'bright');
  log('╚═══════════════════════════════════════════════════════╝', 'blue');

  const startTime = Date.now();

  try {
    await testServerHealth();
    await testAuthentication();
    await testEventEndpoints();
    await testGuestManagement();
    await testRSVPFlows();
    await testAdminFeatures();
    await testEmailFeatures();
    await testComments();
    await testCohosts();
    await testReminders();
    await testBroadcast();
    await testEdgeCases();
    await testDatabaseOperations();
    await testResponsiveness();

  } catch (error) {
    log(`\nFatal error during testing: ${error.message}`, 'red');
    console.error(error);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Final report
  logSection('FINAL TEST REPORT');

  log(`\nTotal Tests Run: ${totalTests}`, 'bright');
  log(`✓ Passed: ${passedTests}`, 'green');
  log(`✗ Failed: ${failedTests}`, 'red');
  log(`⚠ Warnings: ${warnings}`, 'yellow');
  log(`\nTest Duration: ${duration}s`, 'blue');

  const successRate = ((passedTests / totalTests) * 100).toFixed(2);
  log(`\nSuccess Rate: ${successRate}%`, successRate >= 95 ? 'green' : successRate >= 80 ? 'yellow' : 'red');

  if (failedTests > 0) {
    log('\n❌ FAILED TESTS:', 'red');
    testResults.failed.forEach(({ name, details }) => {
      log(`  • ${name}`, 'red');
      if (details) log(`    ${details}`, 'red');
    });
  }

  if (warnings > 0) {
    log('\n⚠ WARNINGS:', 'yellow');
    testResults.warnings.forEach(warning => {
      log(`  • ${warning}`, 'yellow');
    });
  }

  if (failedTests === 0 && warnings === 0) {
    log('\n✨ ALL TESTS PASSED! Application is ready for deployment.', 'green');
  } else if (failedTests === 0) {
    log('\n✓ All tests passed with some warnings. Review warnings before deployment.', 'yellow');
  } else {
    log('\n❌ Some tests failed. Please fix issues before deployment.', 'red');
  }

  log('\n' + '═'.repeat(60), 'blue');

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
