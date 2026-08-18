#!/usr/bin/env node

/**
 * Test Firebase Private Key Format
 * This script helps diagnose private key formatting issues
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================');
console.log('  Firebase Private Key Format Tester');
console.log('========================================\n');

// Method 1: Test from JSON file
if (process.argv[2]) {
  const jsonPath = process.argv[2];
  
  console.log(`Reading from: ${jsonPath}`);
  
  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(content);
    
    console.log('\n✓ Valid JSON file');
    console.log('\nChecking private_key field...\n');
    
    const privateKey = data.private_key;
    
    if (!privateKey) {
      console.log('✗ No private_key field found');
      process.exit(1);
    }
    
    console.log('Key length:', privateKey.length);
    console.log('Has BEGIN marker:', privateKey.includes('BEGIN PRIVATE KEY'));
    console.log('Has END marker:', privateKey.includes('END PRIVATE KEY'));
    console.log('Has \\n characters:', privateKey.includes('\\n'));
    console.log('Has newlines:', privateKey.includes('\n'));
    
    console.log('\nFirst 100 chars:');
    console.log(privateKey.substring(0, 100));
    
    console.log('\nLast 100 chars:');
    console.log(privateKey.substring(privateKey.length - 100));
    
    // Test if it needs conversion
    if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
      console.log('\n⚠ Key has literal \\n - needs conversion');
      const converted = privateKey.replace(/\\n/g, '\n');
      console.log('\nConverted first 200 chars:');
      console.log(converted.substring(0, 200));
    } else if (privateKey.includes('\n')) {
      console.log('\n✓ Key has proper newlines');
    } else {
      console.log('\n✗ Key has no line breaks - invalid format');
    }
    
    // Try to create a test service account
    console.log('\n========================================');
    console.log('Testing with Firebase Admin...');
    console.log('========================================\n');
    
    import('firebase-admin').then(admin => {
      try {
        const testCred = admin.credential.cert({
          type: 'service_account',
          project_id: data.project_id,
          private_key: privateKey,
          client_email: data.client_email
        });
        
        console.log('✓ Private key format is valid!');
        console.log('\nYou can use this key in the setup.');
      } catch (error) {
        console.log('✗ Private key format is invalid');
        console.log('Error:', error.message);
        
        // Try with conversion
        if (privateKey.includes('\\n')) {
          console.log('\nTrying with converted newlines...');
          const converted = privateKey.replace(/\\n/g, '\n');
          
          try {
            const testCred2 = admin.credential.cert({
              type: 'service_account',
              project_id: data.project_id,
              private_key: converted,
              client_email: data.client_email
            });
            
            console.log('✓ Converted key is valid!');
            console.log('\nUse this format (with actual newlines):');
            console.log(converted.substring(0, 200) + '...');
          } catch (error2) {
            console.log('✗ Conversion also failed');
            console.log('Error:', error2.message);
          }
        }
      }
    });
    
  } catch (error) {
    console.log('✗ Error reading file:', error.message);
    process.exit(1);
  }
} else {
  console.log('Usage: node test-firebase-key.js <path-to-firebase-key.json>');
  console.log('\nExample:');
  console.log('  node test-firebase-key.js ./firebase-key.json');
  console.log('  node test-firebase-key.js ~/Downloads/my-project-firebase.json');
}
