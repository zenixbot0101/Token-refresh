# Quick Start Guide

Get up and running with GCloud Token Auth Manager in 5 minutes.

## Prerequisites

- ✅ Linux system (Ubuntu/Debian recommended)
- ✅ Node.js 20+ installed
- ✅ Firebase project ready
- ✅ Firebase service account key downloaded

## Installation (3 steps)

### 1. Install Dependencies

```bash
npm install
```

### 2. Prepare Firebase Key

Place your Firebase service account key in the project root:

```bash
cp /path/to/your-firebase-key.json ./firebase-key.json
```

### 3. Run Setup

```bash
npm run setup
```

Follow the interactive wizard:
- Enter Firebase Project ID
- Enter Firebase Database URL
- Confirm service account path
- Generate user ID (or enter custom)
- Enable encryption (recommended)
- Login to Google Cloud (browser will open)
- Start worker

## That's it! 🎉

The worker is now running and will:
- Refresh your Google Cloud access token every 30 minutes
- Encrypt and store it in Firebase
- Automatically retry on failures
- Continue running until stopped

## Check Status

```bash
npm run status
```

## Stop Worker

Press `Ctrl+C` or:

```bash
gcloud-token-manager stop
```

## Common Commands

```bash
# Start worker
npm start

# Check status
npm run status

# Login to Google Cloud
gcloud-token-manager login

# Logout from Google Cloud
gcloud-token-manager logout

# Run setup again
npm run setup
```

## Systemd Service (Optional)

To run as a background service:

```bash
# Copy and edit service file
sudo cp gcloud-token-manager.service /etc/systemd/system/
sudo nano /etc/systemd/system/gcloud-token-manager.service

# Update paths and user in the file
# Then enable and start
sudo systemctl enable gcloud-token-manager
sudo systemctl start gcloud-token-manager
sudo systemctl status gcloud-token-manager
```

## Troubleshooting

### Google Cloud CLI not installed?

The setup will offer to install it automatically on Ubuntu/Debian.

For manual installation:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Firebase connection issues?

1. Check your service account key path
2. Verify project ID and database URL
3. Ensure Realtime Database is enabled in Firebase Console

### Authentication problems?

```bash
gcloud auth list
gcloud-token-manager login
```

## Next Steps

- Review [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed configuration
- Configure Firebase security rules
- Set up systemd service for auto-start
- Check logs: `~/.gcloud-token-manager/logs/`

## Security Reminder

🔒 **Never commit these files to Git:**
- `firebase-key.json`
- `config.json`
- `.env`

They are already in `.gitignore`.

---

Need help? Check [README.md](README.md) or [SETUP_GUIDE.md](SETUP_GUIDE.md)
