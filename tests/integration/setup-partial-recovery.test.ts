/**
 * Integration Test: Partial Setup Recovery
 *
 * Tests resuming setup when Monzo is already configured
 * but Actual Budget needs to be set up.
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

describe('Integration: Partial Setup Recovery', () => {
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

  it('should resume setup from Actual Budget phase when Monzo already configured', async () => {
    const service = new SetupService();

    // Pre-populate config with Monzo tokens only
    const partialConfig = {
      monzo: {
        clientId: 'oauth2client_00009abc123def456',
        clientSecret: 'mnzconf_secret_1234567890abcdef',
        accessToken: 'access_token_12345678901234567890',
        refreshToken: 'refresh_token_12345678901234567890',
        tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
        authorizedAt: new Date().toISOString(),
      },
      actualBudget: {
        serverUrl: 'http://placeholder',
        password: 'placeholder',
        dataDirectory: '/tmp/placeholder',
      },
    };

    const configPath = path.join(process.cwd(), 'config.yaml');
    const yamlContent = dump(partialConfig, { indent: 2 });
    vol.writeFileSync(configPath, yamlContent);

    // Mock Actual Budget API success
    vi.mocked(actualApi.init).mockResolvedValue(undefined as any);
    vi.mocked(actualApi.shutdown).mockResolvedValue(undefined as any);

    // Execute Actual Budget phase only
    const actualConfig = {
      serverUrl: 'http://localhost:5006',
      password: 'test_password',
      dataDirectory: '/tmp/actual',
      validatedAt: new Date().toISOString(),
    };

    const result = await service.resumeSetup(actualConfig);

    // Assertions
    expect(result.overallSuccess).toBe(true);
    expect(result.monzoPhase?.success).toBe(true);
    expect(result.actualPhase?.success).toBe(true);
    expect(result.completedAt).toBeDefined();

    // Verify config was updated
    const updatedConfigContent = vol.readFileSync(configPath, 'utf-8') as string;
    const updatedConfig = load(updatedConfigContent) as any;

    // Monzo section should be preserved
    expect(updatedConfig.monzo.clientId).toBe('oauth2client_00009abc123def456');
    expect(updatedConfig.monzo.accessToken).toBe('access_token_12345678901234567890');

    // Actual Budget section should be populated
    expect(updatedConfig.actualBudget.serverUrl).toBe('http://localhost:5006');
    expect(updatedConfig.actualBudget.password).toBe('test_password');
    expect(updatedConfig.actualBudget.validatedAt).toBeDefined();

    // setupCompletedAt should now be set
    expect(updatedConfig.setupCompletedAt).toBeDefined();
  });
});
