#!/usr/bin/env node

/**
 * Main entry point for the Actual-Monzo CLI application
 */

import { main } from './commands/index.js';

// Execute the CLI
main().catch(error => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
