import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { retry } from './utils.js';

/**
 * Firebase Manager - Handles Firebase Admin SDK operations
 */
class FirebaseManager {
  constructor() {
    this.app = null;
    this.db = null;
    this.connected = false;
    this.config = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  async initialize(config) {
    try {
      if (this.connected) {
        logger.debug('Firebase already initialized');
        return { success: true };
      }

      logger.info('Initializing Firebase...');

      // Validate configuration
      if (!config || !config.firebase) {
        throw new Error('Firebase configuration is missing');
      }

      const { projectId, databaseURL, serviceAccount } = config.firebase;

      if (!projectId || !databaseURL) {
        throw new Error('Firebase projectId and databaseURL are required');
      }

      if (!serviceAccount) {
        throw new Error('Firebase service account credentials are required');
      }

      // Initialize Firebase Admin with credentials object
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
      });

      // Get database reference
      this.db = admin.database();

      // Test connection
      await this.testConnection();

      this.connected = true;
      this.config = config;

      logger.success('Firebase connected');
      logger.info(`Project: ${projectId}`);
      logger.info(`Database: ${databaseURL}`);

      return { success: true };
    } catch (error) {
      logger.error('Failed to initialize Firebase', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      // Try to read from a test path
      const ref = this.db.ref('.info/connected');
      const snapshot = await ref.once('value');
      
      if (snapshot.exists()) {
        logger.debug('Firebase connection test successful');
        return true;
      }

      return false;
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Update user's gcloud data
   */
  async updateUserGCloudData(userId, data) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const userRef = this.db.ref(`users/${userId}/gcloud`);

      // Add timestamp
      const updateData = {
        ...data,
        updatedAt: Date.now()
      };

      // Perform update with retry
      await retry(
        async () => {
          await userRef.update(updateData);
        },
        {
          retries: 3,
          delay: 1000,
          backoff: 2,
          onRetry: (attempt, maxRetries, delay) => {
            logger.warning(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
          }
        }
      );

      logger.success('Firebase synchronized');
      logger.debug(`Updated user data for: ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error('Failed to update Firebase', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's gcloud data
   */
  async getUserGCloudData(userId) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const userRef = this.db.ref(`users/${userId}/gcloud`);
      const snapshot = await userRef.once('value');

      if (!snapshot.exists()) {
        logger.debug(`No data found for user: ${userId}`);
        return { success: true, data: null };
      }

      const data = snapshot.val();
      logger.debug(`Retrieved data for user: ${userId}`);

      return { success: true, data };
    } catch (error) {
      logger.error('Failed to get user data from Firebase', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update authentication status
   */
  async updateAuthenticationStatus(userId, authenticated, account = null, projectId = null) {
    try {
      const data = {
        authenticated,
        account: account || null,
        projectId: projectId || null,
        lastChecked: Date.now()
      };

      return await this.updateUserGCloudData(userId, data);
    } catch (error) {
      logger.error('Failed to update authentication status', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update token
   */
  async updateToken(userId, token, metadata = {}) {
    try {
      const data = {
        token,
        tokenUpdatedAt: Date.now(),
        ...metadata
      };

      return await this.updateUserGCloudData(userId, data);
    } catch (error) {
      logger.error('Failed to update token', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store encrypted token
   */
  async storeEncryptedToken(userId, encryptedToken, metadata = {}) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const data = {
        token: encryptedToken,
        encrypted: true,
        tokenUpdatedAt: Date.now(),
        ...metadata
      };

      return await this.updateUserGCloudData(userId, data);
    } catch (error) {
      logger.error('Failed to store encrypted token', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear token from database
   */
  async clearToken(userId) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const tokenRef = this.db.ref(`users/${userId}/gcloud/token`);
      await tokenRef.remove();

      logger.info('Token cleared from Firebase');
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear token', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete user data
   */
  async deleteUserData(userId) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const userRef = this.db.ref(`users/${userId}`);
      await userRef.remove();

      logger.info('User data deleted from Firebase');
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete user data', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user exists
   */
  async userExists(userId) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const userRef = this.db.ref(`users/${userId}`);
      const snapshot = await userRef.once('value');

      return snapshot.exists();
    } catch (error) {
      logger.error('Failed to check user existence', error);
      return false;
    }
  }

  /**
   * Get worker status from database
   */
  async getWorkerStatus(userId) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const statusRef = this.db.ref(`users/${userId}/worker`);
      const snapshot = await statusRef.once('value');

      if (!snapshot.exists()) {
        return { success: true, status: null };
      }

      return { success: true, status: snapshot.val() };
    } catch (error) {
      logger.error('Failed to get worker status', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update worker status
   */
  async updateWorkerStatus(userId, status) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const statusRef = this.db.ref(`users/${userId}/worker`);
      await statusRef.update({
        ...status,
        updatedAt: Date.now()
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to update worker status', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set worker running state
   */
  async setWorkerRunning(userId, running) {
    try {
      return await this.updateWorkerStatus(userId, {
        running,
        startedAt: running ? Date.now() : null
      });
    } catch (error) {
      logger.error('Failed to set worker state', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record worker heartbeat
   */
  async recordHeartbeat(userId) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const heartbeatRef = this.db.ref(`users/${userId}/worker/lastHeartbeat`);
      await heartbeatRef.set(Date.now());

      return { success: true };
    } catch (error) {
      logger.debug('Failed to record heartbeat');
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from Firebase
   */
  async disconnect() {
    try {
      if (this.app) {
        await this.app.delete();
        this.app = null;
        this.db = null;
        this.connected = false;
        logger.info('Firebase disconnected');
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to disconnect from Firebase', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get database reference for custom operations
   */
  getDatabase() {
    if (!this.connected) {
      throw new Error('Firebase is not connected');
    }
    return this.db;
  }

  /**
   * Listen to connection state
   */
  async listenToConnectionState(callback) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const connectedRef = this.db.ref('.info/connected');
      
      connectedRef.on('value', (snapshot) => {
        const connected = snapshot.val() === true;
        callback(connected);
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to listen to connection state', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update bot token in /globalToken path
   * Used for Discord bot integration
   */
  async updateBotToken(path, data) {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const botRef = this.db.ref(path);

      // Perform update with retry
      await retry(
        async () => {
          await botRef.update(data);
        },
        {
          retries: 3,
          delay: 1000,
          backoff: 2,
          onRetry: (attempt, maxRetries, delay) => {
            logger.warning(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
          }
        }
      );

      logger.debug(`Bot token updated at /${path}`);

      return { success: true };
    } catch (error) {
      logger.error('Failed to update bot token', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get bot token from /globalToken path
   */
  async getBotToken(path = 'globalToken') {
    try {
      if (!this.connected) {
        throw new Error('Firebase is not connected');
      }

      const botRef = this.db.ref(path);
      const snapshot = await botRef.once('value');

      if (!snapshot.exists()) {
        logger.debug(`No bot token found at /${path}`);
        return { success: true, data: null };
      }

      const data = snapshot.val();
      logger.debug(`Retrieved bot token from /${path}`);

      return { success: true, data };
    } catch (error) {
      logger.error('Failed to get bot token', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const firebaseManager = new FirebaseManager();

export default firebaseManager;
