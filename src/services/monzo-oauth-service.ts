/**
 * Monzo OAuth Service
 * Orchestrates OAuth 2.0 authorization code flow with Monzo
 */

import { randomUUID } from 'crypto';
import { createOAuthCallbackServer } from '../utils/oauth-server';
import { launchBrowser, formatClickableUrl } from '../utils/browser-utils';
import { MonzoApiClient } from './monzo-api-client';
import type { MonzoConfiguration } from '../types/config';
import chalk from 'chalk';
import ora from 'ora';

const MONZO_AUTH_URL = 'https://auth.monzo.com/';

export interface OAuthFlowParams {
  clientId: string;
  clientSecret: string;
}

export class MonzoOAuthService {
  private readonly apiClient: MonzoApiClient;

  constructor() {
    this.apiClient = new MonzoApiClient();
  }

  /**
   * Generates Monzo authorization URL
   */
  generateAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });

    return `${MONZO_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Validates state parameter for CSRF protection
   */
  validateState(expected: string, received: string): boolean {
    return expected === received;
  }

  /**
   * Exchanges authorization code for tokens (delegates to API client)
   */
  async exchangeAuthorizationCode(params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    return this.apiClient.exchangeAuthorizationCode(params);
  }

  /**
   * Validates access token by calling Monzo API
   */
  async validateAccessToken(accessToken: string): Promise<void> {
    await this.apiClient.whoami(accessToken);
  }

  /**
   * Starts complete OAuth flow with user interaction
   * Returns MonzoConfiguration with tokens
   */
  async startOAuthFlow(params: OAuthFlowParams): Promise<MonzoConfiguration> {
    const spinner = ora('Setting up OAuth authorization...').start();

    try {
      // Generate CSRF token
      const state = randomUUID();

      // Start callback server
      const server = await createOAuthCallbackServer();
      const port = await server.start();
      const redirectUri = `http://localhost:${port}/callback`;

      spinner.succeed(`OAuth callback server started on port ${port}`);

      // Generate authorization URL
      const authUrl = this.generateAuthorizationUrl(params.clientId, redirectUri, state);

      // Launch browser
      console.log(chalk.blue('\nOpening browser for Monzo authorization...'));
      const browserResult = await launchBrowser(authUrl);

      if (!browserResult.success) {
        console.log(chalk.yellow('\n⚠️  Could not open browser automatically'));
        console.log(chalk.yellow('Please open this URL in your browser:'));
        console.log(chalk.cyan(formatClickableUrl(authUrl)));
      }

      // Wait for callback
      spinner.start('Waiting for authorization (approve in Monzo app)...');
      const callback = await server.waitForCallback();

      // Clean up server
      await server.shutdown();

      // Handle OAuth errors
      if (callback.error) {
        spinner.fail('Authorization failed');
        throw new Error(
          `OAuth error: ${callback.error}${callback.errorDescription ? ' - ' + callback.errorDescription : ''}`
        );
      }

      // Validate state (CSRF protection)
      if (!callback.state || !this.validateState(state, callback.state)) {
        spinner.fail('Authorization failed');
        throw new Error('State parameter mismatch (possible CSRF attack)');
      }

      if (!callback.code) {
        spinner.fail('Authorization failed');
        throw new Error('No authorization code received');
      }

      // Exchange code for tokens
      spinner.text = 'Exchanging authorization code for tokens...';
      const tokenResponse = await this.apiClient.exchangeAuthorizationCode({
        code: callback.code,
        clientId: params.clientId,
        clientSecret: params.clientSecret,
        redirectUri,
      });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + tokenResponse.expires_in * 1000);

      spinner.stop();

      return {
        clientId: params.clientId,
        clientSecret: params.clientSecret,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiresAt: expiresAt.toISOString(),
        authorizedAt: now.toISOString(),
      };
    } catch (error) {
      spinner.stop();
      throw error;
    }
  }
}
