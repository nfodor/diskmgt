# 🗄️ DiskMgt - Smart Drive Manager for Raspberry Pi

A powerful, user-friendly CLI tool for managing USB drives, SD cards, and external storage on Raspberry Pi OS (Raspbian). Never forget which drive is which again!

<img src="https://img.shields.io/badge/Platform-Raspberry%20Pi%20OS-C51A4A?logo=raspberry-pi" alt="Platform"/> <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js" alt="Node.js"/> <img src="https://img.shields.io/badge/License-MIT-blue" alt="License"/>

## ✨ Key Features

### 🏷️ Smart Drive Recognition
- **Auto-label drives** based on content analysis (detects OS installations, LXD storage, boot partitions)
- **Persistent tracking** by UUID - drives remember their labels even after unplugging
- **Tree view display** showing disks and their partitions in a clean hierarchy
- **LXD/LXC detection** - automatically identifies and displays container storage pools

### 🔧 Advanced Management
- **Partition tools** - format, resize, check, repair partitions with safety confirmations
- **Backup & Restore** - 4 powerful methods (dd, tar, rsync, btrfs snapshots)
- **Cloud backup** - Upload to S3-compatible storage (AWS, Backblaze, DigitalOcean, Wasabi)
- **Clone with auto-resize** - Clone bootable drives to larger targets with automatic partition expansion
- **BTRFS Conversion** - Convert ext4 to BTRFS with full rollback safety, ARM64 optimized

### 🤖 AI-Powered (Optional)
- **Semantic search** - Find drives using natural language ("my backup drive")
- **Error analysis** - AI troubleshooting for disk errors and SMART failures
- Powered by Claude AI (requires API key)

### 🚀 Maintenance Tools
- Disk error checking (badblocks, e2fsck, btrfs, xfs)
- SMART health monitoring
- Space analysis (find largest directories)
- System log analysis for drive-related issues

### 💊 Drive Health Dashboard
- **Real-time SMART monitoring** - Health status, temperature, wear level
- **Power-on hours** - Track drive age and usage
- **Color-coded warnings** - Instant visual health indicators
- **CLI quick check** - `dm --health` for instant overview
- **Proactive alerts** - Warnings for failing drives, high temps, wear

### 🖥️ QEMU Drive Testing
- **Boot in emulator** - Boot any drive in QEMU without mounting on host
- **Read-only mode** - Safe inspection without writing changes
- **Network support** - SSH access via port forwarding (5555 → 22)
- **Automatic detection** - Extracts kernel and device tree from boot partition
- **Safety first** - Test unknown drives in isolation before mounting

## 🎯 Perfect For

- **Media servers** (Plex, Jellyfin, Kodi) - Track your movie/music drives
- **NAS setups** - Manage multiple storage drives
- **Pi clusters** - LXD/LXC container storage management
- **Backup systems** - Organize backup drives
- **Developers** - Track project drives and test media
- **Makers** - Manage SD cards for different Pi projects

## 📋 Requirements

- **Raspberry Pi** (any model with USB ports)
- **Raspberry Pi OS** (Raspbian) - tested on Bookworm, should work on Bullseye+
- **Node.js 18+** (usually pre-installed on modern Pi OS)
- **Root access** for drive operations

## 🚀 Quick Start

### Installation

**Option 1: NPM (Recommended)**
```bash
# Install globally
npm install -g diskmgt

# Run immediately
dm
```

**Option 2: From Source**
```bash
# Clone the repository
git clone https://github.com/nfodor/diskmgt.git
cd diskmgt

# Install dependencies
npm install

# Create alias for easy access
echo "alias dm='/home/pi/dev/diskmgt/dm-sudo'" >> ~/.bashrc
source ~/.bashrc
```

### First Run

```bash
# Launch the interactive menu
dm
```

You'll see a beautiful menu like this:

```
╔══════════════════════════════════════════════════════════════╗
║                     📀 Disk Manager 📀                       ║
╚══════════════════════════════════════════════════════════════╝

? What would you like to do?
  📋 List all drives
  ➕ Register new drive
  🔍 Search drives
  ℹ️  View drive details
  🔧 Partition Tools (Advanced)
  💾 Backup & Restore
❯ 🤖 Configure AI Features
  📖 Help
  🚪 Exit
```

## 📖 Detailed Usage

### Sudo Setup (Recommended)

Most disk operations require root privileges. Set up aliases that automatically use sudo:

```bash
# Remove any old aliases
sed -i '/alias diskmgt=/d' ~/.bashrc
sed -i '/alias dm=/d' ~/.bashrc

# Add sudo-enabled aliases
echo "alias diskmgt='/home/pi/dev/diskmgt/dm-sudo'" >> ~/.bashrc
echo "alias dm='/home/pi/dev/diskmgt/dm-sudo'" >> ~/.bashrc

# Reload shell
source ~/.bashrc
```

Now you can run with automatic sudo:
```bash
dm           # Automatically runs with sudo, uses your config
diskmgt      # Same as above (alternative command name)
```

**How it works:**
- Runs as root for admin operations (mount, fsck, etc.)
- Uses YOUR config at `~/.config/diskmgt/`
- Preserves your ANTHROPIC_API_KEY
- No need to manually type `sudo`

**Benefits:**
- ✅ Runs with root privileges automatically
- ✅ Preserves your user config directory
- ✅ Keeps your API keys and settings
- ✅ No need to type `sudo` every time

### Alternative: Manual sudo
```bash
echo "alias dm='node /home/pi/dev/diskmgt/index.js'" >> ~/.bashrc
source ~/.bashrc

# Always run with sudo
sudo dm
```

**Note:** Manual sudo uses root's config at `/root/.config/diskmgt/` instead of your user's config.

See [SUDO_SETUP.md](SUDO_SETUP.md) for detailed setup information.

## Features

- **Show all drives** - View connected and known drives with tree structure (disks + partitions)
- **Detailed drive info** - Hardware info, partition table, bootable status, OS detection, LXD storage
- **Add/register drives** - Register new drives with labels and purpose
  - **Auto-registration** - Automatically detect and register drives based on content (LXD, OS, boot, mount points)
- **Edit drive info** - Update labels, types, or purpose
- **Remove drives** - Remove drives from tracking
- **Search drives** - Find drives by label, type, or purpose
- **Export drive list** - Export all drive information
- **Backup & Restore** - Comprehensive backup/restore with multiple methods and cloud support
  - **Block-level (dd)** - Exact bit-for-bit copy (slow, large, bootable)
  - **Filesystem (tar)** - Compress files only (fast, small, excludes empty space)
  - **Incremental (rsync)** - Only changed files (space-efficient, fast subsequent backups)
  - **Snapshot (btrfs)** - COW snapshots (instant, filesystem-specific)
  - **S3-compatible cloud backup** - AWS S3, Backblaze B2, DigitalOcean Spaces, Wasabi, MinIO
  - **Configure cloud backup** - Set up S3-compatible provider credentials
- **Disk Maintenance** - Partition-level advanced management tools
  - **Mount/Unmount** - Safe partition mounting with automatic directory creation
  - **Filesystem check** - Read-only scan or repair mode with automatic unmount
  - **Backup partition** - Create .img file backups with dd
  - **Clone partition** - Duplicate partition to another device
  - **Format partition** - Reformat with filesystem selection (ext4, btrfs, xfs, vfat, ntfs)
  - **Resize partition** - Grow/shrink partitions with filesystem-specific commands
  - **Set label** - Change partition labels
- **BTRFS Conversion** - Professional-grade filesystem migration
  - **Convert ext4 → BTRFS** - In-place conversion with data preservation
  - **Full rollback support** - Revert to ext4 if needed (keeps original as snapshot)
  - **ARM64 optimized** - Automatic 16KB blocksize for Raspberry Pi compatibility
  - **Safety features** - Filesystem checks, unmount verification, backup reminders
  - **Make permanent** - Delete rollback snapshot to reclaim space

## Storage

Drive information is stored in: `~/.config/diskmgt/drives.json`
Backup configuration is stored in: `~/.config/diskmgt/backup-config.json`

## Backup Methods

### 1. Block-level (dd) - Bit-for-bit copy
**PROS:** Complete exact copy, bootable, includes all hidden data
**CONS:** Slow, large files, includes empty space, can't resize
**USE:** System drives, recovery scenarios, forensics

### 2. Filesystem-level (tar) - File-by-file copy
**PROS:** Fast, compressed, excludes empty space, flexible restore
**CONS:** Loses some metadata, not bootable without setup, requires mounted
**USE:** Data drives, user files, regular backups

### 3. Incremental (rsync) - Only changes
**PROS:** Fast subsequent backups, space-efficient, deduplication
**CONS:** More complex restore, dependency chain
**USE:** Daily backups, large datasets, limited storage

### 4. Snapshot-based (btrfs) - Copy-on-write
**PROS:** Instant, space-efficient, incremental, point-in-time
**CONS:** Filesystem-specific, complex, requires supported FS
**USE:** Servers, databases, version control

## Cloud Backup

Supports S3-compatible providers:
- AWS S3
- Backblaze B2
- DigitalOcean Spaces
- Wasabi
- MinIO (self-hosted)

Configure with "Configure cloud backup" menu option. Backups can stream directly to S3 without local storage.

## 🖥️ Example Workflows

### Scenario 1: New USB Drive
```bash
dm
→ Register new drive
→ Auto-register → detects "External Backup"
→ Set purpose → "Weekly backups"
✓ Drive registered and ready
```

### Scenario 2: Clone SD Card to Larger Card
```bash
dm
→ Backup & Restore
→ Clone drive with auto-resize
→ Source: 32GB SD (sda)
→ Target: 64GB SD (sdb)
✓ Cloned and expanded to 64GB
```

### Scenario 3: Find Your Drive
```bash
dm
→ Search drives
→ AI search: "my plex movies"
✓ Found: sdb1 - Media Storage
```

### Scenario 4: Migrate to BTRFS for Better Snapshots
```bash
dm
→ BTRFS Conversion
→ Convert ext4 → BTRFS
→ Select: sdb1 (USB backup drive)
✓ Converted with rollback safety
→ Test your data
→ Delete rollback image (make permanent)
✓ Now enjoying instant snapshots!
```

### Scenario 5: Test Unknown Drive Safely
```bash
dm
→ Detailed disk information panel
→ Select: sdc (mysterious USB drive)
→ Boot this drive in QEMU
→ Read-only mode (safe inspection)
✓ Booted in isolated emulator
→ Inspect files, check for malware
→ Exit QEMU (Ctrl+A then X)
✓ Host system untouched!
```

## 📊 System Requirements

### Tested Platforms
- ✅ Raspberry Pi 5 (Raspbian Bookworm)
- ✅ Raspberry Pi 4 (Raspbian Bookworm/Bullseye)
- ✅ Raspberry Pi 3 B+ (Raspbian Bullseye)
- ✅ Raspberry Pi Zero 2 W (Raspbian Bookworm)

### Dependencies
Automatically installed via npm:
- `inquirer` - Interactive prompts
- `chalk` - Colorful output
- `boxen` - Beautiful boxes (v5.1.2 for CommonJS compatibility)
- `cli-table3` - Tables
- `figlet` - ASCII art
- `gradient-string` - Gradient text
- `@anthropic-ai/sdk` - AI features (optional)

### System Tools Required
Pre-installed on Raspberry Pi OS:
- `lsblk` - List block devices
- `parted` - Partition management
- `e2fsck`, `xfs_repair`, `btrfs check` - Filesystem checks
- `dd`, `tar`, `rsync` - Backup tools

## 🔧 Configuration

### Data Storage
Drive labels and metadata are stored in:
```
~/.config/diskmgt/drives.json
~/.config/diskmgt/backup-config.json
```

### Environment Variables
```bash
# Claude AI API Key (optional)
export ANTHROPIC_API_KEY="sk-ant-xxxxx"

# S3 Credentials (for cloud backup)
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
```

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on Raspberry Pi OS
5. Submit a pull request

## 📜 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Built with ❤️ for the Raspberry Pi community
- AI features powered by Anthropic Claude
- Inspired by the need for better drive management on Pi

## 🐛 Known Issues

- **LXD detection**: Requires running containers to detect storage pools
- **Large operations**: May take time on Pi Zero/3

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/nfodor/diskmgt/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/nfodor/diskmgt/discussions)

## 🗺️ Roadmap

- [ ] Web UI for remote management
- [ ] Email notifications for SMART alerts
- [ ] Automatic backup scheduling
- [ ] RAID configuration support
- [ ] USB drive auto-mount profiles

---

**Made with ☕ on a Raspberry Pi 5**
