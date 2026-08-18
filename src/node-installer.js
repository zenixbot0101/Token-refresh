import ora from 'ora';
import logger from './logger.js';
import { executeCommand } from './utils.js';

/**
 * Node.js Installer
 * Automatically installs Node.js 20.x on Linux systems
 */
class NodeInstaller {
  constructor() {
    this.spinner = null;
  }

  /**
   * Install Node.js 20.x using NodeSource repository
   */
  async install() {
    logger.header('Node.js Installation');

    logger.info('Installing Node.js 20.x...');
    logger.info('This may take several minutes');
    console.log();

    try {
      // Check if running with sufficient privileges
      await this.checkPrivileges();

      // Add NodeSource repository
      await this.addNodeSourceRepository();

      // Install Node.js
      await this.installNodePackage();

      // Verify installation
      const verified = await this.verifyInstallation();

      if (verified) {
        logger.success('Node.js installed successfully');
        return { success: true };
      } else {
        throw new Error('Installation verification failed');
      }
    } catch (error) {
      logger.error('Failed to install Node.js', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has sufficient privileges
   */
  async checkPrivileges() {
    this.spinner = ora('Checking privileges...').start();

    try {
      const result = await executeCommand('sudo', ['-n', 'true'], { timeout: 5000 });

      if (result.success) {
        this.spinner.succeed('Privileges verified');
        return true;
      }

      this.spinner.warn('Sudo access required');
      logger.warning('This installation requires sudo privileges');

      return true;
    } catch (error) {
      this.spinner.fail('Privilege check failed');
      throw new Error('Sudo access is required for installation');
    }
  }

  /**
   * Add NodeSource repository
   */
  async addNodeSourceRepository() {
    this.spinner = ora('Adding NodeSource repository...').start();

    try {
      // Install required packages
      this.spinner.text = 'Installing prerequisites...';
      await executeCommand('sudo', [
        'apt-get',
        'update'
      ], { timeout: 120000 });

      await executeCommand('sudo', [
        'apt-get',
        'install',
        '-y',
        'ca-certificates',
        'curl',
        'gnupg'
      ], { timeout: 120000 });

      // Create keyrings directory
      await executeCommand('sudo', [
        'mkdir',
        '-p',
        '/etc/apt/keyrings'
      ]);

      // Download and add NodeSource GPG key
      this.spinner.text = 'Adding NodeSource GPG key...';
      const keyResult = await executeCommand('bash', [
        '-c',
        'curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg'
      ], { timeout: 60000 });

      if (!keyResult.success) {
        throw new Error('Failed to add NodeSource GPG key');
      }

      // Add NodeSource repository
      this.spinner.text = 'Adding repository...';
      const NODE_MAJOR = 20;
      const repoResult = await executeCommand('bash', [
        '-c',
        `echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list`
      ], { timeout: 10000 });

      if (!repoResult.success) {
        throw new Error('Failed to add repository');
      }

      // Update package list
      this.spinner.text = 'Updating package list...';
      await executeCommand('sudo', [
        'apt-get',
        'update'
      ], { timeout: 120000 });

      this.spinner.succeed('NodeSource repository added');
      return true;
    } catch (error) {
      this.spinner.fail('Failed to add NodeSource repository');
      throw error;
    }
  }

  /**
   * Install Node.js package
   */
  async installNodePackage() {
    this.spinner = ora('Installing Node.js...').start();

    try {
      const result = await executeCommand('sudo', [
        'apt-get',
        'install',
        '-y',
        'nodejs'
      ], { timeout: 300000 });

      if (!result.success) {
        throw new Error('Failed to install Node.js package');
      }

      this.spinner.succeed('Node.js package installed');
      return true;
    } catch (error) {
      this.spinner.fail('Failed to install Node.js package');
      throw error;
    }
  }

  /**
   * Verify installation
   */
  async verifyInstallation() {
    this.spinner = ora('Verifying installation...').start();

    try {
      const nodeResult = await executeCommand('node', ['--version']);
      const npmResult = await executeCommand('npm', ['--version']);

      if (!nodeResult.success || !npmResult.success) {
        throw new Error('Node.js or npm not found after installation');
      }

      const nodeVersion = nodeResult.stdout.trim();
      const npmVersion = npmResult.stdout.trim();

      this.spinner.succeed(`Installation verified - Node.js ${nodeVersion}, npm ${npmVersion}`);
      return true;
    } catch (error) {
      this.spinner.fail('Installation verification failed');
      throw error;
    }
  }

  /**
   * Display manual installation instructions
   */
  displayManualInstructions() {
    logger.header('Manual Node.js Installation Instructions');

    logger.info('Please install Node.js 20.x manually:');
    console.log();

    logger.info('1. Using NodeSource repository:');
    console.log('   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -');
    console.log('   sudo apt-get install -y nodejs');
    console.log();

    logger.info('2. Or download from official website:');
    console.log('   https://nodejs.org/');
    console.log();

    logger.info('3. After installation, verify:');
    console.log('   node --version');
    console.log('   npm --version');
    console.log();
  }
}

export default NodeInstaller;
