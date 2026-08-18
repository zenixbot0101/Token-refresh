# GCloud Token Auth Manager - Setup Guide

Complete guide for setting up and running the GCloud Token Auth Manager.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Linux system (Ubuntu 20.04+, Debian 11+, or similar)
- [ ] Node.js 20+ installed
- [ ] npm 10+ installed
- [ ] Internet connection
- [ ] Firebase project created
- [ ] Firebase Realtime Database enabled
- [ ] Firebase service account key downloaded

## Step-by-Step Setup

### 1. Prepare Firebase

#### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Follow the setup wizard

#### 1.2 Enable Realtime Database

1. In Firebase Console, go to "Build" → "Realtime Database"
2. Click "Create Database"
3. Choose location (e.g., us-central1)
4. Start in **locked mode** (we'll configure rules later)

#### 1.3 Download Service Account Key

1. Go to Project Settings (gear icon) → "Service accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Save it as `firebase-key.json` in the project root
5. **NEVER commit this file to Git**

#### 1.4 Configure Firebase Security Rules

Important: Restrict access to user-specific data only.

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

**Note:** Firebase Admin SDK bypasses these rules, so ensure your backend implements proper authorization.

### 2. Install Application

#### 2.1 Clone/Download Repository

```bash
git clone <repository-url>
cd gcloud-token-manager
```

#### 2.2 Run Installation Script

```bash
chmod +x install.sh
./install.sh
```

Or install manually:

```bash
npm install
```

### 3. Initial Configuration

#### 3.1 Run Setup Command

```bash
npm run setup
```

Or:

```bash
node src/index.js setup
```

#### 3.2 Setup Wizard Steps

The setup wizard will guide you through:

1. **System Scan**
   - Detects OS and validates Node.js version
   - Checks for Google Cloud CLI

2. **Google Cloud CLI Installation** (if needed)
   - Automatic installation on Ubuntu/Debian
   - Manual instructions for other distributions

3. **Firebase Configuration**
   - Firebase Project ID
   - Firebase Database URL
   - Service Account Key path
   - User ID generation

4. **Token Encryption Setup**
   - Enable/disable encryption
   - Auto-generate encryption key

5. **Google Cloud Authentication**
   - Opens browser for Google login
   - Authenticate with your Google account

6. **Project Configuration** (optional)
   - Set Google Cloud project ID

7. **Worker Start**
   - Option to start worker immediately

### 4. Configuration File

After setup, configuration is saved to:

```
~/.gcloud-token-manager/config.json
```

Example configuration:

```json
{
  "firebase": {
    "projectId": "your-firebase-project-id",
    "databaseURL": "https://your-project.firebaseio.com",
    "serviceAccountPath": "./firebase-key.json"
  },
  "user": {
    "id": "unique-user-id"
  },
  "worker": {
    "intervalMinutes": 30,
    "retryDelays": [30, 60, 120, 300]
  },
  "security": {
    "encryptTokens": true,
    "encryptionKey": "generated-32-byte-key"
  }
}
```

### 5. Google Cloud Setup

#### 5.1 Authenticate

```bash
gcloud-token-manager login
```

Or during setup, the browser will open automatically.

#### 5.2 Set Project (if needed)

```bash
gcloud config set project YOUR_PROJECT_ID
```

#### 5.3 Verify Authentication

```bash
gcloud auth list
```

## Running the Application

### Start Worker

```bash
npm start
```

Or:

```bash
gcloud-token-manager start
```

The worker will:
- Verify authentication
- Connect to Firebase
- Refresh token every 30 minutes
- Store encrypted token in Firebase
- Continue running until stopped

### Check Status

```bash
gcloud-token-manager status
```

Shows:
- Authentication status
- Worker status
- Last refresh time
- Next refresh time

### Stop Worker

```bash
gcloud-token-manager stop
```

Or press `Ctrl+C` (graceful shutdown)

## Running as Background Service (Optional)

### Using systemd

#### 1. Create Service File

```bash
sudo nano /etc/systemd/system/gcloud-token-manager.service
```

#### 2. Add Configuration

```ini
[Unit]
Description=GCloud Token Auth Manager
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/gcloud-token-manager
ExecStart=/usr/bin/node /path/to/gcloud-token-manager/src/index.js start
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/gcloud-token-manager/output.log
StandardError=append:/var/log/gcloud-token-manager/error.log

[Install]
WantedBy=multi-user.target
```

#### 3. Create Log Directory

```bash
sudo mkdir -p /var/log/gcloud-token-manager
sudo chown youruser:youruser /var/log/gcloud-token-manager
```

#### 4. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable gcloud-token-manager
sudo systemctl start gcloud-token-manager
```

#### 5. Check Service Status

```bash
sudo systemctl status gcloud-token-manager
```

#### 6. View Logs

```bash
sudo journalctl -u gcloud-token-manager -f
```

## Troubleshooting

### Google Cloud CLI Not Found

**Manual Installation:**

```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### Firebase Connection Failed

1. Verify service account key path
2. Check Firebase project ID
3. Ensure Realtime Database is enabled
4. Verify database URL format: `https://PROJECT_ID.firebaseio.com`

### Authentication Expired

```bash
gcloud-token-manager login
```

### Worker Not Starting

1. Check logs: `~/.gcloud-token-manager/logs/`
2. Verify configuration: `~/.gcloud-token-manager/config.json`
3. Run status: `gcloud-token-manager status`
4. Check authentication: `gcloud auth list`

### Permission Denied Errors

```bash
chmod +x src/index.js
chmod +x install.sh
```

## Security Best Practices

### 1. Protect Service Account Key

```bash
chmod 600 firebase-key.json
```

### 2. Enable Token Encryption

Always enable encryption when configuring.

### 3. Secure Firebase Database

Use strict security rules (see Firebase setup above).

### 4. Rotate Credentials

Regularly rotate:
- Firebase service account keys
- Encryption keys
- Google Cloud authentication

### 5. Monitor Access

- Check Firebase usage regularly
- Review authentication logs
- Monitor for suspicious activity

### 6. Backup Configuration

```bash
cp ~/.gcloud-token-manager/config.json ~/.gcloud-token-manager/config.backup.json
```

## Environment Variables (Alternative)

Instead of config file, you can use environment variables:

```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_DATABASE_URL="https://your-project.firebaseio.com"
export FIREBASE_SERVICE_ACCOUNT="/path/to/firebase-key.json"
export USER_ID="unique-user-id"
export ENCRYPTION_KEY="your-32-byte-key"
```

## Updating the Application

```bash
git pull origin main
npm install
```

Restart the worker:

```bash
gcloud-token-manager stop
gcloud-token-manager start
```

## Uninstalling

### 1. Stop Worker

```bash
gcloud-token-manager stop
```

### 2. Remove Service (if using systemd)

```bash
sudo systemctl stop gcloud-token-manager
sudo systemctl disable gcloud-token-manager
sudo rm /etc/systemd/system/gcloud-token-manager.service
sudo systemctl daemon-reload
```

### 3. Remove Configuration

```bash
rm -rf ~/.gcloud-token-manager
```

### 4. Remove Application

```bash
cd ..
rm -rf gcloud-token-manager
```

### 5. Logout from Google Cloud (optional)

```bash
gcloud auth revoke
```

## Support

For issues and questions:
- Check logs: `~/.gcloud-token-manager/logs/`
- Review README.md
- Check Firebase Console for database issues
- Verify Google Cloud authentication

## Next Steps

After setup:
1. Test token refresh by checking Firebase database
2. Monitor logs for any errors
3. Configure systemd service for auto-start
4. Set up monitoring/alerting (optional)
5. Document your specific configuration

---

**Remember:** Never commit secrets (firebase-key.json, .env, config.json) to version control!
