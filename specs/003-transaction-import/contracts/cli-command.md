# Contract: Import Command CLI

**Command**: `actual-monzo import`

**Purpose**: Import Monzo transactions into Actual Budget

**Framework**: Commander.js

## Command Signature

```bash
actual-monzo import [options]
```

## Options

| Option | Alias | Type | Required | Default | Description |
|--------|-------|------|----------|---------|-------------|
| `--start <date>` | `-s` | string | No | 30 days ago | Start date for import (YYYY-MM-DD) |
| `--end <date>` | `-e` | string | No | Today | End date for import (YYYY-MM-DD) |
| `--account <id>` | `-a` | string | No | All mapped | Import specific Monzo account only |
| `--dry-run` | | boolean | No | false | Show what would be imported without importing |

## Examples

### Import last 30 days (default)
```bash
actual-monzo import
```

### Import specific date range
```bash
actual-monzo import --start 2025-09-01 --end 2025-09-30
```

### Import from specific account
```bash
actual-monzo import --account acc_00009ABC123DEF456
```

### Dry run to preview imports
```bash
actual-monzo import --dry-run
```

### Combined options
```bash
actual-monzo import --start 2025-09-15 --end 2025-09-20 --account acc_00009ABC --dry-run
```

## Command Implementation

### Commander.js Definition

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .command('import')
  .description('Import Monzo transactions into Actual Budget')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)', calculateDefaultStart)
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
  .option('-a, --account <id>', 'Import specific Monzo account ID')
  .option('--dry-run', 'Preview import without making changes', false)
  .action(importAction);

function calculateDefaultStart(): string {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return thirtyDaysAgo.toISOString().split('T')[0];
}
```

### Action Handler

```typescript
interface ImportOptions {
  start: string;
  end: string;
  account?: string;
  dryRun: boolean;
}

async function importAction(options: ImportOptions) {
  try {
    // Validate configuration exists
    const config = await loadConfig();
    validateImportConfig(config);

    // Parse and validate date range
    const dateRange = parseDateRange(options.start, options.end);

    // Determine accounts to import
    const accountMappings = filterAccountMappings(config.accountMappings, options.account);

    // Initialize spinner
    const spinner = ora('Starting import...').start();

    // Execute import
    const session = await executeImport(accountMappings, dateRange, options.dryRun, spinner);

    // Display results
    displayImportSummary(session, options.dryRun);

    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Import failed: ${error.message}`));
    process.exit(1);
  }
}
```

## Input Validation

### Date Format Validation

```typescript
function validateDate(dateString: string): Date {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(dateString)) {
    throw new Error(
      `Invalid date format: ${dateString}\n` +
      `Expected format: YYYY-MM-DD (e.g., 2025-09-15)`
    );
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }

  return date;
}
```

### Date Range Validation

```typescript
function parseDateRange(startStr: string, endStr: string): DateRange {
  const start = validateDate(startStr);
  const end = validateDate(endStr);

  if (start > end) {
    throw new Error(
      `Start date (${startStr}) must be before or equal to end date (${endStr})`
    );
  }

  if (start > new Date()) {
    throw new Error(`Start date (${startStr}) cannot be in the future`);
  }

  const daysDiff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (daysDiff > 90) {
    throw new Error(
      `Date range too large (${daysDiff} days). Maximum: 90 days\n` +
      `Consider breaking into smaller imports`
    );
  }

  return { start, end };
}
```

### Configuration Validation

```typescript
function validateImportConfig(config: Config): void {
  // Check Monzo configuration exists
  if (!config.monzo?.clientId || !config.monzo?.clientSecret) {
    throw new Error(
      'Monzo configuration missing. Please run setup command:\n' +
      '  actual-monzo setup'
    );
  }

  // Check Actual Budget configuration exists
  if (!config.actual?.serverUrl || !config.actual?.password) {
    throw new Error(
      'Actual Budget configuration missing. Please run setup command:\n' +
      '  actual-monzo setup'
    );
  }

  // Check account mappings exist
  if (!config.accountMappings || config.accountMappings.length === 0) {
    throw new Error(
      'No account mappings configured. Please run setup command:\n' +
      '  actual-monzo setup'
    );
  }

  // Check tokens exist
  if (!config.monzo?.accessToken) {
    throw new Error(
      'Monzo access token missing or expired. Please run setup command:\n' +
      '  actual-monzo setup'
    );
  }
}
```

### Account Filter Validation

```typescript
function filterAccountMappings(
  mappings: AccountMapping[],
  accountId?: string
): AccountMapping[] {
  if (!accountId) {
    return mappings; // Import all
  }

  const filtered = mappings.filter(m => m.monzoAccountId === accountId);

  if (filtered.length === 0) {
    throw new Error(
      `Account ${accountId} not found in mappings.\n` +
      `Available accounts:\n` +
      mappings.map(m => `  - ${m.monzoAccountId}: ${m.monzoAccountName}`).join('\n')
    );
  }

  return filtered;
}
```

## Output Formatting

### Progress Indication

```typescript
function updateSpinner(
  spinner: Ora,
  accountName: string,
  current: number,
  total: number
): void {
  spinner.text = `Importing from ${accountName}... (${current}/${total} transactions)`;
}
```

### Success Summary

```bash
✓ Import completed in 3.2s

Accounts processed: 2/2
  ✓ Current Account: 45 transactions
  ✓ Joint Account: 23 transactions

Total imported: 68 transactions
Duplicates skipped: 12 transactions
Declined filtered: 3 transactions
```

Implementation:
```typescript
function displayImportSummary(session: ImportSession, dryRun: boolean): void {
  const duration = ((Date.now() - session.startTime.getTime()) / 1000).toFixed(1);

  console.log(chalk.green(`\n✓ ${dryRun ? 'Dry run' : 'Import'} completed in ${duration}s\n`));

  console.log(`Accounts processed: ${session.successfulAccounts.length}/${session.accountsProcessed}`);
  session.successfulAccounts.forEach(accountId => {
    const mapping = findMapping(accountId);
    const count = getTransactionCount(session, accountId);
    console.log(chalk.green(`  ✓ ${mapping.monzoAccountName}: ${count} transactions`));
  });

  if (session.failedAccounts.length > 0) {
    console.log(chalk.yellow(`\nFailed accounts: ${session.failedAccounts.length}`));
    session.failedAccounts.forEach(failure => {
      console.log(chalk.red(`  ✗ ${failure.accountName}: ${failure.message}`));
    });
  }

  console.log(`\nTotal ${dryRun ? 'would import' : 'imported'}: ${session.totalTransactions} transactions`);
  console.log(`Duplicates skipped: ${session.duplicatesSkipped} transactions`);
  console.log(`Declined filtered: ${session.declinedFiltered} transactions`);
}
```

### Dry Run Output

```bash
[DRY RUN] Import preview for 2025-09-01 to 2025-09-30

Would import from Current Account:
  ✓ 2025-09-15 | Tesco | -£7.50
  ✓ 2025-09-14 | Pizza Express | -£12.50
  ⊘ 2025-09-13 | Declined payment | -£5.00 (declined)
  ⊘ 2025-09-12 | Tesco | -£8.25 (duplicate)

Summary: 2 new, 1 duplicate, 1 declined

Would import from Joint Account:
  ✓ 2025-09-20 | Utility Bill | -£150.00

Total would import: 3 transactions
```

### Error Messages

```bash
# Configuration error
Error: Monzo configuration missing. Please run setup command:
  actual-monzo setup

# Date validation error
Error: Invalid date format: 2025/09/01
Expected format: YYYY-MM-DD (e.g., 2025-09-15)

# Token expired error
Error: Monzo access token expired. Please re-authenticate:
  actual-monzo setup

# API error
Error: Import failed for Current Account: Monzo API is currently unavailable
Accounts processed: 1/2 (1 failed)
```

## Exit Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 0 | Success | All accounts imported successfully (or all failed accounts continue) |
| 1 | Error | Configuration missing, validation failed, or unrecoverable error |

**Note**: Partial failures (some accounts succeed, some fail) still exit with code 0 and display failure summary.

## Test Coverage Requirements

CLI contract tests must verify:
1. ✅ Command registration (import command exists)
2. ✅ Option parsing (--start, --end, --account, --dry-run)
3. ✅ Default values (start = 30 days ago, end = today)
4. ✅ Date format validation (YYYY-MM-DD)
5. ✅ Date range validation (start <= end, not future, <= 90 days)
6. ✅ Configuration validation (all required fields present)
7. ✅ Account filter validation (account ID exists)
8. ✅ Success output formatting
9. ✅ Error message clarity
10. ✅ Exit codes (0 = success, 1 = error)
11. ✅ Dry run output (no actual import)

## Integration with Existing Commands

The import command should be added to the main CLI program:

```typescript
// src/index.ts
import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { importCommand } from './commands/import.js';

const program = new Command();

program
  .name('actual-monzo')
  .description('CLI tool to import Monzo transactions into Actual Budget')
  .version('1.0.0');

program.addCommand(setupCommand);
program.addCommand(importCommand); // New command

program.parse();
```
