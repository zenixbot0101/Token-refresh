#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import logger from './logger.js';
import configManager from './config.js';
import Scanner from './scanner.js';
import GCloudInstaller from './installer.js';
import NodeInstaller from './node-installer.js';
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
 * Setup command - Automated configuration
 */
async function setupCommand() {
  try {
    logger.box('GCLOUD TOKEN AUTH MANAGER', {
      Version: APP_VERSION
    });

    // Step 1: System scan
    const scanner = new Scanner();
    logger.info('Scanning system...');
    
    const validation = await scanner.validateRequirements();
    scanner.displaySummary(validation.results);

    // Step 2: Auto-install Node.js if needed
    if (!validation.results.node.compatible) {
      if (!validation.results.node.installed) {
        logger.warning('Node.js is not installed');
        
        const { installNode } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'installNode',
            message: 'Install Node.js 20.x automatically?',
            default: true
          }
        ]);

        if (!installNode) {
          logger.error('Node.js 20+ is required to continue');
          process.exit(1);
        }

        const nodeInstaller = new NodeInstaller();
        const nodeInstallResult = await nodeInstaller.install();

        if (!nodeInstallResult.success) {
          logger.error('Node.js installation failed');
          nodeInstaller.displayManualInstructions();
          process.exit(1);
        }

        logger.success('Node.js installed successfully');
        logger.warning('Please restart this setup script');
        process.exit(0);
      } else {
        logger.error('Node.js version is too old (requires 20+)');
        logger.info('Current version:', validation.results.node.version);
        
        const nodeInstaller = new NodeInstaller();
        nodeInstaller.displayManualInstructions();
        process.exit(1);
      }
    }

    const capabilities = scanner.getCapabilities(validation.results);

    // Step 3: Auto-install gcloud if needed
    if (capabilities.needsGCloudInstall) {
      logger.warning('Google Cloud CLI is not installed');
      
      const { installGCloud } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'installGCloud',
          message: 'Install Google Cloud CLI automatically?',
          default: true
        }
      ]);

      if (!installGCloud) {
        logger.error('Google Cloud CLI is required to continue');
        process.exit(1);
      }

      const installer = new GCloudInstaller();
      const installResult = await installer.installWithFallback(validation.results.os);

      if (!installResult.success) {
        logger.error('Google Cloud CLI installation failed');
        if (installResult.manual) {
          logger.info('Please install manually and run setup again');
        }
        process.exit(1);
      }

      if (installResult.requiresRestart) {
        logger.warning('Please restart your terminal and run setup again');
        process.exit(0);
      }

      logger.success('Google Cloud CLI installed successfully');
    }

    // Step 4: Firebase configuration (simplified)
    const firebaseConfig = await setupFirebaseSimplified();

    // Step 5: Google Cloud authentication
    logger.header('Google Cloud Authentication');
    logger.info('You will be redirected to Google login page');
    logger.info('Please sign in with your Google account');
    console.log();

    const { proceedAuth } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceedAuth',
        message: 'Ready to authenticate with Google Cloud?',
        default: true
      }
    ]);

    if (!proceedAuth) {
      logger.error('Authentication is required');
      process.exit(1);
    }

    const authResult = await authManager.login();

    if (!authResult.success) {
      logger.error('Authentication failed');
      process.exit(1);
    }

    // Step 6: Configure project (optional)
    const projectResult = await authManager.getCurrentProject();
    
    if (!projectResult.project) {
      logger.warning('No Google Cloud project configured');
      
      const { configureProject } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'configureProject',
          message: 'Configure Google Cloud project now?',
          default: false
        }
      ]);

      if (configureProject) {
        await authManager.configureProject();
      }
    }

    // Step 7: Save state
    configManager.updateState({
      setupCompleted: true,
      gcloudInstalled: true,
      authenticated: true,
      account: authManager.getActiveAccount(),
      projectId: authManager.getProjectId()
    });

    // Step 8: Setup complete
    logger.header('Setup Complete');
    logger.success('All components configured successfully');
    console.log();

    // Display summary
    logger.table({
      'Firebase Project': firebaseConfig.firebase.projectId,
      'Google Account': authManager.getActiveAccount(),
      'User ID': firebaseConfig.user.id,
      'Encryption': firebaseConfig.security.encryptTokens ? 'Enabled ✓' : 'Disabled'
    });

    console.log();

    // Step 9: Ask to start worker
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
      logger.info('Start the worker anytime with:');
      logger.info('  npm start');
      logger.info('  or: gcloud-token-manager start');
    }
  } catch (error) {
    logger.error('Setup failed', error);
    process.exit(1);
  }
}

/**
 * Simplified Firebase setup - no file creation needed
 */
async function setupFirebaseSimplified() {
  logger.header('Firebase Configuration');

  logger.info('Please provide your Firebase credentials');
  logger.info('You can find these in Firebase Console → Project Settings → Service Accounts');
  console.log();

  // Check if configuration already exists
  let config = configManager.loadConfig();
  
  if (config?.firebase?.projectId) {
    logger.info('Existing Firebase configuration found');
    
    const { useExisting } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useExisting',
        message: 'Use existing Firebase configuration?',
        default: true
      }
    ]);

    if (useExisting) {
      const initResult = await firebaseManager.initialize(config);
      if (initResult.success) {
        return config;
      }
      logger.warning('Failed to connect with existing configuration');
    }
  }

  // Prompt for Firebase credentials
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
      message: 'Firebase Database URL (e.g., https://your-project.firebaseio.com):',
      validate: (input) => {
        if (!input.trim()) return 'Database URL is required';
        if (!input.startsWith('https://')) return 'URL must start with https://';
        return true;
      }
    },
    {
      type: 'input',
      name: 'clientEmail',
      message: 'Firebase Client Email (firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com):',
      validate: (input) => {
        if (!input.trim()) return 'Client email is required';
        if (!input.includes('@') || !input.includes('iam.gserviceaccount.com')) {
          return 'Invalid service account email format';
        }
        return true;
      }
    },
    {
      type: 'editor',
      name: 'privateKey',
      message: 'Firebase Private Key (will open editor - paste the entire key including -----BEGIN/END PRIVATE KEY-----):',
      default: '-----BEGIN PRIVATE KEY-----\n\n-----END PRIVATE KEY-----',
      validate: (input) => {
        if (!input.trim()) return 'Private key is required';
        if (!input.includes('BEGIN PRIVATE KEY') || !input.includes('END PRIVATE KEY')) {
          return 'Invalid private key format - must include BEGIN and END markers';
        }
        return true;
      },
      postProcess: (input) => {
        // Ensure proper line breaks
        return input.trim();
      }
    }
  ]);

  // Generate user ID
  let userId = config?.user?.id;
  
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

  // Create service account object from provided credentials
  // Ensure private key has proper line breaks
  let privateKey = answers.privateKey.trim();
  
  // If private key doesn't have literal \n characters, it's probably already formatted correctly
  // If it has escaped \n as literal text (\\n), we need to replace them with actual newlines
  if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
    // Has literal \n characters - need to convert to actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  
  // Ensure it starts and ends correctly
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    logger.error('Private key must start with -----BEGIN PRIVATE KEY-----');
    throw new Error('Invalid private key format');
  }
  
  if (!privateKey.endsWith('-----END PRIVATE KEY-----')) {
    logger.error('Private key must end with -----END PRIVATE KEY-----');
    throw new Error('Invalid private key format');
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: answers.projectId,
    private_key: privateKey,
    client_email: answers.clientEmail.trim(),
    token_uri: 'https://oauth2.googleapis.com/token',
    universe_domain: 'googleapis.com'
  };

  // Save configuration
  const newConfig = {
    firebase: {
      projectId: answers.projectId.trim(),
      databaseURL: answers.databaseURL.trim(),
      serviceAccount: serviceAccount
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
    logger.error('Please verify your credentials and try again');
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
      logger.info('Run setup first: npm run setup');
      process.exit(1);
    }

    // Validate configuration
    const validation = configManager.validateConfig(config);
    
    if (!validation.valid) {
      logger.error('Invalid configuration');
      validation.errors.forEach(error => logger.error(`  - ${error}`));
      logger.info('Run setup again: npm run setup');
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
      logger.info('Run setup: npm run setup');
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
  .description('Automated setup and configuration')
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
