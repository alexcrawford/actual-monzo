/**
 * Integration Test: Setup Reconfiguration
 *
 * Tests reconfiguring individual components (Monzo or Actual Budget)
 * when setup is already complete.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import nock from 'nock';
import { SetupService } from '../../src/services/setup-service';
import { load, dump } from 'js-yaml';
import path from 'path';

// Mock filesystem
vi.mock('fs/promises', () => ({
  ...vol.promises,
  default: vol.promises,
}));

// Mock @actual-app/api
vi.mock('@actual-app/api', () => ({
  init: vi.fn().mockResolvedValue(undefined as any),
  shutdown: vi.fn().mockResolvedValue(undefined as any),
}));

import * as actualApi from '@actual-app/api';

describe('Integration: Setup Reconfiguration', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vi.clearAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it('should allow reconfiguring Actual Budget only when Monzo is valid', async () => {
    const service = new SetupService();

    // Pre-populate complete config
    const completeConfig = {
      monzo: {
        clientId: 'oauth2client_00009abc123def456',
        clientSecret: 'mnzconf_secret_1234567890abcdef',
        accessToken: 'access_token_12345678901234567890',
        refreshToken: 'refresh_token_12345678901234567890',
        tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
        authorizedAt: new Date().toISOString(),
      },
      actualBudget: {
        serverUrl: 'http://localhost:5006',
        password: 'old_password',
        dataDirectory: '/tmp/actual',
        validatedAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      },
      setupCompletedAt: new Date(Date.now() - 86400000).toISOString(),
    };

    const configPath = path.join(process.cwd(), 'config.yaml');
    const yamlContent = dump(completeConfig, { indent: 2 });
    vol.writeFileSync(configPath, yamlContent);

    // Mock Monzo whoami endpoint (tokens still valid)
    nock('https://api.monzo.com')
      .get('/ping/whoami')
      .reply(200, { authenticated: true, user_id: 'user_12345' });

    // Mock Actual Budget API success with new config
    vi.mocked(actualApi.init).mockResolvedValue(undefined as any);
    vi.mocked(actualApi.shutdown).mockResolvedValue(undefined as any);

    // Execute Actual Budget reconfiguration by overwriting with new config
    const newActualConfig = {
      serverUrl: 'http://localhost:5007',
      password: 'new_password',
      dataDirectory: '/tmp/actual-new',
      validatedAt: new Date().toISOString(),
    };

    // Use runFullSetup to allow reconfiguration (preserving Monzo config)
    const result = await service.runFullSetup({
      monzo: completeConfig.monzo,
      actualBudget: newActualConfig,
    });

    // Assertions
    expect(result.success).toBe(true);
    expect(result.setupCompletedAt).toBeDefined();

    // Verify config was updated
    const updatedConfigContent = vol.readFileSync(configPath, 'utf-8') as string;
    const updatedConfig = load(updatedConfigContent) as any;

    // Monzo section should be UNCHANGED
    expect(updatedConfig.monzo.clientId).toBe('oauth2client_00009abc123def456');
    expect(updatedConfig.monzo.accessToken).toBe('access_token_12345678901234567890');
    expect(updatedConfig.monzo.authorizedAt).toBe(completeConfig.monzo.authorizedAt);

    // Actual Budget section should be UPDATED
    expect(updatedConfig.actualBudget.serverUrl).toBe('http://localhost:5007');
    expect(updatedConfig.actualBudget.password).toBe('new_password');
    expect(updatedConfig.actualBudget.dataDirectory).toBe('/tmp/actual-new');
    expect(updatedConfig.actualBudget.validatedAt).not.toBe(
      completeConfig.actualBudget.validatedAt
    );

    // setupCompletedAt should be UPDATED
    expect(updatedConfig.setupCompletedAt).not.toBe(completeConfig.setupCompletedAt);
  });

  it('should allow reconfiguring Monzo when tokens are expired', async () => {
    const service = new SetupService();

    // Pre-populate config with expired Monzo tokens
    const configWithExpiredTokens = {
      monzo: {
        clientId: 'oauth2client_00009abc123def456',
        clientSecret: 'mnzconf_secret_1234567890abcdef',
        accessToken: 'expired_access_token',
        refreshToken: 'expired_refresh_token',
        tokenExpiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        authorizedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      actualBudget: {
        serverUrl: 'http://localhost:5006',
        password: 'test_password',
        dataDirectory: '/tmp/actual',
        validatedAt: new Date().toISOString(),
      },
      setupCompletedAt: new Date(Date.now() - 86400000).toISOString(),
    };

    const configPath = path.join(process.cwd(), 'config.yaml');
    const yamlContent = dump(configWithExpiredTokens, { indent: 2 });
    vol.writeFileSync(configPath, yamlContent);

    // Mock Monzo OAuth endpoints for re-authorization
    nock('https://api.monzo.com').post('/oauth2/token').reply(200, {
      access_token: 'new_access_token_12345678901234567890',
      refresh_token: 'new_refresh_token_12345678901234567890',
      expires_in: 21600,
      token_type: 'Bearer',
    });

    // Execute Monzo reconfiguration
    const newMonzoConfig = {
      clientId: 'oauth2client_00009abc123def456',
      clientSecret: 'mnzconf_secret_1234567890abcdef',
      accessToken: 'new_access_token_12345678901234567890',
      refreshToken: 'new_refresh_token_12345678901234567890',
      tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
      authorizedAt: new Date().toISOString(),
    };

    const result = await service.runFullSetup({
      monzo: newMonzoConfig,
      actualBudget: configWithExpiredTokens.actualBudget,
    });

    // Assertions
    expect(result.success).toBe(true);
    expect(result.setupCompletedAt).toBeDefined();

    // Verify config was updated
    const updatedConfigContent = vol.readFileSync(configPath, 'utf-8') as string;
    const updatedConfig = load(updatedConfigContent) as any;

    // Monzo section should be UPDATED
    expect(updatedConfig.monzo.accessToken).toBe('new_access_token_12345678901234567890');
    expect(updatedConfig.monzo.refreshToken).toBe('new_refresh_token_12345678901234567890');
    expect(updatedConfig.monzo.authorizedAt).not.toBe(configWithExpiredTokens.monzo.authorizedAt);

    // Actual Budget section should be UNCHANGED
    expect(updatedConfig.actualBudget.serverUrl).toBe('http://localhost:5006');
    expect(updatedConfig.actualBudget.password).toBe('test_password');
    expect(updatedConfig.actualBudget.validatedAt).toBe(
      configWithExpiredTokens.actualBudget.validatedAt
    );

    // setupCompletedAt should be UPDATED
    expect(updatedConfig.setupCompletedAt).not.toBe(configWithExpiredTokens.setupCompletedAt);
  });
});
