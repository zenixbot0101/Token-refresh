# Configuration Guide

## 📋 Quick Setup

After cloning the repository, you need to create your config file:

```bash
cd ~/Token-refresh

# Copy example config to user directory
cp config/config.json ~/.gcloud-token-manager/config.json

# Edit config
nano ~/.gcloud-token-manager/config.json
```

## 🔧 Configuration Fields

### 1. Firebase Configuration

```json
{
  "firebase": {
    "projectId": "your-firebase-project-id",
    "databaseURL": "https://your-firebase-project.firebaseio.com",
    "serviceAccount": {
      "type": "service_account",
      "project_id": "your-firebase-project-id",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
      "token_uri": "https://oauth2.googleapis.com/token",
      "universe_domain": "googleapis.com"
    }
  }
}
```

**How to get:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download JSON file
6. Copy values from JSON:
   - `project_id` → `projectId` and `serviceAccount.project_id`
   - `private_key` → `serviceAccount.private_key`
   - `client_email` → `serviceAccount.client_email`

**Database URL:**
1. Go to Realtime Database in Firebase Console
2. Copy the database URL (e.g., `https://your-project.firebaseio.com`)

---

### 2. Google Cloud Configuration

```json
{
  "gcloud": {
    "projectId": "qwiklabs-gcp-02-xxxxx"
  }
}
```

**How to get:**

```bash
# On Linux server
gcloud config get-value project
```

Or:

```bash
gcloud projects list
```

**Important:** Use your **REAL** GCP project ID, not placeholder!

**Common formats:**
- Qwiklabs: `qwiklabs-gcp-02-e44272075ef7`
- Regular: `my-project-123456`

---

### 3. Bot Integration

```json
{
  "bot": {
    "enabled": true,
    "tokenSlot": 1,
    "firebasePath": "globalToken"
  }
}
```

**Fields:**
- `enabled` - Set to `true` to write tokens to `/globalToken` path for Discord bot
- `tokenSlot` - Which slot to write to:
  - `1` = Primary token (recommended)
  - `2` = Backup token
- `firebasePath` - Firebase path to write tokens (default: `globalToken`)

**When to use:**
- ✅ `enabled: true` - If you have a Discord bot that reads tokens from Firebase
- ❌ `enabled: false` - If you only want personal token management

---

### 4. User ID

```json
{
  "user": {
    "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  }
}
```

**Generate:**

```bash
# Method 1: OpenSSL
openssl rand -hex 16

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Method 3: During setup
# Setup wizard will auto-generate
```

**Purpose:** Unique identifier for your token data in Firebase `/users/USER_ID` path.

---

### 5. Worker Settings

```json
{
  "worker": {
    "intervalMinutes": 30,
    "retryDelays": [30, 60, 120, 300],
    "tokenLifetimeMs": 3600000
  }
}
```

**Fields:**
- `intervalMinutes` - How often to refresh token (default: 30 minutes)
  - Token expires after 1 hour
  - Refreshing every 30 min ensures fresh token
- `retryDelays` - Retry delays in seconds on failure: 30s, 60s, 120s, 300s
- `tokenLifetimeMs` - Token lifetime in milliseconds (default: 3600000 = 1 hour)

**Recommendations:**
- ✅ Keep `intervalMinutes: 30` - Refreshes twice per token lifetime
- ✅ Adjust retry delays if your network is unstable
- ❌ Don't set interval > 55 minutes - Token will expire!

---

### 6. Security Settings

```json
{
  "security": {
    "encryptTokens": false,
    "encryptionKey": null
  }
}
```

**Fields:**
- `encryptTokens` - Encrypt tokens in `/users/USER_ID` path
  - `false` - Store plain text (required for bot integration in `/globalToken`)
  - `true` - Encrypt tokens (only for personal use)
- `encryptionKey` - 64-character hex key for AES-256-GCM encryption

**For Bot Integration:**
```json
{
  "security": {
    "encryptTokens": false
  }
}
```

**For Personal Use (No Bot):**
```json
{
  "security": {
    "encryptTokens": true,
    "encryptionKey": "generate-64-char-hex-key"
  }
}
```

**Generate encryption key:**
```bash
openssl rand -hex 32
```

---

## 📝 Complete Example

```json
{
  "firebase": {
    "projectId": "dung-7a41b",
    "databaseURL": "https://dung-7a41b-default-rtdb.firebaseio.com",
    "serviceAccount": {
      "type": "service_account",
      "project_id": "dung-7a41b",
      "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQChnoymsAU...\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk-fbsvc@dung-7a41b.iam.gserviceaccount.com",
      "token_uri": "https://oauth2.googleapis.com/token",
      "universe_domain": "googleapis.com"
    }
  },
  "gcloud": {
    "projectId": "qwiklabs-gcp-02-e44272075ef7"
  },
  "bot": {
    "enabled": true,
    "tokenSlot": 1,
    "firebasePath": "globalToken"
  },
  "user": {
    "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  },
  "worker": {
    "intervalMinutes": 30,
    "retryDelays": [30, 60, 120, 300],
    "tokenLifetimeMs": 3600000
  },
  "security": {
    "encryptTokens": false,
    "encryptionKey": null
  }
}
```

---

## 🚀 Setup Steps

### 1. Clone Repository

```bash
git clone https://github.com/zenixbot0101/Token-refresh.git
cd Token-refresh
npm install
```

### 2. Create Config Directory

```bash
mkdir -p ~/.gcloud-token-manager
```

### 3. Copy and Edit Config

```bash
# Copy example config
cp config/config.json ~/.gcloud-token-manager/config.json

# Edit with your values
nano ~/.gcloud-token-manager/config.json
```

### 4. Fill in Required Values

**Required fields:**
- ✅ `firebase.projectId`
- ✅ `firebase.databaseURL`
- ✅ `firebase.serviceAccount.private_key`
- ✅ `firebase.serviceAccount.client_email`
- ✅ `gcloud.projectId` (your REAL GCP project ID)
- ✅ `user.id` (generate with `openssl rand -hex 16`)

**Optional fields:**
- `bot.*` - If you have Discord bot
- `security.encryptTokens` - Set to `false` for bot
- `worker.intervalMinutes` - Keep default 30

### 5. Save Config

In nano:
- `Ctrl+O` → Save
- `Enter` → Confirm
- `Ctrl+X` → Exit

### 6. Validate Config

```bash
# Check JSON syntax
cat ~/.gcloud-token-manager/config.json | python3 -m json.tool
```

No errors = Config is valid ✅

### 7. Start Worker

```bash
npm start
```

---

## ✅ Validation Checklist

Before starting worker:

- [ ] Firebase project ID correct?
- [ ] Firebase database URL correct?
- [ ] Private key has `\n` (literal backslash-n)?
- [ ] Client email is service account email?
- [ ] GCP project ID is REAL (not `xxxxx`)?
- [ ] User ID is unique (16 hex bytes)?
- [ ] Bot enabled if you have Discord bot?
- [ ] Encryption disabled for bot integration?
- [ ] Config file valid JSON?

---

## 🔍 Troubleshooting

### Error: "Failed to parse private key"

**Cause:** Private key format wrong

**Solution:** Ensure private key has literal `\n` characters:
```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Not actual newlines!

### Error: "The resource 'projects/qwiklabs-gcp-02-xxxxx' was not found"

**Cause:** Using placeholder project ID

**Solution:** Replace `xxxxx` with your REAL project ID:
```bash
gcloud config get-value project
```

### Error: "values argument contains undefined"

**Cause:** Some required field is missing or undefined

**Solution:** Check all required fields are filled:
- `firebase.projectId`
- `firebase.serviceAccount.private_key`
- `firebase.serviceAccount.client_email`
- `gcloud.projectId`
- `user.id`

---

## 📚 Related Docs

- [Main README](./README.md) - Overview
- [Quick Start](./QUICKSTART.md) - 5-minute setup
- [Bot Integration](./BOT_INTEGRATION.md) - Discord bot setup
- [Troubleshooting](./QUICK_FIX.md) - Common issues

---

## 🆘 Support

**Config issues?**

```bash
# View current config
cat ~/.gcloud-token-manager/config.json

# Validate JSON
cat ~/.gcloud-token-manager/config.json | python3 -m json.tool

# Test Firebase connection
node test-firebase-key.js ~/.gcloud-token-manager/config.json
```

**Still stuck?**
- Check logs: `~/.gcloud-token-manager/logs/app-*.log`
- GitHub Issues: https://github.com/zenixbot0101/Token-refresh/issues
