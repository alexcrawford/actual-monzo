/**
 * Unit Tests: Token Refresh
 * Tests for automatic Monzo access token refresh functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { MonzoApiClient } from '../../src/services/monzo-api-client';

describe('Unit: Token Refresh', () => {
  let monzoClient: MonzoApiClient;
  const MONZO_API_BASE = 'https://api.monzo.com';

  beforeEach(() => {
    monzoClient = new MonzoApiClient();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('MonzoApiClient.refreshAccessToken', () => {
    it('should exchange refresh token for new access token', async () => {
      const clientId = 'oauth2client_test123';
      const clientSecret = 'mnzconf_testsecret';
      const refreshToken = 'refresh_token_xyz';

      const mockResponse = {
        access_token: 'new_access_token_abc',
        refresh_token: 'new_refresh_token_xyz',
        expires_in: 108000, // 30 hours in seconds
        token_type: 'Bearer',
      };

      nock(MONZO_API_BASE)
        .post('/oauth2/token', (body) => {
          return (
            body.grant_type === 'refresh_token' &&
            body.client_id === clientId &&
            body.client_secret === clientSecret &&
            body.refresh_token === refreshToken
          );
        })
        .reply(200, mockResponse);

      const result = await monzoClient.refreshAccessToken({
        clientId,
        clientSecret,
        refreshToken,
      });

      expect(result.access_token).toBe('new_access_token_abc');
      expect(result.refresh_token).toBe('new_refresh_token_xyz');
      expect(result.expires_in).toBe(108000);
      expect(result.token_type).toBe('Bearer');
    });

    it('should handle invalid refresh token error', async () => {
      const clientId = 'oauth2client_test123';
      const clientSecret = 'mnzconf_testsecret';
      const refreshToken = 'invalid_refresh_token';

      nock(MONZO_API_BASE)
        .post('/oauth2/token')
        .reply(400, {
          error: 'invalid_grant',
          error_description: 'The refresh token is invalid or expired',
        });

      await expect(
        monzoClient.refreshAccessToken({
          clientId,
          clientSecret,
          refreshToken,
        })
      ).rejects.toThrow('invalid_grant');
    });

    it('should handle network errors during token refresh', async () => {
      const clientId = 'oauth2client_test123';
      const clientSecret = 'mnzconf_testsecret';
      const refreshToken = 'refresh_token_xyz';

      nock(MONZO_API_BASE).post('/oauth2/token').replyWithError('Network error');

      await expect(
        monzoClient.refreshAccessToken({
          clientId,
          clientSecret,
          refreshToken,
        })
      ).rejects.toThrow();
    });

    it('should handle unauthorized client credentials', async () => {
      const clientId = 'oauth2client_invalid';
      const clientSecret = 'mnzconf_invalid';
      const refreshToken = 'refresh_token_xyz';

      nock(MONZO_API_BASE).post('/oauth2/token').reply(401, {
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      });

      await expect(
        monzoClient.refreshAccessToken({
          clientId,
          clientSecret,
          refreshToken,
        })
      ).rejects.toThrow();
    });
  });

  describe('Token Expiry Detection', () => {
    it('should detect expired token based on tokenExpiresAt', () => {
      // Token expired 1 hour ago
      const expiredAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const isExpired = isTokenExpired(expiredAt);
      expect(isExpired).toBe(true);
    });

    it('should detect valid token that has not expired', () => {
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const isExpired = isTokenExpired(expiresAt);
      expect(isExpired).toBe(false);
    });

    it('should consider token expiring in less than 5 minutes as expired (buffer)', () => {
      // Token expires in 3 minutes
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      const isExpired = isTokenExpired(expiresAt);
      expect(isExpired).toBe(true);
    });

    it('should handle missing tokenExpiresAt as expired', () => {
      const isExpired = isTokenExpired(undefined);
      expect(isExpired).toBe(true);
    });
  });
});

/**
 * Helper function to check if token is expired
 * Includes 5-minute buffer for safety
 */
function isTokenExpired(tokenExpiresAt: string | undefined): boolean {
  if (!tokenExpiresAt) {
    return true;
  }

  const expiryTime = new Date(tokenExpiresAt).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  return expiryTime - now < bufferMs;
}
