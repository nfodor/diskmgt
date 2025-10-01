const detect = require('./detect');
const diskinfo = require('./diskinfo');
const lxcinfo = require('./lxcinfo');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Generate smart label for a drive based on its content
function generateSmartLabel(drive, detailedInfo) {
    // Priority 1: LXD Storage
    if (detailedInfo.lxdInfo && detailedInfo.lxdInfo.isLXD) {
        if (detailedInfo.lxdInfo.pools.length > 0) {
            return `LXD-${detailedInfo.lxdInfo.pools[0].name}`;
        }
        return 'LXD-Storage';
    }

    // Priority 2: OS Installation
    if (detailedInfo.osInfo && detailedInfo.osInfo.length > 0) {
        const os = detailedInfo.osInfo[0];
        if (os.osType && os.osType !== 'Unknown' && !os.osType.includes('Unknown')) {
            // Clean up OS name for label
            const osName = os.osType
                .replace(/\([^)]*\)/g, '') // Remove parentheses
                .replace(/\s+/g, '-')      // Replace spaces with dashes
                .substring(0, 20);          // Limit length
            return osName;
        }
    }

    // Priority 3: Boot partition
    if (detailedInfo.bootable && detailedInfo.bootPartitions.length > 0) {
        return 'Boot-Drive';
    }

    // Priority 4: Mount point
    if (drive.mountpoint && drive.mountpoint !== 'not mounted') {
        const mountName = path.basename(drive.mountpoint);
        if (mountName && mountName !== '/') {
            return mountName.replace(/[^a-zA-Z0-9-_]/g, '-');
        }
        if (drive.mountpoint === '/') {
            return 'Root-System';
        }
    }

    // Priority 5: Filesystem label
    if (drive.fstype === 'vfat' || drive.fstype === 'ntfs') {
        // Try to get volume label
        try {
            const label = execSync(`blkid -s LABEL -o value ${drive.device} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
            if (label) {
                return label.replace(/\s+/g, '-').substring(0, 20);
            }
        } catch (err) {
            // Ignore
        }
    }

    // Priority 6: Model name
    if (drive.model && drive.model !== 'Unknown Model' && drive.model !== 'unknown') {
        return drive.model.replace(/\s+/g, '-').substring(0, 20);
    }

    // Fallback: Device name + size
    return `${drive.name}-${drive.size.replace(/\./g, '')}`;
}

// Detect purpose from drive content
function detectPurpose(drive, detailedInfo) {
    // Check for LXD
    if (detailedInfo.lxdInfo && detailedInfo.lxdInfo.isLXD) {
        const containerCount = detailedInfo.lxdInfo.containers.length;
        return containerCount > 0
            ? `LXD Storage (${containerCount} containers)`
            : 'LXD Storage';
    }

    // Check for OS installation
    if (detailedInfo.osInfo && detailedInfo.osInfo.length > 0) {
        return 'Operating System';
    }

    // Check for boot
    if (detailedInfo.bootable) {
        return 'System Boot';
    }

    // Check mount point for common purposes
    if (drive.mountpoint && drive.mountpoint !== 'not mounted') {
        const mount = drive.mountpoint.toLowerCase();

        if (mount.includes('backup') || mount.includes('timeshift')) {
            return 'Backup';
        }
        if (mount.includes('media') || mount.includes('videos') || mount.includes('music')) {
            return 'Media Storage';
        }
        if (mount.includes('data') || mount.includes('storage')) {
            return 'Data Storage';
        }
        if (mount.includes('project') || mount.includes('dev')) {
            return 'Development';
        }
        if (mount === '/') {
            return 'System Root';
        }
    }

    // Check filesystem type
    if (drive.fstype === 'swap') {
        return 'Swap Memory';
    }

    // Check common directory names in root
    if (drive.mountpoint && drive.mountpoint !== 'not mounted') {
        try {
            const dirs = execSync(`ls -1 ${drive.mountpoint} 2>/dev/null | head -10 || true`, { encoding: 'utf8' }).trim();

            if (dirs.includes('backup') || dirs.includes('Backup')) {
                return 'Backup Storage';
            }
            if (dirs.includes('Media') || dirs.includes('media')) {
                return 'Media Storage';
            }
            if (dirs.includes('Documents') || dirs.includes('documents')) {
                return 'Document Storage';
            }
        } catch (err) {
            // Ignore
        }
    }

    // Default
    return 'General Storage';
}

// Auto-register a single drive
function autoRegisterDrive(drive) {
    // Get detailed info for smart detection
    const devicePath = drive.device.replace(/p?\d+$/, ''); // Get parent device if partition
    const detailedInfo = diskinfo.getDetailedDiskInfo(devicePath);

    const label = generateSmartLabel(drive, detailedInfo);
    const purpose = detectPurpose(drive, detailedInfo);
    const driveType = detect.getDriveType(drive.name);

    return {
        uuid: drive.uuid,
        label: label,
        size: drive.size,
        type: driveType,
        purpose: purpose,
        device: drive.device
    };
}

// Auto-register all unregistered drives
function autoRegisterAll(detectedDrives, knownDrives) {
    const knownUUIDs = new Set(knownDrives.map(d => d.uuid));

    // Only register partitions, not whole disks (to avoid duplicates)
    // Partitions are what you actually use (mount, format, etc.)
    const partitions = detectedDrives.filter(d => d.type === 'part');
    const unregistered = partitions.filter(d => !knownUUIDs.has(d.uuid));

    const registered = [];

    unregistered.forEach(drive => {
        try {
            const driveData = autoRegisterDrive(drive);
            registered.push(driveData);
        } catch (err) {
            console.error(`Failed to auto-register ${drive.name}: ${err.message}`);
        }
    });

    return registered;
}

module.exports = {
    generateSmartLabel,
    detectPurpose,
    autoRegisterDrive,
    autoRegisterAll
};
