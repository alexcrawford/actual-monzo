import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir, access } from 'fs/promises';

/**
 * Configuration schema for the Actual-Monzo CLI
 */
export interface ActualMonzoConfig {
  monzo: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    webhookUrl?: string;
  };
  actual: {
    serverUrl?: string;
    syncId?: string;
    password?: string;
    budgetName?: string;
  };
  preferences: {
    defaultDateRange: number; // days
    autoSync: boolean;
    verbose: boolean;
    backupBeforeSync: boolean;
  };
  lastSync?: string; // ISO timestamp
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ActualMonzoConfig = {
  monzo: {},
  actual: {},
  preferences: {
    defaultDateRange: 30,
    autoSync: false,
    verbose: false,
    backupBeforeSync: true
  }
};

/**
 * Secure configuration manager for CLI settings
 */
export class ConfigManager {
  private readonly configPath: string;
  private config: ActualMonzoConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath ?? join(homedir(), '.config', 'actual-monzo', 'config.json');
  }

  /**
   * Loads configuration from disk
   */
  async load(): Promise<ActualMonzoConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      await access(this.configPath);
      const content = await readFile(this.configPath, 'utf8');
      const savedConfig = JSON.parse(content) as Partial<ActualMonzoConfig>;

      // Merge with defaults to ensure all properties exist
      this.config = this.mergeWithDefaults(savedConfig);
      return this.config;
    } catch (error) {
      // Config file doesn't exist or is corrupted, use defaults
      this.config = { ...DEFAULT_CONFIG };
      return this.config;
    }
  }

  /**
   * Saves configuration to disk
   */
  async save(config?: Partial<ActualMonzoConfig>): Promise<void> {
    if (config) {
      const currentConfig = await this.load();
      this.config = this.mergeWithDefaults({ ...currentConfig, ...config });
    }

    if (!this.config) {
      throw new Error('No configuration to save');
    }

    // Ensure config directory exists
    const configDir = join(this.configPath, '..');
    try {
      await mkdir(configDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  /**
   * Gets a specific configuration value
   */
  async get<K extends keyof ActualMonzoConfig>(key: K): Promise<ActualMonzoConfig[K]> {
    const config = await this.load();
    return config[key];
  }

  /**
   * Sets a specific configuration value
   */
  async set<K extends keyof ActualMonzoConfig>(
    key: K,
    value: ActualMonzoConfig[K]
  ): Promise<void> {
    const config = await this.load();
    config[key] = value;
    this.config = config;
    await this.save();
  }

  /**
   * Updates nested configuration values
   */
  async update(updates: Partial<ActualMonzoConfig>): Promise<void> {
    const config = await this.load();
    this.config = this.mergeWithDefaults({ ...config, ...updates });
    await this.save();
  }

  /**
   * Clears all configuration
   */
  async clear(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save();
  }

  /**
   * Validates configuration completeness
   */
  async validateSetup(): Promise<{
    isComplete: boolean;
    missing: string[];
    warnings: string[];
  }> {
    const config = await this.load();
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required Monzo configuration
    if (!config.monzo.clientId) missing.push('monzo.clientId');
    if (!config.monzo.clientSecret) missing.push('monzo.clientSecret');

    // Check required Actual configuration
    if (!config.actual.serverUrl) missing.push('actual.serverUrl');
    if (!config.actual.syncId) missing.push('actual.syncId');

    // Check for warnings
    if (!config.monzo.accessToken) {
      warnings.push('No Monzo access token - authentication required');
    }
    if (!config.actual.password) {
      warnings.push('No Actual Budget password - may be required for sync');
    }

    return {
      isComplete: missing.length === 0,
      missing,
      warnings
    };
  }

  /**
   * Gets the configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Checks if configuration file exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Backs up current configuration
   */
  async backup(backupPath?: string): Promise<string> {
    const config = await this.load();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = this.configPath.replace('.json', `-backup-${timestamp}.json`);
    const targetPath = backupPath ?? defaultBackupPath;

    await writeFile(targetPath, JSON.stringify(config, null, 2), 'utf8');
    return targetPath;
  }

  /**
   * Restores configuration from backup
   */
  async restore(backupPath: string): Promise<void> {
    const content = await readFile(backupPath, 'utf8');
    const backupConfig = JSON.parse(content) as ActualMonzoConfig;

    this.config = this.mergeWithDefaults(backupConfig);
    await this.save();
  }

  /**
   * Merges partial config with defaults
   */
  private mergeWithDefaults(partial: Partial<ActualMonzoConfig>): ActualMonzoConfig {
    return {
      monzo: { ...DEFAULT_CONFIG.monzo, ...partial.monzo },
      actual: { ...DEFAULT_CONFIG.actual, ...partial.actual },
      preferences: { ...DEFAULT_CONFIG.preferences, ...partial.preferences },
      lastSync: partial.lastSync
    };
  }

  /**
   * Exports configuration for debugging (with sensitive data masked)
   */
  async exportMasked(): Promise<string> {
    const config = await this.load();
    const masked = {
      ...config,
      monzo: {
        ...config.monzo,
        clientSecret: config.monzo.clientSecret ? '***MASKED***' : undefined,
        accessToken: config.monzo.accessToken ? '***MASKED***' : undefined,
        refreshToken: config.monzo.refreshToken ? '***MASKED***' : undefined
      },
      actual: {
        ...config.actual,
        password: config.actual.password ? '***MASKED***' : undefined
      }
    };

    return JSON.stringify(masked, null, 2);
  }
}

/**
 * Global configuration manager instance
 */
export const configManager = new ConfigManager();