# actual-monzo

Automated synchronization between Monzo bank accounts and Actual Budget.

## Features

- 🔐 **Secure OAuth Integration** - Connect to Monzo using official OAuth 2.0 flow
- 💰 **Transaction Import** - Sync Monzo transactions to Actual Budget
- 🗺️ **Account Mapping** - Configure which Monzo accounts sync to which Actual Budget accounts
- 💾 **Persistent Configuration** - YAML-based config with secure permissions (chmod 600)

## Quick Start

### Prerequisites

1. **Monzo Developer Account**
   - Register at [Monzo Developers](https://developers.monzo.com/)
   - Create an OAuth client application
   - Set redirect URI: `http://localhost:8234/callback`
   - Note your Client ID and Client Secret

2. **Actual Budget Server**
   - Running Actual Budget instance (local or remote)
   - Server URL (default: `http://localhost:5006`)
   - Server password

3. **Monzo Mobile App**
   - Installed on your mobile device (required to approve OAuth)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/actual-monzo.git
cd actual-monzo

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Setup

Run the setup command to configure both Monzo and Actual Budget:

```bash
node dist/index.js setup
```

This will:
1. Collect your Monzo OAuth credentials (Client ID & Secret)
2. Open a browser for Monzo authorization
3. Collect your Actual Budget server details
4. Validate the connection and save to `config.yaml`

**Security:** The config file is automatically set to `chmod 600` (owner read/write only).

### Map Accounts

Configure which Monzo accounts sync to which Actual Budget accounts:

```bash
node dist/index.js map-accounts
```

This interactive command lets you select mappings between your Monzo accounts and Actual Budget accounts.

### Import Transactions

Import Monzo transactions into Actual Budget:

```bash
node dist/index.js import
```

Options:
- `--since <date>` - Import transactions from this date (default: 30 days ago)
- `--account <id>` - Import only this Monzo account

## Configuration

After setup, `config.yaml` is created in the project root:

```yaml
monzo:
  clientId: "oauth2client_..."
  clientSecret: "mnzconf..."
  accessToken: "access_token_..."
  refreshToken: "refresh_token_..."
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"

actualBudget:
  serverUrl: "http://localhost:5006"
  password: "your-password"
  dataDirectory: "/Users/you/.actual"
  validatedAt: "2025-10-01T12:05:00.000Z"

accountMappings:
  - monzoAccountId: "acc_..."
    monzoAccountName: "Current Account"
    actualAccountId: "..."
    actualAccountName: "Checking"

setupCompletedAt: "2025-10-01T12:05:00.000Z"
```

**⚠️ Important:** Never commit `config.yaml` to version control. It's already in `.gitignore`.

## Development

### Project Structure

```
actual-monzo/
├── src/
│   ├── commands/       # CLI commands (setup, import, map-accounts)
│   ├── services/       # Business logic (OAuth, API clients)
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utilities (config, OAuth server, browser)
├── tests/
│   ├── contract/       # Contract tests (API contracts)
│   ├── integration/    # Integration tests (end-to-end flows)
│   └── unit/           # Unit tests (individual functions)
└── specs/              # Feature specifications
```

### Tech Stack

- **Language:** TypeScript 5.2+
- **Runtime:** Node.js 18+
- **CLI Framework:** Commander.js
- **Interactive Prompts:** Inquirer.js
- **Testing:** Vitest
- **Config:** YAML (js-yaml) + Zod validation
- **APIs:** @actual-app/api, Axios (Monzo)

### Running Tests

```bash
# Run all tests
pnpm vitest run

# Watch mode
pnpm test

# With coverage
pnpm test:coverage

# Specific test suites
pnpm vitest run tests/contract/
pnpm vitest run tests/integration/
pnpm vitest run tests/unit/
```

**Test Coverage:**
- Contract tests (API contracts)
- Integration tests (end-to-end flows)
- Unit tests (individual functions)

### Building

```bash
# Production build
pnpm build

# Development mode (watch)
pnpm dev

# Type checking only
pnpm type-check

# Clean build artifacts
pnpm clean
```

### Linting & Formatting

```bash
# Run ESLint
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix

# Format code
pnpm format
```

### Running Locally

```bash
# After building
node dist/index.js setup
node dist/index.js import

# Or with tsx (development)
pnpm tsx src/index.ts setup
```

### Global Installation (Optional)

```bash
pnpm build
pnpm link --global

# Then use from anywhere
actual-monzo setup
actual-monzo import
```

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature-name`
2. Make changes with tests
3. Run tests: `pnpm vitest run`
4. Run type checking: `pnpm type-check`
5. Run linter: `pnpm lint`
6. Build: `pnpm build`
7. Commit with conventional commits format
8. Create pull request

### Testing Standards

- Write tests for new features (contract tests define the API)
- Maintain comprehensive test coverage
- All tests must pass before merge
- Use TypeScript strict mode

### Code Style

- TypeScript strict mode enabled
- ESLint rules enforced (no `any` types)
- Prettier for formatting
- Conventional commits format

## Troubleshooting

### Command Not Found

```bash
# Ensure built
pnpm build

# Check dist exists
ls dist/index.js

# Run with explicit path
node dist/index.js setup
```

### Browser Doesn't Open (OAuth)

If running in headless environment or browser fails to open:
- The CLI displays a clickable URL
- Copy and paste into browser manually
- OAuth callback still works on localhost

### Actual Budget Connection Issues

```bash
# Verify server is running
docker ps | grep actual

# Check server is accessible
curl http://localhost:5006

# Verify correct port and URL
```

### OAuth Token Expired

Monzo tokens expire after 6 hours. If you see authentication errors:
- The CLI will auto-refresh tokens (when implemented)
- For now, re-run setup: `node dist/index.js setup`

### Config File Issues

```bash
# Check permissions
ls -la config.yaml

# Should be: -rw------- (600)

# Fix if needed
chmod 600 config.yaml

# Start fresh
rm config.yaml
node dist/index.js setup
```

## Security

- Config file uses `chmod 600` (owner read/write only)
- Never commit `config.yaml` (.gitignore protects this)
- OAuth uses CSRF protection (state parameter)
- Localhost-only OAuth callback server
- Tokens stored in plain text (acceptable for read-only banking access)

## License

MIT

## Links

- [Monzo API Docs](https://docs.monzo.com/)
- [Actual Budget](https://actualbudget.org/)
- [Feature Specs](specs/) - Detailed specifications
- [GitHub Issues](https://github.com/alexcrawford/actual-monzo/issues)

---

**Status:** Active Development
**Node Version:** >=18.0.0
**License:** MIT
