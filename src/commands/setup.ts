/**
 * Setup Command
 * CLI command for interactive two-phase setup
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { SetupService } from '../services/setup-service';
import { validateConfig, configExists } from '../utils/config-manager';
import { ConfigState } from '../types/setup';

export function createSetupCommand(): Command {
  const command = new Command('setup');

  command
    .description('Configure Monzo and Actual Budget integration')
    .action(async () => {
      try {
        await runSetup();
      } catch (error) {
        console.error(chalk.red('\n❌ Setup failed'));
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });

  return command;
}

async function runSetup() {
  console.log(chalk.bold('\n🚀 actual-monzo Setup\n'));
  console.log(chalk.dim('This will configure your Monzo and Actual Budget integration.\n'));

  // Check existing configuration
  const existingState = await checkExistingConfig();

  if (existingState === ConfigState.COMPLETE) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Configuration already exists and is complete. Overwrite?',
      default: false
    }]);

    if (!overwrite) {
      console.log(chalk.yellow('\n✓ Keeping existing configuration'));
      return;
    }
  }

  if (existingState === ConfigState.PARTIAL_MONZO_ONLY) {
    const { resume } = await inquirer.prompt([{
      type: 'confirm',
      name: 'resume',
      message: 'Monzo configuration exists. Resume setup from Actual Budget phase?',
      default: true
    }]);

    if (resume) {
      await runActualBudgetPhase();
      return;
    }
  }

  // Run complete setup flow
  await runCompleteSetup();
}

async function checkExistingConfig(): Promise<ConfigState> {
  if (!(await configExists())) {
    return ConfigState.UNCONFIGURED;
  }

  const result = await validateConfig();
  return result.state ?? ConfigState.MALFORMED;
}

async function runCompleteSetup() {
  const service = new SetupService();

  // Collect Monzo credentials
  console.log(chalk.bold('\n📱 Phase 1: Monzo Configuration\n'));

  const monzoAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'clientId',
      message: 'Monzo Client ID (starts with oauth2client_):',
      validate: (input: string) => {
        if (!input.startsWith('oauth2client_')) {
          return 'Client ID must start with oauth2client_';
        }
        if (input.length < 20) {
          return 'Client ID appears too short';
        }
        return true;
      }
    },
    {
      type: 'password',
      name: 'clientSecret',
      message: 'Monzo Client Secret (starts with mnzconf or mnzpub):',
      mask: '*',
      validate: (input: string) => {
        if (!input.match(/^mnz(conf|pub)/)) {
          return 'Client Secret must start with mnzconf or mnzpub';
        }
        if (input.length < 20) {
          return 'Client Secret appears too short';
        }
        return true;
      }
    }
  ]);

  // Collect Actual Budget credentials
  console.log(chalk.bold('\n💰 Phase 2: Actual Budget Configuration\n'));

  const actualAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serverUrl',
      message: 'Actual Budget Server URL:',
      default: 'http://localhost:5006',
      validate: (input: string) => {
        if (!input.match(/^https?:\/\//)) {
          return 'Server URL must start with http:// or https://';
        }
        try {
          new URL(input);
          return true;
        } catch {
          return 'Invalid URL format';
        }
      }
    },
    {
      type: 'password',
      name: 'password',
      message: 'Actual Budget Server Password:',
      mask: '*',
      validate: (input: string) => input.length > 0 || 'Password cannot be empty'
    },
    {
      type: 'input',
      name: 'dataDirectory',
      message: 'Actual Budget Data Directory:',
      default: './data',
      validate: (input: string) => {
        if (!input.match(/^(~|\/|\.|[A-Za-z]:)/)) {
          return 'Data directory must be a valid path (absolute or relative)';
        }
        return true;
      }
    }
  ]);

  // Execute complete setup
  await service.runCompleteSetup(
    {
      clientId: monzoAnswers.clientId,
      clientSecret: monzoAnswers.clientSecret
    },
    {
      serverUrl: actualAnswers.serverUrl,
      password: actualAnswers.password,
      dataDirectory: actualAnswers.dataDirectory
    }
  );
}

async function runActualBudgetPhase() {
  const service = new SetupService();

  console.log(chalk.bold('\n💰 Actual Budget Configuration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serverUrl',
      message: 'Actual Budget Server URL:',
      default: 'http://localhost:5006',
      validate: (input: string) => {
        if (!input.match(/^https?:\/\//)) {
          return 'Server URL must start with http:// or https://';
        }
        try {
          new URL(input);
          return true;
        } catch {
          return 'Invalid URL format';
        }
      }
    },
    {
      type: 'password',
      name: 'password',
      message: 'Actual Budget Server Password:',
      mask: '*',
      validate: (input: string) => input.length > 0 || 'Password cannot be empty'
    },
    {
      type: 'input',
      name: 'dataDirectory',
      message: 'Actual Budget Data Directory:',
      default: './data',
      validate: (input: string) => {
        if (!input.match(/^(~|\/|\.|[A-Za-z]:)/)) {
          return 'Data directory must be a valid path (absolute or relative)';
        }
        return true;
      }
    }
  ]);

  await service.resumeSetup({
    serverUrl: answers.serverUrl,
    password: answers.password,
    dataDirectory: answers.dataDirectory
  });
}
