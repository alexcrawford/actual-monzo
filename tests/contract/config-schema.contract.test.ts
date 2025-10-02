/**
 * Contract Test: Config Validation
 *
 * This test MUST FAIL before implementation with error:
 * "validateConfig is not defined"
 *
 * Tests validate config file validation and state determination:
 * - Valid complete config passes
 * - Partial Monzo-only config passes
 * - Expired tokens detected
 * - Malformed YAML error handling
 * - Missing required fields
 * - Relative path rejection
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import path from 'path';

// This import WILL FAIL until T019 is implemented
import { validateConfig } from '../../src/utils/config-manager';
import { ConfigState } from '../../src/types/setup';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

describe('Config Validation Contract', () => {
  const loadFixture = (fixtureName: string) => {
    const filePath = path.join(FIXTURES_DIR, 'config-templates.yaml');
    const content = readFileSync(filePath, 'utf-8');
    const fixtures = load(content) as any;
    return fixtures[fixtureName];
  };

  describe('Valid Complete Config', () => {
    it('should pass validation for complete config', async () => {
      const config = loadFixture('complete');
      const result = await validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.state).toBe(ConfigState.COMPLETE);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Valid Partial Config', () => {
    it('should pass validation for Monzo-only config', async () => {
      const config = loadFixture('partialMonzoOnly');
      const result = await validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.state).toBe(ConfigState.PARTIAL_MONZO_ONLY);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Expired Tokens Detection', () => {
    it('should detect expired tokens', async () => {
      const config = loadFixture('expiredTokens');
      const result = await validateConfig(config);

      expect(result.valid).toBe(true); // Config structure valid
      expect(result.state).toBe(ConfigState.EXPIRED_TOKENS);
    });
  });

  describe('Malformed YAML Handling', () => {
    it('should handle YAML parse errors gracefully', async () => {
      const malformedYaml = 'monzo:\n  clientId: [invalid\nactualBudget:';

      const result = await validateConfig(malformedYaml);

      expect(result.valid).toBe(false);
      expect(result.state).toBe(ConfigState.MALFORMED);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('YAML parse error');
    });
  });

  describe('Missing Required Fields', () => {
    it('should reject config missing clientId', async () => {
      const invalidConfig = {
        monzo: {
          clientSecret: 'mnzconf_secret'
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual'
        }
      };

      const result = await validateConfig(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.state).toBe(ConfigState.MALFORMED);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('clientId'))).toBe(true);
    });

    it('should reject config missing serverUrl', async () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret'
        },
        actualBudget: {
          password: 'test',
          dataDirectory: '/tmp/actual'
        }
      };

      const result = await validateConfig(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.includes('serverUrl'))).toBe(true);
    });
  });

  describe('Invalid URL Format', () => {
    it('should reject URL without protocol', async () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret'
        },
        actualBudget: {
          serverUrl: 'localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual'
        }
      };

      const result = await validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.includes('http://') || e.includes('https://'))).toBe(true);
    });
  });

  describe('Relative Path Acceptance', () => {
    it('should accept relative dataDirectory path', async () => {
      const validConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'access_token_12345678901234567890',
          refreshToken: 'refresh_token_12345678901234567890',
          tokenExpiresAt: '2099-12-31T23:59:59.000Z',
          authorizedAt: '2025-10-01T18:00:00.000Z'
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: './relative/path'
        }
      };

      const result = await validateConfig(validConfig);

      expect(result.valid).toBe(true);
    });
  });

  describe('accessToken without refreshToken', () => {
    it('should reject accessToken without refreshToken/tokenExpiresAt/authorizedAt', async () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
          accessToken: 'access_token_only'
          // Missing refreshToken, tokenExpiresAt, authorizedAt
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual'
        }
      };

      const result = await validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e =>
        e.includes('accessToken') &&
        (e.includes('refreshToken') || e.includes('tokenExpiresAt') || e.includes('authorizedAt'))
      )).toBe(true);
    });
  });
});
