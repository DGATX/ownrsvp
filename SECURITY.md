# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it via:

**GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature at https://github.com/DGATX/ownrsvp/security/advisories

### What to Include

When reporting a vulnerability, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Time

We aim to respond to security reports within 48 hours and will keep you updated on our progress.

### Disclosure Policy

- We will acknowledge receipt of your report within 48 hours
- We will provide a detailed response within 7 days
- We will notify you when the vulnerability is fixed
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When deploying OwnRSVP:

1. **Use strong secrets**: Generate strong `AUTH_SECRET` and `CRON_SECRET` values
2. **Protect database file**: Ensure the SQLite database file (`/app/data/ownrsvp.db`) has proper file permissions
3. **Enable HTTPS**: Use SSL/TLS certificates in production
4. **Keep updated**: Regularly update Docker images and dependencies
5. **Review access**: Limit admin access to trusted users only
6. **Backup regularly**: Maintain regular database backups
7. **Monitor logs**: Review application logs for suspicious activity

## Known Security Considerations

- The application requires SMTP credentials to send emails
- Admin users have full access to all events and user data
- Database is accessible within the Docker network
- Ensure proper firewall rules are in place

Thank you for helping keep OwnRSVP secure!

