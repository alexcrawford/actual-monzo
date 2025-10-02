/**
 * Integration Test: Expired Tokens Recovery
 *
 * Tests setup recovery when Monzo tokens have expired.
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

describe('Integration: Expired Tokens Recovery', () => {
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

  it('should detect expired tokens and require re-authentication', async () => {
    const service = new SetupService();

    // Pre-populate config with expired Monzo tokens
    const expiredConfig = {
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
    const yamlContent = dump(expiredConfig, { indent: 2 });
    vol.writeFileSync(configPath, yamlContent);

    // Check config state
    const state = await service.getConfigState();
    expect(state).toBe('expired_tokens');
  });

  it('should allow re-authentication with new tokens', async () => {
    const service = new SetupService();

    // Pre-populate config with expired tokens
    const expiredConfig = {
      monzo: {
        clientId: 'oauth2client_00009abc123def456',
        clientSecret: 'mnzconf_secret_1234567890abcdef',
        accessToken: 'expired_access_token',
        refreshToken: 'expired_refresh_token',
        tokenExpiresAt: new Date(Date.now() - 3600000).toISOString(),
        authorizedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      actualBudget: {
        serverUrl: 'http://localhost:5006',
        password: 'test_password',
        dataDirectory: '/tmp/actual',
        validatedAt: new Date().toISOString(),
      },
    };

    const configPath = path.join(process.cwd(), 'config.yaml');
    vol.writeFileSync(configPath, dump(expiredConfig, { indent: 2 }));

    // Mock OAuth re-authentication
    nock('https://api.monzo.com').post('/oauth2/token').reply(200, {
      access_token: 'new_access_token_12345678901234567890',
      refresh_token: 'new_refresh_token_12345678901234567890',
      expires_in: 21600,
      token_type: 'Bearer',
    });

    // Re-authenticate with new tokens
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
      actualBudget: expiredConfig.actualBudget,
    });

    // Assertions
    expect(result.success).toBe(true);
    expect(result.setupCompletedAt).toBeDefined();

    // Verify new tokens stored
    const updatedConfigContent = vol.readFileSync(configPath, 'utf-8') as string;
    const updatedConfig = load(updatedConfigContent) as any;

    expect(updatedConfig.monzo.accessToken).toBe('new_access_token_12345678901234567890');
    expect(updatedConfig.monzo.refreshToken).toBe('new_refresh_token_12345678901234567890');
    expect(new Date(updatedConfig.monzo.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
