const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');

// Get detailed disk information
function getDetailedDiskInfo(device) {
    const info = {
        device: device,
        partitionTable: null,
        bootable: false,
        bootPartitions: [],
        osInfo: [],
        hardware: {},
        partitions: [],
        lxdInfo: null
    };

    try {
        // Get partition table type
        const partedOutput = execSync(`parted -s ${device} print 2>/dev/null || true`, { encoding: 'utf8' });

        if (partedOutput.includes('Partition Table:')) {
            const tableMatch = partedOutput.match(/Partition Table: (\w+)/);
            if (tableMatch) {
                info.partitionTable = tableMatch[1];
            }
        }

        // Get partition details and boot flags
        const partedLines = partedOutput.split('\n');
        let inPartitionList = false;

        partedLines.forEach(line => {
            if (line.match(/^\s*Number\s+Start\s+End/)) {
                inPartitionList = true;
                return;
            }

            if (inPartitionList && line.trim() && !line.startsWith('Partition Table')) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    const partNum = parts[0];
                    const flags = line.includes('boot') || line.includes('esp') || line.includes('bios_grub');

                    if (flags) {
                        info.bootable = true;
                        info.bootPartitions.push({
                            number: partNum,
                            flags: line.match(/(boot|esp|bios_grub)/g) || []
                        });
                    }
                }
            }
        });

        // Get detailed partition info with filesystem labels
        const blkidOutput = execSync(`blkid -o export ${device}* 2>/dev/null || true`, { encoding: 'utf8' });
        const blocks = blkidOutput.split('\n\n').filter(b => b.trim());

        blocks.forEach(block => {
            const lines = block.split('\n');
            const partInfo = {};

            lines.forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    partInfo[key] = value;
                }
            });

            if (partInfo.DEVNAME) {
                const partition = {
                    device: partInfo.DEVNAME,
                    type: partInfo.TYPE || 'unknown',
                    label: partInfo.LABEL || null,
                    uuid: partInfo.UUID || null,
                    partlabel: partInfo.PARTLABEL || null
                };

                // Detect OS from filesystem labels and types
                const os = detectOS(partition, partInfo.DEVNAME);
                if (os) {
                    info.osInfo.push(os);
                }

                info.partitions.push(partition);
            }
        });

        // Get hardware info
        try {
            const lsblkHardware = execSync(`lsblk -ndo NAME,SIZE,MODEL,SERIAL,TRAN ${device} 2>/dev/null`, { encoding: 'utf8' });
            const hwParts = lsblkHardware.trim().split(/\s+/);

            info.hardware = {
                size: hwParts[1] || 'unknown',
                model: hwParts.slice(2, -2).join(' ') || 'unknown',
                serial: hwParts[hwParts.length - 2] || 'unknown',
                transport: hwParts[hwParts.length - 1] || 'unknown'
            };
        } catch (err) {
            // Fallback to basic info
            const lsblkBasic = execSync(`lsblk -ndo SIZE,MODEL ${device} 2>/dev/null || echo "unknown unknown"`, { encoding: 'utf8' });
            const [size, ...model] = lsblkBasic.trim().split(/\s+/);
            info.hardware = {
                size: size,
                model: model.join(' ') || 'unknown',
                serial: 'unknown',
                transport: 'unknown'
            };
        }

        // Check if device is currently mounted as boot
        const mountInfo = execSync(`mount | grep ${device} || true`, { encoding: 'utf8' });
        if (mountInfo.includes('/boot')) {
            info.bootable = true;
        }

        // Check for LXD storage on mounted partitions
        const lxcinfo = require('./lxcinfo.js');
        info.partitions.forEach(part => {
            // Get mount point for this partition
            try {
                const partMount = execSync(`findmnt -n -o TARGET ${part.device} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
                if (partMount) {
                    const lxdInfo = lxcinfo.detectLXDStorage(partMount);
                    if (lxdInfo.isLXD) {
                        info.lxdInfo = lxdInfo;
                        info.lxdInfo.mountpoint = partMount;
                    }
                }
            } catch (err) {
                // Ignore mount point lookup errors
            }
        });

    } catch (err) {
        console.error(`Error getting disk info: ${err.message}`);
    }

    return info;
}

// Detect OS from partition info
function detectOS(partition, devicePath) {
    const type = partition.type?.toLowerCase();
    const label = (partition.label || partition.partlabel || '').toLowerCase();

    // Check for boot partition indicators
    const isBootPartition = label.includes('boot') || label.includes('efi') || label.includes('esp');

    // Check filesystem content for OS detection
    try {
        // Try to mount and check for OS files (read-only)
        const tempMount = `/tmp/diskmgt_mount_${Date.now()}`;

        try {
            execSync(`mkdir -p ${tempMount}`, { encoding: 'utf8' });
            execSync(`mount -o ro ${devicePath} ${tempMount} 2>/dev/null`, { encoding: 'utf8' });

            const osDetected = {
                partition: devicePath,
                osType: 'Unknown',
                bootFiles: []
            };

            // Check for Linux
            if (fs.existsSync(`${tempMount}/etc/os-release`)) {
                const osRelease = fs.readFileSync(`${tempMount}/etc/os-release`, 'utf8');
                const nameMatch = osRelease.match(/PRETTY_NAME="([^"]+)"/);
                if (nameMatch) {
                    osDetected.osType = nameMatch[1];
                } else {
                    osDetected.osType = 'Linux (Unknown Distribution)';
                }
            }

            // Check for Windows
            if (fs.existsSync(`${tempMount}/Windows`) || fs.existsSync(`${tempMount}/windows`)) {
                osDetected.osType = 'Windows';
            }

            // Check for macOS
            if (fs.existsSync(`${tempMount}/System/Library/CoreServices`)) {
                osDetected.osType = 'macOS';
            }

            // Check for boot files
            const bootFiles = [
                'vmlinuz', 'vmlinux', 'kernel', 'bzImage',  // Linux kernels
                'EFI/BOOT/BOOTX64.EFI', 'EFI/ubuntu', 'EFI/debian',  // UEFI
                'grub', 'grub2',  // GRUB
                'bootmgr', 'BOOTMGR',  // Windows
                'boot/grub/grub.cfg'
            ];

            bootFiles.forEach(file => {
                if (fs.existsSync(`${tempMount}/${file}`)) {
                    osDetected.bootFiles.push(file);
                }
            });

            execSync(`umount ${tempMount} 2>/dev/null`, { encoding: 'utf8' });
            execSync(`rm -rf ${tempMount}`, { encoding: 'utf8' });

            if (osDetected.osType !== 'Unknown' || osDetected.bootFiles.length > 0) {
                return osDetected;
            }

        } catch (mountErr) {
            // Can't mount, try other detection methods
            try {
                execSync(`umount ${tempMount} 2>/dev/null || true`, { encoding: 'utf8' });
                execSync(`rm -rf ${tempMount} 2>/dev/null || true`, { encoding: 'utf8' });
            } catch (cleanupErr) {
                // Ignore cleanup errors
            }
        }

    } catch (err) {
        // Silent fail for OS detection
    }

    // Fallback detection based on labels and filesystem types
    if (isBootPartition) {
        return {
            partition: devicePath,
            osType: 'Boot Partition (OS Unknown)',
            bootFiles: []
        };
    }

    return null;
}

// Display detailed disk info panel
function displayDetailedDiskInfo(info) {
    const boxen = require('boxen');
    const Table = require('cli-table3');

    // Hardware info box
    const hwDetails = [
        `${chalk.bold('Device:')}    ${chalk.yellow(info.device)}`,
        `${chalk.bold('Size:')}      ${chalk.yellow(info.hardware.size)}`,
        `${chalk.bold('Model:')}     ${chalk.yellow(info.hardware.model)}`,
        `${chalk.bold('Transport:')} ${chalk.yellow(info.hardware.transport)}`,
        info.hardware.serial !== 'unknown' ? `${chalk.bold('Serial:')}    ${chalk.dim(info.hardware.serial)}` : null
    ].filter(Boolean).join('\n');

    console.log('\n' + boxen(hwDetails, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: '🔧 Hardware Information',
        titleAlignment: 'center'
    }));

    // Partition table info
    const ptDetails = [
        `${chalk.bold('Type:')}      ${chalk.yellow(info.partitionTable || 'Unknown')}`,
        `${chalk.bold('Bootable:')}  ${info.bootable ? chalk.green('✓ Yes') : chalk.yellow('✗ No')}`,
        info.bootPartitions.length > 0 ? chalk.bold('\nBoot Partitions:') : null,
        ...info.bootPartitions.map(bp => `  Partition ${bp.number}: ${chalk.green(bp.flags.join(', '))}`)
    ].filter(Boolean).join('\n');

    console.log(boxen(ptDetails, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'magenta',
        title: '💾 Partition Table',
        titleAlignment: 'center'
    }));

    // OS Information
    if (info.osInfo.length > 0) {
        const osDetails = info.osInfo.map(os => {
            const lines = [
                `${chalk.green('●')} ${chalk.bold(os.osType)}`,
                `  ${chalk.dim('Partition:')} ${os.partition}`
            ];
            if (os.bootFiles.length > 0) {
                lines.push(`  ${chalk.dim('Boot Files:')} ${os.bootFiles.slice(0, 3).join(', ')}`);
            }
            return lines.join('\n');
        }).join('\n\n');

        console.log(boxen(osDetails, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            title: '🖥️  Operating Systems Detected',
            titleAlignment: 'center'
        }));
    } else {
        console.log(boxen(chalk.dim('No OS detected (or partitions not accessible)'), {
            padding: 1,
            margin: 1,
            borderColor: 'yellow',
            title: '🖥️  Operating Systems',
            titleAlignment: 'center'
        }));
    }

    // Partitions table
    if (info.partitions.length > 0) {
        const partTable = new Table({
            head: [
                chalk.cyan.bold('Device'),
                chalk.cyan.bold('Type'),
                chalk.cyan.bold('Label'),
                chalk.cyan.bold('UUID')
            ],
            style: {
                head: [],
                border: ['cyan']
            }
        });

        info.partitions.forEach(part => {
            partTable.push([
                chalk.yellow(part.device.split('/').pop()),
                part.type,
                part.label || part.partlabel || chalk.dim('N/A'),
                part.uuid ? chalk.dim(part.uuid.substring(0, 24) + '...') : chalk.dim('N/A')
            ]);
        });

        console.log('\n' + boxen(partTable.toString(), {
            padding: { left: 1, right: 1, top: 0, bottom: 0 },
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue',
            title: '📂 Partitions',
            titleAlignment: 'center'
        }));
    }

    // LXD Storage information
    if (info.lxdInfo && info.lxdInfo.isLXD) {
        const lxcinfo = require('./lxcinfo.js');
        lxcinfo.displayLXDInfo(info.lxdInfo);
    }
}

module.exports = {
    getDetailedDiskInfo,
    displayDetailedDiskInfo
};
