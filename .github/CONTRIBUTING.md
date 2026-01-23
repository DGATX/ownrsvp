# Contributing to OwnRSVP

Thank you for your interest in contributing to OwnRSVP! We welcome contributions from the community.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/ownrsvp.git
   cd ownrsvp
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

See [README.md](../README.md) for complete setup instructions.

### Quick Development Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Run database migrations (creates SQLite database)
npm run db:migrate

# Start development server
npm run dev
```

Alternatively, use the development Docker Compose setup:
```bash
docker compose -f docker-compose.dev.yml up
```

## Making Changes

1. **Make your changes** in your feature branch
2. **Test your changes** thoroughly
3. **Follow code style** - the project uses ESLint and Prettier
4. **Update documentation** if you add features or change behavior

## Submitting Changes

1. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "Add feature: description of what you added"
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub:
   - Provide a clear description of what you changed
   - Reference any related issues
   - Include screenshots if UI changes were made

## Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Add comments for complex logic
- Keep functions focused and small
- Write meaningful commit messages

## Reporting Bugs

If you find a bug, please open an issue with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Docker version, etc.)
- Relevant logs or error messages

## Feature Requests

We welcome feature requests! Please open an issue and describe:
- What feature you'd like
- Why it would be useful
- How it might work

## Questions?

Feel free to open an issue for questions or discussions. We're here to help!

Thank you for contributing to OwnRSVP! 🎉

