#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import logger from './logger.js';
import configManager from './config.js';
import Scanner from './scanner.js';
import GCloudInstaller from './installer.js';
import firebaseManager from './firebase.js';
import authManager from './auth.js';
import worker from './worker.js';
import { generateUserId, generateKey } from './utils.js';

const program = new Command();

/**
 * Application version
 */
const APP_VERSION = '1.0.0';

/**
 * Setup command - Initial configuration
 */
async function setupCommand() {
  try {
    logger.box('GCLOUD TOKEN AUTH MANAGER', {
      Version: APP_VERSION
    });

    // Step 1: System scan
    const scanner = new Scanner();
    const validation = await scanner.validateRequirements();

    scanner.displaySummary(validation.results);

    if (!validation.valid) {
      logger.error('System requirements not met');
      validation.errors.forEach(error => logger.error(`  - ${error}`));
      process.exit(1);
    }

    const capabilities = scanner.getCapabilities(validation.results);

    // Step 2: Install gcloud if needed
    if (capabilities.needsGCloudInstall) {
      logger.info('Google Cloud CLI installation required');
      
      const { installGCloud } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'installGCloud',
          message: 'Install Google Cloud CLI now?',
          default: true
        }
      ]);

      if (!installGCloud) {
        logger.warning('Google Cloud CLI is required to continue');
        logger.info('Please install manually and run setup again');
        process.exit(0);
      }

      const installer = new GCloudInstaller();
      const installResult = await installer.installWithFallback(validation.results.os);

      if (!installResult.success) {
        logger.error('Installation failed');
        if (installResult.manual) {
          logger.info('Please install manually and run setup again');
        }
        process.exit(1);
      }

      if (installResult.requiresRestart) {
        logger.warning('Please restart your terminal and run setup again');
        process.exit(0);
      }
    }

    // Step 3: Firebase configuration
    await setupFirebase();

    // Step 4: Google Cloud authentication
    logger.info('Google Cloud authentication is required');
    const authResult = await authManager.login();

    if (!authResult.success) {
      logger.error('Authentication failed');
      process.exit(1);
    }

    // Step 5: Configure project (optional)
    const { configureProject } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'configureProject',
        message: 'Configure Google Cloud project?',
        default: false
      }
    ]);

    if (configureProject) {
      await authManager.configureProject();
    }

    // Step 6: Save state
    configManager.updateState({
      setupCompleted: true,
      gcloudInstalled: true,
      authenticated: true,
      account: authManager.getActiveAccount(),
      projectId: authManager.getProjectId()
    });

    // Step 7: Setup complete
    logger.header('Setup Complete');
    logger.success('All components configured successfully');
    console.log();

    // Step 8: Ask to start worker
    const { startWorker } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'startWorker',
        message: 'Start the worker now?',
        default: true
      }
    ]);

    if (startWorker) {
      await startCommand();
    } else {
      logger.info('Start the worker anytime with: gcloud-token-manager start');
    }
  } catch (error) {
    logger.error('Setup failed', error);
    process.exit(1);
  }
}

/**
 * Setup Firebase configuration
 */
async function setupFirebase() {
  logger.header('Firebase Configuration');

  let config = configManager.loadConfig();

  if (!config) {
    logger.info('No configuration found, creating new configuration');
    config = {};
  }

  // Check if Firebase is already configured
  if (config.firebase?.projectId && config.firebase?.databaseURL) {
    logger.info('Existing Firebase configuration found');
    logger.table({
      'Project ID': config.firebase.projectId,
      'Database URL': config.firebase.databaseURL
    });

    const { useExisting } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useExisting',
        message: 'Use existing configuration?',
        default: true
      }
    ]);

    if (useExisting) {
      // Test connection
      const initResult = await firebaseManager.initialize(config);
      if (initResult.success) {
        return config;
      }
      logger.warning('Failed to connect with existing configuration');
    }
  }

  // Prompt for Firebase configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectId',
      message: 'Firebase Project ID:',
      validate: (input) => input.trim().length > 0 || 'Project ID is required'
    },
    {
      type: 'input',
      name: 'databaseURL',
      message: 'Firebase Database URL:',
      validate: (input) => {
        if (!input.trim()) return 'Database URL is required';
        if (!input.startsWith('https://')) return 'URL must start with https://';
        return true;
      }
    },
    {
      type: 'input',
      name: 'serviceAccountPath',
      message: 'Service Account Key Path:',
      default: './firebase-key.json',
      validate: (input) => input.trim().length > 0 || 'Path is required'
    }
  ]);

  // Check for user ID
  let userId = config.user?.id;
  
  if (!userId) {
    const { useGeneratedId } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useGeneratedId',
        message: 'Generate unique user ID automatically?',
        default: true
      }
    ]);

    if (useGeneratedId) {
      userId = generateUserId();
      logger.success(`Generated User ID: ${userId}`);
    } else {
      const { customUserId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customUserId',
          message: 'Enter custom user ID:',
          validate: (input) => input.trim().length > 0 || 'User ID is required'
        }
      ]);
      userId = customUserId;
    }
  }

  // Setup encryption
  const { enableEncryption } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableEncryption',
      message: 'Enable token encryption?',
      default: true
    }
  ]);

  let encryptionKey = null;
  if (enableEncryption) {
    encryptionKey = generateKey(32);
    logger.success('Encryption key generated');
  }

  // Save configuration
  const newConfig = {
    firebase: {
      projectId: answers.projectId,
      databaseURL: answers.databaseURL,
      serviceAccountPath: answers.serviceAccountPath
    },
    user: {
      id: userId
    },
    worker: {
      intervalMinutes: 30,
      retryDelays: [30, 60, 120, 300]
    },
    security: {
      encryptTokens: enableEncryption,
      encryptionKey: encryptionKey
    }
  };

  configManager.saveConfig(newConfig);
  logger.success('Configuration saved');

  // Test Firebase connection
  logger.info('Testing Firebase connection...');
  const initResult = await firebaseManager.initialize(newConfig);

  if (!initResult.success) {
    logger.error('Firebase connection failed');
    throw new Error('Failed to connect to Firebase');
  }

  logger.success('Firebase connected successfully');

  return newConfig;
}

/**
 * Start command - Start the worker
 */
async function startCommand() {
  try {
    logger.box('GCLOUD TOKEN AUTH MANAGER', {
      Version: APP_VERSION,
      Command: 'start'
    });

    // Load configuration
    const config = configManager.loadConfig();
    
    if (!config) {
      logger.error('No configuration found');
      logger.info('Run setup first: gcloud-token-manager setup');
      process.exit(1);
    }

    // Validate configuration
    const validation = configManager.validateConfig(config);
    
    if (!validation.valid) {
      logger.error('Invalid configuration');
      validation.errors.forEach(error => logger.error(`  - ${error}`));
      logger.info('Run setup again: gcloud-token-manager setup');
      process.exit(1);
    }

    // Initialize Firebase
    logger.info('Connecting to Firebase...');
    const firebaseResult = await firebaseManager.initialize(config);
    
    if (!firebaseResult.success) {
      logger.error('Failed to connect to Firebase');
      process.exit(1);
    }

    // Verify authentication
    logger.info('Verifying Google Cloud authentication...');
    const authResult = await authManager.ensureAuthenticated();
    
    if (!authResult.success) {
      logger.error('Authentication failed');
      process.exit(1);
    }

    // Initialize and start worker
    await worker.initialize(config);
    const startResult = await worker.start();

    if (!startResult.success) {
      logger.error('Failed to start worker');
      process.exit(1);
    }

    // Keep the process running
    // The worker handles its own lifecycle
  } catch (error) {
    logger.error('Failed to start', error);
    process.exit(1);
  }
}

/**
 * Stop command - Stop the worker
 */
async function stopCommand() {
  try {
    logger.info('Stopping worker...');

    const stopResult = await worker.stop();

    if (!stopResult.success) {
      logger.warning(stopResult.error);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Failed to stop worker', error);
    process.exit(1);
  }
}

/**
 * Status command - Display status
 */
async function statusCommand() {
  try {
    logger.box('GCLOUD TOKEN AUTH MANAGER', {
      Version: APP_VERSION,
      Command: 'status'
    });

    // Load configuration
    const config = configManager.loadConfig();
    
    if (!config) {
      logger.warning('No configuration found');
      logger.info('Run setup: gcloud-token-manager setup');
      return;
    }

    // Initialize Firebase (for status check)
    await firebaseManager.initialize(config);

    // Display authentication status
    await authManager.displayStatus();
    console.log();

    // Display worker status
    await worker.displayStatus();
  } catch (error) {
    logger.error('Failed to get status', error);
    process.exit(1);
  }
}

/**
 * Login command - Google Cloud login
 */
async function loginCommand() {
  try {
    const result = await authManager.login();

    if (!result.success) {
      logger.error('Login failed');
      process.exit(1);
    }

    // Update state
    configManager.updateState({
      authenticated: true,
      account: authManager.getActiveAccount()
    });

    logger.success('Login successful');
  } catch (error) {
    logger.error('Login failed', error);
    process.exit(1);
  }
}

/**
 * Logout command - Google Cloud logout
 */
async function logoutCommand(options) {
  try {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to logout?',
        default: false
      }
    ]);

    if (!confirm) {
      logger.info('Logout cancelled');
      return;
    }

    const result = await authManager.logout(options.account);

    if (!result.success) {
      logger.error('Logout failed');
      process.exit(1);
    }

    // Update state
    configManager.updateState({
      authenticated: false,
      account: null
    });

    logger.success('Logout successful');
  } catch (error) {
    logger.error('Logout failed', error);
    process.exit(1);
  }
}

/**
 * Main program
 */
program
  .name('gcloud-token-manager')
  .description('Google Cloud Token Authentication Manager with Firebase integration')
  .version(APP_VERSION);

program
  .command('setup')
  .description('Initial setup and configuration')
  .action(setupCommand);

program
  .command('start')
  .description('Start the token refresh worker')
  .action(startCommand);

program
  .command('stop')
  .description('Stop the worker')
  .action(stopCommand);

program
  .command('status')
  .description('Display current status')
  .action(statusCommand);

program
  .command('login')
  .description('Login to Google Cloud')
  .action(loginCommand);

program
  .command('logout')
  .description('Logout from Google Cloud')
  .option('-a, --account <email>', 'Specific account to logout')
  .action(logoutCommand);

// Default action (no command)
if (process.argv.length === 2) {
  // No command specified, run start
  startCommand();
} else {
  program.parse(process.argv);
}
