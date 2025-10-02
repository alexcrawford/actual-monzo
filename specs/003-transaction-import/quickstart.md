# Quickstart: Transaction Import

**Feature**: Transaction Import
**Branch**: `003-transaction-import`
**Prerequisites**: Setup command completed successfully

## Quick Start (5 minutes)

### 1. Verify Setup

Ensure you've completed the setup command:
```bash
actual-monzo setup
```

This should have configured:
- ✅ Monzo OAuth credentials and access token
- ✅ Actual Budget server connection
- ✅ Account mappings between Monzo and Actual Budget

### 2. Import Last 30 Days (Default)

```bash
actual-monzo import
```

Expected output:
```
✓ Import completed in 3.2s

Accounts processed: 2/2
  ✓ Current Account: 45 transactions
  ✓ Joint Account: 23 transactions

Total imported: 68 transactions
Duplicates skipped: 0 transactions
Declined filtered: 2 transactions
```

### 3. Verify in Actual Budget

1. Open Actual Budget web interface
2. Navigate to your mapped accounts (e.g., "Checking")
3. See imported transactions with Monzo merchant names
4. Transactions appear as "Uncategorized" (categorize them in Actual Budget)

**Done!** Transactions are now in your budget.

---

## Common Usage Scenarios

### Import Specific Date Range

Import transactions from September 2025:
```bash
actual-monzo import --start 2025-09-01 --end 2025-09-30
```

### Preview Before Importing (Dry Run)

See what would be imported without making changes:
```bash
actual-monzo import --dry-run
```

Output shows:
- Which transactions would be imported
- Which are duplicates (skipped)
- Which are declined (filtered)

### Import from Single Account

If you have multiple Monzo accounts mapped, import from just one:
```bash
actual-monzo import --account acc_00009ABC123DEF456
```

*Tip*: Find your account ID in `config.yaml` under `accountMappings`

### Regular Syncing

Run import command daily/weekly to keep Actual Budget up-to-date:
```bash
# Import last 7 days
actual-monzo import --start $(date -d '7 days ago' +%Y-%m-%d)
```

Or use default (last 30 days) which safely handles duplicates:
```bash
actual-monzo import
```

---

## What Gets Imported

### Included Transactions
- ✅ **Settled transactions** (fully processed by Monzo)
- ✅ **Pending transactions** (not yet settled but visible in Monzo)
- ✅ **All transaction types** (purchases, transfers, fees, refunds)

### Excluded Transactions
- ❌ **Declined transactions** (failed payment attempts)
- ❌ **Previously imported transactions** (automatic duplicate detection)

### Transaction Details Preserved
- **Date**: Transaction date (settled date if available, otherwise created date)
- **Amount**: Exact amount in pence (£7.50 → 750 pence)
- **Payee**: Merchant name (e.g., "Tesco") or description if no merchant
- **Notes**: Monzo category + transaction ID (e.g., "Monzo: groceries | ID: tx_000...")

### NOT Imported
- ❌ **Categories**: Transactions import as "Uncategorized" in Actual Budget
  - *Why*: Monzo and Actual Budget have different category structures
  - *Action*: Categorize transactions in Actual Budget after import
- ❌ **Tags**: Monzo tags not transferred
- ❌ **Attachments**: Receipt images not transferred

---

## Duplicate Handling

The import command automatically prevents duplicates:

1. **First import**: All transactions imported
2. **Subsequent imports**: Only new transactions imported

Example:
```bash
# Day 1: Import September
actual-monzo import --start 2025-09-01 --end 2025-09-30
# Result: 150 transactions imported

# Day 2: Import September again (overlapping range)
actual-monzo import --start 2025-09-01 --end 2025-09-30
# Result: 0 transactions imported, 150 duplicates skipped
```

**How it works**:
- Each Monzo transaction has unique ID (e.g., `tx_00009ABC...`)
- Import history stored in `config.yaml`
- Before importing, checks if transaction ID already imported
- Skips if found, imports if new

**Safe to run repeatedly**: Import same date range multiple times without creating duplicates.

---

## Date Range Behavior

### Default Range (No Options)
```bash
actual-monzo import
```
- Imports **last 30 days** from today
- Safe for daily/weekly runs (handles duplicates)
- Recommended for regular syncing

### Custom Range
```bash
actual-monzo import --start 2025-09-01 --end 2025-09-15
```
- Both dates **inclusive**
- Must be YYYY-MM-DD format
- Start must be ≤ end
- Maximum range: 90 days (Monzo API limit)

### Edge Cases
- **Future dates**: Error (start date cannot be in future)
- **Too large range**: Error if > 90 days (split into smaller imports)
- **Empty results**: No error, just "0 transactions imported"

---

## Error Handling & Recovery

### Token Expired
```
Error: Monzo access token expired. Please re-authenticate:
  actual-monzo setup
```

**Solution**: Re-run setup command to refresh OAuth token

### Configuration Missing
```
Error: No account mappings configured. Please run setup command:
  actual-monzo setup
```

**Solution**: Complete setup command first

### Monzo API Unavailable
```
Error: Import failed for Current Account: Monzo API is currently unavailable
Accounts processed: 1/2 (1 failed)
```

**Solution**: Wait and retry in a few minutes (Monzo may be experiencing issues)

### Partial Failures
If one account fails but others succeed:
```
✓ Import completed in 2.5s

Accounts processed: 1/2
  ✓ Current Account: 45 transactions

Failed accounts: 1
  ✗ Joint Account: Monzo API timeout

Total imported: 45 transactions
```

**Behavior**: Successful accounts are imported, failures reported at end
**Solution**: Retry import for failed accounts (duplicates will be skipped)

### Network Issues
```
Error: Import failed: Network timeout connecting to Monzo API
```

**Solution**: Check internet connection and retry

---

## Verification Steps

After importing, verify success:

### 1. Check Command Output
Look for:
- ✅ "Import completed" success message
- ✅ Account names and transaction counts
- ✅ Zero failed accounts

### 2. Verify in Actual Budget
1. Open Actual Budget web interface
2. Navigate to mapped account (e.g., "Checking")
3. Check:
   - ✅ Recent transactions visible
   - ✅ Amounts match Monzo app
   - ✅ Payee names correct (merchant names)
   - ✅ Dates accurate

### 3. Check Transaction Details
Click a transaction in Actual Budget:
- **Payee**: Should show merchant name (e.g., "Tesco")
- **Category**: Should be "Uncategorized" (categorize manually)
- **Notes**: Should show `Monzo: {category} | ID: tx_...`

### 4. Verify Import History
Check `config.yaml` for import tracking:
```yaml
importHistory:
  lastImportTimestamp: '2025-10-01T14:30:00Z'
  importedTransactions:
    - monzoId: tx_00009ABC123DEF456
      accountId: acc_00009ABC123DEF456
      importedAt: '2025-10-01T14:30:00Z'
```

---

## Troubleshooting

### Problem: No transactions imported (but expect some)

**Possible causes**:
1. Date range doesn't cover recent transactions
   - Solution: Check Monzo app for transaction dates, adjust `--start` and `--end`

2. All transactions already imported (duplicates)
   - Solution: Normal behavior, check import history in `config.yaml`

3. Account mapping incorrect
   - Solution: Verify `config.yaml` mappings point to correct Actual Budget accounts

### Problem: Wrong amount imported

**Possible causes**:
1. Currency mismatch (expected but not found in MVP)
   - Solution: Document assumption is GBP, verify Monzo account currency

2. Amount display confusion (£7.50 vs 750 pence)
   - Solution: Actual Budget stores in cents, displays in pounds (normal behavior)

### Problem: Missing merchant name

**Possible causes**:
1. Monzo transaction has no merchant (uses description instead)
   - Solution: Normal behavior, check Monzo app to confirm

### Problem: Duplicates not being detected

**Possible causes**:
1. Import history corrupted in `config.yaml`
   - Solution: Check `importHistory` section for valid JSON/YAML syntax

2. Different account mapping (same Monzo account mapped to different Actual account)
   - Solution: Verify account mappings in config

---

## Performance Expectations

### Typical Import Times
| Transaction Count | Expected Duration |
|-------------------|-------------------|
| 0-50 | 1-2 seconds |
| 50-100 | 2-3 seconds |
| 100-300 | 3-5 seconds |
| 300+ | 5-10 seconds |

*Times include API calls to both Monzo and Actual Budget*

### Factors Affecting Speed
- Network latency (Monzo API + Actual Budget server)
- Number of accounts mapped
- Monzo API rate limiting (rare, exponential backoff applied)

---

## Integration Testing Checklist

Manual test scenarios to verify before release:

- [ ] **Fresh import**: No duplicates, all transactions imported
- [ ] **Repeat import**: Same date range, all duplicates skipped
- [ ] **Overlapping range**: Partial new + partial duplicates handled
- [ ] **Multiple accounts**: Both accounts import successfully
- [ ] **Declined transactions**: Excluded from import
- [ ] **Pending transactions**: Included in import
- [ ] **Custom date range**: Respects --start and --end options
- [ ] **Single account filter**: --account option works
- [ ] **Dry run**: No actual import, preview shown
- [ ] **Token expiry**: Clear error message, guides to setup
- [ ] **Invalid dates**: Validation errors caught
- [ ] **Empty results**: No error, graceful "0 imported" message
- [ ] **API timeout**: Error message, retry guidance
- [ ] **Partial failure**: Successful accounts import, failures reported

---

## Success Criteria

Import feature is complete when:

1. ✅ User can import transactions with single command
2. ✅ Default behavior (last 30 days) works without options
3. ✅ Custom date ranges supported
4. ✅ Duplicates automatically prevented
5. ✅ Declined transactions filtered out
6. ✅ Pending transactions included
7. ✅ Multiple accounts supported (parallel processing)
8. ✅ Partial failures handled gracefully
9. ✅ Clear error messages guide user to resolution
10. ✅ Dry run allows preview without importing
11. ✅ Transaction details preserved (date, amount, merchant)
12. ✅ Import history tracked in config

---

## Next Steps After Import

### Categorize Transactions
1. Open Actual Budget
2. Select imported transactions (they're uncategorized)
3. Assign categories based on your budget structure
4. Create rules for auto-categorization (Actual Budget feature)

### Set Up Regular Imports
Create a script or cron job for automated syncing:
```bash
#!/bin/bash
# Import last 7 days daily
actual-monzo import --start $(date -d '7 days ago' +%Y-%m-%d)
```

### Review Import History
Periodically check `config.yaml` import history:
- Verify expected transaction count
- Prune old history (>90 days) if needed

---

## Support & Debugging

### Enable Verbose Logging (Future Enhancement)
*Not implemented in MVP, but recommended for future:*
```bash
actual-monzo import --verbose
```

### Check Configuration
View current config:
```bash
cat config.yaml
```

Look for:
- `accountMappings`: Verify Monzo ↔ Actual Budget account pairs
- `importHistory`: Check last import timestamp
- `monzo.accessToken`: Ensure not empty (indicates authentication)

### Report Issues
If import fails unexpectedly:
1. Note exact error message
2. Check Monzo and Actual Budget are accessible via web
3. Verify config.yaml is valid YAML syntax
4. Try dry run to isolate issue
5. Check import history for corruption

---

**End of Quickstart Guide**

For technical details, see:
- `data-model.md` - Data structures and transformations
- `contracts/` - API contracts for Monzo and Actual Budget
- `research.md` - Implementation decisions and alternatives
