/**
 * OAuth-specific type definitions for Monzo authentication flow
 */

export interface OAuthCallbackSession {
  /** CSRF protection token */
  state: string;
  /** Redirect URI registered with Monzo */
  redirectUri: string;
  /** Port the callback server is listening on */
  serverPort: number;
  /** PKCE code verifier (for future enhancement) */
  codeVerifier?: string;
  /** When session was created (ISO 8601) */
  createdAt: string;
  /** When session expires (ISO 8601) */
  expiresAt: string;
}

export interface OAuthTokenResponse {
  /** OAuth access token */
  access_token: string;
  /** OAuth refresh token */
  refresh_token: string;
  /** Token lifetime in seconds (typically 21600 = 6 hours) */
  expires_in: number;
  /** Token type (typically "Bearer") */
  token_type: string;
}

export interface OAuthAuthorizationParams {
  /** Monzo OAuth client ID */
  client_id: string;
  /** Redirect URI for callback */
  redirect_uri: string;
  /** OAuth response type (always "code" for authorization code flow) */
  response_type: string;
  /** CSRF protection token */
  state: string;
}

export interface OAuthErrorResponse {
  /** Error code (e.g., "access_denied", "invalid_grant") */
  error: string;
  /** Human-readable error description */
  error_description?: string;
}

export interface WhoAmIResponse {
  /** Is user currently authenticated? */
  authenticated: boolean;
  /** User ID from Monzo */
  user_id?: string;
  /** Client ID that authorized the request */
  client_id?: string;
}
