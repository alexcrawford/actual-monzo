/**
 * Unit Test: OAuth Server Environment Variable
 *
 * Tests that the OAuth callback server respects OAUTH_CALLBACK_PORT environment variable.
 * This allows users to configure the port to match their Monzo OAuth redirect URI.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createOAuthCallbackServer } from '../../src/utils/oauth-server';

describe('Unit: OAuth Server Environment Variable', () => {
  const originalEnv = process.env.OAUTH_CALLBACK_PORT;
  let servers: Array<{ shutdown: () => Promise<void> }> = [];

  afterEach(async () => {
    // Shutdown all servers
    for (const server of servers) {
      await server.shutdown();
    }
    servers = [];

    // Restore original env var
    if (originalEnv !== undefined) {
      process.env.OAUTH_CALLBACK_PORT = originalEnv;
    } else {
      delete process.env.OAUTH_CALLBACK_PORT;
    }

    // Small delay to ensure ports are freed
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it('should use default port 8234 when OAUTH_CALLBACK_PORT is not set', async () => {
    delete process.env.OAUTH_CALLBACK_PORT;

    const server = await createOAuthCallbackServer();
    servers.push(server);
    const port = await server.start();

    expect(port).toBe(8234);
  });

  it('should use OAUTH_CALLBACK_PORT environment variable when set', async () => {
    process.env.OAUTH_CALLBACK_PORT = '9999';

    const server = await createOAuthCallbackServer();
    servers.push(server);
    const port = await server.start();

    expect(port).toBe(9999);
  });

  it('should handle invalid OAUTH_CALLBACK_PORT gracefully and fall back to default', async () => {
    process.env.OAUTH_CALLBACK_PORT = 'invalid';

    const server = await createOAuthCallbackServer();
    servers.push(server);
    const port = await server.start();

    // Should fall back to default 8234
    expect(port).toBe(8234);
  });

  it('should handle out-of-range port numbers and fall back to default', async () => {
    process.env.OAUTH_CALLBACK_PORT = '99999'; // Invalid port (max 65535)

    const server = await createOAuthCallbackServer();
    servers.push(server);
    const port = await server.start();

    // Should fall back to default 8234
    expect(port).toBe(8234);
  });
});
