/**
 * Unit Tests: Import Transaction Filtering
 * Tests for filtering logic during transaction import
 */

import { describe, it, expect } from 'vitest';
import type { ActualTransaction } from '../../src/types/import';

/**
 * Filter function that should exclude zero-amount transactions
 */
function shouldIncludeTransaction(tx: ActualTransaction): boolean {
  // Exclude zero-amount transactions - they don't represent actual money movement
  return tx.amount !== 0;
}

describe('Unit: Import Transaction Filtering', () => {
  describe('shouldIncludeTransaction', () => {
    it('should include positive amount transactions', () => {
      const tx: ActualTransaction = {
        account: 'account-id',
        date: '2025-10-02',
        amount: 1500, // £15.00
        payee_name: 'Coffee Shop',
        notes: 'Monzo: eating_out | ID: tx_123',
        imported_id: 'tx_123',
        cleared: true,
      };

      expect(shouldIncludeTransaction(tx)).toBe(true);
    });

    it('should include negative amount transactions', () => {
      const tx: ActualTransaction = {
        account: 'account-id',
        date: '2025-10-02',
        amount: -1500, // -£15.00 (expense)
        payee_name: 'Coffee Shop',
        notes: 'Monzo: eating_out | ID: tx_123',
        imported_id: 'tx_123',
        cleared: true,
      };

      expect(shouldIncludeTransaction(tx)).toBe(true);
    });

    it('should exclude zero amount transactions', () => {
      const tx: ActualTransaction = {
        account: 'account-id',
        date: '2025-10-02',
        amount: 0, // £0.00
        payee_name: 'Authorization Hold',
        notes: 'Monzo: general | ID: tx_123',
        imported_id: 'tx_123',
        cleared: false,
      };

      expect(shouldIncludeTransaction(tx)).toBe(false);
    });

    it('should filter out zero transactions from a list', () => {
      const transactions: ActualTransaction[] = [
        {
          account: 'acc-1',
          date: '2025-10-02',
          amount: 1000,
          payee_name: 'Store A',
          notes: 'Monzo: shopping | ID: tx_1',
          imported_id: 'tx_1',
          cleared: true,
        },
        {
          account: 'acc-1',
          date: '2025-10-02',
          amount: 0, // Should be filtered
          payee_name: 'Auth Hold',
          notes: 'Monzo: general | ID: tx_2',
          imported_id: 'tx_2',
          cleared: false,
        },
        {
          account: 'acc-1',
          date: '2025-10-02',
          amount: -500,
          payee_name: 'Store B',
          notes: 'Monzo: groceries | ID: tx_3',
          imported_id: 'tx_3',
          cleared: true,
        },
        {
          account: 'acc-1',
          date: '2025-10-02',
          amount: 0, // Should be filtered
          payee_name: 'Another Hold',
          notes: 'Monzo: general | ID: tx_4',
          imported_id: 'tx_4',
          cleared: false,
        },
      ];

      const filtered = transactions.filter(shouldIncludeTransaction);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].amount).toBe(1000);
      expect(filtered[1].amount).toBe(-500);
      expect(filtered.every(tx => tx.amount !== 0)).toBe(true);
    });
  });
});
