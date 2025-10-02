# Research: Setup Command Technical Decisions

**Feature**: Two-Phase Setup Command (Monzo OAuth + Actual Budget)
**Date**: 2025-10-01
**Status**: Complete

## 1. Monzo OAuth Implementation

### Decision: Use Standard OAuth 2.0 Authorization Code Flow

**Endpoints**:
- Authorization: `https://auth.monzo.com/`
- Token Exchange: `https://api.monzo.com/oauth2/token`
- Logout: `https://api.monzo.com/oauth2/logout` (for future token invalidation)

**Flow**:
1. Redirect user to authorization endpoint with client_id, redirect_uri, response_type=code, state (CSRF token)
2. User authenticates via email and approves in Monzo mobile app (Strong Customer Authentication)
3. Monzo redirects to localhost callback with authorization code
4. Exchange code for access token + refresh token via POST to token endpoint
5. Store tokens for API usage

**Rationale**:
- Standard OAuth 2.0 flow with confidential client (CLI can protect client_secret)
- Monzo requires Strong Customer Authentication (mobile app approval) per PSD2 regulations
- Confidential clients receive refresh tokens (critical for long-term usage)
- Access tokens expire after 6 hours (21600 seconds)
- 90-day re-authentication requirement (handled in future iterations)

**PKCE**: Not explicitly required by Monzo based on search results, but considered best practice. Will implement as enhancement if time permits, otherwise defer to future iteration.

**Scopes**: Monzo API does not expose granular scope selection in public documentation. User grants permission to all account data after authentication. After research, no specific scopes need to be requested - standard authorization flow grants read access to transactions.

**Alternatives Considered**:
- Implicit flow: Rejected - Less secure, no refresh tokens
- Client credentials: Rejected - Not supported for user data access
- Personal access tokens: Rejected - Requires manual generation, expires in 90 days

**References**:
- Monzo docs: https://github.com/monzo/docs/blob/master/source/includes/_authentication.md
- OAuth 2.0 RFC 6749: https://datatracker.ietf.org/doc/html/rfc6749

---

## 2. OAuth Callback Server

### Decision: Use Node.js `http` module with temporary ephemeral server

**Implementation Pattern**:
```typescript
import http from 'node:http';

// Create server before browser launch
const server = http.createServer((req, res) => {
  const url = new URL(req.url!, `http://localhost:${port}`);
  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    // Validate state, extract code, send HTML response
    // Resolve promise with code
  }
});

server.listen(port, '127.0.0.1'); // localhost-only binding
// ... after token exchange ...
server.close();
```

**Port Strategy**: Start with port 3000, if in use, try 3001-3010 with exponential backoff. Display actionable error if all ports busy.

**CSRF Protection**: Generate random UUID as `state` parameter, validate on callback matches sent value.

**Security Measures**:
- Bind to 127.0.0.1 only (no external access)
- Immediate shutdown after receiving callback (minimize attack surface)
- Timeout after 5 minutes if no callback received (changed from "indefinite" per spec review - user can Ctrl+C)
- HTML response page confirms success and instructs user to return to CLI

**Rationale**:
- Native Node.js http module (no extra dependencies)
- RFC 8252 (OAuth 2.0 for Native Apps) explicitly supports localhost callbacks
- Temporary server pattern used by GitHub CLI, Google Cloud SDK
- Ephemeral nature prevents persistent security risks

**Alternatives Considered**:
- Express server: Rejected - Adds dependency for simple single-endpoint use case
- Manual code entry: Rejected - Poor UX, error-prone for long authorization codes
- External callback service: Rejected - Adds infrastructure complexity, security risk

**References**:
- RFC 8252 (OAuth for Native Apps): Section 7.3 Loopback Interface Redirection
- Article: "Building a Localhost OAuth Callback Server in Node.js" (Level Up Coding)

---

## 3. Actual Budget SDK Integration

### Decision: Use `@actual-app/api` v25.x with `init()` for connection validation

**Initialization Pattern**:
```typescript
import * as actual from '@actual-app/api';

await actual.init({
  dataDir: '/path/to/budget/data',
  serverURL: 'http://localhost:5006',
  password: 'user-password'
});
// If init() succeeds → connection valid
// If init() throws → display error details
await actual.disconnect(); // Cleanup after validation
```

**Connection Validation**: Call `init()` during setup to verify:
1. Server is reachable at provided URL
2. Password is correct (authentication succeeds)
3. Data directory is writable

**Error Handling**:
- Network errors: "Server unreachable at {URL}. Check server is running."
- Auth errors: "Invalid password. Please check your Actual Budget server password."
- IO errors: "Cannot write to directory {path}. Check permissions."

**Rationale**:
- `init()` is the primary entry point for SDK usage per official docs
- Initialization performs all necessary validation (network, auth, filesystem)
- Matches actual usage pattern (setup validates same way as runtime usage)
- Errors from `init()` provide specific failure reasons

**Budget Data Directory**: Default to `~/.actual-budget/data`, prompt user to confirm or customize. Validate directory exists or can be created with write permissions.

**Alternatives Considered**:
- Custom ping endpoint: Rejected - `init()` already validates connection
- Separate validation methods: Rejected - Redundant with `init()` behavior
- Skip validation: Rejected - Violates spec requirement FR-014

**References**:
- @actual-app/api npm: https://www.npmjs.com/package/@actual-app/api
- Actual Budget API docs: https://actualbudget.org/docs/api/

---

## 4. Configuration Management

### Decision: Use `js-yaml` with custom Conf wrapper for YAML support

**Why YAML**:
- Human-readable for manual inspection/editing
- Supports comments for user guidance
- Cleaner than JSON for configuration files
- Spec clarification explicitly chose YAML format

**Implementation**:
```typescript
import Conf from 'conf';
import yaml from 'js-yaml';

// Custom serialization/deserialization
const config = new Conf({
  projectName: 'actual-monzo',
  fileExtension: 'yaml',
  serialize: (value) => yaml.dump(value),
  deserialize: (text) => yaml.load(text)
});
```

**File Location**: Project root `config.yaml` (per spec clarification)

**Schema**:
```yaml
monzo:
  clientId: "oauth2client_..."
  clientSecret: "mnzconf..."
  accessToken: "access_token..."
  refreshToken: "refresh_token..."
  tokenExpiresAt: "2025-10-01T12:00:00Z"

actualBudget:
  serverUrl: "http://localhost:5006"
  password: "encrypted-or-plain"  # Plain text acceptable per spec
  dataDirectory: "/Users/alex/.actual-budget/data"

setupCompletedAt: "2025-10-01T11:30:00Z"
```

**Partial Configuration Support**: Allow saving Monzo config even if Actual Budget phase fails. On subsequent run, validate existing Monzo tokens before re-prompting.

**Rationale**:
- Conf library handles cross-platform paths, atomic writes, validation
- js-yaml is well-maintained, widely used YAML parser
- Custom wrapper approach preserves Conf benefits while adding YAML support
- File location in project root matches user expectation for CLI config

**Alternatives Considered**:
- Pure JSON with Conf: Rejected - Spec chose YAML for readability
- cosmiconfig: Rejected - Overkill for single config file
- Direct fs.writeFile: Rejected - No atomic writes, validation, or migrations

**References**:
- Conf library: https://github.com/sindresorhus/conf
- js-yaml: https://github.com/nodeca/js-yaml

---

## 5. Browser Launching

### Decision: Use `open` npm package for cross-platform browser launching

**Pattern**:
```typescript
import open from 'open';

const authUrl = `https://auth.monzo.com/?client_id=${clientId}&...`;
console.log(`Opening browser to: ${authUrl}`);
console.log(`If browser doesn't open automatically, click here: ${authUrl}`);
await open(authUrl);
```

**Fallback**: Display clickable link (most terminals support Cmd+click) if `open` fails.

**User Flow**:
1. CLI displays "Opening browser for Monzo authorization..."
2. Browser opens to Monzo auth page
3. CLI displays "Waiting for authorization... (press Ctrl+C to cancel)"
4. User completes auth on browser + mobile app
5. Browser redirects to localhost, CLI receives code

**Rationale**:
- `open` package handles macOS (`open`), Windows (`start`), Linux (`xdg-open`)
- Graceful fallback to manual link clicking if automation fails
- Widely used by CLI tools (GitHub CLI, Netlify CLI, etc.)
- Small dependency with cross-platform compatibility

**Alternatives Considered**:
- Manual commands per OS: Rejected - Reinvents cross-platform wheel
- Custom child_process spawning: Rejected - Error-prone across platforms
- QR code generation: Rejected - Mobile device already required for Monzo approval

**References**:
- open npm: https://github.com/sindresorhus/open

---

## 6. Interactive CLI Patterns

### Decision: Use Inquirer for prompts with Ora for async operations

**Password Masking**:
```typescript
import inquirer from 'inquirer';

const { clientSecret } = await inquirer.prompt([
  {
    type: 'password',
    name: 'clientSecret',
    message: 'Enter Monzo client secret:',
    mask: '*'
  }
]);
```

**Async Operations with Spinner**:
```typescript
import ora from 'ora';

const spinner = ora('Validating Actual Budget connection...').start();
try {
  await actual.init({ serverURL, password, dataDir });
  spinner.succeed('Connection validated successfully!');
} catch (error) {
  spinner.fail('Connection failed');
  // Display error details and recovery options
}
```

**Error Recovery UX**:
```typescript
// After error, prompt for retry or change credentials
const { action } = await inquirer.prompt([
  {
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Retry with same credentials', value: 'retry' },
      { name: 'Enter different credentials', value: 'change' },
      { name: 'Exit setup', value: 'exit' }
    ]
  }
]);
```

**Rationale**:
- Inquirer provides built-in password masking (FR-012)
- Ora spinners communicate async operations without blocking
- Choice lists provide clear recovery paths (FR-023)
- Both libraries already project dependencies from 001-project-init-set

**Testing Strategy**: Mock Inquirer prompts in tests with predefined answers, verify correct questions asked and validation logic.

**Alternatives Considered**:
- Prompts library: Rejected - Inquirer more feature-rich, already installed
- Custom readline implementation: Rejected - No password masking built-in
- Chalk-only output: Rejected - No interactive retry mechanisms

**References**:
- Inquirer: https://github.com/SBoudrias/Inquirer.js
- Ora: https://github.com/sindresorhus/ora

---

## Summary of Decisions

| Component | Technology Choice | Rationale |
|-----------|------------------|-----------|
| OAuth Flow | Standard authorization code | Monzo supports, gets refresh tokens |
| Callback Server | Node.js `http` module | Native, RFC 8252 compliant, ephemeral |
| Port Strategy | 3000-3010 with retry | Balance availability with predictability |
| Actual SDK | `@actual-app/api` init() | Official SDK, validates all requirements |
| Config Format | YAML via js-yaml + Conf | Spec requirement, human-readable |
| Browser Launch | `open` package | Cross-platform, widely used |
| CLI Interaction | Inquirer + Ora | Built-in features, already installed |

## Implementation Risk Assessment

**Low Risk**:
- Actual Budget SDK integration (well-documented, stable API)
- Config management (proven libraries)
- Interactive prompts (standard patterns)

**Medium Risk**:
- OAuth callback server (port conflicts, state management)
  - Mitigation: Comprehensive port retry logic, UUID state validation
- Browser launching (may fail on headless systems)
  - Mitigation: Clear fallback instructions, FR-020 documents limitation

**High Risk**:
- OAuth token expiry (6-hour tokens, 90-day re-auth)
  - Mitigation: Store expiry timestamp, detect in future commands
  - Future enhancement: Automatic refresh token usage

## Next Steps

All technical unknowns resolved. Proceed to Phase 1 (Design & Contracts).
