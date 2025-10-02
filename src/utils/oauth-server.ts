/**
 * OAuth Callback Server
 * Temporary HTTP server for receiving OAuth authorization callbacks
 */

import http from 'http';
import { URL } from 'url';

export interface OAuthCallbackResult {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface OAuthServer {
  start: () => Promise<number>;
  waitForCallback: () => Promise<OAuthCallbackResult>;
  shutdown: () => Promise<void>;
}

/**
 * Creates a temporary OAuth callback server
 * Listens on localhost only on port 8234
 * Port 8234 chosen to avoid conflicts with common dev servers (3000-4000)
 */
export async function createOAuthCallbackServer(
  startPort: number = 8234,
  maxPort: number = 8234
): Promise<OAuthServer> {
  let server: http.Server | null = null;
  let actualPort: number = startPort;
  let callbackResolver: ((result: OAuthCallbackResult) => void) | null = null;

  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    // Only handle /callback route
    if (!req.url?.startsWith('/callback')) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>404 Not Found</h1></body></html>');
      return;
    }

    // Parse query parameters
    const url = new URL(req.url, `http://localhost:${actualPort}`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Send success page to browser
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (error) {
      res.end(`
        <html>
          <head>
            <meta charset="utf-8">
            <title>Authorization Failed</title>
          </head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #d32f2f;">❌ Authorization Failed</h1>
            <p>Error: ${error}</p>
            ${errorDescription ? `<p>${errorDescription}</p>` : ''}
            <p>You can close this window and return to the terminal.</p>
          </body>
        </html>
      `);
    } else {
      res.end(`
        <html>
          <head>
            <meta charset="utf-8">
            <title>Authorization Successful</title>
          </head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #4caf50;">✓ Authorization Successful</h1>
            <p>You can close this window and return to the terminal.</p>
          </body>
        </html>
      `);
    }

    // Resolve with callback result
    if (callbackResolver) {
      callbackResolver({
        code: code || undefined,
        state: state || undefined,
        error: error || undefined,
        errorDescription: errorDescription || undefined
      });
      callbackResolver = null;
    }
  };

  const start = async (): Promise<number> => {
    // Try ports from startPort to maxPort
    for (let port = startPort; port <= maxPort; port++) {
      try {
        await new Promise<void>((resolve, reject) => {
          server = http.createServer(requestHandler);

          server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              reject(new Error(`Port ${port} is already in use`));
            } else {
              reject(err);
            }
          });

          server.listen(port, 'localhost', () => {
            actualPort = port;
            resolve();
          });
        });

        return actualPort;
      } catch (error) {
        if (port === maxPort) {
          throw new Error(
            `Port ${startPort} is already in use. ` +
            `Please free up the port or check if another OAuth flow is running.\n` +
            `Run: lsof -i :${startPort} to see what's using the port.`
          );
        }
        // Try next port
        continue;
      }
    }

    throw new Error(`Failed to start server on any port ${startPort}-${maxPort}`);
  };

  const waitForCallback = (): Promise<OAuthCallbackResult> => {
    return new Promise((resolve) => {
      callbackResolver = resolve;
    });
  };

  const shutdown = async (): Promise<void> => {
    if (server) {
      return new Promise((resolve, reject) => {
        server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };

  return { start, waitForCallback, shutdown };
}
