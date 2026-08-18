import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.logDir = path.join(os.homedir(), '.gcloud-token-manager', 'logs');
    this.logFile = path.join(this.logDir, `app-${this.getDateString()}.log`);
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error.message);
    }
  }

  getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  getTimestamp() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  writeToFile(level, message) {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level}] ${message}\n`;
      fs.appendFileSync(this.logFile, logMessage);
    } catch (error) {
      // Silent fail - don't block application if logging fails
    }
  }

  sanitizeMessage(message) {
    // Remove potential tokens from log messages
    // Pattern matches common token formats (ya29.*, Bearer *, etc.)
    const patterns = [
      /ya29\.[A-Za-z0-9_-]+/g,
      /Bearer\s+[A-Za-z0-9_-]+/g,
      /token[:\s]+[A-Za-z0-9_-]{20,}/gi,
      /"token"\s*:\s*"[^"]+"/g,
    ];

    let sanitized = message;
    patterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED_TOKEN]');
    });

    return sanitized;
  }

  info(message) {
    const sanitized = this.sanitizeMessage(message);
    console.log(chalk.blue('[INFO]'), sanitized);
    this.writeToFile('INFO', sanitized);
  }

  success(message) {
    const sanitized = this.sanitizeMessage(message);
    console.log(chalk.green('[OK]'), sanitized);
    this.writeToFile('SUCCESS', sanitized);
  }

  warning(message) {
    const sanitized = this.sanitizeMessage(message);
    console.log(chalk.yellow('[WARNING]'), sanitized);
    this.writeToFile('WARNING', sanitized);
  }

  error(message, error = null) {
    const sanitized = this.sanitizeMessage(message);
    console.log(chalk.red('[ERROR]'), sanitized);
    
    if (error) {
      const errorMessage = error.stack || error.message || String(error);
      const sanitizedError = this.sanitizeMessage(errorMessage);
      console.log(chalk.red('       '), sanitizedError);
      this.writeToFile('ERROR', `${sanitized} - ${sanitizedError}`);
    } else {
      this.writeToFile('ERROR', sanitized);
    }
  }

  debug(message) {
    if (process.env.DEBUG === 'true') {
      const sanitized = this.sanitizeMessage(message);
      console.log(chalk.gray('[DEBUG]'), sanitized);
      this.writeToFile('DEBUG', sanitized);
    }
  }

  step(stepNumber, totalSteps, message) {
    console.log(chalk.cyan(`[${stepNumber}/${totalSteps}]`), message);
    this.writeToFile('STEP', `[${stepNumber}/${totalSteps}] ${message}`);
  }

  header(title) {
    const line = '='.repeat(40);
    console.log(chalk.bold.cyan(`\n${line}`));
    console.log(chalk.bold.cyan(title.toUpperCase().padStart((40 + title.length) / 2)));
    console.log(chalk.bold.cyan(`${line}\n`));
    this.writeToFile('HEADER', title);
  }

  box(title, content) {
    const line = '═'.repeat(38);
    console.log(chalk.cyan(`╔${line}╗`));
    console.log(chalk.cyan(`║`) + chalk.bold(title.padEnd(38)) + chalk.cyan(`║`));
    console.log(chalk.cyan(`╚${line}╝`));
    
    if (content) {
      console.log();
      Object.entries(content).forEach(([key, value]) => {
        const sanitizedValue = this.sanitizeMessage(String(value));
        console.log(chalk.white(`${key.padEnd(12)}: ${sanitizedValue}`));
      });
      console.log();
    }
    
    this.writeToFile('BOX', `${title}: ${JSON.stringify(content || {})}`);
  }

  workerStatus(data) {
    const timestamp = this.getTimestamp();
    console.log(`[${chalk.green(timestamp)}]`, data.message);
    
    if (data.next) {
      console.log(chalk.gray(`Next refresh: ${data.next}`));
    }
    
    this.writeToFile('WORKER', `[${timestamp}] ${data.message}`);
  }

  table(data) {
    console.log();
    Object.entries(data).forEach(([key, value]) => {
      const sanitizedValue = this.sanitizeMessage(String(value));
      console.log(chalk.white(key.padEnd(15)), ':', chalk.cyan(sanitizedValue));
    });
    console.log();
  }
}

// Singleton instance
const logger = new Logger();

export default logger;
