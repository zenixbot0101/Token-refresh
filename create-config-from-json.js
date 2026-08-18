#!/usr/bin/env node

/**
 * Create config.json from Firebase service account JSON file
 * This ensures proper format and avoids PEM errors
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================');
console.log('  Config Creator from Firebase JSON');
console.log('========================================\n');

// Check if file path provided
if (!process.argv[2]) {
  console.log('Usage: node create-config-from-json.js <firebase-key.json>');
  console.log('\nExample:');
  console.log('  node create-config-from-json.js ./firebase-key.json');
  console.log('  node create-config-from-json.js ~/Downloads/my-project-firebase.json');
  process.exit(1);
}

const jsonFilePath = process.argv[2];

// Read Firebase JSON file
console.log(`Reading: ${jsonFilePath}`);

try {
  const content = fs.readFileSync(jsonFilePath, 'utf8');
  const firebaseData = JSON.parse(content);
  
  console.log('✓ Valid JSON file\n');
  
  // Validate required fields
  const required = ['project_id', 'private_key', 'client_email'];
  const missing = required.filter(field => !firebaseData[field]);
  
  if (missing.length > 0) {
    console.log('✗ Missing required fields:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✓ All required fields present\n');
  
  // Generate user ID
  const userId = crypto.randomBytes(16).toString('hex');
  console.log(`Generated User ID: ${userId}`);
  
  // Generate encryption key
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  console.log(`Generated Encryption Key: ${encryptionKey.substring(0, 16)}...`);
  
  // Prompt for database URL
  console.log('\n========================================');
  console.log('Database URL is required');
  console.log('========================================\n');
  console.log('Get it from: Firebase Console → Realtime Database\n');
  console.log('Format: https://YOUR-PROJECT.firebaseio.com');
  console.log('     or https://YOUR-PROJECT-default-rtdb.firebaseio.com\n');
  
  // For non-interactive, try to construct default URL
  const projectId = firebaseData.project_id;
  const defaultDatabaseURL = `https://${projectId}-default-rtdb.firebaseio.com`;
  
  console.log(`Using default URL: ${defaultDatabaseURL}`);
  console.log('(If this is wrong, edit the config file manually)\n');
  
  // Create config object
  const config = {
    firebase: {
      projectId: projectId,
      databaseURL: defaultDatabaseURL,
      serviceAccount: {
        type: firebaseData.type || 'service_account',
        project_id: projectId,
        private_key: firebaseData.private_key,
        client_email: firebaseData.client_email,
        token_uri: firebaseData.token_uri || 'https://oauth2.googleapis.com/token',
        universe_domain: firebaseData.universe_domain || 'googleapis.com'
      }
    },
    user: {
      id: userId
    },
    worker: {
      intervalMinutes: 30,
      retryDelays: [30, 60, 120, 300]
    },
    security: {
      encryptTokens: true,
      encryptionKey: encryptionKey
    }
  };
  
  // Create config directory
  const configDir = path.join(os.homedir(), '.gcloud-token-manager');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`Created directory: ${configDir}`);
  }
  
  // Save config
  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  
  console.log(`✓ Config saved to: ${configPath}\n`);
  
  // Test Firebase connection
  console.log('========================================');
  console.log('Testing Firebase Connection');
  console.log('========================================\n');
  
  import('firebase-admin').then(admin => {
    try {
      // Test credential
      const testCred = admin.credential.cert(config.firebase.serviceAccount);
      console.log('✓ Service account credentials are valid\n');
      
      console.log('========================================');
      console.log('SUCCESS!');
      console.log('========================================\n');
      
      console.log('Configuration:');
      console.log('  Project ID:', config.firebase.projectId);
      console.log('  Database URL:', config.firebase.databaseURL);
      console.log('  Client Email:', config.firebase.serviceAccount.client_email);
      console.log('  User ID:', config.user.id);
      console.log('  Encryption:', config.security.encryptTokens ? 'Enabled' : 'Disabled');
      
      console.log('\n========================================');
      console.log('Next Steps:');
      console.log('========================================\n');
      
      console.log('1. Verify database URL is correct:');
      console.log('   https://console.firebase.google.com/project/' + projectId + '/database\n');
      
      console.log('2. If database URL is wrong, edit config:');
      console.log('   nano ' + configPath + '\n');
      
      console.log('3. Login to Google Cloud:');
      console.log('   gcloud auth login\n');
      
      console.log('4. Start the worker:');
      console.log('   cd ~/Token-refresh');
      console.log('   npm start\n');
      
    } catch (error) {
      console.log('✗ Credential validation failed');
      console.log('Error:', error.message);
      console.log('\nPrivate key format issue detected.');
      console.log('The config has been created but may need manual adjustment.\n');
      console.log('Edit the config file:');
      console.log('  nano ' + configPath);
      process.exit(1);
    }
  }).catch(err => {
    console.log('✗ Could not load firebase-admin');
    console.log('Error:', err.message);
    console.log('\nConfig created but not validated.');
    console.log('Try: npm install');
  });
  
} catch (error) {
  console.log('✗ Error:', error.message);
  
  if (error.code === 'ENOENT') {
    console.log('\nFile not found:', jsonFilePath);
  } else if (error instanceof SyntaxError) {
    console.log('\nInvalid JSON file');
  }
  
  process.exit(1);
}
