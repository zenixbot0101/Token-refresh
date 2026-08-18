# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-18

### Added
- Initial release of GCloud Token Auth Manager
- System scanner for OS, Node.js, and Google Cloud CLI detection
- Automatic Google Cloud CLI installation for Debian/Ubuntu systems
- Firebase Admin SDK integration for database operations
- Google Cloud authentication management (login, logout, verification)
- Token refresh worker with 30-minute intervals
- Token encryption using AES-256-GCM
- Automatic retry with exponential backoff on failures
- Comprehensive logging with token sanitization
- Configuration management (file-based and state tracking)
- CLI interface with commands: setup, start, stop, status, login, logout
- Interactive setup wizard
- Graceful shutdown handling (SIGINT, SIGTERM)
- Firebase database synchronization
- Worker heartbeat mechanism
- Support for multiple Google Cloud accounts
- Project configuration management
- Systemd service template
- Installation script for easy deployment

### Security
- Token encryption before storage
- Automatic token sanitization in logs
- Firebase security rules recommendations
- Service account key protection guidelines
- No plain-text credential storage

### Documentation
- Comprehensive README.md
- Detailed SETUP_GUIDE.md
- Configuration examples
- Troubleshooting guide
- Security best practices

### System Requirements
- Linux (Ubuntu 20.04+, Debian 11+)
- Node.js 20.0.0+
- npm 10.0.0+
- Google Cloud CLI (auto-installable)
- Firebase project with Realtime Database

## [Unreleased]

### Planned Features
- Docker support
- Multi-region Firebase support
- Token rotation strategies
- Advanced monitoring and alerting
- Web dashboard for status monitoring
- Support for additional Linux distributions
- Cloud deployment templates (AWS, GCP, Azure)
- Backup and restore functionality
- Token usage analytics
- Integration with secret managers (HashiCorp Vault, AWS Secrets Manager)

---

## Version History

- **1.0.0** - Initial stable release with core functionality
