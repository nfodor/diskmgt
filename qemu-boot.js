const { execSync, spawn } = require('child_process');
const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const display = require('./display');

// Check if QEMU is available
function isAvailable() {
    try {
        execSync('which qemu-system-aarch64', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// Detect boot partition and root partition
function detectBootablePartitions(device) {
    try {
        // Get all partitions for this disk
        const diskDevice = device.replace(/p?\d+$/, ''); // Get base disk device
        const output = execSync(`lsblk -nlo NAME,FSTYPE,MOUNTPOINT,LABEL,PARTTYPE ${diskDevice}`, { encoding: 'utf-8' });
        const lines = output.trim().split('\n');

        const partitions = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                device: '/dev/' + parts[0],
                fstype: parts[1] || '',
                mountpoint: parts[2] || '',
                label: parts[3] || '',
                parttype: parts[4] || ''
            };
        }).filter(p => p.device !== diskDevice && p.device.startsWith(diskDevice));

        // Find boot partition (vfat with bootfs label or EFI partition type)
        const bootPart = partitions.find(p =>
            (p.fstype === 'vfat' && (p.label === 'bootfs' || p.label.toLowerCase().includes('boot'))) ||
            p.parttype === 'c12a7328-f81f-11d2-ba4b-00a0c93ec93b' // EFI partition
        );

        // Find root partition (ext4/btrfs, usually largest or has rootfs label)
        const rootPart = partitions.find(p =>
            (p.fstype === 'ext4' || p.fstype === 'btrfs') &&
            (p.label === 'rootfs' || p.label.toLowerCase().includes('root'))
        ) || partitions.find(p => p.fstype === 'ext4' || p.fstype === 'btrfs');

        return { bootPart, rootPart, partitions };
    } catch (err) {
        throw new Error(`Failed to detect partitions: ${err.message}`);
    }
}

// Extract kernel and DTB from boot partition
function extractBootFiles(bootDevice, tempDir) {
    try {
        const mountPoint = `${tempDir}/boot-mount`;
        execSync(`mkdir -p ${mountPoint}`, { stdio: 'ignore' });
        execSync(`mount -o ro ${bootDevice} ${mountPoint}`, { stdio: 'inherit' });

        // Look for kernel
        let kernelSrc = null;
        const kernelCandidates = ['kernel8.img', 'kernel_2712.img', 'vmlinuz', 'Image'];
        for (const candidate of kernelCandidates) {
            if (fs.existsSync(`${mountPoint}/${candidate}`)) {
                kernelSrc = `${mountPoint}/${candidate}`;
                break;
            }
        }

        if (!kernelSrc) {
            execSync(`umount ${mountPoint}`, { stdio: 'ignore' });
            throw new Error('No kernel found on boot partition');
        }

        // Copy kernel
        const kernelDest = `${tempDir}/kernel.img`;
        execSync(`cp ${kernelSrc} ${kernelDest}`, { stdio: 'inherit' });

        // Look for device tree
        let dtbSrc = null;
        const dtbCandidates = [
            'bcm2711-rpi-4-b.dtb',
            'bcm2712-rpi-5-b.dtb',
            'bcm2710-rpi-3-b-plus.dtb'
        ];
        for (const candidate of dtbCandidates) {
            if (fs.existsSync(`${mountPoint}/${candidate}`)) {
                dtbSrc = `${mountPoint}/${candidate}`;
                break;
            }
        }

        let dtbDest = null;
        if (dtbSrc) {
            dtbDest = `${tempDir}/device-tree.dtb`;
            execSync(`cp ${dtbSrc} ${dtbDest}`, { stdio: 'inherit' });
        }

        execSync(`umount ${mountPoint}`, { stdio: 'ignore' });
        execSync(`rmdir ${mountPoint}`, { stdio: 'ignore' });

        return { kernel: kernelDest, dtb: dtbDest };
    } catch (err) {
        throw new Error(`Failed to extract boot files: ${err.message}`);
    }
}

// Boot drive in QEMU
async function bootInQemu(device) {
    display.displayHeader('Boot Drive in QEMU');

    // Check if QEMU is available
    if (!isAvailable()) {
        display.displayError('QEMU ARM64 emulator not installed!');
        console.log(chalk.yellow('\nInstall with: sudo apt install qemu-system-arm\n'));
        return;
    }

    console.log(chalk.cyan(`Analyzing drive: ${device}\n`));

    try {
        // Detect partitions
        const { bootPart, rootPart, partitions } = detectBootablePartitions(device);

        console.log(chalk.cyan('Detected partitions:'));
        partitions.forEach(p => {
            console.log(`  ${p.device} - ${p.fstype || 'unknown'} ${p.label ? '(' + p.label + ')' : ''}`);
        });
        console.log('');

        if (!rootPart) {
            display.displayError('No root partition detected (need ext4 or btrfs)');
            return;
        }

        console.log(chalk.green(`✓ Root partition: ${rootPart.device}`));
        if (bootPart) {
            console.log(chalk.green(`✓ Boot partition: ${bootPart.device}\n`));
        } else {
            console.log(chalk.yellow('⚠ No separate boot partition found\n'));
        }

        // Configuration options
        const { memory, network } = await inquirer.prompt([
            {
                type: 'list',
                name: 'memory',
                message: 'RAM allocation:',
                choices: [
                    { name: '2GB (recommended)', value: '2G' },
                    { name: '4GB', value: '4G' },
                    { name: '1GB (minimal)', value: '1G' }
                ],
                default: '2G'
            },
            {
                type: 'confirm',
                name: 'network',
                message: 'Enable network (SSH port forwarding 5555 → 22)?',
                default: true
            }
        ]);

        // Determine if we need to extract kernel
        let kernel, dtb;
        if (bootPart) {
            console.log(chalk.cyan('\nExtracting kernel and device tree from boot partition...'));
            const tempDir = `/tmp/qemu-boot-${Date.now()}`;
            execSync(`mkdir -p ${tempDir}`, { stdio: 'ignore' });

            try {
                const bootFiles = extractBootFiles(bootPart.device, tempDir);
                kernel = bootFiles.kernel;
                dtb = bootFiles.dtb;
                console.log(chalk.green(`✓ Kernel extracted: ${kernel}`));
                if (dtb) console.log(chalk.green(`✓ Device tree: ${dtb}`));
            } catch (err) {
                display.displayError(err.message);
                execSync(`rm -rf ${tempDir}`, { stdio: 'ignore' });
                return;
            }
        }

        // Build QEMU command
        const qemuArgs = [
            '-M', 'virt',
            '-cpu', 'cortex-a72',
            '-m', memory,
            '-nographic',
            '-serial', 'mon:stdio'
        ];

        if (kernel) {
            qemuArgs.push('-kernel', kernel);
            const rootDevice = '/dev/vda2'; // Assuming standard partition layout
            qemuArgs.push('-append', `root=${rootDevice} rootfstype=${rootPart.fstype} rw console=ttyAMA0`);
        }

        if (dtb) {
            qemuArgs.push('-dtb', dtb);
        }

        // Add disk
        const diskDevice = device.replace(/p?\d+$/, ''); // Get base disk device
        qemuArgs.push('-drive', `file=${diskDevice},format=raw,if=virtio`);

        // Add network
        if (network) {
            qemuArgs.push(
                '-device', 'virtio-net-pci,netdev=net0',
                '-netdev', 'user,id=net0,hostfwd=tcp::5555-:22'
            );
        }

        console.log(chalk.bold.yellow('\n⚠️  QEMU Boot Safety:\n'));
        console.log(chalk.yellow('• Drive will boot in isolated emulator'));
        console.log(chalk.yellow('• Changes WILL be written to the actual drive'));
        console.log(chalk.yellow('• Use read-only mode for inspection only'));
        console.log(chalk.yellow('• To exit: Ctrl+A then X\n'));

        const { mode } = await inquirer.prompt([{
            type: 'list',
            name: 'mode',
            message: 'Boot mode:',
            choices: [
                { name: '👁️  Read-only (safe inspection, no changes saved)', value: 'readonly' },
                { name: '✏️  Read-write (can modify drive)', value: 'readwrite' }
            ],
            default: 'readonly'
        }]);

        if (mode === 'readonly') {
            // Add snapshot mode (no writes to disk)
            qemuArgs.push('-snapshot');
            console.log(chalk.green('\n✓ Snapshot mode enabled - no changes will be saved\n'));
        } else {
            console.log(chalk.red('\n⚠️  Changes WILL be written to the drive!\n'));
        }

        console.log(chalk.bold.cyan('Starting QEMU...\n'));
        console.log(chalk.dim('QEMU command: qemu-system-aarch64 ' + qemuArgs.join(' ') + '\n'));

        // Spawn QEMU with stdio inheritance
        const qemu = spawn('qemu-system-aarch64', qemuArgs, {
            stdio: 'inherit'
        });

        // Wait for QEMU to exit
        await new Promise((resolve) => {
            qemu.on('close', (code) => {
                console.log(chalk.cyan(`\n\nQEMU exited with code ${code}\n`));
                resolve();
            });
        });

        // Cleanup
        if (kernel) {
            const tempDir = kernel.substring(0, kernel.lastIndexOf('/'));
            execSync(`rm -rf ${tempDir}`, { stdio: 'ignore' });
        }

    } catch (err) {
        display.displayError(`Failed to boot in QEMU: ${err.message}`);
    }
}

module.exports = {
    isAvailable,
    bootInQemu
};
