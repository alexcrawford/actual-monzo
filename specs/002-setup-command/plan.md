# Implementation Plan: Setup Command

**Branch**: `002-setup-command` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/alex/Projects/actual-monzo/specs/002-setup-command/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

The setup command provides a two-phase interactive CLI workflow for configuring Monzo bank account integration with Actual Budget. Phase 1 handles Monzo OAuth 2.0 authentication via localhost callback server with mobile app approval. Phase 2 collects and validates Actual Budget server credentials. Configuration is persisted in YAML format in the project root, supporting partial setup recovery and independent reconfiguration of either service.

## Technical Context

**Language/Version**: TypeScript 5.2+ with Node.js 18+
**Primary Dependencies**:
- CLI: Commander (command framework), Inquirer (interactive prompts), Chalk (styling), Ora (spinners)
- Config: Conf (configuration management), js-yaml (YAML parsing)
- OAuth: axios/node-fetch (HTTP client), open (browser launcher)
- Actual Budget SDK: @actual-app/api
- Monzo API: Custom OAuth client implementation

**Storage**: YAML config file in project root (`config.yaml`)
**Testing**: Vitest (unit + integration), with mocked OAuth server and Actual Budget API
**Target Platform**: Local development machines (macOS, Linux, Windows with Node.js 18+)
**Project Type**: Single CLI project
**Performance Goals**: Interactive response <100ms, OAuth callback handling <1s, config validation <2s
**Constraints**:
- Localhost-only execution (requires browser access)
- No automated OAuth completion (requires manual mobile approval)
- Plain text credential storage (acceptable for read-only API access)
- Sequential setup phases (Monzo → Actual Budget)

**Scale/Scope**: Single-user CLI tool, ~10 commands total, config file <10KB

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. API-First Integration ✅ PASS
- **Monzo OAuth**: Official OAuth 2.0 flow with proper authorization
- **Actual Budget SDK**: Using official `@actual-app/api` client
- **Credential Storage**: YAML config in project root (justified: read-only transaction access)
- **Security**: No credential bypass or scraping, all flows user-controlled

### II. CLI-First Interface ✅ PASS
- **Interactive Mode**: Inquirer prompts for credential collection
- **Non-Interactive Support**: Future enhancement (not required for v1)
- **Exit Codes**: Standard Unix conventions (0=success, 1=error)
- **Output Formats**: Human-readable with Chalk styling, JSON support deferred

### III. Configuration Management ✅ PASS
- **Secure Storage**: Using Conf library with YAML format
- **Environment Support**: Single environment for v1 (dev/prod splitting future enhancement)
- **No Hardcoded Secrets**: All credentials collected interactively
- **Setup Workflow**: Two-phase guided setup with validation

### IV. Data Validation & Transformation ✅ PASS
- **OAuth Token Validation**: Token exchange with Monzo API validation
- **Actual Budget Connection**: Test connection during setup
- **Data Accuracy**: Direct credential passthrough, no transformation needed
- **Error Handling**: Validation errors displayed with retry options

### V. Error Handling & Recovery ✅ PASS
- **API Failures**: Graceful error messages with actionable guidance
- **Network Issues**: Retry mechanisms for OAuth and Actual Budget connections
- **Partial State**: Saves Monzo config even if Actual Budget fails
- **Clear Messaging**: All errors include suggested remediation steps

**API Integration Standards**: ✅ PASS
- OAuth 2.0 with secure token storage
- HTTP error handling for all API calls
- Request/response logging (without sensitive data)
- Data validation for API responses
- Graceful degradation (partial config support)
- Rate limiting respect (minimal API calls during setup)

**Development Workflow**: ✅ PASS
- TDD approach with tests before implementation
- TypeScript strict mode enabled
- Documentation in quickstart.md
- Security review focus on credential handling

**Overall**: PASS - No constitutional violations. Plain text storage justified by read-only API access scope.

## Project Structure

### Documentation (this feature)
```
specs/002-setup-command/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── setup-flow.yaml  # Interactive setup contract
│   ├── monzo-oauth.yaml # OAuth flow contract
│   └── actual-config.yaml # Actual Budget validation contract
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── commands/
│   ├── index.ts
│   ├── init.ts           # Existing initialization
│   └── setup.ts          # NEW: Setup command implementation
├── services/
│   ├── init-service.ts   # Existing
│   ├── monzo-oauth-service.ts  # NEW: OAuth flow handling
│   ├── monzo-api-client.ts     # NEW: Monzo API wrapper
│   ├── actual-client.ts        # NEW: Actual Budget SDK wrapper
│   └── setup-service.ts        # NEW: Orchestrates two-phase setup
├── config/
│   └── config-manager.ts # Enhanced for YAML support
├── types/
│   ├── monzo-config.ts   # NEW: Monzo credentials & tokens
│   ├── actual-config.ts  # NEW: Actual Budget credentials
│   └── setup-session.ts  # NEW: Setup flow state
└── utils/
    ├── cli-utils.ts      # Enhanced with setup prompts
    ├── oauth-server.ts   # NEW: Temporary callback server
    └── browser-utils.ts  # NEW: Browser launching

tests/
├── unit/
│   ├── contracts/
│   │   ├── test-setup-flow.test.ts
│   │   ├── test-monzo-oauth.test.ts
│   │   └── test-actual-config.test.ts
│   ├── services/
│   │   ├── test-monzo-oauth-service.test.ts
│   │   ├── test-actual-client.test.ts
│   │   └── test-setup-service.test.ts
│   └── utils/
│       ├── test-oauth-server.test.ts
│       └── test-browser-utils.test.ts
└── integration/
    ├── test-setup-command-e2e.test.ts
    ├── test-monzo-phase.test.ts
    ├── test-actual-phase.test.ts
    └── test-partial-setup-recovery.test.ts
```

**Structure Decision**: Single CLI project structure using existing patterns from 001-project-init-set. New setup command integrates with existing Commander CLI framework, config management, and testing infrastructure. OAuth-specific utilities isolated in new modules for testability.

## Phase 0: Outline & Research

**Research Tasks**:

1. **Monzo OAuth Implementation**
   - Research Monzo OAuth 2.0 endpoint URLs and parameters
   - Investigate PKCE requirements for OAuth security
   - Determine required scopes for read-only transaction access
   - Find best practices for localhost OAuth callback servers in Node.js

2. **Actual Budget SDK Integration**
   - Research @actual-app/api initialization patterns
   - Determine connection validation approach (api.init vs. test endpoint)
   - Investigate error handling for unreachable servers
   - Find budget data directory best practices

3. **OAuth Callback Server**
   - Research temporary HTTP server patterns in Node.js (http module)
   - Investigate port selection strategies (fixed vs. dynamic)
   - Determine state parameter CSRF protection implementation
   - Find browser launching libraries (open vs. alternatives)

4. **Configuration Management**
   - Research js-yaml vs. yaml alternatives for YAML parsing
   - Investigate Conf library YAML support or need for custom wrapper
   - Determine config file naming and location conventions
   - Find validation patterns for partial configuration

5. **Interactive CLI Patterns**
   - Research Inquirer best practices for password masking
   - Investigate Ora spinner patterns for async operations
   - Determine error recovery UX with Inquirer (retry prompts)
   - Find CLI testing patterns for interactive flows

**Research Output**: All findings documented in `research.md` with decisions, rationales, and alternatives considered.

## Phase 1: Design & Contracts

*Prerequisites: research.md complete*

### 1. Data Model (`data-model.md`)

**Entities**:

- **MonzoConfiguration**
  - Fields: clientId (string), clientSecret (string), accessToken (string), refreshToken (string), tokenExpiresAt (Date)
  - Validation: clientId/secret non-empty, tokens non-empty after OAuth
  - State: PENDING_OAUTH → AUTHENTICATED → TOKEN_EXPIRED

- **ActualBudgetConfiguration**
  - Fields: serverUrl (URL string), password (string), dataDirectory (path string)
  - Validation: serverUrl is valid URL, dataDirectory exists and writable
  - State: UNCONFIGURED → VALIDATING → CONFIGURED → CONNECTION_FAILED

- **SetupSession**
  - Fields: monzoConfig (MonzoConfiguration), actualConfig (ActualBudgetConfiguration), phase (enum), completedAt (Date?)
  - Relationships: Contains MonzoConfiguration and ActualBudgetConfiguration
  - State: MONZO_PHASE → ACTUAL_PHASE → COMPLETE → PARTIAL_COMPLETE

- **OAuthCallbackSession**
  - Fields: state (CSRF token), codeVerifier (PKCE), redirectUri (string), serverPort (number), expiresAt (Date)
  - Validation: state is random UUID, codeVerifier for PKCE if supported
  - Lifecycle: Created before browser launch → destroyed after token exchange

### 2. API Contracts (`/contracts/`)

**setup-flow.yaml**: Interactive setup command contract
```yaml
command: actual-monzo setup
phases:
  - name: monzo-oauth
    inputs:
      - clientId: prompt
      - clientSecret: prompt (masked)
    outputs:
      - authorizationUrl: clickable link
      - accessToken: from OAuth callback
      - refreshToken: from OAuth callback
    errors:
      - OAUTH_FAILED: Invalid credentials or user denial
      - PORT_IN_USE: Callback server bind failure

  - name: actual-budget
    inputs:
      - serverUrl: prompt
      - password: prompt (masked)
      - dataDirectory: prompt with default
    outputs:
      - connectionValid: boolean
      - configSaved: boolean
    errors:
      - SERVER_UNREACHABLE: Network or URL error
      - INVALID_CREDENTIALS: Auth failure
      - DIRECTORY_ERROR: Path not writable
```

**monzo-oauth.yaml**: OAuth flow contract
```yaml
endpoints:
  authorization:
    url: https://auth.monzo.com/
    method: GET
    params:
      client_id: required
      redirect_uri: required (localhost:PORT format)
      response_type: code
      state: required (CSRF protection)

  token:
    url: https://api.monzo.com/oauth2/token
    method: POST
    body:
      grant_type: authorization_code
      code: required
      client_id: required
      client_secret: required
      redirect_uri: required
    response:
      access_token: string
      refresh_token: string
      expires_in: number
      token_type: Bearer
```

**actual-config.yaml**: Actual Budget connection contract
```yaml
validation:
  api_init:
    method: actual.init()
    params:
      serverURL: string
      password: string
      dataDir: string
    success: Returns without throwing
    errors:
      - NETWORK_ERROR: Server unreachable
      - AUTH_ERROR: Invalid password
      - IO_ERROR: Data directory issue
```

### 3. Contract Tests

Generate failing tests for each contract:
- `test-setup-flow.test.ts`: Validate two-phase setup orchestration
- `test-monzo-oauth.test.ts`: Mock OAuth server, test token exchange
- `test-actual-config.test.ts`: Mock Actual SDK, test connection validation

### 4. Quickstart (`quickstart.md`)

Extract test scenarios from user stories:
- Happy path: Complete setup from scratch
- Partial recovery: Monzo succeeds, Actual Budget fails, re-run setup
- Re-configuration: Update Actual Budget URL with existing Monzo tokens
- Error recovery: Handle port conflict, invalid credentials, network failures

### 5. Agent Context Update

Run: `.specify/scripts/bash/update-agent-context.sh claude`

Add to CLAUDE.md:
- Active Technologies: Monzo OAuth, Actual Budget SDK, js-yaml, open (browser)
- Project Structure: OAuth services, setup command
- Commands: `pnpm setup` for interactive setup
- Code Style: OAuth security patterns, error recovery UX
- Recent Changes: Added setup command with two-phase flow

**Output**: data-model.md, /contracts/*, failing contract tests, quickstart.md, CLAUDE.md updated

## Testing Implementation Strategy

*Added based on spec review feedback - defines comprehensive E2E testing approach*

### Mock Libraries & Tools

**HTTP/API Mocking**:
- **Library**: `nock` v13+
- **Purpose**: Mock Monzo OAuth endpoints without real API calls
- **Usage**: Intercept authorization, token exchange, and whoami endpoints

**SDK Mocking**:
- **Library**: `vitest.mock()` (built-in)
- **Purpose**: Mock `@actual-app/api` SDK behavior
- **Usage**: Mock `init()` and `disconnect()` methods with configurable responses

**CLI/Interactive Mocking**:
- **Library**: `@inquirer/testing` v2+
- **Purpose**: Test Inquirer prompts programmatically
- **Spinner Mocking**: Mock `ora` to verify start/succeed/fail calls

**Browser Mocking**:
- **Library**: `vitest.mock('open')`
- **Purpose**: Mock browser launching without opening actual browser

**Filesystem Mocking**:
- **Library**: `memfs` or `vitest.mock('fs')`
- **Purpose**: Test config file operations in-memory

### Test Data Fixtures

**Location**: `tests/fixtures/`

**Files**:
- `monzo-tokens.json` - Valid/expired access and refresh tokens
- `oauth-responses.json` - Authorization success/denial, token exchange responses
- `config-templates.yaml` - Complete, partial, expired, and malformed configs
- `actual-responses.json` - SDK success/failure scenarios (network, auth, IO errors)

### E2E Test Coverage Matrix

| Scenario | Test File | Mock Strategy |
|----------|-----------|---------------|
| Happy Path | `setup.e2e.test.ts` | OAuth success + Actual SDK success |
| Partial Recovery | `setup-recovery.e2e.test.ts` | Pre-populate config, mock whoami |
| Expired Tokens | `setup-recovery.e2e.test.ts` | Expired config, mock whoami 401 |
| Reconfiguration | `setup-reconfig.e2e.test.ts` | Complete config, test menu |
| Port Conflict | `oauth-server.test.ts` | Mock EADDRINUSE on ports 3000-3009 |
| Network Error | `actual-client.test.ts` | Mock Actual SDK ECONNREFUSED |
| Invalid Password | `actual-client.test.ts` | Mock Actual SDK 401 error |
| Directory Error | `actual-client.test.ts` | Mock Actual SDK EACCES error |
| User Denial | `monzo-oauth.test.ts` | Mock error=access_denied callback |
| Browser Failure | `browser-utils.test.ts` | Mock `open` throwing error |
| User Cancel | `setup.e2e.test.ts` | Simulate SIGINT |

### Assertion Strategies

- **Config State**: Read YAML, assert field values and structure
- **API Calls**: Verify nock intercepts consumed, spy on function calls
- **Console Output**: Capture and assert error messages
- **Spinner State**: Mock ora, verify lifecycle (start/succeed/fail)
- **Exit Codes**: Mock process.exit, verify correct codes
- **Prompts**: Use @inquirer/testing to simulate user input

### Contract Test Failure Criteria

Each contract test initially fails with specific error:
- **Monzo OAuth**: `MonzoOAuthService is not defined`
- **Actual Budget**: `ActualClient is not defined`
- **Setup Flow**: `SetupCommand is not defined`

Tests assert expected behavior (config changes, API calls), not implementation details.

### Test Dependencies

**Install**: `nock`, `@inquirer/testing`, `memfs` as devDependencies
**Configure**: vitest with node environment, coverage reporting
**Create**: Test fixture files before writing tests

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **From Contracts** (contracts/*.yaml):
   - For each OAuth endpoint → contract test task [P]
   - For each Actual Budget method → contract test task [P]
   - For setup flow phases → integration test task

2. **From Data Model** (data-model.md):
   - For each entity → TypeScript type/interface task [P]
   - For each validation rule → validation function task [P]
   - For each state transition → state management task

3. **From User Stories** (spec.md scenarios):
   - Each acceptance scenario → integration test task
   - Each edge case → error handling test task

4. **Implementation Tasks** (TDD order):
   - OAuth callback server implementation
   - Browser launcher utility
   - Monzo API client wrapper
   - Actual Budget client wrapper
   - Setup service orchestration
   - Setup command CLI integration
   - Configuration persistence

**Ordering Strategy**:

1. **Phase 1: Types & Models** [P]
   - Create TypeScript interfaces for all entities
   - Implement configuration schema validation

2. **Phase 2: Contract Tests** [P]
   - Write failing OAuth flow tests
   - Write failing Actual Budget connection tests
   - Write failing setup orchestration tests

3. **Phase 3: Core Utilities**
   - OAuth callback server (with test)
   - Browser launcher (with test)
   - YAML config manager (with test)

4. **Phase 4: API Clients**
   - Monzo OAuth service (make OAuth tests pass)
   - Actual Budget client (make connection tests pass)

5. **Phase 5: Orchestration**
   - Setup service (make orchestration tests pass)
   - Setup command (make E2E tests pass)

6. **Phase 6: Integration**
   - Wire into existing Commander CLI
   - Add to config-manager.ts
   - Update CLAUDE.md

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**Parallelization Markers**:
- [P] on all type definitions (independent files)
- [P] on all contract test creation (independent test files)
- [P] on utility implementations after interfaces defined

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, validate OAuth flow manually with real Monzo dev credentials)

## Complexity Tracking

*No constitutional violations requiring justification*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
