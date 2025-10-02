/**
 * Configuration type definitions for Actual Monzo setup
 * Defines structure for Monzo OAuth credentials and Actual Budget server configuration
 */

import type { AccountMapping } from './import.js';

export interface MonzoConfiguration {
  /** OAuth client ID from Monzo developer portal */
  clientId: string;
  /** OAuth client secret (stored plain text per spec) */
  clientSecret: string;
  /** OAuth access token (present after successful auth) */
  accessToken?: string;
  /** OAuth refresh token (present after successful auth) */
  refreshToken?: string;
  /** Access token expiration timestamp (ISO 8601) */
  tokenExpiresAt?: string;
  /** When OAuth flow completed (ISO 8601) */
  authorizedAt?: string;
}

export interface ActualBudgetConfiguration {
  /** Actual Budget server URL (e.g., http://localhost:5006) */
  serverUrl: string;
  /** Server password (plain text per spec) */
  password: string;
  /** Local path for budget data cache */
  dataDirectory: string;
  /** When connection was last validated (ISO 8601) */
  validatedAt?: string;
}

export enum SetupPhase {
  MONZO_CREDENTIALS = 'monzo_credentials',
  MONZO_OAUTH = 'monzo_oauth',
  ACTUAL_CREDENTIALS = 'actual_credentials',
  ACTUAL_VALIDATION = 'actual_validation',
  COMPLETE = 'complete'
}

export interface SetupSession {
  monzoConfig: MonzoConfiguration;
  actualConfig: ActualBudgetConfiguration;
  currentPhase: SetupPhase;
  completedAt?: string;
  /** True if Monzo succeeded but Actual Budget failed */
  isPartialSetup: boolean;
}

export interface Config {
  /** Config schema version for future migrations */
  configVersion?: string;
  monzo: MonzoConfiguration;
  actualBudget: ActualBudgetConfiguration;
  /** Timestamp when full setup completed (ISO 8601) */
  setupCompletedAt?: string;
  /** Account mappings between Monzo and Actual Budget accounts */
  accountMappings?: AccountMapping[];
}
