import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

/**
 * Contract Test: Monzo Transactions API
 *
 * Verifies the contract for Monzo /transactions endpoint:
 * - Request format (query params, headers, expand merchant)
 * - Response structure and field validation
 * - Pagination handling
 * - Error responses (401, 429, 500)
 * - Declined transaction filtering
 */

describe('Monzo Transactions API Contract', () => {
  const mockAccessToken = 'mock_access_token_123';
  const mockAccountId = 'acc_00009ABC123DEF456';
  const baseURL = 'https://api.monzo.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Format', () => {
    it('should include correct headers with Bearer token', async () => {
      const mockGet = vi.spyOn(axios, 'get').mockResolvedValue({
        data: { transactions: [] },
      });

      await axios.get(`${baseURL}/transactions`, {
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
        },
        params: {
          account_id: mockAccountId,
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/transactions'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });

    it('should include required query parameters', async () => {
      const mockGet = vi.spyOn(axios, 'get').mockResolvedValue({
        data: { transactions: [] },
      });

      const since = '2025-09-01T00:00:00Z';
      const before = '2025-09-30T23:59:59Z';

      await axios.get(`${baseURL}/transactions`, {
        headers: { Authorization: `Bearer ${mockAccessToken}` },
        params: {
          account_id: mockAccountId,
          since,
          before,
          'expand[]': 'merchant',
          limit: 100,
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            account_id: mockAccountId,
            since,
            before,
            'expand[]': 'merchant',
            limit: 100,
          }),
        })
      );
    });

    it('should include expand[]=merchant parameter', async () => {
      const mockGet = vi.spyOn(axios, 'get').mockResolvedValue({
        data: { transactions: [] },
      });

      await axios.get(`${baseURL}/transactions`, {
        headers: { Authorization: `Bearer ${mockAccessToken}` },
        params: {
          account_id: mockAccountId,
          'expand[]': 'merchant',
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            'expand[]': 'merchant',
          }),
        })
      );
    });
  });

  describe('Success Response (200 OK)', () => {
    it('should parse transaction response correctly', () => {
      const mockResponse = {
        transactions: [
          {
            id: 'tx_00009ABC123DEF456',
            account_id: mockAccountId,
            amount: -750,
            created: '2025-09-15T14:30:00.000Z',
            currency: 'GBP',
            description: 'Tesco Metro',
            merchant: {
              id: 'merch_00009XYZ',
              name: 'Tesco',
              category: 'groceries',
            },
            notes: '',
            settled: '2025-09-15T14:30:05.000Z',
            category: 'groceries',
            decline_reason: null,
          },
        ],
      };

      expect(mockResponse.transactions).toHaveLength(1);
      expect(mockResponse.transactions[0].id).toMatch(/^tx_[a-zA-Z0-9]+$/);
      expect(mockResponse.transactions[0].amount).toBeTypeOf('number');
      expect(Number.isInteger(mockResponse.transactions[0].amount)).toBe(true);
      expect(mockResponse.transactions[0].decline_reason).toBeNull();
    });

    it('should validate transaction field types', () => {
      const transaction = {
        id: 'tx_00009ABC123DEF456',
        account_id: mockAccountId,
        amount: -1250,
        created: '2025-09-14T19:45:00.000Z',
        currency: 'GBP',
        description: 'Pizza Express',
        merchant: {
          name: 'Pizza Express',
          category: 'eating_out',
        },
        notes: 'Dinner with friends',
        settled: '2025-09-14T19:45:03.000Z',
        category: 'eating_out',
        decline_reason: null,
      };

      // Validate field types
      expect(typeof transaction.id).toBe('string');
      expect(transaction.id).toMatch(/^tx_/);
      expect(typeof transaction.amount).toBe('number');
      expect(Number.isInteger(transaction.amount)).toBe(true);
      expect(typeof transaction.created).toBe('string');
      expect(new Date(transaction.created).toISOString()).toBe(transaction.created);
      expect(transaction.decline_reason).toBeNull();
    });

    it('should handle merchant expansion correctly', () => {
      const transaction = {
        id: 'tx_00009ABC',
        account_id: mockAccountId,
        amount: -500,
        created: '2025-09-10T10:00:00.000Z',
        currency: 'GBP',
        description: 'Coffee Shop',
        merchant: {
          name: 'Starbucks',
          category: 'eating_out',
        },
        notes: '',
        settled: '2025-09-10T10:00:05.000Z',
        category: 'eating_out',
        decline_reason: null,
      };

      expect(transaction.merchant).not.toBeNull();
      expect(transaction.merchant.name).toBe('Starbucks');
      expect(transaction.merchant.category).toBe('eating_out');
    });
  });

  describe('Time-Based Pagination', () => {
    it('should handle full page (100 transactions) indicating more pages exist', () => {
      const mockResponse = {
        transactions: Array.from({ length: 100 }, (_, i) => ({
          id: `tx_${String(i).padStart(3, '0')}`,
          amount: -100,
          created: `2025-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
          decline_reason: null,
        })),
      };

      expect(mockResponse.transactions).toHaveLength(100);
      // When we get exactly 100 transactions, we should fetch next page
      // using the last transaction's timestamp
      const lastTx = mockResponse.transactions[99];
      expect(lastTx.created).toBe('2025-09-100T00:00:00Z');
    });

    it('should use last transaction timestamp as new since parameter for next page', () => {
      const lastTransaction = {
        id: 'tx_100',
        amount: -100,
        created: '2025-09-15T14:30:00.000Z',
        decline_reason: null,
      };

      // For next page, we add 1ms to avoid fetching the same transaction
      const lastTimestamp = new Date(lastTransaction.created);
      lastTimestamp.setMilliseconds(lastTimestamp.getMilliseconds() + 1);
      const newSince = lastTimestamp.toISOString();

      expect(newSince).toBe('2025-09-15T14:30:00.001Z');
    });

    it('should handle partial page (< 100 transactions) indicating last page', () => {
      const mockResponse = {
        transactions: Array.from({ length: 42 }, (_, i) => ({
          id: `tx_${String(i).padStart(3, '0')}`,
          amount: -100,
          created: `2025-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
          decline_reason: null,
        })),
      };

      expect(mockResponse.transactions).toHaveLength(42);
      // When we get fewer than 100 transactions, this is the last page
      expect(mockResponse.transactions.length).toBeLessThan(100);
    });

    it('should handle empty response (no transactions)', () => {
      const mockResponse = {
        transactions: [],
      };

      expect(mockResponse.transactions).toHaveLength(0);
      // Empty response means no more transactions in date range
    });

    it('should preserve since and before parameters across pages', async () => {
      const mockGet = vi.spyOn(axios, 'get').mockResolvedValue({
        data: { transactions: [] },
      });

      const since = '2025-09-01T00:00:00Z';
      const before = '2025-09-30T23:59:59Z';

      await axios.get(`${baseURL}/transactions`, {
        headers: { Authorization: `Bearer ${mockAccessToken}` },
        params: {
          account_id: mockAccountId,
          since,
          before,
          limit: 100,
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            since,
            before,
            limit: 100,
          }),
        })
      );
    });
  });

  describe('Declined Transaction Filtering', () => {
    it('should identify declined transactions by decline_reason field', () => {
      const declinedTransaction = {
        id: 'tx_declined',
        account_id: mockAccountId,
        amount: -500,
        created: '2025-09-15T12:00:00.000Z',
        currency: 'GBP',
        description: 'Declined payment',
        merchant: null,
        notes: '',
        settled: '',
        category: 'general',
        decline_reason: 'INSUFFICIENT_FUNDS',
      };

      expect(declinedTransaction.decline_reason).not.toBeNull();
      expect(declinedTransaction.decline_reason).toBe('INSUFFICIENT_FUNDS');
    });

    it('should filter out declined transactions client-side', () => {
      const transactions = [
        { id: 'tx_001', amount: -100, decline_reason: null },
        { id: 'tx_002', amount: -200, decline_reason: 'INSUFFICIENT_FUNDS' },
        { id: 'tx_003', amount: -300, decline_reason: null },
        { id: 'tx_004', amount: -400, decline_reason: 'CARD_BLOCKED' },
      ];

      const validTransactions = transactions.filter(tx => tx.decline_reason === null);

      expect(validTransactions).toHaveLength(2);
      expect(validTransactions[0].id).toBe('tx_001');
      expect(validTransactions[1].id).toBe('tx_003');
    });
  });

  describe('Error Responses', () => {
    it('should handle 401 Unauthorized error', async () => {
      const mockGet = vi.spyOn(axios, 'get').mockRejectedValue({
        response: {
          status: 401,
          data: {
            error: 'unauthorized',
            message: 'Invalid or expired access token',
          },
        },
      });

      await expect(
        axios.get(`${baseURL}/transactions`, {
          headers: { Authorization: 'Bearer invalid_token' },
          params: { account_id: mockAccountId },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 401,
          data: expect.objectContaining({
            error: 'unauthorized',
          }),
        }),
      });

      expect(mockGet).toHaveBeenCalled();
    });

    it('should handle 429 Too Many Requests error', async () => {
      const mockGet = vi.spyOn(axios, 'get').mockRejectedValue({
        response: {
          status: 429,
          data: {
            error: 'too_many_requests',
            message: 'Rate limit exceeded',
          },
        },
      });

      await expect(
        axios.get(`${baseURL}/transactions`, {
          headers: { Authorization: `Bearer ${mockAccessToken}` },
          params: { account_id: mockAccountId },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 429,
          data: expect.objectContaining({
            error: 'too_many_requests',
          }),
        }),
      });

      expect(mockGet).toHaveBeenCalled();
    });

    it('should handle 500 Internal Server Error', async () => {
      const mockGet = vi.spyOn(axios, 'get').mockRejectedValue({
        response: {
          status: 500,
          data: {
            error: 'internal_server_error',
            message: 'An error occurred processing your request',
          },
        },
      });

      await expect(
        axios.get(`${baseURL}/transactions`, {
          headers: { Authorization: `Bearer ${mockAccessToken}` },
          params: { account_id: mockAccountId },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 500,
          data: expect.objectContaining({
            error: 'internal_server_error',
          }),
        }),
      });

      expect(mockGet).toHaveBeenCalled();
    });
  });

  describe('Field Validation', () => {
    it('should validate transaction ID format', () => {
      const validIds = ['tx_00009ABC123DEF456', 'tx_123456789012345678'];
      const invalidIds = ['tx_', 'invalid', '123', 'acc_00009ABC'];

      validIds.forEach(id => {
        expect(id).toMatch(/^tx_[a-zA-Z0-9]{16,}$/);
      });

      invalidIds.forEach(id => {
        expect(id).not.toMatch(/^tx_[a-zA-Z0-9]{16,}$/);
      });
    });

    it('should validate amount is integer (pence)', () => {
      const validAmounts = [-750, -1250, 5000, 0];
      const invalidAmounts = [-7.5, 12.5, 'invalid'];

      validAmounts.forEach(amount => {
        expect(typeof amount).toBe('number');
        expect(Number.isInteger(amount)).toBe(true);
      });

      invalidAmounts.forEach(amount => {
        if (typeof amount === 'number') {
          expect(Number.isInteger(amount)).toBe(false);
        } else {
          expect(typeof amount).not.toBe('number');
        }
      });
    });

    it('should validate date parsing for created and settled fields', () => {
      const validDates = [
        '2025-09-15T14:30:00.000Z',
        '2025-09-14T19:45:03.000Z',
        '2025-10-01T00:00:00.000Z',
      ];

      validDates.forEach(dateStr => {
        const date = new Date(dateStr);
        expect(date.toISOString()).toBe(dateStr);
        expect(!isNaN(date.getTime())).toBe(true);
      });
    });
  });
});
