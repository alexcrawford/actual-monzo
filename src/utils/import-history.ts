/**
 * Import History Manager
 * Records imported transactions in a single append-only log file
 *
 * Note: Duplicate detection is handled by Actual Budget via imported_id field.
 * These logs are purely for audit/record-keeping purposes.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Import log file in logs directory
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'import.log');

/**
 * Ensure logs directory exists
 */
async function ensureLogsDirectory(): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    // Ignore if already exists
  }
}

/**
 * Record an import session to the log file
 */
export async function recordImportSession(transactionCount: number): Promise<void> {
  await ensureLogsDirectory();

  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} - Imported ${transactionCount} transaction(s)\n`;

  await fs.appendFile(LOG_FILE, logLine, 'utf-8');
}
