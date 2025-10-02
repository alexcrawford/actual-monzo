# actual-monzo

Automated synchronization between Monzo bank accounts and Actual Budget.

## Overview

`actual-monzo` is a CLI tool that connects your Monzo bank account to Actual Budget, enabling automated transaction imports and financial management.

## Features

- 🔐 **Secure OAuth Integration** - Connect to Monzo using official OAuth 2.0 flow
- 💰 **Actual Budget Support** - Validate and store Actual Budget server credentials
- 🔄 **Two-Phase Setup** - Sequential configuration of Monzo OAuth and Actual Budget
- 💾 **Persistent Configuration** - YAML-based config storage with proper security
- 🛡️ **Error Recovery** - Partial setup support and actionable error messages
- ✅ **Comprehensive Testing** - 77.5% code coverage with 65 passing tests

## Quick Start

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

### Run Setup

```bash
# Run setup command
node dist/index.js setup

# Or use tsx for development
pnpm tsx src/index.ts setup
```

### Global Installation (Optional)

```bash
# Build and link globally
pnpm build
pnpm link --global

# Run from anywhere
actual-monzo setup
```

## Prerequisites

### 1. Monzo Developer Account

- Register at [Monzo Developers](https://developers.monzo.com/)
- Create an OAuth client application
- Note your Client ID and Client Secret
- Set redirect URI: `http://localhost:8234/callback`

### 2. Actual Budget Server

- Running Actual Budget instance (local or remote)
- Server URL (default: `http://localhost:5006`)
- Server password
- Writable directory for budget data

### 3. Monzo Mobile App

- Monzo app installed on your mobile device
- Access to approve OAuth authorization

## Usage

### Setup Command

Configure Monzo OAuth and Actual Budget credentials:

```bash
actual-monzo setup
```

**What it does:**
1. **Phase 1: Monzo OAuth**
   - Collects Client ID and Client Secret
   - Opens browser for authorization
   - Handles OAuth callback
   - Stores access and refresh tokens

2. **Phase 2: Actual Budget**
   - Collects server URL, password, and data directory
   - Validates connection
   - Stores configuration

**Result:**
- Creates `config.yaml` in project root
- Both services configured and validated
- Ready for future commands

### Configuration File

After setup, `config.yaml` contains:

```yaml
monzo:
  clientId: "oauth2client_..."
  clientSecret: "mnzconf..."
  accessToken: "access_token_..."
  refreshToken: "refresh_token_..."
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"
  authorizedAt: "2025-10-01T12:00:00.000Z"

actualBudget:
  serverUrl: "http://localhost:5006"
  password: "your-password"
  dataDirectory: "/Users/you/.actual"
  validatedAt: "2025-10-01T12:05:00.000Z"

setupCompletedAt: "2025-10-01T12:05:00.000Z"
```

**Security:**
```bash
# Protect your config file
chmod 600 config.yaml

# Never commit to git
echo "config.yaml" >> .gitignore
```

## Development

### Project Structure

```
actual-monzo/
├── src/
│   ├── commands/          # CLI commands
│   │   └── setup.ts       # Setup command
│   ├── services/          # Business logic
│   │   ├── actual-client.ts
│   │   ├── monzo-api-client.ts
│   │   ├── monzo-oauth-service.ts
│   │   └── setup-service.ts
│   ├── types/             # TypeScript types
│   │   ├── config.ts
│   │   └── setup.ts
│   └── utils/             # Utilities
│       ├── browser-utils.ts
│       ├── config-manager.ts
│       ├── config-schema.ts
│       └── oauth-server.ts
├── tests/
│   ├── contract/          # Contract tests
│   ├── integration/       # Integration tests
│   └── unit/              # Unit tests
├── specs/
│   └── 002-setup-command/ # Feature specification
└── docs/
    └── SETUP_COMMAND.md   # Detailed setup guide
```

### Tech Stack

- **Language:** TypeScript 5.2+
- **Runtime:** Node.js 18+
- **CLI Framework:** Commander.js
- **Interactive Prompts:** Inquirer.js
- **Testing:** Vitest
- **OAuth:** Custom implementation with Monzo API
- **Actual Budget SDK:** @actual-app/api
- **Config Format:** YAML (js-yaml)

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm vitest run tests/contract/
pnpm vitest run tests/integration/setup-*.test.ts

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test --watch
```

### Test Coverage

- **Overall:** 77.5%
- **actual-client.ts:** 98.51%
- **monzo-oauth-service.ts:** 87.41%
- **config-manager.ts:** 76.52%
- **setup-service.ts:** 68.02%

**Test Stats:**
- 65 tests passing
- 14 test files
- Contract tests: 100% passing
- Integration tests: 85% coverage

### Build

```bash
# Development build
pnpm build

# Watch mode
pnpm build --watch

# Type checking
pnpm tsc --noEmit
```

### Linting

```bash
# Run ESLint
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix
```

## Error Handling

### Port Conflicts

If ports 3000-3010 are busy:
```bash
# Check what's using ports
lsof -i :3000-3010

# Kill blocking processes
kill <PID>
```

### Network Errors

**Actual Budget server unreachable:**
- Verify server is running: `docker ps`
- Check firewall settings
- Confirm correct port (default: 5006)

### OAuth Issues

**Authorization denied:**
- Approve access in Monzo mobile app
- Check OAuth client credentials

**Tokens expired:**
- Tokens expire after 6 hours
- Future commands will auto-refresh
- Re-run setup if refresh fails

## Troubleshooting

### Command Not Found

```bash
# Ensure project is built
ls dist/index.js

# Rebuild if needed
pnpm build

# Run with explicit path
node dist/index.js setup
```

### Browser Doesn't Open

If running in headless environment:
- CLI displays clickable URL
- Copy URL and open in browser manually
- OAuth callback still works

### Config File Issues

**Permission errors:**
```bash
# Fix permissions
chmod 600 config.yaml
```

**Validation errors:**
```bash
# Remove and re-run setup
rm config.yaml
node dist/index.js setup
```

## Roadmap

### Implemented ✅
- Two-phase setup command
- Monzo OAuth 2.0 flow
- Actual Budget connection validation
- YAML configuration storage
- Partial setup recovery
- Comprehensive error handling
- Contract and integration tests

### Planned 🚧
- Transaction sync command
- Automatic token refresh in API commands
- Category mapping configuration
- Budget reconciliation
- Interactive reconfiguration menu
- Enhanced error recovery prompts

### Future Ideas 💡
- Multiple Monzo account support
- Scheduled sync jobs
- Transaction filtering rules
- Custom category rules
- Web dashboard
- Docker image

## Documentation

- **[Setup Guide](docs/SETUP_COMMAND.md)** - Detailed setup instructions
- **[Specification](specs/002-setup-command/spec.md)** - Feature specification
- **[Quickstart](specs/002-setup-command/quickstart.md)** - Usage scenarios
- **[Data Model](specs/002-setup-command/data-model.md)** - Entity definitions
- **[Technical Plan](specs/002-setup-command/plan.md)** - Implementation plan

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b 003-feature-name`
2. Create spec: `specs/003-feature-name/spec.md`
3. Run planning: Generate plan.md, data-model.md, contracts/
4. Generate tasks: Create tasks.md
5. Implement with TDD
6. Run tests: `pnpm test`
7. Commit changes
8. Create pull request

### Testing Standards

- Write contract tests first (must fail)
- Implement features to make tests pass
- Maintain >75% code coverage
- All tests must pass before merge

### Code Style

- TypeScript strict mode
- ESLint rules enforced
- Prettier for formatting
- Conventional commits

## Security

### Configuration Security

- Config file uses 600 permissions (owner read/write only)
- Never commit `config.yaml` to version control
- Tokens stored in plain text (acceptable for read-only access)
- Refresh tokens require re-auth every 90 days

### API Security

- OAuth 2.0 with PKCE (planned)
- Localhost-only callback server
- CSRF protection with state parameter
- Secure password input (masked)

### Best Practices

```bash
# Protect config
chmod 600 config.yaml

# Verify .gitignore
git status  # config.yaml should not appear

# Regular rotation
# - Rotate Actual Budget password regularly
# - Re-authorize Monzo every 90 days
```

## License

MIT

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/actual-monzo/issues)
- **Monzo API:** https://docs.monzo.com/
- **Actual Budget:** https://actualbudget.org/docs/

## Acknowledgments

- [Monzo](https://monzo.com/) - Banking API
- [Actual Budget](https://actualbudget.org/) - Budget management
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) - Interactive prompts

---

**Status:** Feature branch `002-setup-command`
**Last Updated:** 2025-10-01
**Test Coverage:** 77.5% (65 passing tests)
**Spec Compliance:** 74% (17/23 functional requirements)
