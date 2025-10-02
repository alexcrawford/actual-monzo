# Tasks: Transaction Import

**Input**: Design documents from `/specs/003-transaction-import/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

## Execution Flow (main)
```
✓ 1. Load plan.md from feature directory
   → Tech stack: TypeScript 5.2+, Commander.js, Axios, Zod, Vitest
   → Structure: Single project (src/, tests/)
✓ 2. Load optional design documents:
   → data-model.md: 6 entities extracted
   → contracts/: 3 contracts (Monzo API, Actual API, CLI)
   → research.md: Duplicate detection, date handling decisions
✓ 3. Generate tasks by category:
   → Setup: Dependencies already exist (no new deps)
   → Tests: 3 contract tests, 3 integration tests, 3 unit tests
   → Core: Types, utilities, service extensions, CLI command
   → Integration: Config schema, import service orchestration
   → Polish: Documentation, manual testing
✓ 4. Apply task rules:
   → Contract tests [P], type files [P], unit tests [P]
   → Services sequential (depend on types)
   → CLI command depends on services
✓ 5. Number tasks sequentially (T001-T033)
✓ 6. Generate dependency graph
✓ 7. Create parallel execution examples
✓ 8. Validate task completeness:
   → All 3 contracts have tests ✓
   → All 6 entities have type definitions ✓
   → CLI command implementation complete ✓
✓ 9. SUCCESS - 33 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Single project structure (repository root):
- Source: `src/commands/`, `src/services/`, `src/types/`, `src/utils/`
- Tests: `tests/contract/`, `tests/integration/`, `tests/unit/`

---

## Phase 3.1: Setup

No new dependencies required - all libraries already in package.json ✓

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Parallel - Different Files)
- [X] **T001** [P] Create Monzo transactions API contract test in `tests/contract/monzo-transactions.contract.test.ts`
  - Mock Monzo `/transactions` endpoint responses (200, 401, 429, 500)
  - Test request format (query params, headers, expand merchant)
  - Test pagination handling (offset parameter)
  - Verify declined transaction filtering (`decline_reason !== null`)
  - Assert field validation (id format, amount integer, date parsing)

- [X] **T002** [P] Create Actual Budget import API contract test in `tests/contract/actual-import.contract.test.ts`
  - Mock `@actual-app/api` `importTransactions()` method
  - Test transaction format validation (account UUID, date YYYY-MM-DD, amount integer)
  - Test duplicate detection via `imported_id` field
  - Verify return value structure (`{ added: [], updated: [] }`)
  - Test SDK initialization requirement

- [X] **T003** [P] Create import CLI command contract test in `tests/contract/import-command.contract.test.ts`
  - Test command registration (`actual-monzo import`)
  - Test option parsing (--start, --end, --account, --dry-run)
  - Test default values (start = 30 days ago, end = today)
  - Test date format validation (YYYY-MM-DD required)
  - Test date range validation (start <= end, <= 90 days, not future)
  - Test configuration validation (mappings exist, tokens present)
  - Test exit codes (0 = success, 1 = error)

### Integration Tests (Parallel - Different Files)
- [ ] **T004** [P] Create full import flow integration test in `tests/integration/import-full-flow.integration.test.ts`
  - Mock Monzo API with sample transactions (settled, pending)
  - Mock Actual Budget SDK
  - Load config with account mappings
  - Execute import command with date range
  - Verify transactions fetched from Monzo
  - Verify declined transactions filtered out
  - Verify transactions imported to Actual Budget
  - Verify import history updated in config
  - Assert summary output (counts, durations)

- [ ] **T005** [P] Create duplicate detection integration test in `tests/integration/import-duplicates.integration.test.ts`
  - Set up config with existing import history (pre-imported transaction IDs)
  - Mock Monzo API returning mix of new and previously imported transactions
  - Execute import command
  - Verify only new transactions imported (duplicates skipped)
  - Assert duplicate count in summary output
  - Verify import history appended correctly

- [ ] **T006** [P] Create partial failure integration test in `tests/integration/import-partial-failure.integration.test.ts`
  - Mock multiple account mappings
  - Mock Monzo API to succeed for first account, fail (500 error) for second
  - Execute import command
  - Verify first account transactions imported successfully
  - Verify second account failure reported in summary
  - Assert exit code 0 (partial success continues)
  - Verify import history only updated for successful account

### Unit Tests (Parallel - Different Files)
- [ ] **T007** [P] Create date utilities unit test in `tests/unit/date-utils.unit.test.ts`
  - Test `formatDate(isoTimestamp)` → YYYY-MM-DD
  - Test `validateDateString(dateStr)` with valid/invalid formats
  - Test `calculateDefaultDateRange()` → last 30 days
  - Test `parseDateRange(start, end)` validation (order, range, future check)

- [ ] **T008** [P] Create duplicate detection unit test in `tests/unit/duplicate-detection.unit.test.ts`
  - Test `isDuplicate(monzoId, importHistory)` true/false
  - Test `recordImport(monzoId, accountId, history)` appends correctly
  - Test `pruneOldRecords(history, daysToKeep)` removes old entries

- [ ] **T009** [P] Create transaction transformation unit test in `tests/unit/transaction-transform.unit.test.ts`
  - Test `transformMonzoToActual(monzoTx, accountMapping)` conversion
  - Verify amount preservation (pence → cents)
  - Verify date extraction (settled || created)
  - Verify payee name (merchant.name || description)
  - Verify notes format (`Monzo: {category} | ID: {id}`)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Type Definitions (Parallel - Different Files)
- [X] **T010** [P] Create import types in `src/types/import.ts`
  - Define `MonzoTransaction` interface (id, amount, merchant, decline_reason, etc.)
  - Define `ActualTransaction` interface (account, date, amount, payee_name, notes, imported_id)
  - Define `AccountMapping` interface (monzoAccountId, actualAccountId, names)
  - Define `ImportedTransactionRecord` interface (monzoId, accountId, importedAt)
  - Define `ImportHistory` interface (lastImportTimestamp, importedTransactions[])
  - Define `DateRange` interface (start, end)
  - Define `FailedAccountRecord` interface (accountId, accountName, error, message)
  - Define `ImportSession` interface (startTime, dateRange, statistics, failures)

- [X] **T011** [P] Extend config types in `src/types/config.ts`
  - Import `AccountMapping` and `ImportHistory` from `import.ts`
  - Add `accountMappings?: AccountMapping[]` to Config interface
  - Add `importHistory?: ImportHistory` to Config interface

- [X] **T012** [P] Extend config schema in `src/utils/config-schema.ts`
  - Import Zod schemas from dependencies
  - Create `AccountMappingSchema` with field validations (monzoAccountId regex, UUID)
  - Create `ImportedTransactionRecordSchema` (monzoId regex, datetime)
  - Create `ImportHistorySchema` (lastImportTimestamp, importedTransactions array)
  - Add `accountMappings: z.array(AccountMappingSchema).optional()` to ConfigSchema
  - Add `importHistory: ImportHistorySchema.optional()` to ConfigSchema

### Utilities (Parallel - Different Files)
- [X] **T013** [P] Create date utilities in `src/utils/date-utils.ts`
  - Implement `formatDate(isoTimestamp: string): string` → YYYY-MM-DD
  - Implement `validateDateString(dateStr: string): Date` with format check
  - Implement `calculateDefaultDateRange(): DateRange` (30 days ago to today)
  - Implement `parseDateRange(startStr: string, endStr: string): DateRange`
    - Validate format, order, future dates, max 90-day range
    - Throw clear errors with format examples

### Service Extensions (Sequential - Depends on Types)
- [X] **T014** Extend Monzo API client in `src/services/monzo-api-client.ts`
  - Add `getTransactions(accountId: string, since: string, before: string): Promise<MonzoTransaction[]>` method
  - Implement pagination loop (offset parameter, max 100 per page)
  - Add `expand[]=merchant` to request params
  - Handle errors: 401 (token expired), 429 (rate limit with exponential backoff), 500 (retry once)
  - Filter declined transactions client-side (`decline_reason === null`)
  - Return array of valid MonzoTransaction objects

- [X] **T015** Create import service in `src/services/import-service.ts`
  - Create `ImportService` class
  - Implement `executeImport(mappings, dateRange, dryRun): Promise<ImportSession>` method
  - Initialize ImportSession with start time and date range
  - For each AccountMapping:
    - Fetch transactions from Monzo using MonzoApiClient
    - Filter declined transactions
    - Load import history from config
    - Check duplicates (transaction ID in history)
    - Transform MonzoTransaction → ActualTransaction
    - If not dry run: import to Actual Budget via SDK
    - Update session statistics (total, duplicates, declined)
    - Handle errors: catch per-account, add to failedAccounts, continue
  - Update import history in config after successful imports
  - Return completed ImportSession

- [X] **T016** Add import history management to `src/utils/config-manager.ts`
  - Implement `isDuplicate(monzoId: string, config: Config): boolean`
    - Check if monzoId exists in config.importHistory?.importedTransactions
  - Implement `recordImport(monzoId: string, accountId: string, config: Config): Config`
    - Append new ImportedTransactionRecord to importHistory
    - Update lastImportTimestamp to current time
  - Implement `pruneImportHistory(config: Config, daysToKeep = 90): Config`
    - Filter importedTransactions older than threshold
    - Return updated config

### CLI Command (Sequential - Depends on Services)
- [X] **T017** Create import command file in `src/commands/import.ts`
  - Import Commander, ImportService, ConfigManager, date utilities
  - Create `importCommand` using Commander.js `new Command('import')`
  - Add options:
    - `-s, --start <date>` (default: calculateDefaultStart())
    - `-e, --end <date>` (default: today YYYY-MM-DD)
    - `-a, --account <id>` (optional: filter to specific Monzo account)
    - `--dry-run` (boolean, default: false)
  - Define `ImportOptions` interface for typed options

- [X] **T018** Implement import command action handler in `src/commands/import.ts`
  - Create `importAction(options: ImportOptions)` async function
  - Load config using ConfigManager
  - Call `validateImportConfig(config)` (validates Monzo/Actual setup, mappings exist)
  - Parse and validate date range using `parseDateRange(options.start, options.end)`
  - Filter account mappings if `--account` specified
  - Initialize ora spinner: `ora('Starting import...').start()`
  - Execute import: `await importService.executeImport(mappings, dateRange, options.dryRun, spinner)`
  - Update spinner during execution (per-account progress)
  - Display import summary using `displayImportSummary(session, options.dryRun)`
  - Handle errors: catch, log with chalk.red, exit(1)
  - Success: exit(0)

- [X] **T019** Implement validation functions in `src/commands/import.ts`
  - Create `validateImportConfig(config: Config): void`
    - Check Monzo configuration (clientId, clientSecret, accessToken)
    - Check Actual Budget configuration (serverUrl, password)
    - Check account mappings exist (length > 0)
    - Throw clear errors with guidance to run setup if missing
  - Create `filterAccountMappings(mappings, accountId?): AccountMapping[]`
    - If accountId provided, filter mappings to matching account
    - Throw error if accountId not found (list available accounts)
    - Return all mappings if no filter

- [X] **T020** Implement output formatting in `src/commands/import.ts`
  - Create `displayImportSummary(session: ImportSession, dryRun: boolean): void`
  - Calculate duration: `(Date.now() - session.startTime) / 1000`
  - Display success header with chalk.green: `✓ ${dryRun ? 'Dry run' : 'Import'} completed in {duration}s`
  - Display accounts processed count
  - For each successful account: green checkmark + account name + transaction count
  - If failed accounts: display yellow warning + red error messages
  - Display totals: imported, duplicates skipped, declined filtered
  - For dry run: show "would import" instead of "imported"

- [X] **T021** Wire import command to main CLI in `src/index.ts`
  - Import `importCommand` from `./commands/import.js`
  - Add `program.addCommand(importCommand)` after setup command
  - Verify program.parse() still at end

---

## Phase 3.4: Integration

- [X] **T022** Create transaction transformation utility in `src/utils/transaction-transform.ts`
  - Implement `transformMonzoToActual(monzoTx: MonzoTransaction, mapping: AccountMapping): ActualTransaction`
  - Extract date: `formatDate(monzoTx.settled || monzoTx.created)`
  - Extract payee: `monzoTx.merchant?.name || monzoTx.description`
  - Create notes: `Monzo: ${monzoTx.category} | ID: ${monzoTx.id}`
  - Set cleared: `!!monzoTx.settled`
  - Set imported_id: `monzoTx.id`
  - Return ActualTransaction object

- [X] **T023** Integrate Actual Budget SDK in `src/services/import-service.ts`
  - Import `@actual-app/api` as actualApi
  - In executeImport(): initialize SDK with `actualApi.init(config.actual)`
  - Call `actualApi.importTransactions(mapping.actualAccountId, actualTransactions)`
  - Store result (`{ added, updated }`) in session statistics
  - Always disconnect: `finally { await actualApi.disconnect() }`
  - Handle SDK errors: invalid account, connection failures

- [X] **T024** Add import history persistence in `src/services/import-service.ts`
  - After successful batch import, for each imported transaction:
    - Call `ConfigManager.recordImport(transaction.id, accountId, config)`
  - Update config.importHistory.lastImportTimestamp to current time
  - Save updated config using ConfigManager.save()
  - On error: log warning, do not fail entire import

---

## Phase 3.5: Polish

### Unit Test Coverage (Parallel - Different Files)
- [ ] **T025** [P] Add unit tests for config validation in `tests/unit/config-validation.unit.test.ts`
  - Test `validateImportConfig()` with missing Monzo config
  - Test with missing Actual config
  - Test with missing account mappings
  - Verify error messages include setup guidance

- [ ] **T026** [P] Add unit tests for account filtering in `tests/unit/account-filter.unit.test.ts`
  - Test `filterAccountMappings()` with valid account ID
  - Test with invalid account ID (should throw with available accounts list)
  - Test with no filter (returns all)

- [ ] **T027** [P] Add unit tests for output formatting in `tests/unit/output-format.unit.test.ts`
  - Test `displayImportSummary()` with successful session
  - Test with partial failures (some accounts failed)
  - Test dry run output format
  - Verify chalk colors applied correctly

### Edge Cases & Error Handling
- [ ] **T028** Add error handling tests for Monzo API in `tests/unit/monzo-api-errors.unit.test.ts`
  - Test 401 error: verify "token expired" message
  - Test 429 error: verify exponential backoff (1s, 2s, 4s)
  - Test 500 error: verify single retry, then fail
  - Test network timeout: verify graceful failure

- [ ] **T029** Add edge case tests for date ranges in `tests/integration/import-edge-cases.integration.test.ts`
  - Test empty date range (no transactions returned)
  - Test maximum 90-day range
  - Test date range > 90 days (should error)
  - Test future start date (should error)
  - Test start > end (should error)

### Documentation & Final Touches
- [ ] **T030** [P] Update project README in `README.md`
  - Add "Import Transactions" section after "Setup"
  - Document basic usage: `actual-monzo import`
  - Document options: --start, --end, --account, --dry-run
  - Add examples: specific date range, dry run, single account
  - Document duplicate handling behavior

- [ ] **T031** [P] Add JSDoc comments to public APIs
  - Add JSDoc to `MonzoApiClient.getTransactions()`
  - Add JSDoc to `ImportService.executeImport()`
  - Add JSDoc to date utilities (formatDate, parseDateRange, etc.)
  - Add JSDoc to transform utilities

- [ ] **T032** Run manual testing checklist from `specs/003-transaction-import/quickstart.md`
  - Follow "Integration Testing Checklist" section (13 scenarios)
  - Verify fresh import (no duplicates)
  - Verify repeat import (all duplicates skipped)
  - Verify overlapping ranges
  - Verify multiple accounts
  - Verify declined/pending transaction handling
  - Verify dry run mode
  - Verify error messages (token expiry, invalid dates)
  - Document any issues found

- [ ] **T033** Performance validation
  - Test import with 300 transactions (should complete in < 10 seconds)
  - Test multiple accounts (2-3 accounts in parallel)
  - Verify memory usage remains stable
  - Check for potential bottlenecks (API rate limits)

---

## Dependencies

### Critical Path (Sequential)
```
T001-T009 (Tests First)
  ↓
T010-T012 (Type Definitions) [can be parallel]
  ↓
T013 (Date Utils)
  ↓
T014 (Monzo API Client Extension)
  ↓
T015 (Import Service)
  ↓
T016 (Import History Management)
  ↓
T017-T021 (CLI Command)
  ↓
T022-T024 (Integration)
  ↓
T025-T033 (Polish)
```

### Specific Dependencies
- **T010-T012** must complete before **T014** (types needed for service)
- **T013** must complete before **T015** (date utils used in service)
- **T014** must complete before **T015** (import service calls Monzo client)
- **T015** must complete before **T017** (CLI command uses import service)
- **T016** must complete before **T024** (import history management)
- **T001-T009** should fail before **T010** starts (TDD validation)

### Independent Parallel Groups
```
Group 1 (Contract Tests): T001, T002, T003
Group 2 (Integration Tests): T004, T005, T006
Group 3 (Unit Tests): T007, T008, T009
Group 4 (Types): T010, T011, T012
Group 5 (CLI Parts): T017, T018, T019, T020 (must be sequential within group)
Group 6 (Polish Unit Tests): T025, T026, T027
Group 7 (Documentation): T030, T031
```

---

## Parallel Execution Examples

### Phase 3.2 - Launch All Contract Tests Together
```bash
# All contract tests can run in parallel (different files)
Task: "Create Monzo transactions API contract test in tests/contract/monzo-transactions.contract.test.ts"
Task: "Create Actual Budget import API contract test in tests/contract/actual-import.contract.test.ts"
Task: "Create import CLI command contract test in tests/contract/import-command.contract.test.ts"
```

### Phase 3.2 - Launch All Integration Tests Together
```bash
# All integration tests can run in parallel (different files)
Task: "Create full import flow integration test in tests/integration/import-full-flow.integration.test.ts"
Task: "Create duplicate detection integration test in tests/integration/import-duplicates.integration.test.ts"
Task: "Create partial failure integration test in tests/integration/import-partial-failure.integration.test.ts"
```

### Phase 3.3 - Launch Type Definitions Together
```bash
# All type files can be created in parallel (different files)
Task: "Create import types in src/types/import.ts"
Task: "Extend config types in src/types/config.ts"
Task: "Extend config schema in src/utils/config-schema.ts"
```

### Phase 3.5 - Launch Polish Unit Tests Together
```bash
# Unit tests for polish phase (different files)
Task: "Add unit tests for config validation in tests/unit/config-validation.unit.test.ts"
Task: "Add unit tests for account filtering in tests/unit/account-filter.unit.test.ts"
Task: "Add unit tests for output formatting in tests/unit/output-format.unit.test.ts"
```

---

## Notes

- **[P] tasks** = Different files, no dependencies, safe to run in parallel
- **Sequential tasks** = Same file or depend on previous task completion
- **TDD Rule**: Verify T001-T009 all fail before starting T010
- **Commit frequency**: Commit after each completed task
- **Test verification**: Run `pnpm test` after each test task to ensure it fails
- **Implementation verification**: Run `pnpm test` after implementation to ensure tests pass

## Validation Checklist

- [x] All 3 contracts have corresponding contract tests (T001-T003)
- [x] All 6 entities from data-model.md have type definitions (T010)
- [x] All tests (T001-T009) come before implementation (T010-T024)
- [x] Parallel tasks [P] truly independent (different files verified)
- [x] Each task specifies exact file path (all tasks include paths)
- [x] No task modifies same file as another [P] task (verified)
- [x] CLI command fully implemented (T017-T021)
- [x] Integration complete (T022-T024)
- [x] Polish tasks included (T025-T033)

---

**Total Tasks**: 33
**Estimated Completion**: 3-5 days (depends on testing thoroughness)

**Ready for execution** ✅
