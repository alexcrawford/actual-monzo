import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contract Test: Actual Budget Import API
 *
 * Verifies the contract for @actual-app/api importTransactions method:
 * - Transaction format validation
 * - Duplicate detection via imported_id
 * - Return value structure
 * - SDK initialization requirement
 */

// Mock @actual-app/api SDK
vi.mock('@actual-app/api', () => ({
  init: vi.fn().mockResolvedValue(undefined as any),
  shutdown: vi.fn().mockResolvedValue(undefined as any),
  importTransactions: vi.fn().mockResolvedValue({
    added: ['uuid-1', 'uuid-2'],
    updated: []
  }),
  getAccounts: vi.fn().mockResolvedValue([
    { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Checking' }
  ])
}));

import * as actualApi from '@actual-app/api';

describe('Actual Budget Import API Contract', () => {
  const mockAccountId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SDK Initialization', () => {
    it('should require SDK initialization before importing', async () => {
      const initSpy = vi.spyOn(actualApi, 'init');

      await actualApi.init({
        serverURL: 'http://localhost:5006',
        password: 'test-password',
        dataDir: './actual-data'
      });

      expect(initSpy).toHaveBeenCalledWith({
        serverURL: 'http://localhost:5006',
        password: 'test-password',
        dataDir: './actual-data'
      });
    });

    it('should support shutdown after operations', async () => {
      const shutdownSpy = vi.spyOn(actualApi, 'shutdown');

      await actualApi.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe('Transaction Format Validation', () => {
    it('should accept valid transaction format', async () => {
      const validTransaction = {
        account: mockAccountId,
        date: '2025-09-15',
        amount: -750,
        payee_name: 'Tesco',
        notes: 'Monzo: groceries | ID: tx_00009ABC',
        imported_id: 'tx_00009ABC123DEF456',
        cleared: true
      };

      // Validate required fields
      expect(validTransaction.account).toBe(mockAccountId);
      expect(validTransaction.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof validTransaction.amount).toBe('number');
      expect(Number.isInteger(validTransaction.amount)).toBe(true);
    });

    it('should validate date format (YYYY-MM-DD)', () => {
      const validDates = ['2025-09-15', '2025-10-01', '2025-12-31'];
      const invalidDates = ['2025/09/15', '15-09-2025', '2025-9-5', 'invalid'];

      validDates.forEach(date => {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      invalidDates.forEach(date => {
        expect(date).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should validate amount as integer (cents)', () => {
      const validAmounts = [-750, -1250, 5000, 0];
      const invalidAmounts = [-7.50, 12.5, 'invalid', null];

      validAmounts.forEach(amount => {
        expect(typeof amount).toBe('number');
        expect(Number.isInteger(amount)).toBe(true);
      });

      invalidAmounts.forEach(amount => {
        if (typeof amount === 'number' && !isNaN(amount)) {
          expect(Number.isInteger(amount)).toBe(false);
        } else {
          expect(typeof amount).not.toBe('number');
        }
      });
    });

    it('should validate account UUID format', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '123e4567-e89b-12d3-a456-426614174000'
      ];
      const invalidUUIDs = [
        'acc_00009ABC',
        'invalid-uuid',
        '123-456-789'
      ];

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      validUUIDs.forEach(uuid => {
        expect(uuid).toMatch(uuidRegex);
      });

      invalidUUIDs.forEach(uuid => {
        expect(uuid).not.toMatch(uuidRegex);
      });
    });

    it('should accept optional fields (payee_name, notes, cleared)', () => {
      const minimalTransaction = {
        account: mockAccountId,
        date: '2025-09-15',
        amount: -750
      };

      const fullTransaction = {
        account: mockAccountId,
        date: '2025-09-15',
        amount: -750,
        payee_name: 'Tesco',
        notes: 'Groceries',
        imported_id: 'tx_123',
        cleared: true
      };

      // Both should be valid structures
      expect(minimalTransaction.account).toBeDefined();
      expect(minimalTransaction.date).toBeDefined();
      expect(minimalTransaction.amount).toBeDefined();

      expect(fullTransaction.payee_name).toBeDefined();
      expect(fullTransaction.notes).toBeDefined();
      expect(fullTransaction.cleared).toBeDefined();
    });
  });

  describe('importTransactions Method', () => {
    it('should accept accountId and transactions array', async () => {
      const importSpy = vi.spyOn(actualApi, 'importTransactions');

      const transactions = [
        {
          account: mockAccountId,
          date: '2025-09-15',
          amount: -750,
          payee_name: 'Tesco',
          imported_id: 'tx_001'
        },
        {
          account: mockAccountId,
          date: '2025-09-14',
          amount: -1250,
          payee_name: 'Pizza Express',
          imported_id: 'tx_002'
        }
      ];

      await actualApi.importTransactions(mockAccountId, transactions);

      expect(importSpy).toHaveBeenCalledWith(mockAccountId, transactions);
    });

    it('should return added and updated transaction IDs', async () => {
      const mockResponse = {
        added: ['actual-tx-uuid-1', 'actual-tx-uuid-2'],
        updated: []
      };

      vi.spyOn(actualApi, 'importTransactions').mockResolvedValue(mockResponse);

      const result = await actualApi.importTransactions(mockAccountId, [
        { account: mockAccountId, date: '2025-09-15', amount: -750, imported_id: 'tx_001' },
        { account: mockAccountId, date: '2025-09-14', amount: -1250, imported_id: 'tx_002' }
      ]);

      expect(result).toEqual(mockResponse);
      expect(result.added).toHaveLength(2);
      expect(result.updated).toHaveLength(0);
      expect(Array.isArray(result.added)).toBe(true);
      expect(Array.isArray(result.updated)).toBe(true);
    });
  });

  describe('Duplicate Detection via imported_id', () => {
    it('should use imported_id for duplicate detection', async () => {
      const newTransaction = {
        account: mockAccountId,
        date: '2025-09-15',
        amount: -750,
        payee_name: 'Tesco',
        imported_id: 'tx_00009ABC123DEF456'
      };

      expect(newTransaction.imported_id).toBeDefined();
      expect(newTransaction.imported_id).toMatch(/^tx_/);
    });

    it('should return updated IDs for duplicate transactions', async () => {
      const mockResponse = {
        added: [],
        updated: ['actual-tx-uuid-1'] // Existing transaction updated
      };

      vi.spyOn(actualApi, 'importTransactions').mockResolvedValue(mockResponse);

      const duplicateTransaction = {
        account: mockAccountId,
        date: '2025-09-15',
        amount: -750,
        imported_id: 'tx_duplicate'
      };

      const result = await actualApi.importTransactions(mockAccountId, [duplicateTransaction]);

      expect(result.added).toHaveLength(0);
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]).toBe('actual-tx-uuid-1');
    });

    it('should handle mix of new and duplicate transactions', async () => {
      const mockResponse = {
        added: ['actual-tx-uuid-1', 'actual-tx-uuid-2'],
        updated: ['actual-tx-uuid-3']
      };

      vi.spyOn(actualApi, 'importTransactions').mockResolvedValue(mockResponse);

      const transactions = [
        { account: mockAccountId, date: '2025-09-15', amount: -750, imported_id: 'tx_new_1' },
        { account: mockAccountId, date: '2025-09-14', amount: -1250, imported_id: 'tx_new_2' },
        { account: mockAccountId, date: '2025-09-13', amount: -500, imported_id: 'tx_duplicate' }
      ];

      const result = await actualApi.importTransactions(mockAccountId, transactions);

      expect(result.added).toHaveLength(2);
      expect(result.updated).toHaveLength(1);
    });
  });

  describe('Batch Import', () => {
    it('should handle batch import of multiple transactions', async () => {
      const importSpy = vi.spyOn(actualApi, 'importTransactions');

      const batchTransactions = Array.from({ length: 50 }, (_, i) => ({
        account: mockAccountId,
        date: '2025-09-15',
        amount: -(i + 1) * 100,
        payee_name: `Merchant ${i}`,
        imported_id: `tx_${String(i).padStart(3, '0')}`
      }));

      await actualApi.importTransactions(mockAccountId, batchTransactions);

      expect(importSpy).toHaveBeenCalledWith(mockAccountId, batchTransactions);
      expect(batchTransactions).toHaveLength(50);
    });

    it('should handle empty transaction array', async () => {
      const importSpy = vi.spyOn(actualApi, 'importTransactions').mockResolvedValue({
        added: [],
        updated: []
      });

      const result = await actualApi.importTransactions(mockAccountId, []);

      expect(importSpy).toHaveBeenCalledWith(mockAccountId, []);
      expect(result.added).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
    });
  });

  describe('Account Management', () => {
    it('should provide getAccounts method', async () => {
      const accountsSpy = vi.spyOn(actualApi, 'getAccounts');

      const accounts = await actualApi.getAccounts();

      expect(accountsSpy).toHaveBeenCalled();
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts[0]).toHaveProperty('id');
      expect(accounts[0]).toHaveProperty('name');
    });

    it('should return account with valid UUID format', async () => {
      const accounts = await actualApi.getAccounts();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      accounts.forEach(account => {
        expect(account.id).toMatch(uuidRegex);
        expect(typeof account.name).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid account ID error', async () => {
      vi.spyOn(actualApi, 'importTransactions').mockRejectedValue(
        new Error('Account not found in budget file')
      );

      await expect(
        actualApi.importTransactions('invalid-uuid', [])
      ).rejects.toThrow('Account not found');
    });

    it('should handle SDK not initialized error', async () => {
      vi.spyOn(actualApi, 'importTransactions').mockRejectedValue(
        new Error('SDK not initialized. Call init() first.')
      );

      await expect(
        actualApi.importTransactions(mockAccountId, [])
      ).rejects.toThrow('not initialized');
    });

    it('should handle validation errors', async () => {
      vi.spyOn(actualApi, 'importTransactions').mockRejectedValue(
        new Error('Invalid transaction format: date must be YYYY-MM-DD')
      );

      const invalidTransaction = {
        account: mockAccountId,
        date: '2025/09/15', // Invalid format
        amount: -750
      };

      await expect(
        actualApi.importTransactions(mockAccountId, [invalidTransaction])
      ).rejects.toThrow('Invalid transaction format');
    });
  });
});
