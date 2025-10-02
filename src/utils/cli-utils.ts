import chalk from 'chalk';
import ora, { type Ora } from 'ora';

/**
 * Progress tracking interface for long-running operations
 */
export interface ProgressTracker {
  spinner: Ora;
  current: number;
  total: number;
  startTime: Date;
  updateProgress(message?: string): void;
  updateStep(step: number, message?: string): void;
  succeed(message?: string): void;
  fail(message?: string): void;
  warn(message?: string): void;
  info(message?: string): void;
}

/**
 * Creates a new progress tracker with spinner
 */
export function createProgressTracker(
  total: number,
  initialMessage = 'Starting...'
): ProgressTracker {
  const spinner = ora(initialMessage).start();
  const startTime = new Date();

  return {
    spinner,
    current: 0,
    total,
    startTime,

    updateProgress(message?: string) {
      if (message) {
        this.spinner.text = `${message} (${this.current}/${this.total})`;
      }
    },

    updateStep(step: number, message?: string) {
      this.current = step;
      const text = message || `Step ${step} of ${total}`;
      this.spinner.text = `${text} (${step}/${total})`;
    },

    succeed(message?: string) {
      const elapsed = Date.now() - this.startTime.getTime();
      const finalMessage = message || `Completed ${this.total} steps in ${formatDuration(elapsed)}`;
      this.spinner.succeed(finalMessage);
    },

    fail(message?: string) {
      const elapsed = Date.now() - this.startTime.getTime();
      const finalMessage = message || `Failed after ${formatDuration(elapsed)} (step ${this.current}/${this.total})`;
      this.spinner.fail(finalMessage);
    },

    warn(message?: string) {
      this.spinner.warn(message || 'Warning occurred');
    },

    info(message?: string) {
      this.spinner.info(message || 'Information');
    }
  };
}

/**
 * Formats duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Logging utilities with consistent styling
 */
export const logSuccess = (message: string): void => {
  console.log(chalk.green('✓'), message);
};

export const logError = (message: string): void => {
  console.log(chalk.red('✗'), message);
};

export const logWarning = (message: string): void => {
  console.log(chalk.yellow('⚠'), message);
};

export const logInfo = (message: string): void => {
  console.log(chalk.blue('ℹ'), message);
};

export const logProgress = (message: string): void => {
  console.log(chalk.cyan('→'), message);
};

export const logVerbose = (message: string, verbose = false): void => {
  if (verbose) {
    console.log(chalk.dim('  '), chalk.dim(message));
  }
};

/**
 * Prompts user for confirmation with styled text
 */
export async function confirmAction(
  message: string,
  defaultValue = false
): Promise<boolean> {
  const { default: inquirer } = await import('inquirer');

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.cyan(message),
      default: defaultValue
    }
  ]);

  return answer.confirmed;
}

/**
 * Prompts user for text input with validation
 */
export async function promptForInput(
  message: string,
  validate?: (input: string) => boolean | string,
  defaultValue?: string
): Promise<string> {
  const { default: inquirer } = await import('inquirer');

  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: chalk.cyan(message),
      default: defaultValue,
      validate: validate || ((input: string) => input.trim().length > 0 || 'Input cannot be empty')
    }
  ]);

  return answer.value;
}

/**
 * Prompts user to select from a list of options
 */
export async function promptForSelection<T extends string>(
  message: string,
  choices: { name: string; value: T }[],
  defaultValue?: T
): Promise<T> {
  const { default: inquirer } = await import('inquirer');

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message: chalk.cyan(message),
      choices,
      default: defaultValue
    }
  ]);

  return answer.selection;
}

/**
 * Displays a formatted table of key-value pairs
 */
export function displayTable(data: Record<string, string | number | boolean>): void {
  const maxKeyLength = Math.max(...Object.keys(data).map(key => key.length));

  Object.entries(data).forEach(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLength);
    const formattedValue = typeof value === 'boolean'
      ? (value ? chalk.green('✓ Yes') : chalk.red('✗ No'))
      : chalk.white(String(value));

    console.log(`  ${chalk.cyan(paddedKey)} : ${formattedValue}`);
  });
}

/**
 * Displays a list with consistent formatting
 */
export function displayList(title: string, items: string[], symbol = '•'): void {
  console.log(chalk.bold(title));
  items.forEach(item => {
    console.log(`  ${chalk.dim(symbol)} ${item}`);
  });
}

/**
 * Creates a visual separator line
 */
export function logSeparator(char = '─', width = 50): void {
  console.log(chalk.dim(char.repeat(width)));
}

/**
 * Suppress all console output during callback execution
 */
export async function suppressConsole<T>(
  callback: () => T | Promise<T>
): Promise<T> {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalStderrWrite = process.stderr.write;

  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  // Also suppress direct stderr writes (Actual Budget API uses this)
  process.stderr.write = (() => true) as any;

  try {
    return await callback();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    process.stderr.write = originalStderrWrite;
  }
}

/**
 * Groups related log messages with indentation
 */
export function withIndentation<T>(
  callback: () => T | Promise<T>,
  indent = '  '
): T | Promise<T> {
  const originalLog = console.log;

  console.log = (...args) => {
    originalLog(indent + args.join(' '));
  };

  try {
    const result = callback();

    if (result instanceof Promise) {
      return result.finally(() => {
        console.log = originalLog;
      });
    } else {
      console.log = originalLog;
      return result;
    }
  } catch (error) {
    console.log = originalLog;
    throw error;
  }
}

/**
 * Handles graceful shutdown of CLI operations
 */
export function setupGracefulShutdown(cleanup?: () => void | Promise<void>): void {
  const handleShutdown = async (signal: string) => {
    console.log(chalk.yellow(`\nReceived ${signal}, shutting down gracefully...`));

    if (cleanup) {
      try {
        await cleanup();
        logSuccess('Cleanup completed');
      } catch (error) {
        logError(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

/**
 * Validates command line arguments
 */
export function validateRequiredArgs(
  args: Record<string, unknown>,
  required: string[]
): { valid: boolean; missing: string[] } {
  const missing = required.filter(key => {
    const value = args[key];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Displays command help with consistent formatting
 */
export function displayCommandHelp(
  command: string,
  description: string,
  usage: string,
  options: { flag: string; description: string }[],
  examples: string[]
): void {
  console.log(chalk.bold.cyan(`\n${command}`));
  console.log(chalk.dim(description));

  console.log(chalk.bold('\nUsage:'));
  console.log(`  ${usage}`);

  if (options.length > 0) {
    console.log(chalk.bold('\nOptions:'));
    const maxFlagLength = Math.max(...options.map(opt => opt.flag.length));

    options.forEach(option => {
      const paddedFlag = option.flag.padEnd(maxFlagLength);
      console.log(`  ${chalk.cyan(paddedFlag)}  ${option.description}`);
    });
  }

  if (examples.length > 0) {
    console.log(chalk.bold('\nExamples:'));
    examples.forEach(example => {
      console.log(`  ${chalk.dim('$')} ${example}`);
    });
  }

  console.log();
}

/**
 * Creates a loading animation for async operations
 */
export async function withLoadingAnimation<T>(
  operation: () => Promise<T>,
  message = 'Processing...'
): Promise<T> {
  const spinner = ora(message).start();

  try {
    const result = await operation();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Measures and logs execution time for operations
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    if (operationName) {
      logInfo(`${operationName} completed in ${formatDuration(duration)}`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (operationName) {
      logError(`${operationName} failed after ${formatDuration(duration)}`);
    }

    throw error;
  }
}