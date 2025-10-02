/**
 * Date utility functions for transaction import
 */

import type { DateRange } from '../types/import.js';

/**
 * Format ISO timestamp to YYYY-MM-DD format
 * @param isoTimestamp ISO 8601 timestamp (e.g., "2025-09-15T14:30:00.000Z")
 * @returns Date string in YYYY-MM-DD format (e.g., "2025-09-15")
 */
export function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toISOString().split('T')[0];
}

/**
 * Validate date string format and parseability
 * @param dateStr Date string to validate (expected YYYY-MM-DD)
 * @returns Parsed Date object
 * @throws Error if format is invalid or date cannot be parsed
 */
export function validateDateString(dateStr: string): Date {
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

  // Check if date was normalized (e.g., Feb 29 2023 becomes Mar 1 2023)
  const [year, month, day] = dateStr.split('-').map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${dateStr} (does not exist in calendar)`);
  }

  return date;
}

/**
 * Calculate default date range for import (last 30 days)
 * @returns DateRange with start = 30 days ago, end = today
 */
export function calculateDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  return { start, end };
}

/**
 * Parse and validate date range from string inputs
 * @param startStr Start date string (YYYY-MM-DD)
 * @param endStr End date string (YYYY-MM-DD)
 * @returns DateRange object with validated dates
 * @throws Error if dates are invalid or range is invalid
 */
export function parseDateRange(startStr: string, endStr: string): DateRange {
  const start = validateDateString(startStr);
  const end = validateDateString(endStr);

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
}
