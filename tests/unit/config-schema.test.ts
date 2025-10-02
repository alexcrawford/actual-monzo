/**
 * Unit Test: Config Schema Validation
 *
 * Tests Zod schema validation for configuration structure.
 */

import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../../src/utils/config-schema';

describe('Unit: Config Schema', () => {
  describe('Valid Complete Config', () => {
    it('should validate complete configuration', () => {
      const validConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'access_token_12345678901234567890',
          refreshToken: 'refresh_token_12345678901234567890',
          tokenExpiresAt: new Date().toISOString(),
          authorizedAt: new Date().toISOString(),
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test_password',
          dataDirectory: '/tmp/actual',
        },
        setupCompletedAt: new Date().toISOString(),
      };

      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should accept HTTPS URLs for Actual Budget server', () => {
      const config = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
        },
        actualBudget: {
          serverUrl: 'https://budget.example.com',
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Valid Partial Config', () => {
    it('should validate config with only Monzo credentials (no tokens)', () => {
      const partialConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test_password',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(partialConfig);
      expect(result.success).toBe(true);
    });

    it('should validate config with Monzo tokens but no Actual Budget validation', () => {
      const partialConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'access_token_12345678901234567890',
          refreshToken: 'refresh_token_12345678901234567890',
          tokenExpiresAt: new Date().toISOString(),
          authorizedAt: new Date().toISOString(),
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test_password',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(partialConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actualBudget.validatedAt).toBeUndefined();
      }
    });
  });

  describe('Missing Required Fields', () => {
    it('should reject config missing monzo.clientId', () => {
      const invalidConfig = {
        monzo: {
          clientSecret: 'mnzconf_secret',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.issues.map(i => i.path.join('.'));
        expect(errors).toContain('monzo.clientId');
      }
    });

    it('should reject config missing actualBudget.serverUrl', () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
        },
        actualBudget: {
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.issues.map(i => i.path.join('.'));
        expect(errors).toContain('actualBudget.serverUrl');
      }
    });

    it('should reject config missing actualBudget.dataDirectory', () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.issues.map(i => i.path.join('.'));
        expect(errors).toContain('actualBudget.dataDirectory');
      }
    });
  });

  describe('Invalid URL Format', () => {
    it('should reject URL without protocol', () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
        },
        actualBudget: {
          serverUrl: 'localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasUrlError = result.error.issues.some(
          i =>
            i.path.includes('serverUrl') &&
            (i.message.includes('http://') ||
              i.message.includes('https://') ||
              i.message.includes('URL'))
        );
        expect(hasUrlError).toBe(true);
      }
    });

    it('should reject invalid URL scheme', () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
        },
        actualBudget: {
          serverUrl: 'ftp://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Path Validation', () => {
    it('should accept relative paths for dataDirectory', () => {
      const validConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'access_token_12345678901234567890',
          refreshToken: 'refresh_token_12345678901234567890',
          tokenExpiresAt: '2099-12-31T23:59:59.000Z',
          authorizedAt: '2025-10-01T18:00:00.000Z',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: './relative/path',
        },
      };

      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should accept absolute paths for dataDirectory', () => {
      const validConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/absolute/path/to/data',
        },
      };

      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('Token Field Dependencies', () => {
    it('should reject accessToken without refreshToken', () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
          accessToken: 'access_token_only',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should require tokenExpiresAt and authorizedAt when accessToken is present', () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          // Missing tokenExpiresAt and authorizedAt
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('ISO 8601 Date Validation', () => {
    it('should accept valid ISO 8601 dates', () => {
      const validConfig = {
        monzo: {
          clientId: 'oauth2client_00009abc123def456',
          clientSecret: 'mnzconf_secret_1234567890abcdef',
          accessToken: 'access_token_12345678901234567890',
          refreshToken: 'refresh_token_12345678901234567890',
          tokenExpiresAt: '2025-10-01T20:00:00.000Z',
          authorizedAt: '2025-10-01T19:00:00.000Z',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual',
          validatedAt: '2025-10-01T19:30:00.000Z',
        },
        setupCompletedAt: '2025-10-01T19:30:00.000Z',
      };

      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date formats', () => {
      const invalidConfig = {
        monzo: {
          clientId: 'oauth2client_test',
          clientSecret: 'mnzconf_secret',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          tokenExpiresAt: '2025-10-01 20:00:00', // Invalid format
          authorizedAt: '2025-10-01T19:00:00.000Z',
        },
        actualBudget: {
          serverUrl: 'http://localhost:5006',
          password: 'test',
          dataDirectory: '/tmp/actual',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });
});
