import ora from 'ora';
import logger from './logger.js';
import { executeCommand, sleep, retry } from './utils.js';

/**
 * Google Cloud CLI Installer
 * Supports Debian/Ubuntu systems
 */
class GCloudInstaller {
  constructor() {
    this.spinner = null;
  }

  /**
   * Install Google Cloud CLI on Debian/Ubuntu
   */
  async install() {
    logger.header('Google Cloud CLI Installation');

    logger.info('Installing Google Cloud CLI...');
    logger.info('This may take several minutes');
    console.log();

    try {
      // Check if running with sufficient privileges
      await this.checkPrivileges();

      // Install required dependencies
      await this.installDependencies();

      // Add Google Cloud package source
      await this.addPackageSource();

      // Install gcloud CLI
      await this.installGCloudPackage();

      // Verify installation
      const verified = await this.verifyInstallation();

      if (verified) {
        logger.success('Google Cloud CLI installed successfully');
        return { success: true };
      } else {
        throw new Error('Installation verification failed');
      }
    } catch (error) {
      logger.error('Failed to install Google Cloud CLI', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has sufficient privileges
   */
  async checkPrivileges() {
    this.spinner = ora('Checking privileges...').start();

    try {
      // Check if sudo is available
      const result = await executeCommand('sudo', ['-n', 'true'], { timeout: 5000 });

      if (result.success) {
        this.spinner.succeed('Privileges verified');
        return true;
      }

      this.spinner.warn('Sudo access required');
      logger.warning('This installation requires sudo privileges');
      logger.info('You may be prompted for your password');
      await sleep(2000);

      return true;
    } catch (error) {
      this.spinner.fail('Privilege check failed');
      throw new Error('Sudo access is required for installation');
    }
  }

  /**
   * Install required dependencies
   */
  async installDependencies() {
    this.spinner = ora('Installing dependencies...').start();

    try {
      // Update package list
      this.spinner.text = 'Updating package list...';
      const updateResult = await executeCommand('sudo', [
        'apt-get',
        'update'
      ], { timeout: 120000 });

      if (!updateResult.success) {
        throw new Error('Failed to update package list');
      }

      // Install required packages
      this.spinner.text = 'Installing required packages...';
      const packages = [
        'apt-transport-https',
        'ca-certificates',
        'gnupg',
        'curl'
      ];

      const installResult = await executeCommand('sudo', [
        'apt-get',
        'install',
        '-y',
        ...packages
      ], { timeout: 180000 });

      if (!installResult.success) {
        throw new Error('Failed to install dependencies');
      }

      this.spinner.succeed('Dependencies installed');
      return true;
    } catch (error) {
      this.spinner.fail('Failed to install dependencies');
      throw error;
    }
  }

  /**
   * Add Google Cloud package source
   */
  async addPackageSource() {
    this.spinner = ora('Adding Google Cloud package source...').start();

    try {
      // Add Google Cloud GPG key
      this.spinner.text = 'Adding GPG key...';
      
      const keyResult = await executeCommand('bash', [
        '-c',
        'curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg'
      ], { timeout: 60000 });

      if (!keyResult.success) {
        throw new Error('Failed to add GPG key');
      }

      // Add repository
      this.spinner.text = 'Adding repository...';
      
      const repoResult = await executeCommand('bash', [
        '-c',
        'echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list'
      ], { timeout: 10000 });

      if (!repoResult.success) {
        throw new Error('Failed to add repository');
      }

      // Update package list again
      this.spinner.text = 'Updating package list...';
      
      const updateResult = await executeCommand('sudo', [
        'apt-get',
        'update'
      ], { timeout: 120000 });

      if (!updateResult.success) {
        throw new Error('Failed to update package list after adding repository');
      }

      this.spinner.succeed('Package source added');
      return true;
    } catch (error) {
      this.spinner.fail('Failed to add package source');
      throw error;
    }
  }

  /**
   * Install gcloud package
   */
  async installGCloudPackage() {
    this.spinner = ora('Installing Google Cloud CLI...').start();

    try {
      const result = await executeCommand('sudo', [
        'apt-get',
        'install',
        '-y',
        'google-cloud-cli'
      ], { timeout: 300000 }); // 5 minutes timeout

      if (!result.success) {
        throw new Error('Failed to install google-cloud-cli package');
      }

      this.spinner.succeed('Google Cloud CLI package installed');
      return true;
    } catch (error) {
      this.spinner.fail('Failed to install Google Cloud CLI package');
      throw error;
    }
  }

  /**
   * Verify installation
   */
  async verifyInstallation() {
    this.spinner = ora('Verifying installation...').start();

    try {
      // Check if gcloud command is available
      const commandCheck = await executeCommand('command', ['-v', 'gcloud']);

      if (!commandCheck.success) {
        // Try to source shell profile and check again
        await sleep(2000);
        
        const retryCheck = await executeCommand('bash', [
          '-c',
          'source ~/.bashrc && command -v gcloud'
        ]);

        if (!retryCheck.success) {
          throw new Error('gcloud command not found after installation');
        }
      }

      // Get version to confirm it's working
      const versionResult = await executeCommand('gcloud', ['--version']);

      if (!versionResult.success) {
        throw new Error('gcloud installed but not functional');
      }

      // Parse version
      const versionMatch = versionResult.stdout.match(/Google Cloud SDK (\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      this.spinner.succeed(`Installation verified (version ${version})`);
      return true;
    } catch (error) {
      this.spinner.fail('Installation verification failed');
      throw error;
    }
  }

  /**
   * Alternative installation using install script
   */
  async installViaScript() {
    logger.header('Alternative Installation Method');
    logger.info('Installing via official installation script...');
    console.log();

    this.spinner = ora('Downloading installation script...').start();

    try {
      // Download and run the installation script
      const result = await executeCommand('bash', [
        '-c',
        'curl https://sdk.cloud.google.com | bash'
      ], { timeout: 600000 }); // 10 minutes timeout

      if (!result.success) {
        throw new Error('Script installation failed');
      }

      this.spinner.succeed('Installation script completed');

      // Initialize gcloud
      logger.info('Please restart your terminal or run:');
      logger.info('  source ~/.bashrc');
      logger.info('  gcloud init');

      return { success: true, requiresRestart: true };
    } catch (error) {
      this.spinner.fail('Script installation failed');
      logger.error('Alternative installation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Provide manual installation instructions
   */
  displayManualInstructions() {
    logger.header('Manual Installation Instructions');

    logger.info('Please install Google Cloud CLI manually:');
    console.log();

    logger.info('1. For Debian/Ubuntu:');
    console.log('   curl https://sdk.cloud.google.com | bash');
    console.log('   exec -l $SHELL');
    console.log();

    logger.info('2. Or visit the official documentation:');
    console.log('   https://cloud.google.com/sdk/docs/install');
    console.log();

    logger.info('3. After installation, verify:');
    console.log('   gcloud --version');
    console.log();

    logger.info('4. Then run this application again:');
    console.log('   npm start');
    console.log();
  }

  /**
   * Check if automatic installation is supported
   */
  isAutomaticInstallSupported(osInfo) {
    // Only support Debian-based distributions
    return osInfo.debianBased === true;
  }

  /**
   * Main installation flow with fallbacks
   */
  async installWithFallback(osInfo) {
    // Check if automatic installation is supported
    if (!this.isAutomaticInstallSupported(osInfo)) {
      logger.warning('Automatic installation is not supported on this distribution');
      this.displayManualInstructions();
      return { success: false, manual: true };
    }

    logger.info('Attempting automatic installation...');
    console.log();

    // Try package manager installation
    let result = await this.install();

    if (result.success) {
      return result;
    }

    // If package installation fails, try script installation
    logger.warning('Package installation failed, trying alternative method...');
    console.log();

    result = await this.installViaScript();

    if (result.success) {
      return result;
    }

    // If both methods fail, show manual instructions
    logger.error('Automatic installation failed');
    this.displayManualInstructions();

    return { success: false, manual: true };
  }

  /**
   * Uninstall Google Cloud CLI
   */
  async uninstall() {
    logger.header('Uninstalling Google Cloud CLI');

    this.spinner = ora('Removing Google Cloud CLI...').start();

    try {
      const result = await executeCommand('sudo', [
        'apt-get',
        'remove',
        '-y',
        'google-cloud-cli'
      ], { timeout: 120000 });

      if (!result.success) {
        throw new Error('Failed to uninstall');
      }

      this.spinner.succeed('Google Cloud CLI removed');
      return { success: true };
    } catch (error) {
      this.spinner.fail('Uninstallation failed');
      logger.error('Failed to uninstall Google Cloud CLI', error);
      return { success: false, error: error.message };
    }
  }
}

export default GCloudInstaller;
