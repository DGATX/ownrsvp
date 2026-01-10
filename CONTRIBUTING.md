# Contributing to OwnRSVP

Thank you for your interest in contributing to OwnRSVP!

## How to Contribute

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/your-feature`
3. **Make your changes**
4. **Test locally:** `docker compose -f docker-compose.dev.yml up -d` and verify functionality
5. **Commit with clear messages:** `git commit -m "Add feature: description"`
6. **Push to your fork:** `git push origin feature/your-feature`
7. **Submit a Pull Request**

## Development Setup

See [README.md](README.md#development-setup) for local development instructions.

### Quick Start for Contributors

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/ownrsvp.git
cd ownrsvp

# Copy environment template
cp .env.example .env
# Edit .env with your local settings

# Start development environment
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose logs -f

# Run linting
npm run lint
```

## Code Style

- Use TypeScript for type safety
- Follow existing code patterns and naming conventions
- Run `npm run lint` before committing
- Add comments for complex logic
- Keep functions small and focused
- Write descriptive commit messages

## Commit Message Guidelines

Good commit messages help everyone understand the project history:

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests when relevant

Examples:
```
Add SMS reminder functionality
Fix date validation for past events
Update documentation for Gmail setup
Refactor event creation form
```

## Testing

Before submitting your PR:

1. Test your changes locally with Docker
2. Verify the application starts without errors
3. Test the specific feature you modified
4. Check for console errors in the browser
5. Ensure existing features still work

## Reporting Bugs

Please use GitHub Issues with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Docker version, browser)
- Screenshots if applicable

## Suggesting Features

We welcome feature suggestions! Please:
- Check if the feature has already been requested
- Clearly describe the feature and its benefits
- Explain the use case
- Consider implementation complexity

## Pull Request Process

1. Update documentation if you're changing functionality
2. Add your changes to CHANGELOG.md (if one exists)
3. Ensure your code follows the existing style
4. Make sure your PR description clearly explains what and why
5. Link any related issues
6. Be responsive to review feedback

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully

### Unacceptable Behavior

- Harassment, trolling, or discriminatory comments
- Personal attacks or insults
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

## Questions?

- Open a GitHub Discussion for general questions
- Open a GitHub Issue for bug reports
- Check existing issues and discussions first

Thank you for contributing to OwnRSVP! 🎉
