/**
 * Contract Test: Monzo OAuth Flow
 *
 * This test MUST FAIL before implementation with error:
 * "MonzoOAuthService is not defined"
 *
 * Tests validate the OAuth 2.0 authorization code flow with Monzo:
 * - Authorization URL generation
 * - Token exchange
 * - Error handling
 * - CSRF protection via state parameter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

// This import WILL FAIL until T021-T022 are implemented
import { MonzoOAuthService } from '../../src/services/monzo-oauth-service';

describe('Monzo OAuth Contract', () => {
  let service: MonzoOAuthService;
  const clientId = 'oauth2client_test123';
  const clientSecret = 'mnzconf_testsecret456';
  const redirectUri = 'http://localhost:3000/callback';

  beforeEach(() => {
    service = new MonzoOAuthService();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Authorization URL Generation', () => {
    it('should generate valid authorization URL with all required parameters', () => {
      const state = 'test-state-csrf-token';
      const authUrl = service.generateAuthorizationUrl(clientId, redirectUri, state);

      // Verify URL structure
      expect(authUrl).toContain('https://auth.monzo.com/');
      expect(authUrl).toContain(`client_id=${clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('response_type=code');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange valid authorization code for tokens', async () => {
      const authCode = 'auth_code_abc123';

      // Mock Monzo token endpoint
      nock('https://api.monzo.com')
        .post('/oauth2/token', {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: authCode,
          redirect_uri: redirectUri
        })
        .reply(200, {
          access_token: 'access_token_new',
          refresh_token: 'refresh_token_new',
          expires_in: 21600,
          token_type: 'Bearer'
        });

      const result = await service.exchangeAuthorizationCode({
        code: authCode,
        clientId,
        clientSecret,
        redirectUri
      });

      expect(result.access_token).toBe('access_token_new');
      expect(result.refresh_token).toBe('refresh_token_new');
      expect(result.expires_in).toBe(21600);
      expect(result.token_type).toBe('Bearer');
    });

    it('should handle invalid grant error', async () => {
      const invalidCode = 'invalid_code';

      nock('https://api.monzo.com')
        .post('/oauth2/token')
        .reply(400, {
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid or expired'
        });

      await expect(
        service.exchangeAuthorizationCode({
          code: invalidCode,
          clientId,
          clientSecret,
          redirectUri
        })
      ).rejects.toThrow('invalid_grant');
    });
  });

  describe('CSRF Protection', () => {
    it('should validate state parameter matches', () => {
      const expectedState = 'csrf-token-123';
      const receivedState = 'csrf-token-123';

      const isValid = service.validateState(expectedState, receivedState);
      expect(isValid).toBe(true);
    });

    it('should reject mismatched state parameter', () => {
      const expectedState = 'csrf-token-123';
      const receivedState = 'different-token';

      const isValid = service.validateState(expectedState, receivedState);
      expect(isValid).toBe(false);
    });
  });
});
