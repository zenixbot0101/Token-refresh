import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.gcloud-token-manager');
    this.configPath = path.join(this.configDir, 'config.json');
    this.statePath = path.join(this.configDir, 'state.json');
    this.projectConfigPath = path.join(process.cwd(), 'config', 'config.json');
    
    this.config = null;
    this.state = null;
    
    this.ensureConfigDirectory();
  }

  ensureConfigDirectory() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        logger.debug(`Created config directory: ${this.configDir}`);
      }
    } catch (error) {
      logger.error('Failed to create config directory', error);
      throw error;
    }
  }

  loadConfig() {
    try {
      // Try to load from user home directory first
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(data);
        logger.debug('Loaded config from user directory');
        return this.config;
      }

      // Fall back to project config
      if (fs.existsSync(this.projectConfigPath)) {
        const data = fs.readFileSync(this.projectConfigPath, 'utf8');
        this.config = JSON.parse(data);
        logger.debug('Loaded config from project directory');
        return this.config;
      }

      // No config found
      logger.warning('No configuration file found');
      return null;
    } catch (error) {
      logger.error('Failed to load config', error);
      throw error;
    }
  }

  saveConfig(config) {
    try {
      this.config = config;
      const data = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf8');
      logger.debug('Saved config to user directory');
      return true;
    } catch (error) {
      logger.error('Failed to save config', error);
      throw error;
    }
  }

  loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, 'utf8');
        this.state = JSON.parse(data);
        logger.debug('Loaded application state');
        return this.state;
      }

      // Initialize empty state
      this.state = {
        workerRunning: false,
        lastRefresh: null,
        gcloudInstalled: false,
        authenticated: false,
        account: null,
        projectId: null
      };
      return this.state;
    } catch (error) {
      logger.error('Failed to load state', error);
      throw error;
    }
  }

  saveState(state) {
    try {
      this.state = { ...this.state, ...state };
      const data = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.statePath, data, 'utf8');
      logger.debug('Saved application state');
      return true;
    } catch (error) {
      logger.error('Failed to save state', error);
      throw error;
    }
  }

  getConfig() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config;
  }

  getState() {
    if (!this.state) {
      this.loadState();
    }
    return this.state;
  }

  updateConfig(updates) {
    const config = this.getConfig() || {};
    const updatedConfig = this.deepMerge(config, updates);
    return this.saveConfig(updatedConfig);
  }

  updateState(updates) {
    const state = this.getState();
    const updatedState = { ...state, ...updates };
    return this.saveState(updatedState);
  }

  deepMerge(target, source) {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }

  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  validateConfig(config) {
    const required = [
      'firebase.projectId',
      'firebase.databaseURL',
      'firebase.serviceAccount',
      'user.id'
    ];

    const errors = [];

    required.forEach(path => {
      const value = this.getNestedValue(config, path);
      if (!value) {
        errors.push(`Missing required config: ${path}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
    return obj;
  }

  reset() {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
        logger.info('Removed user config');
      }
      
      if (fs.existsSync(this.statePath)) {
        fs.unlinkSync(this.statePath);
        logger.info('Removed application state');
      }
      
      this.config = null;
      this.state = null;
      
      return true;
    } catch (error) {
      logger.error('Failed to reset configuration', error);
      throw error;
    }
  }

  exportConfig() {
    const config = this.getConfig();
    const state = this.getState();
    
    return {
      config,
      state,
      exportedAt: new Date().toISOString()
    };
  }
}

// Singleton instance
const configManager = new ConfigManager();

export default configManager;
