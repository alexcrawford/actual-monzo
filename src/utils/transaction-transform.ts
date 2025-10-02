/**
 * Transaction transformation utilities
 * Converts Monzo transactions to Actual Budget format
 */

import type { MonzoTransaction, ActualTransaction, AccountMapping } from '../types/import.js';
import { formatDate } from './date-utils.js';

/**
 * Transform Monzo transaction to Actual Budget format
 *
 * @param monzoTx Monzo transaction from API
 * @param mapping Account mapping configuration
 * @returns ActualTransaction ready for import
 */
export function transformMonzoToActual(
  monzoTx: MonzoTransaction,
  mapping: AccountMapping
): ActualTransaction {
  // Extract date: use settled if available, otherwise created
  const date = formatDate(monzoTx.settled || monzoTx.created);

  // Extract payee: prefer merchant name, fallback to description
  const payee_name = monzoTx.merchant?.name || monzoTx.description;

  // Create notes with Monzo category and transaction ID for reference
  const notes = `Monzo: ${monzoTx.category} | ID: ${monzoTx.id}`;

  // Determine if transaction is cleared (settled vs pending)
  const cleared = !!monzoTx.settled;

  return {
    account: mapping.actualAccountId,
    date,
    amount: monzoTx.amount, // Already in pence/cents
    payee_name,
    notes,
    imported_id: monzoTx.id,
    cleared
  };
}
