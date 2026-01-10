# Gmail SMTP Setup Quick Reference

## Quick Setup Steps

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" → "Other (Custom name)" → Enter "OwnRSVP"
   - Copy the 16-character app password

3. **Update `.env` file**
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASSWORD="xxxx xxxx xxxx xxxx"
   SMTP_FROM="OwnRSVP <your-email@gmail.com>"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Restart dev server**
   ```bash
   npm run dev
   ```

5. **Test Configuration**
   - Go to Admin Dashboard
   - Use the "Email Configuration Test" card
   - Enter your email and click "Send Test Email"

## Testing All Email Types

After configuration, test these email types:

1. **User Invitation** - Admin Dashboard → Add User → Send invitation
2. **Event Invitation** - Event page → Add Guest → Send invitation
3. **RSVP Confirmation** - Submit RSVP from invitation link
4. **Password Reset** - Login page → Forgot password
5. **Event Reminder** - Event page → Click reminder button on pending guest
6. **Broadcast Update** - Event page → Broadcast Update button
7. **Event Change Notification** - Edit event → Check "Notify guests"

## Troubleshooting

- **Emails not sending**: Check server console for errors, verify app password is correct
- **Emails in spam**: Mark as "Not spam" in Gmail
- **Invalid login**: Regenerate app password
- **Links point to localhost**: Update `NEXT_PUBLIC_APP_URL` for production

## Test Endpoint

You can also test via API:
```bash
# Check configuration
curl http://localhost:3000/api/test-email

# Send test email (requires admin auth)
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"your-email@gmail.com"}'
```

