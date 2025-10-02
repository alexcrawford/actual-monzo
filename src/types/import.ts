/**
 * Type definitions for transaction import feature
 */

/**
 * Monzo transaction as returned by /transactions API endpoint
 */
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

/**
 * Actual Budget transaction format for import
 */
export interface ActualTransaction {
  account: string;
  date: string;
  amount: number;
  payee_name?: string;
  notes?: string;
  imported_id?: string;
  cleared?: boolean;
}

/**
 * Mapping between Monzo account and Actual Budget account
 */
export interface AccountMapping {
  monzoAccountId: string;
  monzoAccountName: string;
  actualAccountId: string;
  actualAccountName: string;
}

/**
 * Date range for transaction import
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Record of failed account import
 */
export interface FailedAccountRecord {
  accountId: string;
  accountName: string;
  error: Error;
  message: string;
}

/**
 * Import session representing a single import command execution
 */
export interface ImportSession {
  startTime: Date;
  dateRange: DateRange;
  accountsProcessed: number;
  successfulAccounts: string[];
  failedAccounts: FailedAccountRecord[];
  totalTransactions: number;
  declinedFiltered: number;
}
