/**
 * Setup Command
 * CLI command for interactive two-phase setup
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { SetupService } from '../services/setup-service';
import { validateConfig, configExists, saveConfig, loadConfig } from '../utils/config-manager';
import { ConfigState } from '../types/setup';
import { runAccountMappingFlow } from './map-accounts.js';
import type { Config } from '../types/config';

export function createSetupCommand(): Command {
  const command = new Command('setup');

  command.description('Configure Monzo and Actual Budget integration').action(async () => {
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

async function promptForMonzoCredentials() {
  return inquirer.prompt([
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
      },
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
      },
    },
  ]);
}

async function promptForActualBudgetCredentials() {
  return inquirer.prompt([
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
      },
    },
    {
      type: 'password',
      name: 'password',
      message: 'Actual Budget Server Password:',
      mask: '*',
      validate: (input: string) => input.length > 0 || 'Password cannot be empty',
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
      },
    },
  ]);
}

async function runSetup() {
  console.log(chalk.bold('\n🚀 actual-monzo Setup\n'));
  console.log(chalk.dim('This will configure your Monzo and Actual Budget integration.\n'));

  // Check existing configuration
  const existingState = await checkExistingConfig();

  if (existingState === ConfigState.COMPLETE) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Configuration already exists and is complete. Overwrite?',
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\n✓ Keeping existing configuration'));
      return;
    }
  }

  if (existingState === ConfigState.PARTIAL_MONZO_ONLY) {
    const { resume } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'resume',
        message: 'Monzo configuration exists. Resume setup from Actual Budget phase?',
        default: true,
      },
    ]);

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
  const existingConfig = (await configExists()) ? await loadConfig() : null;

  console.log(chalk.bold('\n📱 Phase 1: Monzo Configuration\n'));

  let monzoConfig = null;

  if (existingConfig && (await service.hasMonzoConfig())) {
    const { monzoAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'monzoAction',
        message: 'Monzo configuration already exists. What would you like to do?',
        choices: [
          { name: 'Keep existing configuration', value: 'keep' },
          { name: 'Replace with new configuration', value: 'replace' },
          { name: 'Verify existing configuration', value: 'verify' },
        ],
      },
    ]);

    if (monzoAction === 'keep') {
      console.log(chalk.green('✓ Keeping existing Monzo configuration'));
      monzoConfig = existingConfig.monzo;
    } else if (monzoAction === 'verify') {
      const spinner = ora('Verifying Monzo configuration...').start();
      const verifyResult = await service.verifyMonzoConfig();

      if (verifyResult.success) {
        spinner.succeed('Monzo configuration verified successfully');
        monzoConfig = existingConfig.monzo;
      } else {
        spinner.fail(`Verification failed: ${verifyResult.error?.message}`);
        console.log(chalk.yellow('\nYou will need to replace the configuration.\n'));

        const monzoAnswers = await promptForMonzoCredentials();
        const result = await service.setupMonzo(monzoAnswers);
        if (result.success) {
          monzoConfig = result.data;
          console.log(chalk.green('✔ Monzo authorization successful!'));
        } else {
          console.error(chalk.red('\n❌ Monzo setup failed'));
          process.exit(1);
        }
      }
    } else if (monzoAction === 'replace') {
      const monzoAnswers = await promptForMonzoCredentials();
      const result = await service.setupMonzo(monzoAnswers);
      if (result.success) {
        monzoConfig = result.data;
        console.log(chalk.green('✔ Monzo authorization successful!'));
      } else {
        console.error(chalk.red('\n❌ Monzo setup failed'));
        process.exit(1);
      }
    }
  } else {
    const monzoAnswers = await promptForMonzoCredentials();
    const result = await service.setupMonzo(monzoAnswers);
    if (result.success) {
      monzoConfig = result.data;
      console.log(chalk.green('✔ Monzo authorization successful!'));
    } else {
      console.error(chalk.red('\n❌ Monzo setup failed'));
      process.exit(1);
    }
  }

  console.log(chalk.bold('\n💰 Phase 2: Actual Budget Configuration\n'));

  let actualConfig = null;

  if (existingConfig && (await service.hasActualBudgetConfig())) {
    const { actualAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'actualAction',
        message: 'Actual Budget configuration already exists. What would you like to do?',
        choices: [
          { name: 'Keep existing configuration', value: 'keep' },
          { name: 'Replace with new configuration', value: 'replace' },
          { name: 'Verify existing configuration', value: 'verify' },
        ],
      },
    ]);

    if (actualAction === 'keep') {
      console.log(chalk.green('✓ Keeping existing Actual Budget configuration'));
      actualConfig = existingConfig.actualBudget;
    } else if (actualAction === 'verify') {
      const spinner = ora('Verifying Actual Budget configuration...').start();
      const verifyResult = await service.verifyActualBudgetConfig();

      if (verifyResult.success) {
        spinner.succeed('Actual Budget configuration verified successfully');
        actualConfig = existingConfig.actualBudget;
      } else {
        spinner.fail(`Verification failed: ${verifyResult.error?.message}`);
        console.log(chalk.yellow('\nYou will need to replace the configuration.\n'));

        const actualAnswers = await promptForActualBudgetCredentials();
        const result = await service.setupActualBudget(actualAnswers);
        if (result.success) {
          actualConfig = result.data;
          console.log(chalk.green('✔ Actual Budget configuration validated!'));
        } else {
          console.error(chalk.red('\n❌ Actual Budget setup failed'));
          process.exit(1);
        }
      }
    } else if (actualAction === 'replace') {
      const actualAnswers = await promptForActualBudgetCredentials();
      const result = await service.setupActualBudget(actualAnswers);
      if (result.success) {
        actualConfig = result.data;
        console.log(chalk.green('✔ Actual Budget configuration validated!'));
      } else {
        console.error(chalk.red('\n❌ Actual Budget setup failed'));
        process.exit(1);
      }
    }
  } else {
    const actualAnswers = await promptForActualBudgetCredentials();
    const result = await service.setupActualBudget(actualAnswers);
    if (result.success) {
      actualConfig = result.data;
      console.log(chalk.green('✔ Actual Budget configuration validated!'));
    } else {
      console.error(chalk.red('\n❌ Actual Budget setup failed'));
      process.exit(1);
    }
  }

  const completeConfig: Config = {
    monzo: monzoConfig!,
    actualBudget: actualConfig!,
    setupCompletedAt: new Date().toISOString(),
  };

  await saveConfig(completeConfig);
  console.log(chalk.green('✓ Configuration saved'));
  console.log(chalk.bold.green('\n✅ Setup complete!'));
  console.log(chalk.dim('Configuration saved to config.yaml\n'));

  // Phase 3: Account Mapping
  let config = await loadConfig();

  try {
    config = await runAccountMappingFlow(config);
    await saveConfig(config);
  } catch (error) {
    console.error(
      chalk.yellow('\n⚠ Account mapping failed. You can run it later with:'),
      chalk.cyan('actual-monzo map-accounts')
    );
  }
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
      },
    },
    {
      type: 'password',
      name: 'password',
      message: 'Actual Budget Server Password:',
      mask: '*',
      validate: (input: string) => input.length > 0 || 'Password cannot be empty',
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
      },
    },
  ]);

  await service.resumeSetup({
    serverUrl: answers.serverUrl,
    password: answers.password,
    dataDirectory: answers.dataDirectory,
  });

  // Phase 3: Account Mapping
  let config = await loadConfig();

  try {
    config = await runAccountMappingFlow(config);
    await saveConfig(config);
  } catch (error) {
    console.error(
      chalk.yellow('\n⚠ Account mapping failed. You can run it later with:'),
      chalk.cyan('actual-monzo map-accounts')
    );
  }
}
