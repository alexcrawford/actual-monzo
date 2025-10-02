# Contract: Actual Budget Import API

**SDK**: `@actual-app/api`

**Purpose**: Import transactions into Actual Budget account

**Method**: `importTransactions(accountId, transactions)`

## API Overview

The Actual Budget SDK provides transaction import functionality through the main API module.

### Initialization Required

Before calling import methods, SDK must be initialized:

```typescript
import * as api from '@actual-app/api';

await api.init({
  serverURL: 'http://localhost:5006',
  password: 'your-password',
  dataDir: './actual-data'
});

// Perform imports...

await api.disconnect();
```

## Import Transaction Method

### Function Signature

```typescript
function importTransactions(
  accountId: string,
  transactions: ImportTransaction[]
): Promise<{ added: string[], updated: string[] }>;
```

### Parameters

**accountId** (string, required)
- Actual Budget account UUID
- Must exist in the current budget file
- Obtainable via `api.getAccounts()`

**transactions** (ImportTransaction[], required)
- Array of transaction objects to import
- Duplicate detection handled internally by SDK

### ImportTransaction Interface

```typescript
interface ImportTransaction {
  account: string;      // Actual Budget account UUID (same as accountId param)
  date: string;         // YYYY-MM-DD format
  amount: number;       // Amount in cents (negative = expense, positive = income)
  payee_name?: string;  // Payee/merchant name
  notes?: string;       // Transaction notes/memo
  imported_id?: string; // External ID for duplicate detection (use Monzo transaction ID)
  cleared?: boolean;    // Whether transaction is cleared (optional, defaults to true)
}
```

### Return Value

```typescript
{
  added: string[];    // Array of newly created transaction IDs
  updated: string[];  // Array of updated transaction IDs (if duplicates matched)
}
```

## Example Usage

### Single Account Import

```typescript
const accountId = '550e8400-e29b-41d4-a716-446655440000';

const transactions = [
  {
    account: accountId,
    date: '2025-09-15',
    amount: -750, // £7.50 expense
    payee_name: 'Tesco',
    notes: 'Monzo: groceries | ID: tx_00009ABC123DEF456',
    imported_id: 'tx_00009ABC123DEF456',
    cleared: true
  },
  {
    account: accountId,
    date: '2025-09-14',
    amount: -1250, // £12.50 expense
    payee_name: 'Pizza Express',
    notes: 'Monzo: eating_out | ID: tx_00009XYZ789GHI012',
    imported_id: 'tx_00009XYZ789GHI012',
    cleared: true
  }
];

const result = await api.importTransactions(accountId, transactions);
console.log(`Added: ${result.added.length}, Updated: ${result.updated.length}`);
```

### Batch Import from Multiple Monzo Accounts

```typescript
for (const mapping of accountMappings) {
  const monzoTransactions = await fetchMonzoTransactions(mapping.monzoAccountId);

  const actualTransactions = monzoTransactions.map(tx => ({
    account: mapping.actualAccountId,
    date: formatDate(tx.settled || tx.created),
    amount: tx.amount, // Already in pence
    payee_name: tx.merchant?.name || tx.description,
    notes: `Monzo: ${tx.category} | ID: ${tx.id}`,
    imported_id: tx.id, // Monzo transaction ID for duplicate detection
    cleared: !!tx.settled
  }));

  const result = await api.importTransactions(mapping.actualAccountId, actualTransactions);
  console.log(`${mapping.actualAccountName}: ${result.added.length} imported`);
}
```

## Field Mapping

### From Monzo to Actual Budget

| Monzo Field | Actual Field | Transformation | Notes |
|-------------|--------------|----------------|-------|
| `id` | `imported_id` | Direct | Used for duplicate detection |
| `account_id` | `account` | Via mapping | Lookup in account mappings |
| `settled` or `created` | `date` | Format as YYYY-MM-DD | Use settled if available, else created |
| `amount` | `amount` | Direct (pence) | Already in cents, preserve sign |
| `merchant.name` or `description` | `payee_name` | Coalesce | Prefer merchant name |
| `category` + `id` | `notes` | Concatenate | Format: "Monzo: {category} &#124; ID: {id}" |
| `settled` (presence) | `cleared` | Boolean conversion | true if settled, false if pending |

### Date Formatting

```typescript
function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toISOString().split('T')[0]; // "2025-09-15"
}
```

### Amount Handling

```typescript
// Monzo amounts are already in pence (integer)
const actualAmount = monzoTransaction.amount; // No conversion needed

// Example:
// Monzo: -750 (£7.50 debit)
// Actual: -750 (£7.50 expense)
```

## Duplicate Detection

The SDK uses `imported_id` for duplicate detection:

- If `imported_id` matches existing transaction, it will be updated (returned in `updated[]`)
- If `imported_id` is new, transaction will be created (returned in `added[]`)
- Always provide Monzo `transaction.id` as `imported_id`

**Important**: This is SDK-level duplicate detection. Client-side tracking (import history) is still recommended for:
- Avoiding unnecessary API calls
- Displaying skip statistics
- Faster duplicate checking before API call

## Error Handling

### Connection Errors

```typescript
try {
  const result = await api.importTransactions(accountId, transactions);
} catch (error) {
  if (error.message.includes('not initialized')) {
    throw new Error('Actual Budget SDK not initialized. Call api.init() first.');
  }
  if (error.message.includes('account not found')) {
    throw new Error(`Account ${accountId} not found in budget file.`);
  }
  throw new Error(`Import failed: ${error.message}`);
}
```

### Validation Errors

The SDK may throw if:
- `accountId` doesn't exist in budget
- `date` format is invalid (not YYYY-MM-DD)
- `amount` is not a number
- Required fields are missing

Always validate transactions before calling API:

```typescript
function validateActualTransaction(tx: ImportTransaction): boolean {
  return (
    typeof tx.account === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(tx.date) &&
    typeof tx.amount === 'number' &&
    Number.isInteger(tx.amount) &&
    (!tx.payee_name || typeof tx.payee_name === 'string')
  );
}

const validTransactions = transactions.filter(validateActualTransaction);
```

## Account ID Retrieval

To get Actual Budget account IDs for mapping:

```typescript
const accounts = await api.getAccounts();
// Returns: Array<{ id: string, name: string, ... }>

// Example: Find account by name
const checkingAccount = accounts.find(acc => acc.name === 'Checking');
if (checkingAccount) {
  console.log(`Account ID: ${checkingAccount.id}`);
}
```

## Performance Considerations

### Batch Size
- SDK handles batching internally
- Recommended: Import all transactions for an account in single call (100-300 typical)
- Maximum tested: 1000 transactions per call (should work but not officially documented)

### Network Optimization
- Single `importTransactions()` call per account (not per transaction)
- SDK makes single API call to server regardless of transaction count

### Memory Usage
- Build transaction array in memory before import (acceptable for typical 100-300 transactions)
- For very large imports (>1000), consider chunking into batches of 500

## Test Coverage Requirements

Contract tests must verify:
1. ✅ Transaction import success (valid data)
2. ✅ Duplicate detection (imported_id matching)
3. ✅ Date format validation (YYYY-MM-DD)
4. ✅ Amount integer validation
5. ✅ Invalid account ID error
6. ✅ Missing required fields error
7. ✅ SDK initialization requirement
8. ✅ Batch import (multiple transactions)
9. ✅ Return value structure (added/updated arrays)

## Mock API for Testing

```typescript
// Mock for contract tests
const mockImportTransactions = vi.fn().mockResolvedValue({
  added: ['tx-uuid-1', 'tx-uuid-2'],
  updated: []
});

vi.mock('@actual-app/api', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  importTransactions: mockImportTransactions,
  getAccounts: vi.fn().mockResolvedValue([
    { id: 'account-uuid', name: 'Checking' }
  ])
}));
```
