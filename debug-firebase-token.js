#!/usr/bin/env node

/**
 * Debug Firebase Token
 * Check /globalToken path for bot integration
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('========================================');
console.log('  Firebase Token Debug Tool');
console.log('========================================\n');

// Load config
const configPath = path.join(os.homedir(), '.gcloud-token-manager', 'config.json');

if (!fs.existsSync(configPath)) {
  console.log('❌ Config not found:', configPath);
  console.log('\nRun setup first: npm run setup');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase
try {
  admin.initializeApp({
    credential: admin.credential.cert(config.firebase.serviceAccount),
    databaseURL: config.firebase.databaseURL
  });
  
  console.log('✓ Firebase connected\n');
} catch (error) {
  console.log('❌ Firebase init failed:', error.message);
  process.exit(1);
}

// Get /globalToken data
const db = admin.database();
const globalTokenRef = db.ref('globalToken');

globalTokenRef.once('value', (snapshot) => {
  const data = snapshot.val();
  
  console.log('=== Firebase /globalToken Contents ===\n');
  
  if (!data) {
    console.log('❌ No data at /globalToken path');
    console.log('\nPossible causes:');
    console.log('  1. Worker not running');
    console.log('  2. bot.enabled = false in config');
    console.log('  3. Firebase path is different');
    process.exit(0);
  }
  
  // Display raw data
  console.log(JSON.stringify(data, null, 2));
  console.log('\n=== Field Analysis ===\n');
  
  // Check fields
  const hasToken = !!data.token;
  const hasToken2 = !!data.token2;
  const hasProjectId = !!data.projectId;
  const hasProjectId2 = !!data.projectId2;
  
  console.log(`Has token (slot 1): ${hasToken}`);
  console.log(`Has token2 (slot 2): ${hasToken2}`);
  console.log(`Has projectId: ${hasProjectId}`);
  console.log(`Has projectId2: ${hasProjectId2}`);
  
  // Analyze token 1
  if (hasToken) {
    console.log('\nToken (slot 1):');
    console.log('  Preview:', data.token.substring(0, 40) + '...');
    console.log('  Length:', data.token.length);
    console.log('  Project:', data.projectId || 'N/A');
    
    if (data.tokenExpiresAt) {
      const expires = new Date(data.tokenExpiresAt);
      const now = new Date();
      const isExpired = now > expires;
      
      console.log('  Expires:', expires.toISOString(), isExpired ? '❌ EXPIRED' : '✓ Valid');
    }
    
    if (data.tokenCreatedAt) {
      const created = new Date(data.tokenCreatedAt);
      console.log('  Created:', created.toISOString());
    }
    
    console.log('  Is Service Account:', data.isServiceAccount || false);
    console.log('  Is ADC:', data.isAdc || false);
  }
  
  // Analyze token 2
  if (hasToken2) {
    console.log('\nToken2 (slot 2):');
    console.log('  Preview:', data.token2.substring(0, 40) + '...');
    console.log('  Length:', data.token2.length);
    console.log('  Project:', data.projectId2 || 'N/A');
    
    if (data.token2ExpiresAt) {
      const expires = new Date(data.token2ExpiresAt);
      const now = new Date();
      const isExpired = now > expires;
      
      console.log('  Expires:', expires.toISOString(), isExpired ? '❌ EXPIRED' : '✓ Valid');
    }
    
    if (data.token2CreatedAt) {
      const created = new Date(data.token2CreatedAt);
      console.log('  Created:', created.toISOString());
    }
    
    console.log('  Is Service Account:', data.isServiceAccount2 || false);
    console.log('  Is ADC:', data.isAdc2 || false);
  }
  
  // Last updated
  if (data.lastUpdated) {
    const updated = new Date(data.lastUpdated);
    const minutesAgo = Math.floor((Date.now() - data.lastUpdated) / 60000);
    console.log('\nLast Updated:', updated.toISOString(), `(${minutesAgo} minutes ago)`);
  }
  
  console.log('\n========================================');
  console.log('  Status Summary');
  console.log('========================================\n');
  
  if (hasToken) {
    const expires = new Date(data.tokenExpiresAt);
    const now = new Date();
    const isExpired = now > expires;
    
    if (isExpired) {
      console.log('❌ Token 1 EXPIRED - Worker may not be running');
    } else {
      const minutesLeft = Math.floor((expires - now) / 60000);
      console.log(`✓ Token 1 valid for ${minutesLeft} more minutes`);
    }
  } else {
    console.log('❌ No token 1 - Worker not writing to slot 1');
  }
  
  if (hasToken2) {
    const expires = new Date(data.token2ExpiresAt);
    const now = new Date();
    const isExpired = now > expires;
    
    if (isExpired) {
      console.log('❌ Token 2 EXPIRED - Backup worker may not be running');
    } else {
      const minutesLeft = Math.floor((expires - now) / 60000);
      console.log(`✓ Token 2 valid for ${minutesLeft} more minutes`);
    }
  } else if (!hasToken) {
    console.log('❌ No tokens available - Bot will fail');
  }
  
  console.log('\n');
  
  process.exit(0);
});
