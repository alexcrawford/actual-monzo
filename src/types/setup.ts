/**
 * Setup flow type definitions
 * Defines error handling and state management for two-phase setup
 */

export enum ConfigState {
  UNCONFIGURED = 'unconfigured',
  PARTIAL_MONZO_ONLY = 'partial_monzo_only',
  PARTIAL_ACTUAL_ONLY = 'partial_actual_only',
  COMPLETE = 'complete',
  EXPIRED_TOKENS = 'expired_tokens',
  MALFORMED = 'malformed'
}

export interface SetupError {
  /** Error code for programmatic handling */
  code: SetupErrorCode;
  /** Human-readable error message */
  message: string;
  /** Original error if available */
  originalError?: Error;
  /** Suggested recovery actions */
  recoveryOptions?: RecoveryOption[];
}

export enum SetupErrorCode {
  // OAuth errors
  OAUTH_FAILED = 'oauth_failed',
  OAUTH_DENIED = 'oauth_denied',
  INVALID_CLIENT = 'invalid_client',
  BROWSER_LAUNCH_FAILED = 'browser_launch_failed',
  PORT_CONFLICT = 'port_conflict',

  // Actual Budget errors
  SERVER_UNREACHABLE = 'server_unreachable',
  INVALID_CREDENTIALS = 'invalid_credentials',
  DIRECTORY_ERROR = 'directory_error',

  // Config errors
  CONFIGURATION_ERROR = 'configuration_error',
  VALIDATION_ERROR = 'validation_error',

  // User errors
  USER_CANCELLED = 'user_cancelled'
}

export interface SetupPhaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: SetupError;
}

export interface SetupSession {
  monzoConfig?: any;
  actualConfig?: any;
  state: ConfigState;
  monzoPhase?: SetupPhaseResult;
  actualPhase?: SetupPhaseResult;
  overallSuccess?: boolean;
  completedAt?: string;
}

export interface RecoveryOption {
  /** Label to display to user */
  label: string;
  /** Action identifier */
  action: RecoveryAction;
  /** Additional context for the action */
  context?: Record<string, unknown>;
}

export enum RecoveryAction {
  RETRY = 'retry',
  CHANGE_CREDENTIALS = 'change_credentials',
  CHANGE_URL = 'change_url',
  CHANGE_PASSWORD = 'change_password',
  CHANGE_DIRECTORY = 'change_directory',
  DELETE_CONFIG = 'delete_config',
  EXIT = 'exit'
}

export interface ValidationResult {
  /** Did validation pass? */
  valid: boolean;
  /** Parsed config if valid */
  config?: unknown;
  /** Validation errors if invalid */
  errors?: string[];
  /** Current config state */
  state?: ConfigState;
}
