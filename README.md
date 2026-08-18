# GCloud Token Auth Manager

A Node.js CLI application for managing Google Cloud authentication tokens with Firebase integration on Linux systems. **Bot-ready** - Automatically writes tokens to Firebase for Discord bot consumption.

## Features

- ✅ Automatic Google Cloud CLI detection and installation
- ✅ Firebase Realtime Database integration
- ✅ Automated token refresh (30-minute intervals)
- ✅ **Bot Integration** - Write tokens to `/globalToken` path for bot
- ✅ **Dual Slot Support** - Primary (token) + Backup (token2)
- ✅ Google Cloud authentication management
- ✅ Graceful shutdown handling
- ✅ Comprehensive error handling and retry logic

## Requirements

### Operating System
- Ubuntu 20.04+, 22.04, 24.04
- Debian 11+, 12+
- Other Debian-based distributions

### Runtime
- Node.js 20+
- npm 10+
- Internet connection

### Firebase
- Firebase project
- Firebase Realtime Database
- Firebase service account credentials

## Quick Start (Fully Automated)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Setup
```bash
npm run setup
```

The setup wizard will automatically:
- ✅ Detect and install Node.js 20+ if needed
- ✅ Detect and install Google Cloud CLI if needed
- ✅ Prompt for Firebase credentials (4 simple inputs)
- ✅ Generate user ID and encryption key
- ✅ Open browser for Google authentication
- ✅ Test all connections
- ✅ Start the worker

**No manual file creation needed!**

### 3. Provide Firebase Information

When prompted, enter:
- **Firebase Project ID**: Your project ID
- **Firebase Database URL**: https://your-project.firebaseio.com
- **Firebase Client Email**: firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
- **Firebase Private Key**: (paste entire key including -----BEGIN/END-----)

Get these from: Firebase Console → Project Settings → Service Accounts

### 4. Done! 🎉

The worker is now running and will refresh tokens every 30 minutes.

## Usage

### Initial Setup
```bash
npm run setup
```
or
```bash
node src/index.js setup
```

This will:
1. Detect your operating system
2. Check/install Google Cloud CLI
3. Configure Firebase connection
4. Guide you through Google Cloud authentication
5. Start the worker

### Start Worker
```bash
npm start
```
or
```bash
gcloud-token-manager start
```

### Check Status
```bash
gcloud-token-manager status
```

### Google Cloud Login
```bash
gcloud-token-manager login
```

### Google Cloud Logout
```bash
gcloud-token-manager logout
```

### Stop Worker
```bash
gcloud-token-manager stop
```

## Security

### ⚠️ Important Security Notes

1. **Access tokens are sensitive credentials** - Never log, commit, or expose them
2. **Firebase Database Rules** - Restrict access to user-specific paths only
3. **Service account keys** - Keep `firebase-key.json` secure and never commit to Git
4. **Token encryption** - Tokens are encrypted before storage (enabled by default)
5. **Network security** - Ensure secure connection to Firebase

### Firebase Security Rules Example

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

## Architecture

```
┌──────────────────────────────┐
│     Node.js CLI App          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     System Scanner           │
│  Check Linux + Node + gcloud │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Install gcloud           │
│     (if missing)             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Firebase Setup           │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Google Cloud Authentication │
│     gcloud auth login        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│         Worker               │
│   Every 30 minutes:          │
│   - Get access token         │
│   - Encrypt token            │
│   - Update Firebase          │
└──────────────────────────────┘
```

## Data Model

Firebase structure:
```json
{
  "users": {
    "USER_ID": {
      "gcloud": {
        "email": "user@example.com",
        "projectId": "project-id",
        "authenticated": true,
        "token": "<encrypted-token>",
        "updatedAt": 1787030000000
      }
    }
  }
}
```

## Configuration

The application stores configuration in:
- `~/.gcloud-token-manager/config.json` - User configuration
- `~/.gcloud-token-manager/state.json` - Application state
- `~/.gcloud-token-manager/logs/` - Log files

## Error Handling

The application handles various error scenarios:
- Missing Google Cloud CLI → Auto-installation
- Expired authentication → Prompt for re-authentication
- Firebase connection issues → Automatic retry with backoff
- Network failures → Exponential retry strategy
- Invalid tokens → Re-authentication flow

## Systemd Service (Optional)

To run the worker as a background service:

1. Create service file:
```bash
sudo nano /etc/systemd/system/gcloud-token-manager.service
```

2. Add configuration:
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

[Install]
WantedBy=multi-user.target
```

3. Enable and start:
```bash
sudo systemctl enable gcloud-token-manager
sudo systemctl start gcloud-token-manager
sudo systemctl status gcloud-token-manager
```

## Troubleshooting

### Google Cloud CLI not found
```bash
# Manual installation
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### Firebase connection failed
- Check your service account key path
- Verify Firebase project ID and database URL
- Ensure Firebase Realtime Database is enabled

### Authentication expired
```bash
gcloud-token-manager login
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- No credentials in commits
- Follow security best practices
- Add tests for new features
- Update documentation

## Support

For issues and questions, please open an issue on the repository.
