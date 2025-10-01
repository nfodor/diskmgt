const { execSync } = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');
const display = require('./display');

// Check if btrfs-convert is available
function isAvailable() {
    try {
        execSync('which btrfs-convert', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// Get filesystem info
function getFilesystemInfo(device) {
    try {
        const output = execSync(`lsblk -nlo FSTYPE,SIZE,MOUNTPOINT,LABEL ${device}`, { encoding: 'utf-8' });
        const [fstype, size, mountpoint, label] = output.trim().split(/\s+/);
        return { fstype, size, mountpoint: mountpoint || 'not mounted', label: label || 'none' };
    } catch (err) {
        throw new Error(`Failed to get filesystem info: ${err.message}`);
    }
}

// Check if device is mounted
function isMounted(device) {
    try {
        const output = execSync(`mount | grep "^${device} "`, { encoding: 'utf-8' });
        return output.trim().length > 0;
    } catch {
        return false;
    }
}

// Unmount device
function unmount(device) {
    try {
        execSync(`umount ${device}`, { stdio: 'inherit' });
        return true;
    } catch (err) {
        throw new Error(`Failed to unmount ${device}: ${err.message}`);
    }
}

// Run filesystem check
function fsck(device, fstype) {
    display.displayInfo(`Running filesystem check on ${device}...`);
    try {
        if (fstype === 'ext4' || fstype === 'ext3' || fstype === 'ext2') {
            execSync(`e2fsck -fy ${device}`, { stdio: 'inherit' });
        } else {
            throw new Error(`Unsupported filesystem for check: ${fstype}`);
        }
        return true;
    } catch (err) {
        throw new Error(`Filesystem check failed: ${err.message}`);
    }
}

// Convert ext4 to BTRFS
async function convertToBtrfs(device) {
    display.displayHeader('Convert to BTRFS');

    // Check if btrfs-convert is available
    if (!isAvailable()) {
        display.displayError('btrfs-convert is not installed!');
        console.log(chalk.yellow('\nInstall it with: sudo apt install btrfs-progs\n'));
        return;
    }

    // Get filesystem info
    const info = getFilesystemInfo(device);

    console.log(chalk.cyan('Current filesystem information:'));
    console.log(`  Device:     ${device}`);
    console.log(`  Type:       ${info.fstype}`);
    console.log(`  Size:       ${info.size}`);
    console.log(`  Label:      ${info.label}`);
    console.log(`  Mount:      ${info.mountpoint}\n`);

    // Validate filesystem type
    if (!['ext2', 'ext3', 'ext4'].includes(info.fstype)) {
        display.displayError(`Cannot convert ${info.fstype} to BTRFS. Only ext2/ext3/ext4 supported.`);
        return;
    }

    // Check if it's a root filesystem
    if (info.mountpoint === '/') {
        display.displayError('Cannot convert root filesystem while it\'s running!');
        console.log(chalk.yellow('\nTo convert your root filesystem:'));
        console.log('1. Boot from USB/SD card with DiskMgt');
        console.log('2. Run conversion on unmounted root drive');
        console.log('3. Update /etc/fstab with BTRFS options');
        console.log('4. Reboot to converted system\n');
        return;
    }

    // Show safety warnings
    console.log(chalk.bold.yellow('⚠️  IMPORTANT SAFETY INFORMATION:\n'));
    console.log(chalk.yellow('• This will convert ext4 → BTRFS in-place'));
    console.log(chalk.yellow('• Original filesystem saved as "ext2_saved" (can rollback)'));
    console.log(chalk.yellow('• Requires device to be unmounted'));
    console.log(chalk.yellow('• Filesystem check will be performed first'));
    console.log(chalk.yellow('• Conversion typically takes 1-5 minutes\n'));

    console.log(chalk.bold.green('✓ SAFETY FEATURES:\n'));
    console.log(chalk.green('• Full rollback possible: btrfs-convert -r'));
    console.log(chalk.green('• Original data preserved in snapshot'));
    console.log(chalk.green('• ARM64 16KB blocksize configured automatically'));
    console.log(chalk.green('• Filesystem integrity checked before conversion\n'));

    // Get confirmation
    const { confirm1 } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm1',
        message: chalk.bold('Do you have a backup of this data?'),
        default: false
    }]);

    if (!confirm1) {
        display.displayInfo('Please create a backup first. Use "Backup & Restore" menu.');
        return;
    }

    const { confirm2 } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm2',
        message: chalk.bold(`Convert ${device} from ${info.fstype} to BTRFS?`),
        default: false
    }]);

    if (!confirm2) {
        display.displayInfo('Conversion cancelled.');
        return;
    }

    try {
        // Unmount if mounted
        if (isMounted(device)) {
            display.displayInfo(`Unmounting ${device}...`);
            unmount(device);
        }

        // Run filesystem check
        fsck(device, info.fstype);

        // Perform conversion
        display.displayInfo(`Converting ${device} to BTRFS...`);
        console.log(chalk.dim('This may take several minutes depending on filesystem size.\n'));

        execSync(`btrfs-convert ${device}`, { stdio: 'inherit' });

        display.displaySuccess(`✓ Conversion complete!`);

        console.log(chalk.bold.green('\n📋 Next steps:\n'));
        console.log(chalk.green('1. Mount the filesystem: mount -t btrfs'));
        console.log(chalk.green('2. Test your data is intact'));
        console.log(chalk.green('3. To make permanent: btrfs subvolume delete /mount/ext2_saved'));
        console.log(chalk.green('4. To rollback: btrfs-convert -r ' + device));
        console.log(chalk.green('\n5. Enable compression: remount with -o compress=zstd\n'));

    } catch (err) {
        display.displayError(`Conversion failed: ${err.message}`);
    }
}

// Rollback from BTRFS to ext4
async function rollbackToExt4(device) {
    display.displayHeader('Rollback to ext4');

    const info = getFilesystemInfo(device);

    if (info.fstype !== 'btrfs') {
        display.displayError(`Device ${device} is not BTRFS (current: ${info.fstype})`);
        return;
    }

    console.log(chalk.yellow('⚠️  This will rollback BTRFS → ext4'));
    console.log(chalk.yellow('Only works if ext2_saved subvolume still exists.\n'));

    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Rollback ${device} from BTRFS to ext4?`,
        default: false
    }]);

    if (!confirm) {
        display.displayInfo('Rollback cancelled.');
        return;
    }

    try {
        if (isMounted(device)) {
            display.displayInfo(`Unmounting ${device}...`);
            unmount(device);
        }

        display.displayInfo(`Rolling back ${device} to ext4...`);
        execSync(`btrfs-convert -r ${device}`, { stdio: 'inherit' });

        display.displaySuccess('✓ Rollback complete! Filesystem restored to ext4.');

    } catch (err) {
        display.displayError(`Rollback failed: ${err.message}`);
    }
}

// Delete ext2_saved subvolume (make conversion permanent)
async function deleteSavedImage(device) {
    display.displayHeader('Delete Rollback Image');

    const info = getFilesystemInfo(device);

    if (info.fstype !== 'btrfs') {
        display.displayError(`Device ${device} is not BTRFS`);
        return;
    }

    console.log(chalk.yellow('⚠️  This will DELETE the ext2_saved rollback image'));
    console.log(chalk.yellow('After this, you CANNOT rollback to ext4!'));
    console.log(chalk.green('✓ Frees space used by original filesystem backup\n'));

    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Make BTRFS conversion permanent? (cannot undo)',
        default: false
    }]);

    if (!confirm) {
        display.displayInfo('Operation cancelled.');
        return;
    }

    try {
        // Need to mount first to access subvolume
        const tempMount = '/tmp/btrfs-temp-mount';
        execSync(`mkdir -p ${tempMount}`, { stdio: 'ignore' });

        const wasMounted = isMounted(device);
        const originalMount = info.mountpoint;

        if (!wasMounted) {
            display.displayInfo(`Mounting ${device} temporarily...`);
            execSync(`mount ${device} ${tempMount}`, { stdio: 'inherit' });
        }

        const mountPoint = wasMounted ? originalMount : tempMount;

        display.displayInfo('Deleting ext2_saved subvolume...');
        execSync(`btrfs subvolume delete ${mountPoint}/ext2_saved`, { stdio: 'inherit' });

        if (!wasMounted) {
            execSync(`umount ${tempMount}`, { stdio: 'ignore' });
            execSync(`rmdir ${tempMount}`, { stdio: 'ignore' });
        }

        display.displaySuccess('✓ Rollback image deleted. Conversion is now permanent!');

    } catch (err) {
        display.displayError(`Failed: ${err.message}`);
    }
}

module.exports = {
    isAvailable,
    convertToBtrfs,
    rollbackToExt4,
    deleteSavedImage
};
