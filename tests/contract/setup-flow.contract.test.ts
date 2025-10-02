/**
 * Contract Test: Setup Flow Orchestration
 *
 * This test MUST FAIL before implementation with error:
 * "SetupService is not defined" or "SetupCommand is not defined"
 *
 * Tests validate the two-phase setup orchestration:
 * - Monzo phase → Actual Budget phase sequential execution
 * - Partial setup (Monzo succeeds, config saved, then Actual Budget)
 * - Config persistence with correct structure
 * - setupCompletedAt timestamp set after both phases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';

// These imports WILL FAIL until T024-T025 are implemented
import { SetupService } from '../../src/services/setup-service';
import { ConfigState } from '../../src/types/setup';

// Mock filesystem
vi.mock('fs/promises', () => ({
  ...vol.promises,
  default: vol.promises
}));

vi.mock('@actual-app/api', () => ({
  init: vi.fn(),
  shutdown: vi.fn()
}));

describe('Setup Flow Orchestration Contract', () => {
  let service: SetupService;

  beforeEach(() => {
    vol.reset();
    // Create working directory in memfs
    vol.mkdirSync(process.cwd(), { recursive: true });
    service = new SetupService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Two-Phase Flow', () => {
    it('should execute Monzo phase then Actual Budget phase sequentially', async () => {
      // Mock OAuth success
      const mockOAuthResult = {
        clientId: 'oauth2client_test',
        clientSecret: 'mnzconf_secret',
        accessToken: 'access_token_new',
        refreshToken: 'refresh_token_new',
        tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
        authorizedAt: new Date().toISOString()
      };

      // Mock Actual Budget success
      const mockActualResult = {
        serverUrl: 'http://localhost:5006',
        password: 'test_password',
        dataDirectory: '/tmp/actual',
        validatedAt: new Date().toISOString()
      };

      const result = await service.runFullSetup({
        monzo: mockOAuthResult,
        actualBudget: mockActualResult
      });

      expect(result.success).toBe(true);
      expect(result.setupCompletedAt).toBeDefined();
      expect(result.configState).toBe(ConfigState.COMPLETE);
    });
  });

  describe('Partial Setup Handling', () => {
    it('should save Monzo config even if Actual Budget phase fails', async () => {
      const mockOAuthResult = {
        clientId: 'oauth2client_test',
        clientSecret: 'mnzconf_secret',
        accessToken: 'access_token_new',
        refreshToken: 'refresh_token_new',
        tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
        authorizedAt: new Date().toISOString()
      };

      // Simulate Actual Budget failure

      await service.runMonzoPhase(mockOAuthResult);

      // Verify Monzo config saved
      const configExists = await service.hasMonzoConfig();
      expect(configExists).toBe(true);

      // Verify state is PARTIAL_MONZO_ONLY
      const state = await service.getConfigState();
      expect(state).toBe(ConfigState.PARTIAL_MONZO_ONLY);
    });

    it('should resume from Actual Budget phase if Monzo already configured', async () => {
      // Pre-populate Monzo config
      const existingMonzoConfig = {
        clientId: 'oauth2client_existing',
        clientSecret: 'mnzconf_existing',
        accessToken: 'access_token_existing',
        refreshToken: 'refresh_token_existing',
        tokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
        authorizedAt: new Date().toISOString()
      };

      await service.saveMonzoConfig(existingMonzoConfig);

      const state = await service.getConfigState();
      expect(state).toBe(ConfigState.PARTIAL_MONZO_ONLY);

      // Verify setup service skips Monzo phase
      const shouldRunMonzo = await service.shouldRunMonzoPhase();
      expect(shouldRunMonzo).toBe(false);
    });
  });

  describe('Config Persistence', () => {
    it('should write config.yaml with correct structure', async () => {
      const mockConfig = {
        configVersion: '1.0.0',
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          tokenExpiresAt: new Date().toISOString(),
          authorizedAt: new Date().toISOString()
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'password',
          dataDirectory: '/tmp/actual',
          validatedAt: new Date().toISOString()
        },
        setupCompletedAt: new Date().toISOString()
      };

      await service.saveConfig(mockConfig);

      const savedConfig = await service.loadConfig();
      expect(savedConfig.monzo.clientId).toBe('oauth2client_test');
      expect(savedConfig.actualBudget.serverUrl).toBe('http://localhost:5006');
      expect(savedConfig.setupCompletedAt).toBeDefined();
    });
  });

  describe('setupCompletedAt Timestamp', () => {
    it('should set setupCompletedAt only after both phases complete', async () => {
      // After Monzo only
      await service.runMonzoPhase({
        clientId: 'oauth2client_test',
        clientSecret: 'mnzconf_secret',
        accessToken: 'token',
        refreshToken: 'refresh',
        tokenExpiresAt: new Date().toISOString(),
        authorizedAt: new Date().toISOString()
      });

      let config = await service.loadConfig();
      expect(config.setupCompletedAt).toBeUndefined();

      // After Actual Budget too
      await service.runActualBudgetPhase({
        serverUrl: 'http://localhost:5006',
        password: 'password',
        dataDirectory: '/tmp/actual',
        validatedAt: new Date().toISOString()
      });

      config = await service.loadConfig();
      expect(config.setupCompletedAt).toBeDefined();
      expect(config.setupCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
