/**
 * Integration Test: Setup Command Happy Path
 *
 * Tests the complete end-to-end setup flow with successful OAuth
 * and Actual Budget connection validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import nock from 'nock';
import { SetupService } from '../../src/services/setup-service';
import { load } from 'js-yaml';
import path from 'path';

// Mock filesystem
vi.mock('fs/promises', () => ({
  ...vol.promises,
  default: vol.promises
}));

// Mock @actual-app/api
vi.mock('@actual-app/api', () => ({
  init: vi.fn().mockResolvedValue(undefined as any),
  shutdown: vi.fn().mockResolvedValue(undefined as any)
}));

import * as actualApi from '@actual-app/api';

describe('Integration: Setup Happy Path', () => {
  beforeEach(() => {
    vol.reset();
    // Create working directory in memfs
    vol.mkdirSync(process.cwd(), { recursive: true });
    vi.clearAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it('should complete full setup flow with Monzo OAuth and Actual Budget validation', async () => {
    const service = new SetupService();

    // Mock Monzo OAuth endpoints
    nock('https://api.monzo.com')
      .post('/oauth2/token')
      .reply(200, {
        access_token: 'access_token_12345678901234567890',
        refresh_token: 'refresh_token_12345678901234567890',
        expires_in: 21600,
        token_type: 'Bearer'
      });

    // Mock Actual Budget API success
    vi.mocked(actualApi.init).mockResolvedValue(undefined as any);
    vi.mocked(actualApi.shutdown).mockResolvedValue(undefined as any);

    // Execute two-phase setup
    const monzoConfig = {
      clientId: 'oauth2client_00009abc123def456',
      clientSecret: 'mnzconf_secret_1234567890abcdef',
      accessToken: 'access_token_12345678901234567890',
      refreshToken: 'refresh_token_12345678901234567890',
      tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
      authorizedAt: new Date().toISOString()
    };

    const actualConfig = {
      serverUrl: 'http://localhost:5006',
      password: 'test_password',
      dataDirectory: '/tmp/actual',
      validatedAt: new Date().toISOString()
    };

    const result = await service.runFullSetup({
      monzo: monzoConfig,
      actualBudget: actualConfig
    });

    // Assertions
    expect(result.success).toBe(true);
    expect(result.setupCompletedAt).toBeDefined();
    expect(result.setupCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Verify config.yaml was created
    const configPath = path.join(process.cwd(), 'config.yaml');
    const configContent = vol.readFileSync(configPath, 'utf-8') as string;
    const config = load(configContent) as any;

    // Verify Monzo section
    expect(config.monzo).toBeDefined();
    expect(config.monzo.clientId).toBe('oauth2client_00009abc123def456');
    expect(config.monzo.accessToken).toBe('access_token_12345678901234567890');
    expect(config.monzo.refreshToken).toBe('refresh_token_12345678901234567890');
    expect(config.monzo.tokenExpiresAt).toBeDefined();
    expect(config.monzo.authorizedAt).toBeDefined();

    // Verify Actual Budget section
    expect(config.actualBudget).toBeDefined();
    expect(config.actualBudget.serverUrl).toBe('http://localhost:5006');
    expect(config.actualBudget.password).toBe('test_password');
    expect(config.actualBudget.dataDirectory).toBe('/tmp/actual');
    expect(config.actualBudget.validatedAt).toBeDefined();

    // Verify setupCompletedAt is set
    expect(config.setupCompletedAt).toBeDefined();
    expect(config.setupCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
