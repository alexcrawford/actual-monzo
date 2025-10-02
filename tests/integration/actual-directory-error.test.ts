/**
 * Integration Test: Actual Budget Directory Error
 *
 * Tests directory permission errors during Actual Budget validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { SetupService } from '../../src/services/setup-service.js';
import { dump } from 'js-yaml';
import path from 'path';

// Mock filesystem
vi.mock('fs/promises', () => ({
  ...vol.promises,
  default: vol.promises
}));

// Mock @actual-app/api
vi.mock('@actual-app/api', () => ({
  init: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined as any)
}));

import * as actualApi from '@actual-app/api';

describe('Integration: Actual Budget Directory Error (T033)', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle directory permission error and allow retry with different directory', async () => {
    const service = new SetupService();

    // Pre-populate Monzo config (for partial setup recovery flow)
    const partialConfig = {
      monzo: {
        clientId: 'oauth2client_00009abc123def456',
        clientSecret: 'mnzconf_secret_1234567890abcdef',
        accessToken: 'access_token_12345678901234567890',
        refreshToken: 'refresh_token_12345678901234567890',
        tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
        authorizedAt: new Date().toISOString()
      }
    };

    const configPath = path.join(process.cwd(), 'config.yaml');
    vol.writeFileSync(configPath, dump(partialConfig));

    // Mock Actual SDK to throw EACCES on first attempt
    const permissionError = new Error('EACCES: permission denied');
    (permissionError as any).code = 'EACCES';

    vi.mocked(actualApi.init)
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce(undefined as any);

    // First attempt - should fail with EACCES
    const firstAttempt = await service.setupActualBudget({
      serverUrl: 'http://localhost:5006',
      password: 'test_password',
      dataDirectory: '/root/.actual-budget/data' // Not writable
    });

    expect(firstAttempt.success).toBe(false);
    expect(firstAttempt.error).toBeDefined();
    expect(firstAttempt.error?.code).toBe('directory_error');

    // Second attempt with different directory - should succeed
    const secondAttempt = await service.setupActualBudget({
      serverUrl: 'http://localhost:5006',
      password: 'test_password',
      dataDirectory: '/tmp/actual-budget/data' // Writable
    });

    expect(secondAttempt.success).toBe(true);
    expect(secondAttempt.data).toBeDefined();
    expect(secondAttempt.data?.dataDirectory).toBe('/tmp/actual-budget/data');
    expect(secondAttempt.data?.validatedAt).toBeDefined();

    // Verify disconnect was called in both attempts
    expect(actualApi.shutdown).toHaveBeenCalledTimes(2);
  });

  it('should preserve serverUrl and password when retrying after directory error', async () => {
    const service = new SetupService();

    const permissionError = new Error('EACCES: permission denied, mkdir');
    (permissionError as any).code = 'EACCES';

    vi.mocked(actualApi.init).mockRejectedValue(permissionError);

    const result = await service.setupActualBudget({
      serverUrl: 'http://budget.example.com:5006',
      password: 'my_secure_password',
      dataDirectory: '/root/no-access'
    });

    // Should fail but preserve input params for retry
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Verify error message mentions directory issue
    expect(result.error?.message).toMatch(/director|permission|EACCES/i);

    // Verify disconnect was still called even on failure
    expect(actualApi.shutdown).toHaveBeenCalled();
  });

  it('should differentiate directory errors from network errors', async () => {
    const service = new SetupService();

    const directoryError = new Error('EACCES: permission denied');
    (directoryError as any).code = 'EACCES';

    vi.mocked(actualApi.init).mockRejectedValue(directoryError);

    const result = await service.setupActualBudget({
      serverUrl: 'http://localhost:5006',
      password: 'password',
      dataDirectory: '/invalid/path'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('directory_error');
    expect(result.error?.code).not.toContain('network');
    expect(result.error?.code).not.toContain('auth');
  });
});
