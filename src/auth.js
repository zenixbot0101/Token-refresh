import inquirer from 'inquirer';
import logger from './logger.js';
import { executeCommand, isValidEmail, sleep } from './utils.js';

/**
 * Google Cloud Authentication Manager
 */
class AuthManager {
  constructor() {
    this.authenticated = false;
    this.activeAccount = null;
    this.projectId = null;
  }

  /**
   * Initiate Google Cloud login flow
   */
  async login() {
    logger.header('Google Cloud Authentication');

    logger.info('Google Cloud authentication is required.');
    console.log();
    logger.info('The browser will open for Google authentication.');
    logger.info('Please sign in with your Google account.');
    console.log();

    // Prompt user to continue
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Press ENTER to continue...',
        default: true
      }
    ]);

    if (!proceed) {
      logger.warning('Authentication cancelled by user');
      return { success: false, cancelled: true };
    }

    try {
      // Execute gcloud auth login
      logger.info('Opening browser for authentication...');
      
      const result = await executeCommand('gcloud', ['auth', 'login'], {
        timeout: 300000, // 5 minutes
        stdio: 'inherit'
      });

      if (!result.success) {
        logger.error('Authentication failed');
        return { success: false, error: 'gcloud auth login failed' };
      }

      logger.success('Authentication completed');

      // Verify authentication
      const verification = await this.verifyAuthentication();

      if (!verification.success) {
        logger.error('Authentication verification failed');
        return verification;
      }

      return { success: true, account: this.activeAccount };
    } catch (error) {
      logger.error('Authentication failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify current authentication status
   */
  async verifyAuthentication() {
    try {
      logger.info('Verifying authentication...');

      // Get list of authenticated accounts
      const listResult = await executeCommand('gcloud', ['auth', 'list', '--format=json']);

      if (!listResult.success) {
        logger.warning('Could not verify authentication status');
        return { success: false, error: 'Failed to list accounts' };
      }

      // Parse accounts
      const accounts = JSON.parse(listResult.stdout);

      if (!accounts || accounts.length === 0) {
        logger.warning('No authenticated accounts found');
        this.authenticated = false;
        return { success: false, error: 'No accounts authenticated' };
      }

      // Find active account
      const activeAccount = accounts.find(acc => acc.status === 'ACTIVE');

      if (!activeAccount) {
        logger.warning('No active account found');
        this.authenticated = false;
        return { success: false, error: 'No active account' };
      }

      this.authenticated = true;
      this.activeAccount = activeAccount.account;

      logger.success('Authentication verified');
      logger.info(`Account: ${this.activeAccount}`);

      return {
        success: true,
        account: this.activeAccount,
        allAccounts: accounts
      };
    } catch (error) {
      logger.error('Authentication verification failed', error);
      this.authenticated = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Get access token
   */
  async getAccessToken() {
    try {
      // Verify authentication first
      if (!this.authenticated) {
        const verification = await this.verifyAuthentication();
        if (!verification.success) {
          throw new Error('Not authenticated');
        }
      }

      // Get access token
      const result = await executeCommand('gcloud', ['auth', 'print-access-token'], {
        timeout: 30000
      });

      if (!result.success) {
        throw new Error('Failed to get access token');
      }

      const token = result.stdout.trim();

      if (!token) {
        throw new Error('Empty token received');
      }

      logger.debug('Access token retrieved');

      return {
        success: true,
        token,
        retrievedAt: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get access token', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current project
   */
  async getCurrentProject() {
    try {
      const result = await executeCommand('gcloud', ['config', 'get-value', 'project']);

      if (!result.success) {
        return { success: false, project: null };
      }

      const projectId = result.stdout.trim();

      if (!projectId || projectId === '(unset)') {
        this.projectId = null;
        return { success: true, project: null };
      }

      this.projectId = projectId;
      return { success: true, project: projectId };
    } catch (error) {
      logger.debug('Failed to get current project');
      return { success: false, error: error.message };
    }
  }

  /**
   * Set project
   */
  async setProject(projectId) {
    try {
      logger.info(`Setting project to: ${projectId}`);

      const result = await executeCommand('gcloud', ['config', 'set', 'project', projectId]);

      if (!result.success) {
        throw new Error('Failed to set project');
      }

      this.projectId = projectId;
      logger.success(`Project set to: ${projectId}`);

      return { success: true, project: projectId };
    } catch (error) {
      logger.error('Failed to set project', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Configure project interactively
   */
  async configureProject() {
    try {
      // Check current project
      const currentProject = await this.getCurrentProject();

      if (currentProject.success && currentProject.project) {
        logger.info(`Current project: ${currentProject.project}`);
        
        const { useCurrentProject } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useCurrentProject',
            message: 'Use this project?',
            default: true
          }
        ]);

        if (useCurrentProject) {
          return { success: true, project: currentProject.project };
        }
      } else {
        logger.warning('No active Google Cloud project configured');
      }

      // Prompt for project ID
      const { projectId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectId',
          message: 'Google Cloud Project ID:',
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return 'Project ID is required';
            }
            // Basic validation for project ID format
            if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(input)) {
              return 'Invalid project ID format';
            }
            return true;
          }
        }
      ]);

      // Set the project
      return await this.setProject(projectId.trim());
    } catch (error) {
      logger.error('Failed to configure project', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout from Google Cloud
   */
  async logout(account = null) {
    try {
      logger.info('Logging out from Google Cloud...');

      const args = ['auth', 'revoke'];
      
      if (account) {
        args.push(account);
        logger.info(`Revoking access for: ${account}`);
      } else {
        logger.info('Revoking access for all accounts');
      }

      const result = await executeCommand('gcloud', args);

      if (!result.success) {
        throw new Error('Logout failed');
      }

      this.authenticated = false;
      this.activeAccount = null;
      this.projectId = null;

      logger.success('Logged out successfully');

      return { success: true };
    } catch (error) {
      logger.error('Logout failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all authenticated accounts
   */
  async listAccounts() {
    try {
      const result = await executeCommand('gcloud', ['auth', 'list', '--format=json']);

      if (!result.success) {
        throw new Error('Failed to list accounts');
      }

      const accounts = JSON.parse(result.stdout);
      return { success: true, accounts };
    } catch (error) {
      logger.error('Failed to list accounts', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch active account
   */
  async switchAccount(account) {
    try {
      logger.info(`Switching to account: ${account}`);

      const result = await executeCommand('gcloud', ['config', 'set', 'account', account]);

      if (!result.success) {
        throw new Error('Failed to switch account');
      }

      this.activeAccount = account;
      logger.success(`Active account: ${account}`);

      return { success: true, account };
    } catch (error) {
      logger.error('Failed to switch account', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get authentication info
   */
  async getAuthInfo() {
    try {
      const verification = await this.verifyAuthentication();
      const project = await this.getCurrentProject();

      return {
        success: true,
        authenticated: verification.success,
        account: this.activeAccount,
        project: project.project,
        allAccounts: verification.allAccounts || []
      };
    } catch (error) {
      logger.error('Failed to get auth info', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    return this.authenticated;
  }

  /**
   * Get active account
   */
  getActiveAccount() {
    return this.activeAccount;
  }

  /**
   * Get project ID
   */
  getProjectId() {
    return this.projectId;
  }

  /**
   * Display authentication status
   */
  async displayStatus() {
    logger.header('Authentication Status');

    const info = await this.getAuthInfo();

    if (!info.success) {
      logger.error('Failed to retrieve authentication status');
      return;
    }

    if (!info.authenticated) {
      logger.warning('Not authenticated');
      logger.info('Run: gcloud-token-manager login');
      return;
    }

    logger.table({
      'Status': info.authenticated ? 'Authenticated ✓' : 'Not authenticated',
      'Account': info.account || 'N/A',
      'Project': info.project || 'Not set',
      'Accounts': info.allAccounts.length
    });

    if (info.allAccounts.length > 1) {
      console.log();
      logger.info('All accounts:');
      info.allAccounts.forEach(acc => {
        const status = acc.status === 'ACTIVE' ? '(active)' : '';
        logger.info(`  - ${acc.account} ${status}`);
      });
    }
  }

  /**
   * Ensure authentication is valid
   */
  async ensureAuthenticated() {
    const verification = await this.verifyAuthentication();

    if (!verification.success) {
      logger.warning('Authentication is required');
      const loginResult = await this.login();
      
      if (!loginResult.success) {
        throw new Error('Authentication failed or cancelled');
      }
    }

    return { success: true, account: this.activeAccount };
  }

  /**
   * Refresh authentication (re-login if expired)
   */
  async refresh() {
    try {
      // Try to get a token to check if auth is still valid
      const tokenResult = await this.getAccessToken();

      if (tokenResult.success) {
        logger.debug('Authentication is still valid');
        return { success: true, refreshed: false };
      }

      // If token retrieval fails, authentication might be expired
      logger.warning('Authentication may have expired, re-authenticating...');
      
      const loginResult = await this.login();

      if (!loginResult.success) {
        throw new Error('Re-authentication failed');
      }

      logger.success('Authentication refreshed');
      return { success: true, refreshed: true };
    } catch (error) {
      logger.error('Failed to refresh authentication', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const authManager = new AuthManager();

export default authManager;
