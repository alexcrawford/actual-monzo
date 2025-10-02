/**
 * Integration Test: Invalid Password Recovery
 *
 * Tests handling of invalid password errors during Actual Budget
 * connection and validates retry mechanism.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { SetupService } from '../../src/services/setup-service';
import { SetupErrorCode } from '../../src/types/setup';

// Mock filesystem
vi.mock('fs/promises', () => ({
  ...vol.promises,
  default: vol.promises,
}));

// Mock @actual-app/api
vi.mock('@actual-app/api', () => ({
  init: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined as any),
}));

import * as actualApi from '@actual-app/api';

describe('Integration: Invalid Password Recovery', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect and report invalid password error', async () => {
    const service = new SetupService();

    // Mock 401 Unauthorized error
    const authError = new Error('Unauthorized');
    (authError as any).status = 401;
    vi.mocked(actualApi.init).mockRejectedValue(authError);

    // Attempt Actual Budget setup with wrong password
    const actualParams = {
      serverUrl: 'http://localhost:5006',
      password: 'wrong_password',
      dataDirectory: '/tmp/actual',
    };

    const result = await service.setupActualBudget(actualParams);

    // Assertions
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(SetupErrorCode.INVALID_CREDENTIALS);
    expect(result.error!.message).toContain('Invalid password');
    expect(result.error!.message).toContain('server password');

    // Verify cleanup was called
    expect(actualApi.shutdown).toHaveBeenCalled();
  });

  it('should allow retry with correct password after failure', async () => {
    const service = new SetupService();

    // First attempt: wrong password
    const authError = new Error('Unauthorized');
    (authError as any).status = 401;
    vi.mocked(actualApi.init).mockRejectedValueOnce(authError);

    const wrongParams = {
      serverUrl: 'http://localhost:5006',
      password: 'wrong_password',
      dataDirectory: '/tmp/actual',
    };

    const failedResult = await service.setupActualBudget(wrongParams);

    expect(failedResult.success).toBe(false);
    expect(failedResult.error!.code).toBe(SetupErrorCode.INVALID_CREDENTIALS);

    // Second attempt: correct password
    vi.mocked(actualApi.init).mockResolvedValueOnce(undefined as any);

    const correctParams = {
      serverUrl: 'http://localhost:5006',
      password: 'correct_password',
      dataDirectory: '/tmp/actual',
    };

    const successResult = await service.setupActualBudget(correctParams);

    // Assertions
    expect(successResult.success).toBe(true);
    expect(successResult.data).toBeDefined();
    expect(successResult.data!.password).toBe('correct_password');
    expect(successResult.data!.validatedAt).toBeDefined();

    // Verify cleanup was called for both attempts
    expect(actualApi.shutdown).toHaveBeenCalledTimes(2);
  });

  it('should preserve Monzo config when password retry fails', async () => {
    const service = new SetupService();

    // Save Monzo config first
    const monzoConfig = {
      clientId: 'oauth2client_00009abc123def456',
      clientSecret: 'mnzconf_secret_1234567890abcdef',
      accessToken: 'access_token_12345678901234567890',
      refreshToken: 'refresh_token_12345678901234567890',
      tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
      authorizedAt: new Date().toISOString(),
    };

    await service.saveMonzoConfig(monzoConfig);

    // Attempt Actual Budget setup with wrong password
    const authError = new Error('Unauthorized');
    (authError as any).status = 401;
    vi.mocked(actualApi.init).mockRejectedValue(authError);

    const actualParams = {
      serverUrl: 'http://localhost:5006',
      password: 'wrong_password',
      dataDirectory: '/tmp/actual',
    };

    const result = await service.setupActualBudget(actualParams);

    // Assertions
    expect(result.success).toBe(false);

    // Verify Monzo config is still saved
    const configExists = await service.hasMonzoConfig();
    expect(configExists).toBe(true);

    const savedConfig = await service.loadConfig();
    expect(savedConfig.monzo.accessToken).toBe('access_token_12345678901234567890');

    // Verify cleanup was called
    expect(actualApi.shutdown).toHaveBeenCalled();
  });

  it('should handle 401 error with message variant', async () => {
    const service = new SetupService();

    // Mock error with "401" in message instead of status code
    const authError = new Error('Request failed with status code 401');
    vi.mocked(actualApi.init).mockRejectedValue(authError);

    const actualParams = {
      serverUrl: 'http://localhost:5006',
      password: 'wrong_password',
      dataDirectory: '/tmp/actual',
    };

    const result = await service.setupActualBudget(actualParams);

    // Assertions
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe(SetupErrorCode.INVALID_CREDENTIALS);

    // Verify cleanup was called
    expect(actualApi.shutdown).toHaveBeenCalled();
  });
});
