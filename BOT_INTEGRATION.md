# Bot Integration Guide

## 📖 Overview

This worker automatically writes Google Cloud access tokens to Firebase for Discord bot consumption. The bot reads tokens from `/globalToken` path and uses them to create/delete GCP VMs.

## 🎯 Features

- ✅ **Zero Config** - One command setup
- ✅ **Auto Install** - Installs gcloud if missing
- ✅ **Auto Login** - Prompts for login if needed
- ✅ **Dual Slots** - Primary (token) + Backup (token2)
- ✅ **30-min Refresh** - Tokens expire after 1 hour
- ✅ **Bot Auto-Sync** - Bot detects changes within 5-10s

## 🚀 Quick Start

### 1. Setup Worker

```bash
cd ~/Token-refresh
git pull
npm install
npm run setup
```

When prompted:
- **Firebase Project ID**: Your Firebase project
- **Database URL**: https://your-project.firebaseio.com
- **Client Email**: firebase-adminsdk-xxxxx@...
- **Private Key**: Paste entire key
- **User ID**: Auto-generated
- **Encryption**: Choose **NO** (bot needs plain text)

### 2. Configure Bot Integration

After setup, edit config:

```bash
nano ~/.gcloud-token-manager/config.json
```

Add these fields:

```json
{
  "firebase": {
    "projectId": "dung-7a41b",
    "databaseURL": "https://dung-7a41b-default-rtdb.firebaseio.com",
    "serviceAccount": { ... }
  },
  "gcloud": {
    "projectId": "qwiklabs-gcp-02-xxxxx"
  },
  "bot": {
    "enabled": true,
    "tokenSlot": 1,
    "firebasePath": "globalToken"
  },
  "user": {
    "id": "..."
  },
  "worker": {
    "intervalMinutes": 30,
    "tokenLifetimeMs": 3600000
  },
  "security": {
    "encryptTokens": false
  }
}
```

**Important Config:**
- `gcloud.projectId` - Your GCP project ID (qwiklabs-gcp-02-xxxxx)
- `bot.enabled` - Set to `true` to write to /globalToken
- `bot.tokenSlot` - 1 for primary, 2 for backup
- `security.encryptTokens` - Must be `false` (bot needs plain text)

### 3. Start Worker

```bash
npm start
```

Worker will:
1. Login to Google Cloud (browser opens)
2. Get access token
3. Write to `/globalToken` path in Firebase
4. Refresh every 30 minutes

## 🔧 Token Slots

Worker supports 2 token slots:

| Slot | Firebase Fields | Bot Behavior | Use Case |
|------|----------------|--------------|----------|
| **1** | `token`, `projectId` | Primary token | Default, recommended |
| **2** | `token2`, `projectId2` | Backup token | Multiple projects |

### Configure Slot

In config.json:

```json
{
  "bot": {
    "tokenSlot": 1  // 1 = primary, 2 = backup
  }
}
```

## 📊 Firebase Structure

```json
{
  "globalToken": {
    // Slot 1 (Primary)
    "token": "ya29.a0ARGnu0...",
    "projectId": "qwiklabs-gcp-02-xxxxx",
    "tokenCreatedAt": 1787051400000,
    "tokenExpiresAt": 1787055000000,
    "isServiceAccount": false,
    "isAdc": false,
    "lastUpdated": 1787051400000,
    
    // Slot 2 (Backup) - if enabled
    "token2": "ya29.a0ARGnu0...",
    "projectId2": "qwiklabs-gcp-03-yyyyy",
    "token2CreatedAt": 1787051400000,
    "token2ExpiresAt": 1787055000000,
    "isServiceAccount2": false,
    "isAdc2": false
  },
  
  "users": {
    "USER_ID": {
      "gcloud": {
        "token": "<encrypted-if-enabled>",
        "projectId": "qwiklabs-gcp-02-xxxxx",
        ...
      }
    }
  }
}
```

**Note:** `/globalToken` path has **PLAIN TEXT** tokens for bot. `/users/USER_ID` path can have encrypted tokens.

## 🔄 Bot Auto-Sync Flow

```
┌─────────────┐
│   Worker    │  Every 30 minutes
│   (Linux)   │  gcloud auth print-access-token
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Firebase   │  /globalToken path
│  Realtime   │  token + projectId + timestamps
│   Database  │
└──────┬──────┘
       │ Firebase listener (bot)
       ↓
┌─────────────┐
│     Bot     │  Auto-detect change
│  (Windows)  │  Sync within 5-10s
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ Google      │  Create/Delete VMs
│ Cloud       │  using token
│ Platform    │
└─────────────┘
```

## 📝 Worker Logs

```bash
╔══════════════════════════════════════╗
║GCLOUD TOKEN AUTH MANAGER             ║
╚══════════════════════════════════════╝

[01:32:29] Refreshing access token...
[OK] Access token refreshed
[OK] Firebase updated (974ms)
[OK] Bot token updated

Next refresh: 02:02:30
```

## 🔍 Verify Bot Token

### Check Firebase Console

1. Go to: https://console.firebase.google.com/
2. Select your project
3. Realtime Database
4. Navigate to `/globalToken`
5. Verify token exists and not expired

### Check with Script

```bash
# On bot machine (Windows)
node debug-firebase-token.js
```

Output:
```
=== Firebase /globalToken Contents ===
{
  "token": "ya29.a0ARGnu0...",
  "projectId": "qwiklabs-gcp-02-xxxxx",
  "tokenExpiresAt": 1787055000000,
  "tokenCreatedAt": 1787051400000
}

Token (slot 1):
  Preview: ya29.a0ARGnu0ZyT4gDvfSIomnBuAR...
  Project: qwiklabs-gcp-02-xxxxx
  Expires: 2026-08-18T08:30:00.000Z ✓ Valid
  Created: 2026-08-18T07:30:00.000Z
```

## 🛠️ Troubleshooting

### Bot Gets 401 Error

**Symptoms:**
```
401 - ACCESS_TOKEN_TYPE_UNSUPPORTED
```

**Causes:**
1. Worker not running → No token in Firebase
2. Token expired → Worker stopped
3. Wrong project ID

**Solutions:**

**Check 1: Worker running?**
```bash
ps aux | grep "node src/index.js"
```

**Check 2: Token in Firebase?**
```bash
node debug-firebase-token.js
```

**Check 3: Token expired?**
```
Token expires: 2026-08-18T08:30:00.000Z
Current time:  2026-08-18T08:35:00.000Z  ← EXPIRED!
```

**Fix:** Restart worker to refresh immediately:
```bash
npm start
```

### Bot Not Syncing New Token

**Cause:** Firebase listener not triggered

**Solution:** Restart bot:
```bash
# On bot machine
npm start
```

### Token Encrypted in /globalToken

**Cause:** `security.encryptTokens` is `true`

**Solution:** Set to `false`:
```bash
nano ~/.gcloud-token-manager/config.json
# Change "encryptTokens": true → false
```

Restart worker:
```bash
npm start
```

## 🎯 Best Practices

### 1. Multi-Worker Setup

Run 2 workers for redundancy:

```bash
# Worker 1 - Slot 1
{
  "bot": { "tokenSlot": 1 },
  "worker": { "intervalMinutes": 30 }
}

# Worker 2 - Slot 2  
{
  "bot": { "tokenSlot": 2 },
  "worker": { "intervalMinutes": 31 }
}
```

Bot automatically falls back to token2 if token1 unavailable.

### 2. Monitor Worker Health

```bash
# Setup cron to restart if worker dies
*/10 * * * * pgrep -f "node src/index.js" || (cd ~/Token-refresh && npm start >> /tmp/worker-restart.log 2>&1 &)
```

### 3. Firebase Security Rules

```json
{
  "rules": {
    "globalToken": {
      ".read": true,
      ".write": false
    }
  }
}
```

**Note:** Bot needs read access. Only worker (Firebase Admin SDK) can write.

### 4. Token Rotation

Rotate GCP project weekly to avoid quota limits:

```bash
# Week 1
"gcloud": { "projectId": "qwiklabs-gcp-02-xxxxx" }

# Week 2
"gcloud": { "projectId": "qwiklabs-gcp-03-yyyyy" }
```

## 📚 Related Docs

- [Main README](./README.md) - General setup guide
- [Quick Fix Guide](./QUICK_FIX.md) - Troubleshooting
- [Vietnamese Guide](./HUONG_DAN.md) - Hướng dẫn tiếng Việt

## 🆘 Support

**Check Status:**
```bash
# Worker logs
cat ~/.gcloud-token-manager/logs/app-*.log

# Bot token status
node debug-firebase-token.js

# Worker process
ps aux | grep "node src/index.js"
```

**Common Commands:**
```bash
# Start worker
npm start

# Stop worker
Ctrl+C

# View live logs
tail -f ~/.gcloud-token-manager/logs/app-*.log

# Check config
cat ~/.gcloud-token-manager/config.json
```

---

**Worker is now ready for bot integration!** 🚀

Bot will automatically detect token updates and sync within 5-10 seconds.
