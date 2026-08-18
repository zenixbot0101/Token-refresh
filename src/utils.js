import crypto from 'crypto';
import os from 'os';
import logger from './logger.js';

/**
 * Utility functions for the application
 */

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(text, key) {
  try {
    // Ensure key is 32 bytes for AES-256
    const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
    
    // Generate random IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV + encrypted + authTag
    return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
  } catch (error) {
    logger.error('Encryption failed', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData, key) {
  try {
    // Ensure key is 32 bytes for AES-256
    const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
    
    // Split the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generate a secure random key
 */
export function generateKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if running on Linux
 */
export function isLinux() {
  return os.platform() === 'linux';
}

/**
 * Check if running on supported OS
 */
export function isSupportedOS() {
  return isLinux();
}

/**
 * Get OS information
 */
export function getOSInfo() {
  return {
    platform: os.platform(),
    type: os.type(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname()
  };
}

/**
 * Get distribution information (Linux only)
 */
export async function getLinuxDistribution() {
  if (!isLinux()) {
    return null;
  }

  try {
    const { execa } = await import('execa');
    const { stdout } = await execa('cat', ['/etc/os-release']);
    
    const lines = stdout.split('\n');
    const info = {};
    
    lines.forEach(line => {
      const match = line.match(/^([A-Z_]+)="?(.+?)"?$/);
      if (match) {
        info[match[1]] = match[2];
      }
    });
    
    return {
      id: info.ID || 'unknown',
      name: info.NAME || 'Unknown',
      version: info.VERSION || info.VERSION_ID || 'unknown',
      idLike: info.ID_LIKE ? info.ID_LIKE.split(' ') : []
    };
  } catch (error) {
    logger.debug('Failed to get Linux distribution info');
    return null;
  }
}

/**
 * Check if distribution is Debian-based
 */
export function isDebianBased(distro) {
  if (!distro) return false;
  
  const debianLike = ['debian', 'ubuntu'];
  return debianLike.includes(distro.id) || 
         distro.idLike.some(id => debianLike.includes(id));
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format date for display
 */
export function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate next refresh time
 */
export function getNextRefreshTime(intervalMinutes = 30) {
  const now = new Date();
  const next = new Date(now.getTime() + intervalMinutes * 60 * 1000);
  return formatTimestamp(next);
}

/**
 * Validate token format (basic check)
 */
export function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Google access tokens typically start with ya29.
  // This is a basic validation - tokens can have different formats
  return token.length > 20;
}

/**
 * Sanitize path for cross-platform compatibility
 */
export function sanitizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * Check if command exists
 */
export async function commandExists(command) {
  try {
    const { execa } = await import('execa');
    await execa('command', ['-v', command]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute shell command with timeout
 */
export async function executeCommand(command, args = [], options = {}) {
  try {
    const { execa } = await import('execa');
    const timeout = options.timeout || 30000; // 30 seconds default
    
    const result = await execa(command, args, {
      timeout,
      ...options
    });
    
    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  } catch (error) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.exitCode || 1,
      error: error.message
    };
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retry(fn, options = {}) {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    onRetry = null
  } = options;

  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < retries) {
        const waitTime = delay * Math.pow(backoff, i);
        
        if (onRetry) {
          onRetry(i + 1, retries, waitTime, error);
        }
        
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError;
}

/**
 * Parse version string
 */
export function parseVersion(versionString) {
  const match = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    string: versionString
  };
}

/**
 * Compare versions
 */
export function compareVersions(v1, v2) {
  const version1 = typeof v1 === 'string' ? parseVersion(v1) : v1;
  const version2 = typeof v2 === 'string' ? parseVersion(v2) : v2;
  
  if (!version1 || !version2) return 0;
  
  if (version1.major !== version2.major) {
    return version1.major - version2.major;
  }
  if (version1.minor !== version2.minor) {
    return version1.minor - version2.minor;
  }
  return version1.patch - version2.patch;
}

/**
 * Generate unique user ID
 */
export function generateUserId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Mask sensitive data for display
 */
export function maskSensitiveData(data, visibleChars = 4) {
  if (!data || typeof data !== 'string') return '';
  if (data.length <= visibleChars) return '****';
  
  return data.substring(0, visibleChars) + '*'.repeat(Math.min(data.length - visibleChars, 20));
}

export default {
  encrypt,
  decrypt,
  generateKey,
  isValidEmail,
  isLinux,
  isSupportedOS,
  getOSInfo,
  getLinuxDistribution,
  isDebianBased,
  sleep,
  formatTimestamp,
  formatDate,
  getNextRefreshTime,
  isValidTokenFormat,
  sanitizePath,
  commandExists,
  executeCommand,
  retry,
  parseVersion,
  compareVersions,
  generateUserId,
  maskSensitiveData
};
