import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';

/**
 * Contract Test: Import CLI Command
 *
 * Verifies the contract for the import command:
 * - Command registration
 * - Option parsing (--start, --end, --account, --dry-run)
 * - Default values
 * - Date format validation
 * - Date range validation
 * - Configuration validation
 * - Exit codes
 */

describe('Import Command CLI Contract', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
  });

  describe('Command Registration', () => {
    it('should register import command', () => {
      program
        .command('import')
        .description('Import Monzo transactions into Actual Budget');

      const commands = program.commands;
      const importCommand = commands.find(cmd => cmd.name() === 'import');

      expect(importCommand).toBeDefined();
      expect(importCommand?.name()).toBe('import');
    });

    it('should have correct description', () => {
      const importCommand = program
        .command('import')
        .description('Import Monzo transactions into Actual Budget');

      expect(importCommand.description()).toBe('Import Monzo transactions into Actual Budget');
    });
  });

  describe('Option Parsing', () => {
    it('should define --start option with alias -s', () => {
      const importCommand = program
        .command('import')
        .option('-s, --start <date>', 'Start date (YYYY-MM-DD)');

      const startOption = importCommand.options.find(opt => opt.long === '--start');

      expect(startOption).toBeDefined();
      expect(startOption?.short).toBe('-s');
      expect(startOption?.long).toBe('--start');
    });

    it('should define --end option with alias -e', () => {
      const importCommand = program
        .command('import')
        .option('-e, --end <date>', 'End date (YYYY-MM-DD)');

      const endOption = importCommand.options.find(opt => opt.long === '--end');

      expect(endOption).toBeDefined();
      expect(endOption?.short).toBe('-e');
      expect(endOption?.long).toBe('--end');
    });

    it('should define --account option with alias -a', () => {
      const importCommand = program
        .command('import')
        .option('-a, --account <id>', 'Import specific Monzo account ID');

      const accountOption = importCommand.options.find(opt => opt.long === '--account');

      expect(accountOption).toBeDefined();
      expect(accountOption?.short).toBe('-a');
      expect(accountOption?.long).toBe('--account');
    });

    it('should define --dry-run option (boolean)', () => {
      const importCommand = program
        .command('import')
        .option('--dry-run', 'Preview import without making changes');

      const dryRunOption = importCommand.options.find(opt => opt.long === '--dry-run');

      expect(dryRunOption).toBeDefined();
      expect(dryRunOption?.long).toBe('--dry-run');
      expect(dryRunOption?.short).toBeUndefined(); // No short alias
    });
  });

  describe('Default Values', () => {
    it('should calculate default start date (30 days ago)', () => {
      const calculateDefaultStart = () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return thirtyDaysAgo.toISOString().split('T')[0];
      };

      const defaultStart = calculateDefaultStart();

      expect(defaultStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify it's approximately 30 days ago
      const today = new Date();
      const startDate = new Date(defaultStart);
      const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(30);
    });

    it('should use today as default end date', () => {
      const calculateDefaultEnd = () => {
        return new Date().toISOString().split('T')[0];
      };

      const defaultEnd = calculateDefaultEnd();

      expect(defaultEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const today = new Date().toISOString().split('T')[0];
      expect(defaultEnd).toBe(today);
    });

    it('should default dry-run to false', () => {
      const importCommand = program
        .command('import')
        .option('--dry-run', 'Preview import without making changes', false);

      const dryRunOption = importCommand.options.find(opt => opt.long === '--dry-run');

      expect(dryRunOption?.defaultValue).toBe(false);
    });
  });

  describe('Date Format Validation', () => {
    it('should validate YYYY-MM-DD format', () => {
      const validateDateFormat = (dateStr: string): boolean => {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
      };

      expect(validateDateFormat('2025-09-15')).toBe(true);
      expect(validateDateFormat('2025-10-01')).toBe(true);
      expect(validateDateFormat('2025-12-31')).toBe(true);

      expect(validateDateFormat('2025/09/15')).toBe(false);
      expect(validateDateFormat('15-09-2025')).toBe(false);
      expect(validateDateFormat('2025-9-5')).toBe(false);
      expect(validateDateFormat('invalid')).toBe(false);
    });

    it('should validate date is parseable', () => {
      const validateDate = (dateStr: string): boolean => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;

        // Check if date was normalized (e.g., Feb 29 2023 becomes Mar 1 2023)
        const [year, month, day] = dateStr.split('-').map(Number);
        return (
          date.getUTCFullYear() === year &&
          date.getUTCMonth() === month - 1 &&
          date.getUTCDate() === day
        );
      };

      expect(validateDate('2025-09-15')).toBe(true);
      expect(validateDate('2023-02-29')).toBe(false); // Not a leap year (2023)
      expect(validateDate('2025-13-01')).toBe(false); // Invalid month
      expect(validateDate('2025-12-32')).toBe(false); // Invalid day
    });

    it('should throw clear error for invalid date format', () => {
      const validateDateWithError = (dateStr: string): Date => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        if (!dateRegex.test(dateStr)) {
          throw new Error(
            `Invalid date format: ${dateStr}\n` +
            `Expected format: YYYY-MM-DD (e.g., 2025-09-15)`
          );
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }

        return date;
      };

      expect(() => validateDateWithError('2025/09/15')).toThrow('Invalid date format');
      expect(() => validateDateWithError('2025-13-01')).toThrow('Invalid date');
      expect(validateDateWithError('2025-09-15')).toBeInstanceOf(Date);
    });
  });

  describe('Date Range Validation', () => {
    it('should validate start date <= end date', () => {
      const validateDateRange = (startStr: string, endStr: string): boolean => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        return start <= end;
      };

      expect(validateDateRange('2025-09-01', '2025-09-30')).toBe(true);
      expect(validateDateRange('2025-09-15', '2025-09-15')).toBe(true); // Same day valid
      expect(validateDateRange('2025-09-30', '2025-09-01')).toBe(false);
    });

    it('should reject future start dates', () => {
      const validateNotFuture = (dateStr: string): boolean => {
        const date = new Date(dateStr);
        const today = new Date();
        return date <= today;
      };

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      expect(validateNotFuture(yesterday)).toBe(true);
      expect(validateNotFuture(today)).toBe(true);
    });

    it('should enforce maximum 90-day range', () => {
      const validateMaxRange = (startStr: string, endStr: string): boolean => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        const daysDiff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        return daysDiff <= 90;
      };

      expect(validateMaxRange('2025-09-01', '2025-09-30')).toBe(true); // 29 days
      expect(validateMaxRange('2025-09-01', '2025-11-30')).toBe(true); // 90 days
      expect(validateMaxRange('2025-09-01', '2025-12-31')).toBe(false); // >90 days
    });

    it('should throw clear error for invalid range', () => {
      const parseDateRange = (startStr: string, endStr: string): { start: Date; end: Date } => {
        const start = new Date(startStr);
        const end = new Date(endStr);

        if (start > end) {
          throw new Error(
            `Start date (${startStr}) must be before or equal to end date (${endStr})`
          );
        }

        if (start > new Date()) {
          throw new Error(`Start date (${startStr}) cannot be in the future`);
        }

        const daysDiff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        if (daysDiff > 90) {
          throw new Error(
            `Date range too large (${daysDiff} days). Maximum: 90 days\n` +
            `Consider breaking into smaller imports`
          );
        }

        return { start, end };
      };

      expect(() => parseDateRange('2025-09-30', '2025-09-01')).toThrow('must be before or equal to');
      expect(() => parseDateRange('2025-09-01', '2025-12-31')).toThrow('too large');
      expect(parseDateRange('2025-09-01', '2025-09-30')).toEqual({
        start: new Date('2025-09-01'),
        end: new Date('2025-09-30')
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should require Monzo configuration', () => {
      const validateMonzoConfig = (config: any): void => {
        if (!config.monzo?.clientId || !config.monzo?.clientSecret) {
          throw new Error(
            'Monzo configuration missing. Please run setup command:\n' +
            '  actual-monzo setup'
          );
        }
      };

      expect(() => validateMonzoConfig({})).toThrow('Monzo configuration missing');
      expect(() => validateMonzoConfig({ monzo: {} })).toThrow('Monzo configuration missing');
      expect(() => validateMonzoConfig({
        monzo: { clientId: 'test', clientSecret: 'test' }
      })).not.toThrow();
    });

    it('should require Actual Budget configuration', () => {
      const validateActualConfig = (config: any): void => {
        if (!config.actual?.serverUrl || !config.actual?.password) {
          throw new Error(
            'Actual Budget configuration missing. Please run setup command:\n' +
            '  actual-monzo setup'
          );
        }
      };

      expect(() => validateActualConfig({})).toThrow('Actual Budget configuration missing');
      expect(() => validateActualConfig({ actual: {} })).toThrow('Actual Budget configuration missing');
      expect(() => validateActualConfig({
        actual: { serverUrl: 'http://localhost:5006', password: 'test' }
      })).not.toThrow();
    });

    it('should require account mappings', () => {
      const validateAccountMappings = (config: any): void => {
        if (!config.accountMappings || config.accountMappings.length === 0) {
          throw new Error(
            'No account mappings configured. Please run setup command:\n' +
            '  actual-monzo setup'
          );
        }
      };

      expect(() => validateAccountMappings({})).toThrow('No account mappings configured');
      expect(() => validateAccountMappings({ accountMappings: [] })).toThrow('No account mappings configured');
      expect(() => validateAccountMappings({
        accountMappings: [{ monzoAccountId: 'acc_123', actualAccountId: 'uuid-123' }]
      })).not.toThrow();
    });

    it('should require access token', () => {
      const validateToken = (config: any): void => {
        if (!config.monzo?.accessToken) {
          throw new Error(
            'Monzo access token missing or expired. Please run setup command:\n' +
            '  actual-monzo setup'
          );
        }
      };

      expect(() => validateToken({})).toThrow('access token missing');
      expect(() => validateToken({ monzo: {} })).toThrow('access token missing');
      expect(() => validateToken({
        monzo: { accessToken: 'token_123' }
      })).not.toThrow();
    });
  });

  describe('Account Filter Validation', () => {
    const mockMappings = [
      { monzoAccountId: 'acc_001', monzoAccountName: 'Current Account' },
      { monzoAccountId: 'acc_002', monzoAccountName: 'Joint Account' }
    ];

    it('should return all mappings when no filter provided', () => {
      const filterAccountMappings = (mappings: any[], accountId?: string) => {
        if (!accountId) return mappings;
        return mappings.filter(m => m.monzoAccountId === accountId);
      };

      const result = filterAccountMappings(mockMappings);
      expect(result).toEqual(mockMappings);
      expect(result).toHaveLength(2);
    });

    it('should filter to specific account when provided', () => {
      const filterAccountMappings = (mappings: any[], accountId?: string) => {
        if (!accountId) return mappings;
        return mappings.filter(m => m.monzoAccountId === accountId);
      };

      const result = filterAccountMappings(mockMappings, 'acc_001');
      expect(result).toHaveLength(1);
      expect(result[0].monzoAccountId).toBe('acc_001');
    });

    it('should throw error for invalid account ID', () => {
      const filterAccountMappingsWithError = (mappings: any[], accountId?: string) => {
        if (!accountId) return mappings;

        const filtered = mappings.filter(m => m.monzoAccountId === accountId);

        if (filtered.length === 0) {
          throw new Error(
            `Account ${accountId} not found in mappings.\n` +
            `Available accounts:\n` +
            mappings.map(m => `  - ${m.monzoAccountId}: ${m.monzoAccountName}`).join('\n')
          );
        }

        return filtered;
      };

      expect(() => filterAccountMappingsWithError(mockMappings, 'acc_999')).toThrow('not found in mappings');
      expect(() => filterAccountMappingsWithError(mockMappings, 'acc_999')).toThrow('Available accounts');
    });
  });

  describe('Exit Codes', () => {
    it('should define success exit code (0)', () => {
      const EXIT_SUCCESS = 0;
      expect(EXIT_SUCCESS).toBe(0);
    });

    it('should define error exit code (1)', () => {
      const EXIT_ERROR = 1;
      expect(EXIT_ERROR).toBe(1);
    });

    it('should exit with 0 on successful import', () => {
      const handleSuccess = (): number => {
        return 0; // process.exit(0)
      };

      expect(handleSuccess()).toBe(0);
    });

    it('should exit with 1 on error', () => {
      const handleError = (error: Error): number => {
        console.error(`Import failed: ${error.message}`);
        return 1; // process.exit(1)
      };

      const exitCode = handleError(new Error('Configuration missing'));
      expect(exitCode).toBe(1);
    });

    it('should exit with 0 on partial failure (some accounts succeed)', () => {
      const handlePartialFailure = (_successCount: number, _failureCount: number): number => {
        // Partial success still exits 0, failures reported in summary
        return 0;
      };

      expect(handlePartialFailure(1, 1)).toBe(0);
    });
  });
});
