# Research: Transaction Import

**Feature**: Transaction Import
**Branch**: `003-transaction-import`
**Date**: 2025-10-01

## Overview
Research findings for implementing transaction import from Monzo to Actual Budget, covering Monzo API transaction retrieval, duplicate detection strategies, and Actual Budget transaction creation.

## Technology Decisions

### 1. Monzo Transactions API

**Decision**: Use Monzo `/transactions` endpoint with date range filtering

**Rationale**:
- Monzo API provides `/transactions` endpoint that returns paginated transaction list
- Supports filtering by `since` and `before` parameters (ISO 8601 timestamps)
- Returns comprehensive transaction data including amounts, merchants, categories, and status
- API automatically includes both pending and settled transactions in responses
- Declined transactions have `decline_reason` field populated (can filter client-side)

**Implementation approach**:
- Call `/transactions?account_id={id}&since={start}&before={end}` for each mapped account
- Default date range: last 30 days calculated as `Date.now() - (30 * 24 * 60 * 60 * 1000)`
- Filter out declined transactions client-side where `transaction.decline_reason !== null`
- Handle pagination using `limit` parameter (max 100) and pagination tokens

**Alternatives considered**:
- Webhooks for real-time sync: Rejected - requires server infrastructure, overcomplicated for CLI tool
- Feed items endpoint: Rejected - includes non-transaction items, requires additional filtering

### 2. Duplicate Detection Strategy

**Decision**: Use transaction ID-based tracking with persistent import history

**Rationale**:
- Monzo provides unique `transaction.id` for each transaction (never changes)
- Actual Budget SDK doesn't expose internal transaction IDs via public API
- Need client-side tracking to map Monzo IDs to import status
- Store import history in config file to survive CLI sessions

**Implementation approach**:
- Extend `config.yaml` with `importHistory` section:
  ```yaml
  importHistory:
    lastImportTimestamp: '2025-10-01T12:00:00Z'
    importedTransactions:
      - monzoId: 'tx_00009ABC...'
        accountId: 'acc_00009ABC...'
        importedAt: '2025-10-01T12:00:00Z'
  ```
- Before importing, check if `transaction.id` exists in `importedTransactions`
- After successful import, append transaction ID to history
- Prune history older than 90 days to prevent unbounded growth

**Alternatives considered**:
- Amount + date + description matching: Rejected - unreliable (legitimately identical transactions exist)
- SQLite database: Rejected - adds dependency, requires migration, overcomplicated for use case
- Actual Budget memo field tagging: Rejected - pollutes user-visible data, not guaranteed unique

### 3. Category Mapping

**Decision**: Import transactions without category mapping (uncategorized in Actual Budget)

**Rationale**:
- Monzo categories (e.g., "groceries", "eating_out") don't directly map to Actual Budget categories
- Actual Budget category structure is user-defined and varies between budgets
- Attempting automatic mapping risks incorrect categorization
- Users prefer to categorize in Actual Budget where they see full context

**Implementation approach**:
- Create transactions in Actual Budget with `category_id: null` (uncategorized)
- Store original Monzo category in transaction notes/memo for user reference
- Document in quickstart that users should categorize transactions post-import in Actual Budget

**Alternatives considered**:
- Prompt-based mapping during setup: Rejected - too many categories, tedious setup
- Fuzzy name matching: Rejected - error-prone, different users organize categories differently
- Machine learning: Rejected - overcomplicated, requires training data

### 4. Multi-Currency Handling

**Decision**: Import all transactions in their original currency, document GBP assumption

**Rationale**:
- Monzo API returns amounts in account's base currency (typically GBP)
- Currency conversion already handled by Monzo before API response
- Actual Budget supports multi-currency but most users operate in single currency
- Foreign transactions appear as GBP amounts (already converted by Monzo)

**Implementation approach**:
- Extract `transaction.amount` (already in account base currency, typically GBP)
- Import directly to Actual Budget without currency conversion
- Document assumption: "Monzo account in GBP, transactions imported as GBP"
- Note in quickstart: users with multi-currency accounts should verify amounts

**Alternatives considered**:
- Multi-currency support with exchange rates: Rejected - Monzo already converts, adds unnecessary complexity
- Currency field prompt during setup: Rejected - Monzo API handles conversion, not needed for MVP

### 5. Progress Indication

**Decision**: Use `ora` spinner with per-account progress updates

**Rationale**:
- Already dependency in project (used by setup command)
- CLI-friendly terminal spinner with status messages
- Simple API for updating status during long-running operations
- No batch size target needed - API naturally rate-limits and paginates

**Implementation approach**:
- Initialize spinner before starting imports
- Update spinner text for each account: `"Importing from {account_name}... ({count} transactions)"`
- Show final summary: `"✓ Imported {total} transactions ({skipped} duplicates)"`
- Display errors as warnings, continue processing (fail-safe behavior)

**Alternatives considered**:
- Progress bar: Rejected - can't determine total transaction count upfront without pre-flight API call
- Silent operation: Rejected - users need feedback for long-running operations

## External Dependencies Research

### Monzo API Client
- **Existing**: `MonzoApiClient` class handles OAuth token exchange and `/ping/whoami`
- **Needed**: Extend with `getTransactions(accountId, since, before)` method
- **Pagination**: Use `expand[]=merchant` to include merchant details in single request
- **Rate limiting**: Monzo enforces rate limits; implement exponential backoff for 429 responses

### Actual Budget SDK
- **Existing**: `ActualClient` validates connection
- **Needed**: Research SDK transaction creation API
- **API**: `@actual-app/api` provides `importTransactions(accountId, transactions[])`
- **Transaction format**:
  ```typescript
  {
    account: string;      // Actual Budget account ID
    date: string;         // YYYY-MM-DD format
    amount: number;       // Cents (negative for expenses)
    payee_name?: string;  // Merchant/description
    notes?: string;       // Additional metadata
  }
  ```

### Configuration Management
- **Existing**: `config.yaml` managed by `ConfigManager` with Zod validation
- **Needed**: Extend schema to include:
  - Account mappings: `accountMappings: Array<{ monzoAccountId, actualAccountId }>`
  - Import history: `importHistory: { lastImport, importedTransactions[] }`
- **Migration**: Update `config-schema.ts` with new fields (optional for backward compatibility)

## Performance Considerations

### Expected Load
- **Typical usage**: 1-3 Monzo accounts, 30-90 days of transactions
- **Transaction volume**: ~100-300 transactions per account per month
- **API calls**: 1-3 accounts × 1-3 requests (pagination) = 3-9 API calls per import
- **Processing time**: ~2-5 seconds for typical import (network latency dominant)

### Optimization Strategy
- Parallel account processing: Fetch transactions from multiple accounts concurrently
- Single-pass duplicate check: Build Set from import history before processing
- Batch Actual Budget inserts: Use SDK batch import if available (single API call)

## Error Handling Patterns

### Monzo API Errors
- **401 Unauthorized**: Token expired → guide user to re-run setup
- **429 Rate Limited**: Exponential backoff (1s, 2s, 4s) then fail with message
- **500 Server Error**: Retry once, then fail with "Monzo API unavailable"
- **Network errors**: Report error, continue with next account (partial success)

### Actual Budget Errors
- **Connection lost**: Fail entire import (maintain consistency)
- **Invalid account ID**: Skip account, report error at end
- **Transaction validation error**: Log transaction details, continue with next

### Configuration Errors
- **Missing account mapping**: Fail with clear message directing to setup
- **Invalid date format**: Validate dates before API call, fail fast with example
- **Corrupted import history**: Warn user, proceed without duplicate detection (safe fallback)

## Security Considerations

### Token Management
- Access tokens stored in secure config (existing pattern from setup)
- Tokens never logged or displayed in output
- Expired token detection: catch 401 errors, prompt re-authentication

### Data Privacy
- Transaction data never persisted outside Actual Budget (except import history IDs)
- Import history contains only transaction IDs (no amounts/merchants)
- No external analytics or telemetry

## Testing Strategy

### Contract Tests
- Mock Monzo `/transactions` API responses (success, pagination, errors)
- Verify request format (headers, query params)
- Test error handling (401, 429, 500)

### Integration Tests
- Full import flow with mocked APIs
- Duplicate detection verification
- Partial failure scenarios (one account fails)
- Date range edge cases (empty results, large date ranges)

### Unit Tests
- Date range calculation (30-day default)
- Declined transaction filtering
- Duplicate detection logic
- Configuration schema validation

## Open Questions Resolved

1. ~~Default date range~~ → Last 30 days (clarified)
2. ~~Account mapping configuration~~ → During setup (clarified)
3. ~~Pending transaction handling~~ → Import all (clarified)
4. ~~Declined transactions~~ → Filter out (clarified)
5. ~~Partial failure behavior~~ → Continue, report at end (clarified)
6. ~~Category mapping~~ → No automatic mapping (researched)
7. ~~Multi-currency~~ → Import in base currency (researched)
8. ~~Progress indication~~ → Ora spinner (researched)

## Implementation Readiness

**Status**: ✅ Ready for Phase 1 (Design & Contracts)

All technical unknowns resolved. No blocking research items remain.
