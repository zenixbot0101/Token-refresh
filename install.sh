#!/bin/bash

# GCloud Token Auth Manager - Installation Script
# For Linux systems (Ubuntu/Debian)

set -e

echo "========================================="
echo "  GCloud Token Auth Manager Installer"
echo "========================================="
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ Error: This application only supports Linux"
    echo "   Detected OS: $OSTYPE"
    exit 1
fi

echo "✓ Linux detected"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js 20+ first"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js version 20 or higher is required"
    echo "   Current version: $(node --version)"
    echo "   Please upgrade Node.js"
    exit 1
fi

echo "✓ Node.js $(node --version) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

echo "✓ npm $(npm --version) detected"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"

# Create config directory if needed
if [ ! -d "$HOME/.gcloud-token-manager" ]; then
    mkdir -p "$HOME/.gcloud-token-manager"
    echo "✓ Created config directory: $HOME/.gcloud-token-manager"
fi

# Make CLI executable
chmod +x src/index.js

echo ""
echo "========================================="
echo "  Installation Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Prepare your Firebase service account key (firebase-key.json)"
echo "  2. Run setup: npm run setup"
echo "  3. Start worker: npm start"
echo ""
echo "For more information, see README.md"
echo ""
