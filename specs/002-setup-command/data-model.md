# Data Model: Setup Command

**Feature**: Two-Phase Setup Command
**Date**: 2025-10-01
**Status**: Design Complete

## Entity Definitions

### 1. MonzoConfiguration

**Purpose**: Stores Monzo OAuth credentials and tokens for API access

**Fields**:
```typescript
interface MonzoConfiguration {
  clientId: string;           // OAuth client ID from Monzo developer portal
  clientSecret: string;       // OAuth client secret (stored plain text per spec)
  accessToken?: string;       // OAuth access token (present after successful auth)
  refreshToken?: string;      // OAuth refresh token (present after successful auth)
  tokenExpiresAt?: Date;      // Access token expiration timestamp
  authorizedAt?: Date;        // When OAuth flow completed
}
```

**Validation Rules**:
- `clientId`: Non-empty string, typically starts with "oauth2client_"
- `clientSecret`: Non-empty string, typically starts with "mnzconf" or "mnzpub"
- `accessToken`: Non-empty string after OAuth completion, format: alphanumeric
- `refreshToken`: Non-empty string after OAuth completion
- `tokenExpiresAt`: Must be future date when set, calculated as authorizedAt + 21600 seconds
- `authorizedAt`: Set to current timestamp after successful OAuth

**State Transitions**:
```
UNCONFIGURED (no clientId/secret)
  ↓ (user enters credentials)
CREDENTIALS_ENTERED (has clientId/secret, no tokens)
  ↓ (OAuth flow completes)
AUTHENTICATED (has valid accessToken)
  ↓ (6 hours pass)
TOKEN_EXPIRED (tokenExpiresAt < now)
  ↓ (refresh token used - future feature)
AUTHENTICATED
```

**Invariants**:
- If `accessToken` exists, `refreshToken`, `tokenExpiresAt`, and `authorizedAt` must also exist
- `tokenExpiresAt` must be exactly 6 hours (21600s) after `authorizedAt`

**Relationships**:
- Contained within `SetupSession`
- Persisted in YAML `config.yaml` under `monzo:` key

---

### 2. ActualBudgetConfiguration

**Purpose**: Stores Actual Budget server connection credentials

**Fields**:
```typescript
interface ActualBudgetConfiguration {
  serverUrl: string;          // Actual Budget server URL (e.g., http://localhost:5006)
  password: string;           // Server password (plain text per spec)
  dataDirectory: string;      // Local path for budget data cache
  validatedAt?: Date;         // When connection was last validated
}
```

**Validation Rules**:
- `serverUrl`: Valid HTTP/HTTPS URL, no trailing slash
- `password`: Non-empty string, any characters allowed
- `dataDirectory`: Absolute path, must exist or be creatable, must be writable
- `validatedAt`: Set to current timestamp after successful `actual.init()`

**State Transitions**:
```
UNCONFIGURED (no serverUrl/password)
  ↓ (user enters credentials)
CREDENTIALS_ENTERED (has serverUrl/password, no validation)
  ↓ (connection test with actual.init())
VALIDATING (init() in progress)
  ├─ SUCCESS → CONFIGURED (has validatedAt)
  └─ FAILURE → CONNECTION_FAILED (no validatedAt)
```

**Invariants**:
- If `validatedAt` exists, connection succeeded at least once
- `dataDirectory` must be absolute path (starts with `/` on Unix, drive letter on Windows)

**Relationships**:
- Contained within `SetupSession`
- Persisted in YAML `config.yaml` under `actualBudget:` key

---

### 3. SetupSession

**Purpose**: Represents complete two-phase setup flow state

**Fields**:
```typescript
interface SetupSession {
  monzoConfig: MonzoConfiguration;
  actualConfig: ActualBudgetConfiguration;
  currentPhase: SetupPhase;
  completedAt?: Date;
  isPartialSetup: boolean;  // True if Monzo succeeded but Actual Budget failed
}

enum SetupPhase {
  MONZO_CREDENTIALS = 'monzo_credentials',
  MONZO_OAUTH = 'monzo_oauth',
  ACTUAL_CREDENTIALS = 'actual_credentials',
  ACTUAL_VALIDATION = 'actual_validation',
  COMPLETE = 'complete'
}
```

**Validation Rules**:
- `currentPhase`: Must progress sequentially (no skipping phases)
- `completedAt`: Only set when `currentPhase === COMPLETE`
- `isPartialSetup`: True if Monzo has `accessToken` but Actual Budget has no `validatedAt`

**State Transitions**:
```
MONZO_CREDENTIALS (collecting clientId/secret)
  ↓ (credentials entered)
MONZO_OAUTH (waiting for OAuth callback)
  ├─ SUCCESS → ACTUAL_CREDENTIALS
  └─ FAILURE → MONZO_CREDENTIALS (retry)

ACTUAL_CREDENTIALS (collecting serverUrl/password/dataDir)
  ↓ (credentials entered)
ACTUAL_VALIDATION (testing connection)
  ├─ SUCCESS → COMPLETE
  └─ FAILURE → ACTUAL_CREDENTIALS (retry)

COMPLETE (all validations passed)
```

**Partial Setup Handling**:
- If Monzo phase completes but Actual Budget fails: Save config with `isPartialSetup: true`
- On subsequent run: Validate existing Monzo tokens via API call before re-prompting
- If Monzo tokens still valid: Skip directly to `ACTUAL_CREDENTIALS` phase

**Invariants**:
- Cannot reach `ACTUAL_CREDENTIALS` without `monzoConfig.accessToken`
- Cannot set `completedAt` without `actualConfig.validatedAt`
- `isPartialSetup` is true IFF `monzoConfig.accessToken` exists AND `actualConfig.validatedAt` is undefined

**Relationships**:
- Contains `MonzoConfiguration` and `ActualBudgetConfiguration`
- Not directly persisted (constituents persisted separately in config.yaml)

---

### 4. OAuthCallbackSession

**Purpose**: Temporary state for OAuth callback server lifecycle

**Fields**:
```typescript
interface OAuthCallbackSession {
  state: string;              // CSRF protection token (UUID v4)
  redirectUri: string;        // Callback URL (e.g., http://localhost:3000/callback)
  serverPort: number;         // Port callback server listening on
  codeVerifier?: string;      // PKCE code verifier (optional enhancement)
  createdAt: Date;            // When session initiated
  expiresAt: Date;            // When session expires (5 minutes after creation)
}
```

**Validation Rules**:
- `state`: UUID v4 format (128-bit random value)
- `redirectUri`: Must match format `http://localhost:{serverPort}/callback`
- `serverPort`: Integer 3000-3010 (retry range for port conflicts)
- `codeVerifier`: If present, 43-128 character URL-safe string (PKCE spec)
- `expiresAt`: Exactly 5 minutes (300 seconds) after `createdAt`

**Lifecycle**:
```
CREATE (generate state, select port, create server)
  ↓
WAITING (server listening, browser opened, waiting for redirect)
  ├─ CALLBACK_RECEIVED → EXCHANGE_CODE
  ├─ TIMEOUT (5 min) → DESTROY
  └─ USER_CANCEL (Ctrl+C) → DESTROY

EXCHANGE_CODE (validate state, exchange code for tokens)
  ├─ SUCCESS → DESTROY (cleanup)
  └─ FAILURE → DESTROY (cleanup, propagate error)

DESTROY (close server, clear session)
```

**Security Invariants**:
- `state` parameter in callback MUST match `state` in session
- Server MUST only bind to 127.0.0.1 (localhost-only)
- Server MUST close immediately after receiving callback
- Session MUST timeout after 5 minutes to prevent indefinite blocking

**Relationships**:
- Ephemeral - not persisted to config.yaml
- Created and destroyed within Monzo OAuth phase
- References stored in memory during `monzo-oauth-service` execution

---

## Configuration File Schema

**Location**: Project root `config.yaml`

**Structure**:
```yaml
# Monzo Bank Configuration
monzo:
  clientId: "oauth2client_00009..."
  clientSecret: "mnzconf.xxx..."
  accessToken: "access_token_abc123..."  # Present after OAuth
  refreshToken: "refresh_token_xyz789..." # Present after OAuth
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"  # ISO 8601
  authorizedAt: "2025-10-01T12:00:00.000Z"    # ISO 8601

# Actual Budget Configuration
actualBudget:
  serverUrl: "http://localhost:5006"
  password: "my-budget-password"
  dataDirectory: "/Users/alex/.actual-budget/data"
  validatedAt: "2025-10-01T12:05:00.000Z"  # Present after validation

# Setup Metadata
setupCompletedAt: "2025-10-01T12:05:00.000Z"  # When full setup finished
```

**Partial Configuration Example** (Monzo succeeded, Actual Budget failed):
```yaml
monzo:
  clientId: "oauth2client_00009..."
  clientSecret: "mnzconf.xxx..."
  accessToken: "access_token_abc123..."
  refreshToken: "refresh_token_xyz789..."
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"
  authorizedAt: "2025-10-01T12:00:00.000Z"

actualBudget:
  serverUrl: "http://localhost:5006"  # User entered but validation failed
  password: "incorrect-password"      # Saved for retry
  dataDirectory: "/Users/alex/.actual-budget/data"
  # No validatedAt - indicates validation failed

# No setupCompletedAt - indicates partial setup
```

**Validation on Load**:
- Parse YAML, handle syntax errors gracefully
- Validate field types match schema
- Check Monzo token expiry if present (compare `tokenExpiresAt` to current time)
- Check Actual Budget validation status (presence of `validatedAt`)

---

## Data Flow

### Initial Setup (No Config)
```
User runs `actual-monzo setup`
  ↓
Create empty SetupSession
  ↓
Phase 1: Collect Monzo credentials
  ↓ (user enters clientId, clientSecret)
Create OAuthCallbackSession
  ↓ (open browser, start server)
Receive OAuth callback
  ↓ (exchange code for tokens)
Populate MonzoConfiguration with tokens
  ↓
Persist partial config (Monzo only)
  ↓
Phase 2: Collect Actual Budget credentials
  ↓ (user enters serverUrl, password, dataDir)
Validate with actual.init()
  ↓ (validation succeeds)
Populate ActualBudgetConfiguration.validatedAt
  ↓
Persist complete config
  ↓
Display success message
```

### Re-run After Partial Setup
```
User runs `actual-monzo setup` (Monzo config exists)
  ↓
Load existing MonzoConfiguration from config.yaml
  ↓
Validate Monzo tokens (check expiry, test API)
  ├─ Tokens valid → Skip to Phase 2 (Actual Budget)
  └─ Tokens expired/invalid → Restart Phase 1 (Monzo OAuth)
```

### Reconfiguration (Full Config Exists)
```
User runs `actual-monzo setup` (complete config exists)
  ↓
Display menu:
  [ ] Reconfigure Monzo only
  [ ] Reconfigure Actual Budget only
  [ ] Reconfigure both
  [ ] Exit
  ↓
User selects option
  ↓ (e.g., "Reconfigure Actual Budget only")
Skip Monzo phase, jump to Phase 2
  ↓
Collect new Actual Budget credentials
  ↓
Validate and update config
```

---

## Error States

### Monzo Configuration Errors

| Error | State | Recovery |
|-------|-------|----------|
| Invalid credentials during OAuth | `CREDENTIALS_ENTERED` | Re-prompt for clientId/secret |
| User denies authorization in app | `MONZO_OAUTH` | Display denial message, offer retry |
| Network failure during token exchange | `MONZO_OAUTH` | Display network error, offer retry |
| Port conflict (all 3000-3010 busy) | `MONZO_CREDENTIALS` | Display port error, suggest closing apps |

### Actual Budget Configuration Errors

| Error | State | Recovery |
|-------|-------|----------|
| Server unreachable | `ACTUAL_VALIDATION` | Suggest checking server running, offer retry |
| Invalid password | `ACTUAL_VALIDATION` | Re-prompt for password only |
| Data directory not writable | `ACTUAL_CREDENTIALS` | Re-prompt for different directory |
| Unknown init() error | `ACTUAL_VALIDATION` | Display error details, offer retry or exit |

---

## Relationships Diagram

```
SetupSession
  ├─ contains → MonzoConfiguration
  │               └─ persisted in → config.yaml (monzo:)
  └─ contains → ActualBudgetConfiguration
                  └─ persisted in → config.yaml (actualBudget:)

OAuthCallbackSession (ephemeral, not persisted)
  └─ used during → MonzoConfiguration OAuth phase
```

---

## Implementation Notes

- **Thread Safety**: Single-user CLI, no concurrent setup runs expected (no locking needed)
- **Idempotency**: Re-running setup with existing config should be safe (validate before overwrite)
- **Migrations**: Future config schema changes should preserve existing fields, add new ones with defaults
- **Logging**: Log config operations (create/update/validate) to debug.log (exclude passwords/tokens from logs)
- **Validation**: Use `zod` or `joi` for runtime schema validation when loading config.yaml

---

## Next Steps

Phase 1 continues with:
1. API Contracts (`/contracts/*.yaml`)
2. Contract Tests (failing tests)
3. Quickstart Documentation
4. CLAUDE.md Update
