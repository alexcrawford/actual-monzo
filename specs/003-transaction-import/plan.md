# Implementation Plan: Transaction Import

**Branch**: `003-transaction-import` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-transaction-import/spec.md`

## Execution Flow (/plan command scope)
```
✓ 1. Load feature spec from Input path
✓ 2. Fill Technical Context (scan for NEEDS CLARIFICATION)
     → Project Type: single (CLI application)
     → Structure Decision: Single project with src/ and tests/
✓ 3. Fill the Constitution Check section based on constitution document
✓ 4. Evaluate Constitution Check section
     → No violations detected
     → Progress Tracking: Initial Constitution Check PASS
✓ 5. Execute Phase 0 → research.md
     → All NEEDS CLARIFICATION resolved
✓ 6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
✓ 7. Re-evaluate Constitution Check section
     → No new violations
     → Progress Tracking: Post-Design Constitution Check PASS
✓ 8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
✓ 9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Import Monzo transactions into Actual Budget via CLI command. Retrieves transactions from Monzo `/transactions` API for user-specified date range (defaults to last 30 days), filters declined transactions, detects duplicates using transaction ID tracking in config file, and imports to Actual Budget using `@actual-app/api` SDK. Supports multiple account mappings configured during setup. Handles partial failures gracefully (continues with successful accounts, reports failures at end). Progress indicated via ora spinner.

**Technical Approach**: Extend existing `MonzoApiClient` with `getTransactions()` method, create new `ImportService` for orchestration, persist import history in `config.yaml` for duplicate detection, use Commander.js for CLI command with date range options.

## Technical Context

**Language/Version**: TypeScript 5.2+ with Node.js 18+
**Primary Dependencies**: Commander.js (CLI), Axios (HTTP), @actual-app/api (Actual Budget SDK), Zod (validation), ora (spinners), chalk (colors)
**Storage**: YAML config file (`config.yaml`) for account mappings and import history
**Testing**: Vitest with contract tests (API mocking), integration tests (full flow), unit tests (logic)
**Target Platform**: Node.js CLI (macOS, Linux, Windows via WSL)
**Project Type**: single (CLI application with src/ and tests/ directories)
**Performance Goals**: Import 100-300 transactions in 2-5 seconds (network latency dominant)
**Constraints**: Monzo API rate limiting (handled with exponential backoff), 90-day maximum date range (Monzo pagination limit)
**Scale/Scope**: 1-3 Monzo accounts per user, 30-90 day imports typical, 100-300 transactions per import session

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. API-First Integration ✅
- Uses official Monzo API (`/transactions` endpoint) with OAuth 2.0
- Uses official Actual Budget SDK (`@actual-app/api`)
- No scraping or unofficial endpoints
- Proper error handling for HTTP status codes (401, 429, 500)

### II. CLI-First Interface ✅
- Commander.js command: `actual-monzo import`
- Options: `--start`, `--end`, `--account`, `--dry-run`
- Supports non-interactive mode (all options via flags)
- Human-readable output (ora spinner + formatted summary)
- Predictable exit codes (0 = success, 1 = error)

### III. Configuration Management ✅
- Secure storage: Uses existing `config.yaml` with Zod validation
- No hardcoded secrets
- Account mappings persisted in config
- Import history tracked securely (transaction IDs only, no sensitive data)

### IV. Data Validation & Transformation ✅
- Zod schema validation for config extensions (`AccountMapping`, `ImportHistory`)
- Transaction validation before import (date format, amount integer, required fields)
- Accurate amount preservation (pence → cents, no precision loss)
- Category not auto-mapped (user categorizes in Actual Budget for accuracy)

### V. Error Handling & Recovery ✅
- Token expiry: Clear message directing to re-run setup
- Rate limiting: Exponential backoff (1s, 2s, 4s)
- Partial failures: Continue with successful accounts, report failures at end
- Network errors: Graceful degradation, retry logic for transient failures

**Status**: ✅ PASS - No constitutional violations detected

## Project Structure

### Documentation (this feature)
```
specs/003-transaction-import/
├── plan.md                      # This file (/plan command output)
├── research.md                  # Phase 0 output (/plan command) ✓
├── data-model.md                # Phase 1 output (/plan command) ✓
├── quickstart.md                # Phase 1 output (/plan command) ✓
├── contracts/                   # Phase 1 output (/plan command) ✓
│   ├── monzo-transactions-api.md
│   ├── actual-import-api.md
│   └── cli-command.md
└── tasks.md                     # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── commands/
│   ├── index.ts                 # Export all commands
│   ├── setup.ts                 # Existing setup command
│   └── import.ts                # NEW: Import command
├── services/
│   ├── actual-client.ts         # Existing (extend with import method)
│   ├── monzo-api-client.ts      # Existing (extend with getTransactions)
│   ├── monzo-oauth-service.ts   # Existing
│   ├── setup-service.ts         # Existing
│   └── import-service.ts        # NEW: Import orchestration
├── types/
│   ├── config.ts                # Existing (extend with AccountMapping, ImportHistory)
│   ├── oauth.ts                 # Existing
│   ├── setup.ts                 # Existing
│   └── import.ts                # NEW: Import-related types
└── utils/
    ├── config-manager.ts        # Existing
    ├── config-schema.ts         # Existing (extend Zod schema)
    ├── date-utils.ts            # NEW: Date formatting and validation
    └── ...                      # Existing utils

tests/
├── contract/
│   ├── monzo-transactions.contract.test.ts    # NEW
│   ├── actual-import.contract.test.ts         # NEW
│   └── import-command.contract.test.ts        # NEW
├── integration/
│   ├── import-full-flow.integration.test.ts   # NEW
│   ├── import-duplicates.integration.test.ts  # NEW
│   └── import-partial-failure.integration.test.ts  # NEW
└── unit/
    ├── date-utils.unit.test.ts                # NEW
    ├── duplicate-detection.unit.test.ts       # NEW
    └── transaction-transform.unit.test.ts     # NEW
```

**Structure Decision**: Single project layout (CLI application). All source in `src/` with commands, services, types, and utils. Tests organized by type (contract, integration, unit). Existing setup command pattern will be followed for import command. Config schema extension maintains backward compatibility (new fields optional).

## Phase 0: Outline & Research ✅

**Status**: COMPLETE - See `research.md`

**Unknowns Resolved**:
1. ✅ Monzo transaction retrieval: `/transactions` endpoint with date filtering
2. ✅ Duplicate detection: Transaction ID tracking in `config.yaml` (client-side)
3. ✅ Category mapping: No automatic mapping (import uncategorized)
4. ✅ Multi-currency: Import in base currency (GBP assumption documented)
5. ✅ Progress indication: Ora spinner with per-account updates
6. ✅ Actual Budget import API: `importTransactions()` SDK method
7. ✅ Pagination handling: Loop with offset parameter (max 100 per page)
8. ✅ Error patterns: 401 (token expired), 429 (rate limit), 500 (server error)

**Key Research Findings**:
- Monzo API returns transactions in pence (integer) → direct import to Actual (cents)
- Declined transactions have `decline_reason !== null` → filter client-side
- SDK provides `imported_id` field for duplicate detection (can supplement client-side tracking)
- Account mappings stored in config during setup, loaded at import time
- Import history pruned after 90 days to prevent unbounded growth

**Output**: ✅ research.md with all decisions documented

## Phase 1: Design & Contracts ✅

**Status**: COMPLETE

### Data Model (data-model.md) ✅

**Entities Defined** (6):
1. **MonzoTransaction**: API response structure (id, amount, merchant, etc.)
2. **ActualTransaction**: SDK import format (account, date, amount, payee_name)
3. **AccountMapping**: Monzo ↔ Actual Budget account association
4. **ImportHistory**: Duplicate tracking (transaction IDs + timestamps)
5. **ImportSession**: Single import execution state (statistics, failures)
6. **DateRange**: Time period for transaction retrieval (start, end)

**Config Schema Extensions**:
```typescript
accountMappings?: AccountMapping[];  // Added to existing config
importHistory?: ImportHistory;       // Added to existing config
```

**Type Files Created**: `src/types/import.ts` (all import-related interfaces)

### API Contracts (contracts/) ✅

**1. Monzo Transactions API** (`monzo-transactions-api.md`):
- Endpoint: `GET /transactions`
- Parameters: `account_id`, `since`, `before`, `expand[]=merchant`
- Response: Array of transactions with pagination support
- Error handling: 401 (expired), 429 (rate limit), 500 (server error)
- Validation rules: Filter `decline_reason !== null`

**2. Actual Budget Import API** (`actual-import-api.md`):
- SDK method: `importTransactions(accountId, transactions[])`
- Transaction format: `{ account, date, amount, payee_name, notes, imported_id }`
- Duplicate detection: Uses `imported_id` field (Monzo transaction ID)
- Return value: `{ added: string[], updated: string[] }`

**3. CLI Command** (`cli-command.md`):
- Command: `actual-monzo import [options]`
- Options: `--start`, `--end`, `--account`, `--dry-run`
- Validation: Date format (YYYY-MM-DD), range (≤90 days), config presence
- Output: Ora spinner + formatted summary + exit codes

### Contract Tests (Planned)

**Test Files** (9):
1. `monzo-transactions.contract.test.ts` - Mock Monzo API responses
2. `actual-import.contract.test.ts` - Mock SDK import method
3. `import-command.contract.test.ts` - CLI option parsing and validation
4. `import-full-flow.integration.test.ts` - End-to-end happy path
5. `import-duplicates.integration.test.ts` - Duplicate detection verification
6. `import-partial-failure.integration.test.ts` - One account fails scenario
7. `date-utils.unit.test.ts` - Date formatting and validation
8. `duplicate-detection.unit.test.ts` - Import history logic
9. `transaction-transform.unit.test.ts` - Monzo → Actual mapping

**Test Coverage Requirements**: All contracts must have failing tests before implementation begins (TDD approach).

### Quickstart Guide (quickstart.md) ✅

**User Scenarios Covered**:
- Import last 30 days (default command)
- Import specific date range
- Preview with dry run
- Import single account
- Verify transactions in Actual Budget
- Troubleshoot common errors (token expiry, missing config)

**Manual Test Checklist**: 13 scenarios for pre-release validation

### Agent Context Update (CLAUDE.md) ✅

**Updates Applied**:
- Project structure reflects import command addition
- Active technologies list confirmed (no new dependencies)
- Commands section updated with import command
- Manual additions preserved (Git commit conventions)

**Output**: ✅ All Phase 1 artifacts generated

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

**Source Artifacts**:
1. Load `data-model.md` for entities and schema extensions
2. Load `contracts/` for API contracts and validation rules
3. Load `quickstart.md` for test scenarios

**Task Categories** (TDD order):

1. **Contract Tests** (FIRST - tests before implementation):
   - Parse `contracts/monzo-transactions-api.md` → generate contract test tasks
   - Parse `contracts/actual-import-api.md` → generate contract test tasks
   - Parse `contracts/cli-command.md` → generate contract test tasks
   - Each contract → one failing test file

2. **Type Definitions** (SECOND - enable TypeScript compilation):
   - Parse `data-model.md` → create `src/types/import.ts`
   - Extend `src/types/config.ts` with `AccountMapping`, `ImportHistory`
   - Update `src/utils/config-schema.ts` with Zod schemas

3. **Utilities** (THIRD - shared logic):
   - Date formatting/validation (`src/utils/date-utils.ts`)
   - Duplicate detection logic (part of import service)
   - Transaction transformation (Monzo → Actual)

4. **Service Extensions** (FOURTH - API clients):
   - Extend `MonzoApiClient` with `getTransactions()` method
   - Extend `ActualClient` with import wrapper (if needed)
   - Create `ImportService` orchestrator

5. **CLI Command** (FIFTH - user interface):
   - Create `src/commands/import.ts` with Commander.js
   - Wire up to main CLI program (`src/index.ts`)
   - Implement option parsing and validation

6. **Integration Tests** (SIXTH - end-to-end validation):
   - Full flow test (happy path)
   - Duplicate detection test
   - Partial failure test
   - Edge case tests (empty results, large ranges)

### Ordering Strategy

**Dependency Order**:
```
Contract Tests (P)
  ↓
Type Definitions (P)
  ↓
Utilities (P)
  ↓
Service Extensions (sequential: Monzo client → Actual client → Import service)
  ↓
CLI Command
  ↓
Integration Tests
```

**Parallelization Markers**:
- [P] = Can be worked on in parallel (independent files)
- Sequential tasks depend on previous completion

**Task Numbering**: Sequential 1-N based on dependency order

### Estimated Output

**Total Tasks**: ~30-35 tasks

**Breakdown**:
- Contract tests: 9 tasks (3 files × 3 setup/scenarios)
- Type definitions: 3 tasks (import.ts, config.ts extension, schema)
- Utilities: 4 tasks (date utils, duplicate logic, transform, validators)
- Service extensions: 5 tasks (Monzo client, Actual client, Import service, error handling)
- CLI command: 6 tasks (command definition, option parsing, validation, action handler, output formatting, wiring)
- Integration tests: 4 tasks (full flow, duplicates, partial failure, edge cases)
- Documentation: 2 tasks (update README, update CLAUDE.md if needed)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

*No constitutional violations detected - this section intentionally empty*

All design decisions align with constitution:
- API-first integration (official Monzo + Actual Budget APIs)
- CLI-first interface (Commander.js with options)
- Secure configuration (existing config.yaml pattern)
- Data validation (Zod schemas, transaction validation)
- Error handling (token expiry, rate limits, partial failures)

No simplification needed. Design follows existing patterns from setup command.

## Progress Tracking

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
- [x] Complexity deviations documented (N/A - no deviations)

**Artifacts Generated**:
- [x] research.md (Phase 0)
- [x] data-model.md (Phase 1)
- [x] contracts/monzo-transactions-api.md (Phase 1)
- [x] contracts/actual-import-api.md (Phase 1)
- [x] contracts/cli-command.md (Phase 1)
- [x] quickstart.md (Phase 1)
- [x] CLAUDE.md updated (Phase 1)
- [ ] tasks.md (Phase 2 - awaiting /tasks command)

---

**Ready for `/tasks` command** ✅

All design artifacts complete. Task generation strategy documented. No blockers.

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
