import logger from './logger.js';
import {
  isSupportedOS,
  getOSInfo,
  getLinuxDistribution,
  isDebianBased,
  commandExists,
  executeCommand,
  parseVersion,
  compareVersions
} from './utils.js';

/**
 * System Scanner - Detects OS, Node.js, and gcloud CLI
 */
class Scanner {
  constructor() {
    this.osInfo = null;
    this.distroInfo = null;
    this.nodeVersion = null;
    this.gcloudInstalled = false;
    this.gcloudVersion = null;
  }

  /**
   * Run full system scan
   */
  async scan() {
    logger.header('System Scan');

    const results = {
      os: await this.checkOS(),
      node: await this.checkNode(),
      gcloud: await this.checkGCloud()
    };

    return results;
  }

  /**
   * Check operating system
   */
  async checkOS() {
    logger.step(1, 3, 'Detecting operating system...');

    try {
      this.osInfo = getOSInfo();
      
      if (!isSupportedOS()) {
        logger.error(`Unsupported operating system: ${this.osInfo.platform}`);
        logger.info('This application only supports Linux systems');
        logger.info('Supported distributions: Ubuntu 20.04+, Debian 11+');
        
        return {
          supported: false,
          platform: this.osInfo.platform,
          reason: 'Not a Linux system'
        };
      }

      // Get Linux distribution details
      this.distroInfo = await getLinuxDistribution();
      
      if (!this.distroInfo) {
        logger.warning('Could not detect Linux distribution');
        logger.info('Proceeding with generic Linux support');
        
        return {
          supported: true,
          platform: 'linux',
          distribution: 'unknown',
          version: 'unknown',
          debianBased: false
        };
      }

      const debianBased = isDebianBased(this.distroInfo);
      
      logger.success('Linux detected');
      logger.info(`Distribution: ${this.distroInfo.name} ${this.distroInfo.version}`);
      logger.info(`Architecture: ${this.osInfo.arch}`);
      
      if (debianBased) {
        logger.success('Debian-based distribution detected');
      } else {
        logger.warning('Non-Debian distribution detected');
        logger.info('Automatic gcloud installation may not be available');
      }

      return {
        supported: true,
        platform: 'linux',
        distribution: this.distroInfo.id,
        version: this.distroInfo.version,
        name: this.distroInfo.name,
        debianBased,
        arch: this.osInfo.arch
      };
    } catch (error) {
      logger.error('Failed to detect operating system', error);
      throw error;
    }
  }

  /**
   * Check Node.js version
   */
  async checkNode() {
    logger.step(2, 3, 'Checking Node.js version...');

    try {
      const result = await executeCommand('node', ['--version']);
      
      if (!result.success) {
        logger.error('Node.js is not installed or not in PATH');
        
        return {
          installed: false,
          version: null,
          compatible: false,
          reason: 'Node.js not found'
        };
      }

      const versionString = result.stdout.trim();
      const version = parseVersion(versionString);
      
      if (!version) {
        logger.warning(`Could not parse Node.js version: ${versionString}`);
        
        return {
          installed: true,
          version: versionString,
          compatible: false,
          reason: 'Could not parse version'
        };
      }

      this.nodeVersion = version;

      // Check if version is 20.0.0 or higher
      const minVersion = { major: 20, minor: 0, patch: 0 };
      const compatible = compareVersions(version, minVersion) >= 0;

      if (compatible) {
        logger.success(`Node.js ${versionString} detected`);
      } else {
        logger.error(`Node.js ${versionString} is too old`);
        logger.info('Node.js 20.0.0 or higher is required');
        logger.info('Please upgrade Node.js before continuing');
        logger.info('Visit: https://nodejs.org/');
      }

      return {
        installed: true,
        version: versionString,
        versionParsed: version,
        compatible,
        reason: compatible ? 'Compatible version' : 'Version too old (requires 20.0.0+)'
      };
    } catch (error) {
      logger.error('Failed to check Node.js version', error);
      throw error;
    }
  }

  /**
   * Check Google Cloud CLI
   */
  async checkGCloud() {
    logger.step(3, 3, 'Checking Google Cloud CLI...');

    try {
      // Try multiple methods to find gcloud
      let exists = false;
      let gcloudPath = null;

      // Method 1: Check with which
      const whichResult = await executeCommand('which', ['gcloud']);
      if (whichResult.success && whichResult.stdout.trim()) {
        exists = true;
        gcloudPath = whichResult.stdout.trim();
      }

      // Method 2: Check with command -v
      if (!exists) {
        const commandResult = await executeCommand('command', ['-v', 'gcloud']);
        if (commandResult.success && commandResult.stdout.trim()) {
          exists = true;
          gcloudPath = commandResult.stdout.trim();
        }
      }

      // Method 3: Check common installation paths
      if (!exists) {
        const commonPaths = [
          '/usr/bin/gcloud',
          '/usr/local/bin/gcloud',
          '/snap/bin/gcloud',
          `${process.env.HOME}/google-cloud-sdk/bin/gcloud`
        ];

        for (const path of commonPaths) {
          const testResult = await executeCommand('test', ['-f', path]);
          if (testResult.success) {
            exists = true;
            gcloudPath = path;
            break;
          }
        }
      }
      
      if (!exists) {
        logger.warning('Google Cloud CLI is not installed');
        this.gcloudInstalled = false;
        
        return {
          installed: false,
          version: null,
          path: null,
          reason: 'gcloud command not found'
        };
      }

      // Get gcloud version
      const versionResult = await executeCommand('gcloud', ['--version']);
      
      if (!versionResult.success) {
        // gcloud exists but can't get version - still consider it installed
        logger.success('Google Cloud CLI detected');
        logger.info(`Path: ${gcloudPath}`);
        
        this.gcloudInstalled = true;
        
        return {
          installed: true,
          version: 'installed',
          path: gcloudPath,
          reason: 'Installed and available'
        };
      }

      // Parse version from output
      // Output format: "Google Cloud SDK 450.0.0..."
      const versionMatch = versionResult.stdout.match(/Google Cloud SDK (\d+\.\d+\.\d+)/);
      const versionString = versionMatch ? versionMatch[1] : 'installed';

      this.gcloudInstalled = true;
      this.gcloudVersion = versionString;

      logger.success('Google Cloud CLI detected');
      logger.info(`Version: ${versionString}`);
      logger.info(`Path: ${gcloudPath}`);

      return {
        installed: true,
        version: versionString,
        path: gcloudPath,
        reason: 'Installed and functional'
      };
    } catch (error) {
      logger.error('Failed to check Google Cloud CLI', error);
      throw error;
    }
  }

  /**
   * Validate system requirements
   */
  async validateRequirements() {
    const results = await this.scan();

    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check OS
    if (!results.os.supported) {
      validation.valid = false;
      validation.errors.push('Unsupported operating system');
    } else if (!results.os.debianBased) {
      validation.warnings.push('Non-Debian distribution - manual gcloud installation may be required');
    }

    // Check Node.js
    if (!results.node.installed) {
      validation.valid = false;
      validation.errors.push('Node.js is not installed');
    } else if (!results.node.compatible) {
      validation.valid = false;
      validation.errors.push('Node.js version 20.0.0+ is required');
    }

    // Check gcloud (warning only, can be installed)
    if (!results.gcloud.installed) {
      validation.warnings.push('Google Cloud CLI is not installed (will be installed automatically)');
    }

    return {
      ...validation,
      results
    };
  }

  /**
   * Display scan summary
   */
  displaySummary(results) {
    logger.header('System Summary');

    logger.table({
      'Operating System': results.os.supported ? 
        `${results.os.name || 'Linux'} (${results.os.distribution})` : 
        'Unsupported',
      'Node.js': results.node.installed ? 
        `${results.node.version} ${results.node.compatible ? '✓' : '✗'}` : 
        'Not installed',
      'Google Cloud CLI': results.gcloud.installed ? 
        `${results.gcloud.version} ✓` : 
        'Not installed'
    });

    console.log();
  }

  /**
   * Get system capabilities
   */
  getCapabilities(results) {
    return {
      canInstallGCloud: results.os.supported && results.os.debianBased,
      canRunWorker: results.os.supported && results.node.compatible,
      needsGCloudInstall: !results.gcloud.installed,
      needsNodeUpgrade: results.node.installed && !results.node.compatible
    };
  }
}

export default Scanner;
