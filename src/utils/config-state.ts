/**
 * Configuration State Determination
 * Determines the current state of setup configuration
 */

import type { Config } from './config-schema';
import { ConfigState } from '../types/setup';

/**
 * Determines config state based on which fields are populated
 * Used for routing setup flow (full setup vs partial recovery)
 */
export function determineConfigState(config: Config): ConfigState {
  const now = new Date();
  const hasMonzoTokens = !!config.monzo.accessToken;
  const hasActualValidation = !!config.actualBudget.validatedAt;

  // Check if Monzo tokens are expired
  const monzoExpired = config.monzo.tokenExpiresAt
    ? new Date(config.monzo.tokenExpiresAt) < now
    : false;

  if (monzoExpired) {
    return ConfigState.EXPIRED_TOKENS;
  }

  if (hasMonzoTokens && hasActualValidation && config.setupCompletedAt) {
    return ConfigState.COMPLETE;
  }

  if (hasMonzoTokens && !hasActualValidation) {
    return ConfigState.PARTIAL_MONZO_ONLY;
  }

  if (!hasMonzoTokens && hasActualValidation) {
    return ConfigState.PARTIAL_ACTUAL_ONLY;
  }

  return ConfigState.UNCONFIGURED;
}
