const { execSync } = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');
const display = require('./display');

// Mount a partition
async function mountPartition(device) {
    const mountpoint = `/mnt/${device.split('/').pop()}`;

    try {
        // Create mount point if it doesn't exist
        execSync(`mkdir -p ${mountpoint}`, { encoding: 'utf8' });

        // Mount the partition
        execSync(`mount ${device} ${mountpoint}`, { encoding: 'utf8' });

        display.displaySuccess(`Partition mounted at ${mountpoint}`);
        return mountpoint;
    } catch (err) {
        display.displayError(`Failed to mount: ${err.message}`);
        return null;
    }
}

// Unmount a partition
async function unmountPartition(device) {
    try {
        execSync(`umount ${device}`, { encoding: 'utf8' });
        display.displaySuccess(`Partition unmounted successfully`);
        return true;
    } catch (err) {
        display.displayError(`Failed to unmount: ${err.message}`);
        return false;
    }
}

// Run filesystem check
async function checkFilesystem(device, fstype, readOnly = true) {
    console.log(chalk.cyan(`\n  Running filesystem check on ${device}...\n`));

    let checkCmd;
    const mode = readOnly ? 'read-only' : 'repair';

    switch (fstype) {
        case 'ext4':
        case 'ext3':
        case 'ext2':
            checkCmd = readOnly ? `e2fsck -n ${device}` : `e2fsck -p ${device}`;
            break;
        case 'btrfs':
            checkCmd = readOnly ? `btrfs check --readonly ${device}` : `btrfs check --repair ${device}`;
            break;
        case 'xfs':
            checkCmd = readOnly ? `xfs_repair -n ${device}` : `xfs_repair ${device}`;
            break;
        case 'vfat':
        case 'fat32':
            checkCmd = readOnly ? `fsck.vfat -n ${device}` : `fsck.vfat -a ${device}`;
            break;
        default:
            display.displayError(`Filesystem type "${fstype}" not supported for checking.`);
            return;
    }

    console.log(chalk.yellow(`  Mode: ${mode}\n`));

    try {
        const output = execSync(checkCmd, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
        display.displaySuccess('Filesystem check completed');
        console.log(output);
    } catch (err) {
        console.log(chalk.yellow('\n  ⚠ Filesystem check found issues:\n'));
        console.log(err.stdout || err.message);
    }
}

// Backup partition to image file
async function backupPartition(device) {
    const boxen = require('boxen');
    const deviceName = device.split('/').pop();
    const backupPath = `/tmp/backup-${deviceName}-${Date.now()}.img`;

    console.log(boxen(`Creating backup of ${device}\nThis may take a while...`, {
        padding: 1,
        margin: 1,
        borderColor: 'yellow'
    }));

    try {
        execSync(`dd if=${device} of=${backupPath} bs=4M status=progress`, {
            encoding: 'utf8',
            stdio: 'inherit'
        });

        display.displaySuccess(`Backup created: ${backupPath}`);
        return backupPath;
    } catch (err) {
        display.displayError(`Backup failed: ${err.message}`);
        return null;
    }
}

// Clone partition to another device
async function clonePartition(sourceDevice, targetDevice) {
    const boxen = require('boxen');

    console.log(boxen(
        chalk.red.bold('WARNING') + '\n' +
        `This will OVERWRITE all data on ${targetDevice}\n` +
        `Source: ${sourceDevice}\n` +
        `Target: ${targetDevice}`,
        {
            padding: 1,
            margin: 1,
            borderColor: 'red',
            borderStyle: 'double'
        }
    ));

    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Are you absolutely sure you want to proceed?',
        default: false
    }]);

    if (!confirm) {
        display.displayInfo('Clone operation cancelled.');
        return false;
    }

    try {
        execSync(`dd if=${sourceDevice} of=${targetDevice} bs=4M status=progress`, {
            encoding: 'utf8',
            stdio: 'inherit'
        });

        display.displaySuccess(`Partition cloned successfully`);
        return true;
    } catch (err) {
        display.displayError(`Clone failed: ${err.message}`);
        return false;
    }
}

// Format partition
async function formatPartition(device) {
    const boxen = require('boxen');

    console.log(boxen(
        chalk.red.bold('WARNING') + '\n' +
        `This will ERASE ALL DATA on ${device}`,
        {
            padding: 1,
            margin: 1,
            borderColor: 'red',
            borderStyle: 'double'
        }
    ));

    const { fstype } = await inquirer.prompt([{
        type: 'list',
        name: 'fstype',
        message: 'Select filesystem type:',
        choices: ['ext4', 'ext3', 'btrfs', 'xfs', 'vfat', 'Cancel']
    }]);

    if (fstype === 'Cancel') {
        display.displayInfo('Format cancelled.');
        return false;
    }

    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Format ${device} as ${fstype}?`,
        default: false
    }]);

    if (!confirm) {
        display.displayInfo('Format cancelled.');
        return false;
    }

    try {
        let formatCmd;
        switch (fstype) {
            case 'ext4':
            case 'ext3':
            case 'ext2':
                formatCmd = `mkfs.${fstype} -F ${device}`;
                break;
            case 'btrfs':
                formatCmd = `mkfs.btrfs -f ${device}`;
                break;
            case 'xfs':
                formatCmd = `mkfs.xfs -f ${device}`;
                break;
            case 'vfat':
                formatCmd = `mkfs.vfat ${device}`;
                break;
        }

        execSync(formatCmd, { encoding: 'utf8', stdio: 'inherit' });
        display.displaySuccess(`Partition formatted as ${fstype}`);
        return true;
    } catch (err) {
        display.displayError(`Format failed: ${err.message}`);
        return false;
    }
}

// Set partition label
async function setPartitionLabel(device, fstype) {
    const { label } = await inquirer.prompt([{
        type: 'input',
        name: 'label',
        message: 'Enter new partition label:',
        validate: input => input.trim().length > 0 || 'Label cannot be empty'
    }]);

    try {
        let labelCmd;
        switch (fstype) {
            case 'ext4':
            case 'ext3':
            case 'ext2':
                labelCmd = `e2label ${device} "${label}"`;
                break;
            case 'btrfs':
                labelCmd = `btrfs filesystem label ${device} "${label}"`;
                break;
            case 'xfs':
                labelCmd = `xfs_admin -L "${label}" ${device}`;
                break;
            case 'vfat':
            case 'fat32':
                labelCmd = `fatlabel ${device} "${label}"`;
                break;
            default:
                display.displayError(`Filesystem type "${fstype}" not supported for labeling.`);
                return false;
        }

        execSync(labelCmd, { encoding: 'utf8' });
        display.displaySuccess(`Partition label set to "${label}"`);
        return true;
    } catch (err) {
        display.displayError(`Failed to set label: ${err.message}`);
        return false;
    }
}

// Resize partition
async function resizePartition(device, fstype) {
    console.log(chalk.cyan('\n  Checking current partition size...\n'));

    try {
        const currentSize = execSync(`blockdev --getsize64 ${device}`, { encoding: 'utf8' }).trim();
        const currentGB = (parseInt(currentSize) / (1024 * 1024 * 1024)).toFixed(2);

        console.log(`  Current size: ${currentGB} GB\n`);

        const { newSize } = await inquirer.prompt([{
            type: 'input',
            name: 'newSize',
            message: 'Enter new size (e.g., 100G, 500M):',
            validate: input => /^\d+[GMK]$/.test(input) || 'Invalid format (use 100G, 500M, etc.)'
        }]);

        let resizeCmd;
        switch (fstype) {
            case 'ext4':
            case 'ext3':
            case 'ext2':
                // First resize partition, then filesystem
                console.log(chalk.yellow('\n  Note: Resize requires unmounting first\n'));
                resizeCmd = `resize2fs ${device} ${newSize}`;
                break;
            case 'btrfs':
                resizeCmd = `btrfs filesystem resize ${newSize} ${device}`;
                break;
            case 'xfs':
                display.displayError('XFS can only be grown, not shrunk');
                resizeCmd = `xfs_growfs ${device}`;
                break;
            default:
                display.displayError(`Filesystem type "${fstype}" not supported for resizing.`);
                return false;
        }

        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Resize ${device} to ${newSize}?`,
            default: false
        }]);

        if (!confirm) {
            display.displayInfo('Resize cancelled.');
            return false;
        }

        execSync(resizeCmd, { encoding: 'utf8', stdio: 'inherit' });
        display.displaySuccess('Partition resized successfully');
        return true;
    } catch (err) {
        display.displayError(`Resize failed: ${err.message}`);
        return false;
    }
}

module.exports = {
    mountPartition,
    unmountPartition,
    checkFilesystem,
    backupPartition,
    clonePartition,
    formatPartition,
    setPartitionLabel,
    resizePartition
};
