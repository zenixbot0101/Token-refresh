import logger from './logger.js';
import authManager from './auth.js';
import firebaseManager from './firebase.js';
import configManager from './config.js';
import {
  encrypt,
  sleep,
  getNextRefreshTime,
  isValidTokenFormat,
  retry
} from './utils.js';

/**
 * Token Refresh Worker
 * Periodically refreshes Google Cloud access token and syncs to Firebase
 */
class Worker {
  constructor() {
    this.running = false;
    this.intervalMinutes = 30;
    this.retryDelays = [30, 60, 120, 300]; // seconds
    this.currentRetryIndex = 0;
    this.intervalHandle = null;
    this.config = null;
    this.userId = null;
    this.encryptionEnabled = false;
    this.encryptionKey = null;
  }

  /**
   * Initialize worker with configuration
   */
  async initialize(config) {
    try {
      this.config = config;
      this.userId = config.user?.id;
      this.intervalMinutes = config.worker?.intervalMinutes || 30;
      this.retryDelays = config.worker?.retryDelays || [30, 60, 120, 300];
      
      // Setup encryption
      this.encryptionEnabled = config.security?.encryptTokens || false;
      this.encryptionKey = config.security?.encryptionKey;

      if (this.encryptionEnabled && !this.encryptionKey) {
        logger.warning('Token encryption is enabled but no encryption key provided');
        logger.warning('Tokens will be stored without encryption');
        this.encryptionEnabled = false;
      }

      if (!this.userId) {
        throw new Error('User ID is required');
      }

      logger.debug('Worker initialized');
      logger.debug(`Interval: ${this.intervalMinutes} minutes`);
      logger.debug(`Encryption: ${this.encryptionEnabled ? 'enabled' : 'disabled'}`);

      return { success: true };
    } catch (error) {
      logger.error('Failed to initialize worker', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start the worker
   */
  async start() {
    if (this.running) {
      logger.warning('Worker is already running');
      return { success: false, error: 'Already running' };
    }

    try {
      logger.header('Starting Worker');

      // Verify prerequisites
      await this.verifyPrerequisites();

      this.running = true;

      // Update state
      configManager.updateState({ workerRunning: true });

      // Update Firebase worker status
      await firebaseManager.setWorkerRunning(this.userId, true);

      // Display worker info
      this.displayWorkerInfo();

      // Perform initial refresh
      logger.info('Performing initial token refresh...');
      await this.refreshToken();

      // Start periodic refresh
      this.scheduleNextRefresh();

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      logger.success('Worker started successfully');
      console.log();

      return { success: true };
    } catch (error) {
      logger.error('Failed to start worker', error);
      this.running = false;
      configManager.updateState({ workerRunning: false });
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify prerequisites before starting
   */
  async verifyPrerequisites() {
    // Check authentication
    if (!authManager.isAuthenticated()) {
      logger.info('Verifying authentication...');
      const authResult = await authManager.ensureAuthenticated();
      
      if (!authResult.success) {
        throw new Error('Authentication verification failed');
      }
    }

    // Check Firebase connection
    if (!firebaseManager.isConnected()) {
      throw new Error('Firebase is not connected');
    }

    logger.debug('Prerequisites verified');
  }

  /**
   * Display worker information
   */
  displayWorkerInfo() {
    const account = authManager.getActiveAccount();
    const projectId = authManager.getProjectId();

    logger.box('WORKER RUNNING', {
      'Account': account || 'N/A',
      'Project': projectId || 'Not set',
      'Interval': `${this.intervalMinutes} minutes`,
      'User ID': this.userId
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken() {
    const startTime = Date.now();

    try {
      logger.workerStatus({
        message: 'Refreshing access token...',
        timestamp: new Date()
      });

      // Get access token from gcloud
      const tokenResult = await authManager.getAccessToken();

      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Failed to get access token');
      }

      const { token } = tokenResult;

      // Validate token format
      if (!isValidTokenFormat(token)) {
        throw new Error('Invalid token format received');
      }

      // Prepare token for storage
      let storedToken = token;
      let metadata = {
        account: authManager.getActiveAccount(),
        projectId: authManager.getProjectId(),
        authenticated: true
      };

      // Encrypt token if enabled
      if (this.encryptionEnabled && this.encryptionKey) {
        try {
          storedToken = encrypt(token, this.encryptionKey);
          metadata.encrypted = true;
          logger.debug('Token encrypted successfully');
        } catch (encryptError) {
          logger.warning('Token encryption failed, storing without encryption');
          metadata.encrypted = false;
        }
      } else {
        metadata.encrypted = false;
      }

      // Update Firebase
      const updateResult = await firebaseManager.storeEncryptedToken(
        this.userId,
        storedToken,
        metadata
      );

      if (!updateResult.success) {
        throw new Error('Failed to update Firebase');
      }

      // Record heartbeat
      await firebaseManager.recordHeartbeat(this.userId);

      // Update local state
      const now = Date.now();
      configManager.updateState({
        lastRefresh: now,
        lastRefreshSuccess: true
      });

      // Calculate duration
      const duration = now - startTime;

      // Reset retry index on success
      this.currentRetryIndex = 0;

      logger.workerStatus({
        message: 'Access token refreshed',
        next: getNextRefreshTime(this.intervalMinutes)
      });

      logger.success(`Firebase updated (${duration}ms)`);
      console.log();

      return { success: true };
    } catch (error) {
      logger.error('Token refresh failed', error);

      // Update state
      configManager.updateState({
        lastRefresh: Date.now(),
        lastRefreshSuccess: false,
        lastRefreshError: error.message
      });

      // Handle authentication errors
      if (error.message.includes('authentication') || error.message.includes('Not authenticated')) {
        logger.warning('Authentication issue detected');
        await this.handleAuthenticationError();
      }

      // Schedule retry
      await this.scheduleRetry();

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle authentication errors
   */
  async handleAuthenticationError() {
    try {
      logger.info('Attempting to refresh authentication...');
      
      const refreshResult = await authManager.refresh();

      if (refreshResult.success) {
        logger.success('Authentication refreshed');
      } else {
        logger.error('Authentication refresh failed');
        logger.warning('Worker will continue retrying');
      }
    } catch (error) {
      logger.error('Failed to handle authentication error', error);
    }
  }

  /**
   * Schedule next refresh
   */
  scheduleNextRefresh() {
    if (!this.running) {
      return;
    }

    const intervalMs = this.intervalMinutes * 60 * 1000;

    this.intervalHandle = setTimeout(async () => {
      if (this.running) {
        await this.refreshToken();
        this.scheduleNextRefresh();
      }
    }, intervalMs);

    logger.debug(`Next refresh scheduled in ${this.intervalMinutes} minutes`);
  }

  /**
   * Schedule retry after failure
   */
  async scheduleRetry() {
    if (!this.running) {
      return;
    }

    // Get retry delay
    const retryDelaySeconds = this.retryDelays[
      Math.min(this.currentRetryIndex, this.retryDelays.length - 1)
    ];

    this.currentRetryIndex++;

    logger.warning(`Retrying in ${retryDelaySeconds} seconds...`);

    await sleep(retryDelaySeconds * 1000);

    if (this.running) {
      await this.refreshToken();
      
      // If retry succeeds, schedule normal refresh
      if (this.currentRetryIndex === 0) {
        this.scheduleNextRefresh();
      }
    }
  }

  /**
   * Stop the worker
   */
  async stop() {
    if (!this.running) {
      logger.warning('Worker is not running');
      return { success: false, error: 'Not running' };
    }

    try {
      logger.info('Stopping worker...');

      this.running = false;

      // Clear interval
      if (this.intervalHandle) {
        clearTimeout(this.intervalHandle);
        this.intervalHandle = null;
      }

      // Update state
      configManager.updateState({ workerRunning: false });

      // Update Firebase worker status
      await firebaseManager.setWorkerRunning(this.userId, false);

      logger.success('Worker stopped');

      return { success: true };
    } catch (error) {
      logger.error('Failed to stop worker', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    const state = configManager.getState();

    return {
      running: this.running,
      userId: this.userId,
      intervalMinutes: this.intervalMinutes,
      lastRefresh: state.lastRefresh,
      lastRefreshSuccess: state.lastRefreshSuccess,
      lastRefreshError: state.lastRefreshError,
      account: authManager.getActiveAccount(),
      projectId: authManager.getProjectId(),
      encryptionEnabled: this.encryptionEnabled
    };
  }

  /**
   * Display worker status
   */
  async displayStatus() {
    logger.header('Worker Status');

    const status = this.getStatus();

    let lastRefreshText = 'Never';
    if (status.lastRefresh) {
      const date = new Date(status.lastRefresh);
      lastRefreshText = date.toLocaleString();
    }

    let nextRefreshText = 'N/A';
    if (status.running && status.lastRefresh) {
      const nextRefresh = new Date(status.lastRefresh + this.intervalMinutes * 60 * 1000);
      nextRefreshText = nextRefresh.toLocaleString();
    }

    logger.table({
      'Status': status.running ? 'Running ✓' : 'Stopped',
      'Account': status.account || 'N/A',
      'Project': status.projectId || 'Not set',
      'Interval': `${status.intervalMinutes} minutes`,
      'Last Refresh': lastRefreshText,
      'Last Status': status.lastRefreshSuccess ? 'Success ✓' : 'Failed ✗',
      'Next Refresh': nextRefreshText
    });

    if (!status.running) {
      console.log();
      logger.info('Start the worker with: gcloud-token-manager start');
    }

    if (status.lastRefreshError && !status.lastRefreshSuccess) {
      console.log();
      logger.error(`Last error: ${status.lastRefreshError}`);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const handleShutdown = async (signal) => {
      logger.info(`\nReceived ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    logger.debug('Shutdown handlers registered');
  }

  /**
   * Check if worker is running
   */
  isRunning() {
    return this.running;
  }

  /**
   * Force refresh (manual trigger)
   */
  async forceRefresh() {
    if (!this.running) {
      logger.warning('Worker is not running');
      return { success: false, error: 'Worker not running' };
    }

    logger.info('Forcing token refresh...');
    return await this.refreshToken();
  }
}

// Singleton instance
const worker = new Worker();

export default worker;
