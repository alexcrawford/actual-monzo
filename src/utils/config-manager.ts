/**
 * Configuration File Manager
 * Handles loading, saving, and validating config.yaml
 */

import { readFile, writeFile, access, chmod, mkdir } from 'fs/promises';
import { load, dump } from 'js-yaml';
import { ConfigSchema, type Config } from './config-schema.js';
import { ConfigState } from '../types/setup.js';
import type { ValidationResult } from '../types/setup.js';
// Import history moved to logs/ - no longer stored in config
import path from 'path';
import { homedir } from 'os';

const CONFIG_FILE_NAME = 'config.yaml';
const APP_DIR_NAME = '.actual-monzo';

/**
 * Gets the base directory for config and logs
 * Supports ACTUAL_MONZO_CONFIG_DIR environment variable for testing
 */
function getBaseDirectory(): string {
  // Allow override via environment variable (for testing)
  if (process.env.ACTUAL_MONZO_CONFIG_DIR) {
    return process.env.ACTUAL_MONZO_CONFIG_DIR;
  }
  // Default: ~/.actual-monzo/
  return path.join(homedir(), APP_DIR_NAME);
}

/**
 * Gets the global application directory (~/.actual-monzo/)
 * Creates the directory if it doesn't exist
 */
export async function getAppDirectory(): Promise<string> {
  const appDir = getBaseDirectory();
  await mkdir(appDir, { recursive: true });
  return appDir;
}

/**
 * Gets the absolute path to config.yaml in global config directory
 */
export function getConfigPath(): string {
  // Use global config directory: ~/.actual-monzo/config.yaml
  return path.join(getBaseDirectory(), CONFIG_FILE_NAME);
}

/**
 * Expands ~ to home directory in paths
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return filePath.replace('~', homedir());
  }
  return filePath;
}

/**
 * Checks if config file exists
 */
export async function configExists(): Promise<boolean> {
  try {
    await access(getConfigPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads and validates config from config.yaml
 */
export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  try {
    const fileContent = await readFile(configPath, 'utf-8');
    const rawConfig = load(fileContent);

    // Validate with Zod schema
    const validatedConfig = ConfigSchema.parse(rawConfig);
    return validatedConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Config file not found. Please run setup command first.');
    }
    throw error;
  }
}

/**
 * Saves config to config.yaml with validation
 */
export async function saveConfig(config: Config): Promise<void> {
  // Ensure app directory exists
  await getAppDirectory();

  const configPath = getConfigPath();

  // Validate before saving
  const validatedConfig = ConfigSchema.parse(config);

  // Convert to YAML
  const yamlContent = dump(validatedConfig, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  // Write to file
  await writeFile(configPath, yamlContent, 'utf-8');

  // Set file permissions to 600 (user read/write only)
  try {
    await chmod(configPath, 0o600);
  } catch {
    // Permissions may not be supported on all platforms (Windows)
    // Non-critical, continue
  }
}

/**
 * Validates config and determines current state
 */
export async function validateConfig(configOrYaml?: Config | string): Promise<ValidationResult> {
  try {
    let rawConfig: unknown;

    if (typeof configOrYaml === 'string') {
      // Parse YAML string
      try {
        rawConfig = load(configOrYaml);
      } catch (error) {
        return {
          valid: false,
          state: ConfigState.MALFORMED,
          errors: [`YAML parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        };
      }
    } else if (configOrYaml) {
      // Already an object
      rawConfig = configOrYaml;
    } else {
      // Load from file
      if (!(await configExists())) {
        return {
          valid: false,
          state: ConfigState.UNCONFIGURED,
        };
      }
      const fileContent = await readFile(getConfigPath(), 'utf-8');
      try {
        rawConfig = load(fileContent);
      } catch (error) {
        return {
          valid: false,
          state: ConfigState.MALFORMED,
          errors: [`YAML parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        };
      }
    }

    // Validate with Zod
    try {
      const config = ConfigSchema.parse(rawConfig);

      // Determine state
      const state = determineConfigState(config);

      return {
        valid: true,
        config,
        state,
      };
    } catch (error) {
      // Zod validation error
      // Check for ZodError using issues array
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> };
        const errors = zodError.issues.map(issue => {
          const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
          return `${path}${issue.message}`;
        });

        return {
          valid: false,
          state: ConfigState.MALFORMED,
          errors,
        };
      }

      return {
        valid: false,
        state: ConfigState.MALFORMED,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  } catch (error) {
    return {
      valid: false,
      state: ConfigState.MALFORMED,
      errors: [`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Determines the current config state based on presence of fields
 */
function determineConfigState(config: Config): ConfigState {
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

// Import history functions removed - now in src/utils/import-history.ts
