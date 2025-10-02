# Data Model: Transaction Import

**Feature**: Transaction Import
**Branch**: `003-transaction-import`
**Date**: 2025-10-01

## Domain Entities

### 1. MonzoTransaction

Represents a transaction retrieved from Monzo API.

**Source**: Monzo `/transactions` endpoint response

**Fields**:
- `id`: string (unique, immutable, format: `tx_00009...`)
- `account_id`: string (Monzo account, format: `acc_00009...`)
- `amount`: number (pence, negative for debits, positive for credits)
- `created`: string (ISO 8601 timestamp, transaction creation time)
- `currency`: string (ISO 4217, typically "GBP")
- `description`: string (merchant or transaction description)
- `merchant`: object | null (expanded merchant details)
  - `name`: string (merchant name)
  - `category`: string (Monzo category like "eating_out")
- `notes`: string (user-added notes from Monzo app)
- `settled`: string (ISO 8601 timestamp when transaction settled, empty if pending)
- `category`: string (Monzo category slug)
- `decline_reason`: string | null (populated if declined, null otherwise)

**Validation Rules**:
- `id` must be present and match pattern `tx_[a-zA-Z0-9]{16,}`
- `amount` must be an integer (API uses pence)
- `created` must be valid ISO 8601 timestamp
- `decline_reason !== null` → transaction excluded from import

**State Transitions**:
- Pending → Settled: `settled` field populated with timestamp
- Active → Declined: `decline_reason` populated (excluded from import)

**Relationships**:
- Belongs to one Monzo account (`account_id`)
- Maps to zero or one Actual Budget transaction (if imported)

---

### 2. ActualTransaction

Represents a transaction in Actual Budget after import.

**Source**: Created via `@actual-app/api` SDK

**Fields**:
- `account`: string (Actual Budget account UUID)
- `date`: string (YYYY-MM-DD format, extracted from Monzo `created` or `settled`)
- `amount`: number (cents, negative for expenses, positive for income)
- `payee_name`: string (merchant name or description from Monzo)
- `notes`: string (optional, stores Monzo category and transaction ID for reference)
- `cleared`: boolean (optional, defaults to true for settled, false for pending - if SDK supports)

**Validation Rules**:
- `account` must be valid Actual Budget account UUID
- `date` must be YYYY-MM-DD format
- `amount` must be an integer (cents)
- `payee_name` must not be empty string

**Derivation from MonzoTransaction**:
```typescript
{
  account: accountMapping.actualAccountId,
  date: formatDate(monzoTx.settled || monzoTx.created), // YYYY-MM-DD
  amount: monzoTx.amount, // Already in cents
  payee_name: monzoTx.merchant?.name || monzoTx.description,
  notes: `Monzo: ${monzoTx.category} | ID: ${monzoTx.id}`
}
```

---

### 3. AccountMapping

Associates Monzo account with Actual Budget account.

**Source**: Configured during setup command, persisted in `config.yaml`

**Fields**:
- `monzoAccountId`: string (Monzo account ID, format: `acc_00009...`)
- `monzoAccountName`: string (display name from Monzo API, e.g., "Current Account")
- `actualAccountId`: string (Actual Budget account UUID)
- `actualAccountName`: string (display name from Actual Budget, e.g., "Checking")

**Validation Rules**:
- Both IDs must be non-empty strings
- `monzoAccountId` must match pattern `acc_[a-zA-Z0-9]{16,}`
- No duplicate `monzoAccountId` entries (one-to-one mapping)

**Storage**:
```yaml
accountMappings:
  - monzoAccountId: acc_00009ABC123DEF456
    monzoAccountName: Current Account
    actualAccountId: 550e8400-e29b-41d4-a716-446655440000
    actualAccountName: Checking
```

**Relationships**:
- One Monzo account maps to exactly one Actual Budget account
- Multiple mappings allowed (user can have multiple accounts)

---

### 4. ImportHistory

Tracks imported transactions to prevent duplicates.

**Source**: Persisted in `config.yaml`, updated after each import

**Fields**:
- `lastImportTimestamp`: string (ISO 8601, timestamp of most recent import)
- `importedTransactions`: Array of ImportedTransactionRecord

**ImportedTransactionRecord**:
- `monzoId`: string (Monzo transaction ID)
- `accountId`: string (Monzo account ID for grouping)
- `importedAt`: string (ISO 8601 timestamp when imported)

**Validation Rules**:
- `monzoId` must be unique within array
- `importedAt` must be valid ISO 8601 timestamp
- Records older than 90 days should be pruned (garbage collection)

**Storage**:
```yaml
importHistory:
  lastImportTimestamp: '2025-10-01T14:30:00Z'
  importedTransactions:
    - monzoId: tx_00009ABC123DEF456
      accountId: acc_00009ABC123DEF456
      importedAt: '2025-10-01T14:30:00Z'
    - monzoId: tx_00009XYZ789GHI012
      accountId: acc_00009ABC123DEF456
      importedAt: '2025-10-01T14:30:05Z'
```

**Operations**:
- `isDuplicate(monzoId)`: Check if `monzoId` exists in array
- `recordImport(monzoId, accountId)`: Append new record with current timestamp
- `pruneOldRecords(daysToKeep = 90)`: Remove records older than threshold

---

### 5. ImportSession

Represents a single execution of the import command.

**Source**: In-memory object created when import command runs

**Fields**:
- `startTime`: Date (session start timestamp)
- `dateRange`: DateRange (start and end dates for import)
- `accountsProcessed`: number (count of accounts attempted)
- `successfulAccounts`: Array of strings (Monzo account IDs)
- `failedAccounts`: Array of FailedAccountRecord
- `totalTransactions`: number (total imported)
- `duplicatesSkipped`: number (transactions already imported)
- `declinedFiltered`: number (declined transactions excluded)

**FailedAccountRecord**:
- `accountId`: string (Monzo account ID)
- `accountName`: string (display name)
- `error`: Error (original error object)
- `message`: string (user-friendly error message)

**Lifecycle**:
1. Initialize with date range
2. Process each account mapping
3. Accumulate statistics
4. Generate summary report

**Example Summary Output**:
```
✓ Import completed in 3.2s

Accounts processed: 2/2
  ✓ Current Account: 45 transactions
  ✓ Joint Account: 23 transactions

Total imported: 68 transactions
Duplicates skipped: 12 transactions
Declined filtered: 3 transactions
```

---

### 6. DateRange

Represents time period for transaction retrieval.

**Source**: Command-line arguments or default calculation

**Fields**:
- `start`: Date (inclusive start date)
- `end`: Date (inclusive end date)

**Validation Rules**:
- `start` must be <= `end`
- `start` must not be in the future
- Maximum range: 90 days (Monzo API pagination limit)

**Default Calculation**:
```typescript
const end = new Date(); // Today
const start = new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
```

**API Format Conversion**:
```typescript
// Convert to Monzo API format (RFC 3339 / ISO 8601)
const since = start.toISOString(); // "2025-09-01T00:00:00.000Z"
const before = end.toISOString();  // "2025-10-01T23:59:59.999Z"
```

---

## Data Flow

### Import Flow
```
1. Load Config → AccountMapping[]
2. Calculate DateRange (default or user-specified)
3. Initialize ImportSession
4. For each AccountMapping:
   a. Fetch MonzoTransaction[] from Monzo API
   b. Filter out declined transactions (decline_reason !== null)
   c. Check duplicates against ImportHistory
   d. Transform to ActualTransaction[]
   e. Import to Actual Budget via SDK
   f. Update ImportHistory with new transaction IDs
   g. Update session statistics
5. Save updated config (import history)
6. Display ImportSession summary
```

### Duplicate Detection Flow
```
1. Load ImportHistory from config
2. Build Set<string> from importedTransactions.map(t => t.monzoId)
3. For each MonzoTransaction:
   if (Set.has(transaction.id)) {
     session.duplicatesSkipped++
     continue
   }
4. After successful import:
   ImportHistory.recordImport(transaction.id, accountId)
```

---

## Configuration Schema Extension

Add to existing `config.yaml` schema:

```typescript
// config-schema.ts extension
import { z } from 'zod';

const AccountMappingSchema = z.object({
  monzoAccountId: z.string().regex(/^acc_[a-zA-Z0-9]{16,}$/),
  monzoAccountName: z.string().min(1),
  actualAccountId: z.string().uuid(),
  actualAccountName: z.string().min(1)
});

const ImportedTransactionRecordSchema = z.object({
  monzoId: z.string().regex(/^tx_[a-zA-Z0-9]{16,}$/),
  accountId: z.string().regex(/^acc_[a-zA-Z0-9]{16,}$/),
  importedAt: z.string().datetime()
});

const ImportHistorySchema = z.object({
  lastImportTimestamp: z.string().datetime(),
  importedTransactions: z.array(ImportedTransactionRecordSchema)
}).optional();

// Extend existing ConfigSchema
export const ConfigSchema = z.object({
  // ... existing fields (monzo, actual)
  accountMappings: z.array(AccountMappingSchema).optional(),
  importHistory: ImportHistorySchema
});
```

---

## Type Definitions

New TypeScript interfaces to create in `src/types/`:

```typescript
// src/types/import.ts

export interface MonzoTransaction {
  id: string;
  account_id: string;
  amount: number;
  created: string;
  currency: string;
  description: string;
  merchant?: {
    name: string;
    category: string;
  } | null;
  notes: string;
  settled: string;
  category: string;
  decline_reason: string | null;
}

export interface ActualTransaction {
  account: string;
  date: string;
  amount: number;
  payee_name: string;
  notes?: string;
  cleared?: boolean;
}

export interface AccountMapping {
  monzoAccountId: string;
  monzoAccountName: string;
  actualAccountId: string;
  actualAccountName: string;
}

export interface ImportedTransactionRecord {
  monzoId: string;
  accountId: string;
  importedAt: string;
}

export interface ImportHistory {
  lastImportTimestamp: string;
  importedTransactions: ImportedTransactionRecord[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FailedAccountRecord {
  accountId: string;
  accountName: string;
  error: Error;
  message: string;
}

export interface ImportSession {
  startTime: Date;
  dateRange: DateRange;
  accountsProcessed: number;
  successfulAccounts: string[];
  failedAccounts: FailedAccountRecord[];
  totalTransactions: number;
  duplicatesSkipped: number;
  declinedFiltered: number;
}
```

---

## Summary

**Entities**: 6 (MonzoTransaction, ActualTransaction, AccountMapping, ImportHistory, ImportSession, DateRange)

**New Config Fields**: 2 (accountMappings, importHistory)

**Type Files**: 1 new (`src/types/import.ts`)

**Schema Updates**: 1 (`config-schema.ts` extension)
