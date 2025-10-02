/**
 * Import Service
 * Orchestrates transaction import from Monzo to Actual Budget
 */

import type {
  AccountMapping,
  DateRange,
  ImportSession,
  FailedAccountRecord,
  ActualTransaction
} from '../types/import.js';
import type { Config } from '../utils/config-schema.js';
import { MonzoApiClient } from './monzo-api-client.js';
import { transformMonzoToActual } from '../utils/transaction-transform.js';
import { recordImportSession } from '../utils/import-history.js';
import * as actualApi from '@actual-app/api';
import * as path from 'path';
import type { Ora } from 'ora';

export class ImportService {
  private monzoClient: MonzoApiClient;

  constructor() {
    this.monzoClient = new MonzoApiClient();
  }

  /**
   * Execute transaction import for all mapped accounts
   *
   * @param config Current configuration
   * @param mappings Account mappings to process
   * @param dateRange Date range for import
   * @param dryRun If true, don't actually import (preview only)
   * @param spinner Optional ora spinner for progress updates
   * @returns Completed import session with statistics
   */
  async executeImport(
    config: Config,
    mappings: AccountMapping[],
    dateRange: DateRange,
    dryRun: boolean,
    spinner?: Ora
  ): Promise<ImportSession> {
    const session: ImportSession = {
      startTime: new Date(),
      dateRange,
      accountsProcessed: mappings.length,
      successfulAccounts: [],
      failedAccounts: [],
      totalTransactions: 0,
      declinedFiltered: 0
    };


    // Initialize Actual Budget SDK if not dry run
    if (!dryRun) {
      try {
        // Resolve data directory path (expand ~ and relative paths)
        let dataDir = config.actualBudget.dataDirectory;
        if (dataDir.startsWith('~')) {
          dataDir = dataDir.replace('~', process.env.HOME || '');
        } else if (dataDir.startsWith('.')) {
          dataDir = path.resolve(process.cwd(), dataDir);
        }

        await actualApi.init({
          serverURL: config.actualBudget.serverUrl,
          password: config.actualBudget.password,
          dataDir: dataDir
        });

        // Get and download the budget file
        const budgets = await actualApi.getBudgets();
        if (!budgets || budgets.length === 0) {
          throw new Error('No budgets found on Actual Budget server');
        }

        // Use first budget's groupId
        const budgetId = budgets[0].groupId;
        await actualApi.downloadBudget(budgetId);

      } catch (error) {
        throw new Error(
          `Failed to initialize Actual Budget: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    try {
      // Process each account mapping
      for (const mapping of mappings) {
        try {
          if (spinner) {
            spinner.text = `Fetching transactions from ${mapping.monzoAccountName}...`;
          }

          // Fetch transactions from Monzo
          const since = dateRange.start.toISOString();
          const before = dateRange.end.toISOString();

          const monzoTransactions = await this.monzoClient.getTransactions(
            mapping.monzoAccountId,
            since,
            before,
            config.monzo.accessToken!
          );

          // Transform to Actual Budget format
          // Note: Actual Budget handles duplicate detection automatically via imported_id
          const actualTransactions: ActualTransaction[] = monzoTransactions.map(tx =>
            transformMonzoToActual(tx, mapping)
          );

          if (spinner) {
            const verb = dryRun ? 'Processing' : 'Importing';
            spinner.text = `${verb} ${mapping.monzoAccountName} (${actualTransactions.length} transactions)`;
          }

          // Import to Actual Budget (unless dry run)
          if (!dryRun && actualTransactions.length > 0) {
            const result = await actualApi.importTransactions(
              mapping.actualAccountId,
              actualTransactions
            );

            session.totalTransactions += result.added.length;
          } else if (dryRun) {
            session.totalTransactions += actualTransactions.length;
          }

          session.successfulAccounts.push(mapping.monzoAccountId);

        } catch (error) {
          // Record failure but continue with other accounts
          const failureRecord: FailedAccountRecord = {
            accountId: mapping.monzoAccountId,
            accountName: mapping.monzoAccountName,
            error: error instanceof Error ? error : new Error(String(error)),
            message: error instanceof Error ? error.message : String(error)
          };

          session.failedAccounts.push(failureRecord);
        }
      }

      // Save import session log (unless dry run)
      if (!dryRun) {
        await recordImportSession(session.totalTransactions);
      }

    } finally {
      // Always disconnect from Actual Budget
      if (!dryRun) {
        try {
          if (typeof actualApi.shutdown === 'function') {
            await actualApi.shutdown();
          }
        } catch (error) {
          // Non-critical error - ignore
        }
      }
    }

    return session;
  }
}
