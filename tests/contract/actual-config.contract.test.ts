/**
 * Contract Test: Actual Budget Connection Validation
 *
 * This test MUST FAIL before implementation with error:
 * "ActualClient is not defined"
 *
 * Tests validate Actual Budget SDK integration:
 * - Successful connection validation
 * - Network error handling
 * - Authentication error handling
 * - IO error handling
 * - Cleanup (disconnect) after validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// This import WILL FAIL until T023 is implemented
import { ActualClient } from '../../src/services/actual-client';
import { SetupErrorCode } from '../../src/types/setup';

// Mock @actual-app/api
vi.mock('@actual-app/api', () => ({
  init: vi.fn(),
  shutdown: vi.fn()
}));

import * as actualApi from '@actual-app/api';

describe('Actual Budget Connection Contract', () => {
  let client: ActualClient;
  const serverUrl = 'http://localhost:5006';
  const password = 'test_password';
  const dataDirectory = '/tmp/actual-test';

  beforeEach(() => {
    client = new ActualClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful Connection', () => {
    it('should validate connection successfully and set validatedAt timestamp', async () => {
      vi.mocked(actualApi.init).mockResolvedValue(undefined as any);

      const result = await client.validateConnection(serverUrl, password, dataDirectory);

      expect(result.success).toBe(true);
      expect(result.validatedAt).toBeDefined();
      expect(result.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601
      expect(actualApi.init).toHaveBeenCalledWith({
        serverURL: serverUrl,
        password,
        dataDir: dataDirectory
      });
      expect(actualApi.shutdown).toHaveBeenCalled();
    });
  });

  describe('Network Error Handling', () => {
    it('should handle ECONNREFUSED error', async () => {
      const networkError = new Error('connect ECONNREFUSED 127.0.0.1:5006');
      (networkError as any).code = 'ECONNREFUSED';

      vi.mocked(actualApi.init).mockRejectedValue(networkError);

      const result = await client.validateConnection(serverUrl, password, dataDirectory);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SetupErrorCode.SERVER_UNREACHABLE);
      expect(result.error?.message).toContain('Cannot reach Actual Budget server');
      expect(actualApi.shutdown).toHaveBeenCalled(); // Cleanup even on error
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle 401 Unauthorized error', async () => {
      const authError = new Error('401 Unauthorized: Invalid password');
      (authError as any).status = 401;

      vi.mocked(actualApi.init).mockRejectedValue(authError);

      const result = await client.validateConnection(serverUrl, password, dataDirectory);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SetupErrorCode.INVALID_CREDENTIALS);
      expect(result.error?.message).toContain('Invalid password');
      expect(actualApi.shutdown).toHaveBeenCalled();
    });
  });

  describe('IO Error Handling', () => {
    it('should handle EACCES permission error', async () => {
      const ioError = new Error("EACCES: permission denied, open '/readonly/data'");
      (ioError as any).code = 'EACCES';

      vi.mocked(actualApi.init).mockRejectedValue(ioError);

      const result = await client.validateConnection(serverUrl, password, dataDirectory);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SetupErrorCode.DIRECTORY_ERROR);
      expect(result.error?.message).toContain('Cannot write to directory');
      expect(actualApi.shutdown).toHaveBeenCalled();
    });
  });

  describe('Cleanup Guarantee', () => {
    it('should call disconnect even when init throws', async () => {
      vi.mocked(actualApi.init).mockRejectedValue(new Error('Some error'));

      await client.validateConnection(serverUrl, password, dataDirectory);

      expect(actualApi.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should call disconnect after successful init', async () => {
      vi.mocked(actualApi.init).mockResolvedValue(undefined as any);

      await client.validateConnection(serverUrl, password, dataDirectory);

      expect(actualApi.shutdown).toHaveBeenCalledTimes(1);
    });
  });
});
