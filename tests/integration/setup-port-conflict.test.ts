/**
 * Integration Test: OAuth Port Conflict
 *
 * Tests OAuth callback server single-port (8234) behavior.
 * Since we use a fixed port to match Monzo's redirect URI requirement,
 * this test validates the server detects when the port is already in use.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { createOAuthCallbackServer } from '../../src/utils/oauth-server';
import http from 'http';

// Mock filesystem
vi.mock('fs/promises', () => ({
  ...vol.promises,
  default: vol.promises
}));

describe('Integration: OAuth Port Conflict', () => {
  let blockingServer: http.Server | null = null;

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up blocking server if exists
    if (blockingServer) {
      await new Promise<void>((resolve) => {
        blockingServer!.close(() => resolve());
      });
      blockingServer = null;
    }
  });

  it('should start on port 8234 by default', async () => {
    const server = await createOAuthCallbackServer();

    const port = await server.start();

    // Should start on fixed port 8234
    expect(port).toBe(8234);

    await server.shutdown();
  });

  it('should throw error when port 8234 is already in use', async () => {
    // Create a blocking server on port 8234
    blockingServer = http.createServer();
    await new Promise<void>((resolve) => {
      blockingServer!.listen(8234, 'localhost', () => resolve());
    });

    // Now try to create OAuth server - should fail immediately
    const server = await createOAuthCallbackServer();
    await expect(server.start()).rejects.toThrow('Port 8234 is already in use');

    // Cleanup
    await new Promise<void>((resolve) => {
      blockingServer!.close(() => resolve());
    });
    blockingServer = null;
  });
});
