#!/bin/bash

# Script to test if gcloud is installed and working

echo "=========================================="
echo "  Testing Google Cloud CLI Detection"
echo "=========================================="
echo ""

echo "Method 1: which gcloud"
which gcloud
echo "Exit code: $?"
echo ""

echo "Method 2: command -v gcloud"
command -v gcloud
echo "Exit code: $?"
echo ""

echo "Method 3: type gcloud"
type gcloud
echo "Exit code: $?"
echo ""

echo "Method 4: gcloud --version"
gcloud --version
echo "Exit code: $?"
echo ""

echo "Method 5: Common paths"
for path in /usr/bin/gcloud /usr/local/bin/gcloud /snap/bin/gcloud ~/google-cloud-sdk/bin/gcloud; do
    if [ -f "$path" ]; then
        echo "Found: $path"
    fi
done
echo ""

echo "=========================================="
echo "  PATH variable"
echo "=========================================="
echo "$PATH"
