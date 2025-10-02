/**
 * Integration Test: Network Error Recovery
 *
 * Tests handling of network errors during Actual Budget connection
 * and provides actionable error messages for recovery.
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

describe('Integration: Network Error Recovery', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide actionable error message when server is unreachable', async () => {
    const service = new SetupService();

    // Mock network connection refused error
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:5006');
    (networkError as any).code = 'ECONNREFUSED';
    vi.mocked(actualApi.init).mockRejectedValue(networkError);

    // Attempt Actual Budget setup
    const actualParams = {
      serverUrl: 'http://localhost:5006',
      password: 'test_password',
      dataDirectory: '/tmp/actual',
    };

    const result = await service.setupActualBudget(actualParams);

    // Assertions
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(SetupErrorCode.SERVER_UNREACHABLE);
    expect(result.error!.message).toContain('Cannot reach Actual Budget server');
    expect(result.error!.message).toContain('http://localhost:5006');

    // Verify cleanup was called
    expect(actualApi.shutdown).toHaveBeenCalled();
  });

  it('should handle timeout errors with actionable message', async () => {
    const service = new SetupService();

    // Mock timeout error
    const timeoutError = new Error('Request timeout');
    (timeoutError as any).code = 'ETIMEDOUT';
    vi.mocked(actualApi.init).mockRejectedValue(timeoutError);

    // Attempt Actual Budget setup
    const actualParams = {
      serverUrl: 'http://localhost:5006',
      password: 'test_password',
      dataDirectory: '/tmp/actual',
    };

    const result = await service.setupActualBudget(actualParams);

    // Assertions
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(SetupErrorCode.SERVER_UNREACHABLE);
    expect(result.error!.message).toContain('server is not responding');

    // Verify cleanup was called
    expect(actualApi.shutdown).toHaveBeenCalled();
  });

  it('should handle DNS lookup failures with actionable message', async () => {
    const service = new SetupService();

    // Mock DNS error
    const dnsError = new Error('getaddrinfo ENOTFOUND actual-budget.local');
    (dnsError as any).code = 'ENOTFOUND';
    vi.mocked(actualApi.init).mockRejectedValue(dnsError);

    // Attempt Actual Budget setup
    const actualParams = {
      serverUrl: 'http://actual-budget.local:5006',
      password: 'test_password',
      dataDirectory: '/tmp/actual',
    };

    const result = await service.setupActualBudget(actualParams);

    // Assertions
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(SetupErrorCode.SERVER_UNREACHABLE);
    expect(result.error!.message).toContain('Cannot reach Actual Budget server');

    // Verify cleanup was called
    expect(actualApi.shutdown).toHaveBeenCalled();
  });

  it('should preserve Monzo config when Actual Budget network fails', async () => {
    const service = new SetupService();

    // Mock Monzo OAuth success (simulated with pre-saved config)
    const monzoConfig = {
      clientId: 'oauth2client_00009abc123def456',
      clientSecret: 'mnzconf_secret_1234567890abcdef',
      accessToken: 'access_token_12345678901234567890',
      refreshToken: 'refresh_token_12345678901234567890',
      tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
      authorizedAt: new Date().toISOString(),
    };

    await service.saveMonzoConfig(monzoConfig);

    // Mock network error for Actual Budget
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:5006');
    (networkError as any).code = 'ECONNREFUSED';
    vi.mocked(actualApi.init).mockRejectedValue(networkError);

    // Attempt Actual Budget setup
    const actualParams = {
      serverUrl: 'http://localhost:5006',
      password: 'test_password',
      dataDirectory: '/tmp/actual',
    };

    const actualResult = await service.setupActualBudget(actualParams);

    // Assertions
    expect(actualResult.success).toBe(false);

    // Verify Monzo config is still saved
    const configExists = await service.hasMonzoConfig();
    expect(configExists).toBe(true);

    const savedConfig = await service.loadConfig();
    expect(savedConfig.monzo.accessToken).toBe('access_token_12345678901234567890');

    // Verify cleanup was called
    expect(actualApi.shutdown).toHaveBeenCalled();
  });
});
