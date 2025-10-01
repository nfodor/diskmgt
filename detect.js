const { execSync } = require('child_process');

// Parse lsblk output to get drive information
function detectDrives() {
    try {
        // Use JSON output for accurate parsing
        const output = execSync('lsblk -nbo NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL,UUID --json', {
            encoding: 'utf8'
        });

        const data = JSON.parse(output);
        const drives = [];

        function processDrive(device) {
            const name = device.name;
            const size = parseInt(device.size);
            const type = device.type;

            // Only track disk and part types (skip loop devices)
            if (type !== 'disk' && type !== 'part') return;

            drives.push({
                name: name,
                size: formatSize(size),
                type: type,
                mountpoint: device.mountpoint || 'not mounted',
                fstype: device.fstype || 'unknown',
                model: device.model || 'Unknown Model',
                uuid: device.uuid || `NO-UUID-${name}`,
                device: `/dev/${name}`
            });

            // Process children (partitions)
            if (device.children) {
                device.children.forEach(child => processDrive(child));
            }
        }

        // Process all block devices
        data.blockdevices.forEach(device => processDrive(device));

        return drives;
    } catch (err) {
        console.error('Error detecting drives:', err.message);
        return [];
    }
}

// Format bytes to human-readable size
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
}

// Determine drive type based on device name
function getDriveType(name) {
    if (name.startsWith('mmcblk')) return 'SD Card';
    if (name.startsWith('nvme')) return 'NVMe SSD';
    if (name.startsWith('sd')) return 'USB/SATA Drive';
    return 'Unknown';
}

module.exports = {
    detectDrives,
    getDriveType,
    formatSize
};
