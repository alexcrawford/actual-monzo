/**
 * Integration Test: Setup with Existing Config Verification
 *
 * Tests the interactive flow when config already exists:
 * - Monzo: keep/replace/verify options
 * - Actual Budget: keep/replace/verify options
 * - Account Mappings: keep/replace options
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import nock from 'nock';
import { SetupService } from '../../src/services/setup-service';
import { dump } from 'js-yaml';
import path from 'path';

vi.mock('fs/promises', () => ({
  ...vol.promises,
  default: vol.promises,
}));

vi.mock('@actual-app/api', () => ({
  init: vi.fn().mockResolvedValue(undefined as any),
  shutdown: vi.fn().mockResolvedValue(undefined as any),
}));

import * as actualApi from '@actual-app/api';

describe('Integration: Setup Config Verification', () => {
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

  describe('Monzo Config Verification', () => {
    it('should verify existing Monzo config successfully', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'access_token_12345678901234567890',
          refreshToken: 'refresh_token_12345678901234567890',
          tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
          authorizedAt: new Date().toISOString(),
        },
        actualBudget: {
          serverUrl: '',
          password: '',
          dataDirectory: '',
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      nock('https://api.monzo.com')
        .get('/ping/whoami')
        .reply(200, { authenticated: true, user_id: 'user_12345' });

      const result = await service.verifyMonzoConfig();

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect expired Monzo tokens during verification', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'expired_access_token',
          refreshToken: 'refresh_token',
          tokenExpiresAt: new Date(Date.now() - 3600000).toISOString(),
          authorizedAt: new Date().toISOString(),
        },
        actualBudget: {
          serverUrl: '',
          password: '',
          dataDirectory: '',
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      nock('https://api.monzo.com').get('/ping/whoami').reply(401, { error: 'Unauthorized' });

      const result = await service.verifyMonzoConfig();

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid or expired');
    });

    it('should return error when no Monzo config exists', async () => {
      const service = new SetupService();

      const result = await service.verifyMonzoConfig();

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should return error when access token is missing', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
        },
        actualBudget: {
          serverUrl: '',
          password: '',
          dataDirectory: '',
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      const result = await service.verifyMonzoConfig();

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe('NO_ACCESS_TOKEN');
    });
  });

  describe('Actual Budget Config Verification', () => {
    it('should verify existing Actual Budget config successfully', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: '',
          clientSecret: '',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test_password',
          dataDirectory: '/tmp/actual',
          validatedAt: new Date().toISOString(),
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      vi.mocked(actualApi.init).mockResolvedValue(undefined as any);
      vi.mocked(actualApi.shutdown).mockResolvedValue(undefined as any);

      const result = await service.verifyActualBudgetConfig();

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(actualApi.init).toHaveBeenCalledWith({
        serverURL: 'http://localhost:5006',
        password: 'test_password',
        dataDir: '/tmp/actual',
      });
    });

    it('should detect invalid Actual Budget credentials during verification', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: '',
          clientSecret: '',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'wrong_password',
          dataDirectory: '/tmp/actual',
          validatedAt: new Date().toISOString(),
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      vi.mocked(actualApi.init).mockRejectedValue(new Error('Invalid password'));

      const result = await service.verifyActualBudgetConfig();

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid password');
    });

    it('should return error when no config exists', async () => {
      const service = new SetupService();

      const result = await service.verifyActualBudgetConfig();

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should return error when Actual Budget config is incomplete', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: '',
          clientSecret: '',
        },
        actualBudget: {
          serverUrl: '',
          password: '',
          dataDirectory: '',
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      const result = await service.verifyActualBudgetConfig();

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe('INCOMPLETE_CONFIG');
    });
  });

  describe('Config Existence Checks', () => {
    it('should detect existing Monzo config', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'access_token_12345678901234567890',
          refreshToken: 'refresh_token_12345678901234567890',
        },
        actualBudget: {
          serverUrl: '',
          password: '',
          dataDirectory: '',
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      const hasMonzo = await service.hasMonzoConfig();

      expect(hasMonzo).toBe(true);
    });

    it('should detect existing Actual Budget config', async () => {
      const service = new SetupService();

      const existingConfig = {
        monzo: {
          clientId: '',
          clientSecret: '',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test_password',
          dataDirectory: '/tmp/actual',
          validatedAt: new Date().toISOString(),
        },
      };

      const configPath = path.join(process.cwd(), 'config.yaml');
      const yamlContent = dump(existingConfig, { indent: 2 });
      vol.writeFileSync(configPath, yamlContent);

      const hasActual = await service.hasActualBudgetConfig();

      expect(hasActual).toBe(true);
    });

    it('should return false when config does not exist', async () => {
      const service = new SetupService();

      const hasMonzo = await service.hasMonzoConfig();
      const hasActual = await service.hasActualBudgetConfig();

      expect(hasMonzo).toBe(false);
      expect(hasActual).toBe(false);
    });
  });
});
