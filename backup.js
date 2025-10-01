const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const display = require('./display');

/**
 * BACKUP METHODS AND THEIR PROS/CONS:
 *
 * 1. BLOCK-LEVEL (dd) - Bit-for-bit copy
 *    PROS: Complete exact copy, bootable, includes all hidden data
 *    CONS: Slow, large files, includes empty space, can't resize
 *    USE: System drives, recovery scenarios, forensics
 *
 * 2. FILESYSTEM-LEVEL (tar, rsync) - File-by-file copy
 *    PROS: Fast, compressed, excludes empty space, flexible restore
 *    CONS: Loses some metadata, not bootable without setup, requires mounted
 *    USE: Data drives, user files, regular backups
 *
 * 3. SNAPSHOT-BASED (btrfs/zfs snapshots) - Copy-on-write
 *    PROS: Instant, space-efficient, incremental, point-in-time
 *    CONS: Filesystem-specific, complex, requires supported FS
 *    USE: Servers, databases, version control
 *
 * 4. INCREMENTAL (rsync --link-dest, restic) - Only changes
 *    PROS: Fast subsequent backups, space-efficient, deduplication
 *    CONS: More complex restore, dependency chain
 *    USE: Daily backups, large datasets, limited storage
 */

// Get backup config
function getBackupConfig() {
    const configPath = path.join(require('os').homedir(), '.config/diskmgt/backup-config.json');

    if (!fs.existsSync(configPath)) {
        return {
            s3: { enabled: false },
            local: { path: '/tmp/drive-backups' }
        };
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Save backup config
function saveBackupConfig(config) {
    const configPath = path.join(require('os').homedir(), '.config/diskmgt/backup-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Configure cloud backup providers
async function configureCloudBackup() {
    const boxen = require('boxen');

    console.log(boxen(
        'Cloud Backup Configuration\n\n' +
        'Supported providers:\n' +
        '  • AWS S3\n' +
        '  • Backblaze B2\n' +
        '  • DigitalOcean Spaces\n' +
        '  • Wasabi\n' +
        '  • MinIO (self-hosted)',
        { padding: 1, borderColor: 'cyan' }
    ));

    const config = getBackupConfig();

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'enable',
            message: 'Enable S3-compatible cloud backup?',
            default: config.s3?.enabled || false
        },
        {
            type: 'list',
            name: 'provider',
            message: 'Select provider:',
            choices: ['AWS S3', 'Backblaze B2', 'DigitalOcean Spaces', 'Wasabi', 'MinIO/Custom'],
            when: (answers) => answers.enable
        },
        {
            type: 'input',
            name: 'endpoint',
            message: 'S3 Endpoint URL (leave empty for AWS):',
            when: (answers) => answers.enable && answers.provider !== 'AWS S3'
        },
        {
            type: 'input',
            name: 'bucket',
            message: 'Bucket name:',
            when: (answers) => answers.enable
        },
        {
            type: 'input',
            name: 'accessKey',
            message: 'Access Key ID:',
            when: (answers) => answers.enable
        },
        {
            type: 'password',
            name: 'secretKey',
            message: 'Secret Access Key:',
            mask: '*',
            when: (answers) => answers.enable
        },
        {
            type: 'input',
            name: 'region',
            message: 'Region (e.g., us-east-1):',
            default: 'us-east-1',
            when: (answers) => answers.enable
        }
    ]);

    if (answers.enable) {
        config.s3 = {
            enabled: true,
            provider: answers.provider,
            endpoint: answers.endpoint || null,
            bucket: answers.bucket,
            accessKey: answers.accessKey,
            secretKey: answers.secretKey,
            region: answers.region
        };
    } else {
        config.s3 = { enabled: false };
    }

    saveBackupConfig(config);
    display.displaySuccess('Cloud backup configuration saved');
}

// Backup drive with method selection
async function backupDrive(device, deviceName) {
    const boxen = require('boxen');

    console.log(boxen(
        `Backup Drive: ${deviceName} (${device})`,
        { padding: 1, borderColor: 'cyan', margin: 1 }
    ));

    const { method } = await inquirer.prompt([{
        type: 'list',
        name: 'method',
        message: 'Select backup method:',
        choices: [
            new inquirer.Separator('─── Complete Backups ───'),
            { name: '💾 Block-level (dd) - Exact bit-for-bit copy [SLOW, LARGE]', value: 'dd' },
            { name: '📁 Filesystem (tar) - Compress files only [FAST, SMALL]', value: 'tar' },
            new inquirer.Separator('─── Advanced ───'),
            { name: '🔄 Incremental (rsync) - Only changed files', value: 'rsync' },
            { name: '📸 Snapshot (btrfs) - COW snapshot [btrfs only]', value: 'snapshot' },
            new inquirer.Separator(),
            { name: 'Cancel', value: null }
        ],
        pageSize: 15
    }]);

    if (!method) return null;

    const { destination } = await inquirer.prompt([{
        type: 'list',
        name: 'destination',
        message: 'Backup destination:',
        choices: [
            { name: '💻 Local file', value: 'local' },
            { name: '☁️  Cloud (S3)', value: 's3' },
            { name: 'Cancel', value: null }
        ]
    }]);

    if (!destination) return null;

    let backupPath;

    if (destination === 'local') {
        const config = getBackupConfig();
        const defaultPath = path.join(config.local.path, `${deviceName}-${Date.now()}.${method === 'dd' ? 'img' : 'tar.gz'}`);

        const answer = await inquirer.prompt([{
            type: 'input',
            name: 'path',
            message: 'Backup file path:',
            default: defaultPath
        }]);

        backupPath = answer.path;

        // Ensure directory exists
        execSync(`mkdir -p ${path.dirname(backupPath)}`);
    } else {
        const config = getBackupConfig();
        if (!config.s3?.enabled) {
            display.displayError('S3 not configured. Run "Configure cloud backup" first.');
            return null;
        }
        backupPath = `s3://${config.s3.bucket}/${deviceName}-${Date.now()}.${method === 'dd' ? 'img' : 'tar.gz'}`;
    }

    // Execute backup based on method
    try {
        switch (method) {
            case 'dd':
                await backupBlockLevel(device, backupPath, destination);
                break;
            case 'tar':
                await backupFilesystem(device, backupPath, destination);
                break;
            case 'rsync':
                await backupIncremental(device, backupPath, destination);
                break;
            case 'snapshot':
                await backupSnapshot(device, backupPath);
                break;
        }

        return backupPath;
    } catch (err) {
        display.displayError(`Backup failed: ${err.message}`);
        return null;
    }
}

// Block-level backup (dd)
async function backupBlockLevel(device, backupPath, destination) {
    console.log(chalk.cyan('\n  Creating block-level backup with dd...\n'));
    console.log(chalk.yellow('  This will take a while. Progress will be shown.\n'));

    if (destination === 's3') {
        // Stream to S3
        const config = getBackupConfig();
        const endpoint = config.s3.endpoint ? `--endpoint-url=${config.s3.endpoint}` : '';

        console.log(chalk.dim(`  Streaming to ${backupPath}...\n`));

        execSync(
            `dd if=${device} bs=4M status=progress | ` +
            `gzip -c | ` +
            `aws s3 cp - ${backupPath} ${endpoint} ` +
            `--region ${config.s3.region}`,
            {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    AWS_ACCESS_KEY_ID: config.s3.accessKey,
                    AWS_SECRET_ACCESS_KEY: config.s3.secretKey
                }
            }
        );
    } else {
        // Local file
        execSync(
            `dd if=${device} of=${backupPath} bs=4M status=progress`,
            { stdio: 'inherit' }
        );
    }

    display.displaySuccess(`Block-level backup completed: ${backupPath}`);
}

// Filesystem backup (tar)
async function backupFilesystem(device, backupPath, destination) {
    console.log(chalk.cyan('\n  Creating filesystem backup with tar...\n'));

    // Check if mounted
    const mountInfo = execSync(`findmnt -n -o TARGET ${device} || echo ""`, { encoding: 'utf8' }).trim();

    let mountpoint;
    let tempMount = false;

    if (!mountInfo) {
        // Need to mount temporarily
        mountpoint = `/tmp/backup-mount-${Date.now()}`;
        execSync(`mkdir -p ${mountpoint}`);
        execSync(`mount -o ro ${device} ${mountpoint}`);
        tempMount = true;
        console.log(chalk.dim(`  Temporarily mounted at ${mountpoint}\n`));
    } else {
        mountpoint = mountInfo;
    }

    try {
        if (destination === 's3') {
            const config = getBackupConfig();
            const endpoint = config.s3.endpoint ? `--endpoint-url=${config.s3.endpoint}` : '';

            execSync(
                `tar czf - -C ${mountpoint} . | ` +
                `aws s3 cp - ${backupPath} ${endpoint} --region ${config.s3.region}`,
                {
                    stdio: 'inherit',
                    env: {
                        ...process.env,
                        AWS_ACCESS_KEY_ID: config.s3.accessKey,
                        AWS_SECRET_ACCESS_KEY: config.s3.secretKey
                    }
                }
            );
        } else {
            execSync(
                `tar czf ${backupPath} -C ${mountpoint} .`,
                { stdio: 'inherit' }
            );
        }

        display.displaySuccess(`Filesystem backup completed: ${backupPath}`);
    } finally {
        if (tempMount) {
            execSync(`umount ${mountpoint}`);
            execSync(`rm -rf ${mountpoint}`);
        }
    }
}

// Incremental backup (rsync)
async function backupIncremental(device, backupPath, destination) {
    console.log(chalk.cyan('\n  Creating incremental backup with rsync...\n'));

    if (destination === 's3') {
        display.displayError('Incremental rsync to S3 not supported. Use local destination.');
        return;
    }

    // Check if mounted
    const mountInfo = execSync(`findmnt -n -o TARGET ${device} || echo ""`, { encoding: 'utf8' }).trim();

    if (!mountInfo) {
        display.displayError('Drive must be mounted for rsync backup');
        return;
    }

    // Create backup directory
    const backupDir = backupPath.replace(/\.(tar\.gz|img)$/, '');
    execSync(`mkdir -p ${backupDir}`);

    // Look for previous backup for linking
    const backupParent = path.dirname(backupDir);
    const previousBackups = execSync(`ls -dt ${backupParent}/*/ 2>/dev/null | head -2 || true`, { encoding: 'utf8' }).trim().split('\n');
    const linkDest = previousBackups[1] ? `--link-dest=${previousBackups[1]}` : '';

    execSync(
        `rsync -aHAX --info=progress2 ${linkDest} ${mountInfo}/ ${backupDir}/`,
        { stdio: 'inherit' }
    );

    display.displaySuccess(`Incremental backup completed: ${backupDir}`);
}

// Snapshot backup (btrfs)
async function backupSnapshot(device, backupPath) {
    console.log(chalk.cyan('\n  Creating btrfs snapshot...\n'));

    const mountInfo = execSync(`findmnt -n -o TARGET,FSTYPE ${device} || echo ""`, { encoding: 'utf8' }).trim();

    if (!mountInfo.includes('btrfs')) {
        display.displayError('Snapshot backup only works with btrfs filesystems');
        return;
    }

    const mountpoint = mountInfo.split(' ')[0];
    const snapshotPath = `${mountpoint}/.snapshots/${Date.now()}`;

    execSync(`mkdir -p ${path.dirname(snapshotPath)}`);
    execSync(`btrfs subvolume snapshot -r ${mountpoint} ${snapshotPath}`, { stdio: 'inherit' });

    display.displaySuccess(`Snapshot created: ${snapshotPath}`);
}

// Clone drive with auto-resize
async function cloneDriveWithResize(sourceDrive, sourceDeviceName, targetDrive, targetDeviceName) {
    const boxen = require('boxen');

    console.log(boxen(
        chalk.red.bold('⚠️  WARNING: TARGET DRIVE WILL BE DESTROYED ⚠️\n\n') +
        `Source: ${sourceDeviceName} (${sourceDrive})\n` +
        `Target: ${targetDeviceName} (${targetDrive})\n\n` +
        'This will:\n' +
        '1. Clone entire disk (bootloader, partitions, data)\n' +
        '2. Auto-resize partitions to use full target space\n' +
        '3. Create bootable clone on target drive',
        { padding: 1, borderColor: 'cyan', borderStyle: 'double', margin: 1 }
    ));

    // Check sizes
    const sourceSize = execSync(`blockdev --getsize64 ${sourceDrive}`, { encoding: 'utf8' }).trim();
    const targetSize = execSync(`blockdev --getsize64 ${targetDrive}`, { encoding: 'utf8' }).trim();

    if (parseInt(targetSize) < parseInt(sourceSize)) {
        display.displayError('Target drive is smaller than source drive. Cannot clone.');
        return false;
    }

    console.log(chalk.yellow(`\nSource size: ${(parseInt(sourceSize) / 1024 / 1024 / 1024).toFixed(2)} GB`));
    console.log(chalk.yellow(`Target size: ${(parseInt(targetSize) / 1024 / 1024 / 1024).toFixed(2)} GB\n`));

    const { confirm1 } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm1',
        message: 'Proceed with clone operation?',
        default: false
    }]);

    if (!confirm1) {
        display.displayInfo('Clone cancelled');
        return false;
    }

    const { confirmText } = await inquirer.prompt([{
        type: 'input',
        name: 'confirmText',
        message: `Type "CLONE TO ${targetDrive}" to confirm:`,
    }]);

    if (confirmText !== `CLONE TO ${targetDrive}`) {
        display.displayError('Confirmation text did not match. Clone cancelled.');
        return false;
    }

    try {
        // Step 1: Clone with dd
        console.log(chalk.cyan('\n  Step 1/3: Cloning disk with dd...\n'));
        execSync(
            `dd if=${sourceDrive} of=${targetDrive} bs=4M status=progress`,
            { stdio: 'inherit' }
        );

        // Step 2: Re-read partition table
        console.log(chalk.cyan('\n  Step 2/3: Re-reading partition table...\n'));
        execSync(`partprobe ${targetDrive}`, { stdio: 'inherit' });
        execSync('sleep 2'); // Wait for kernel to update

        // Step 3: Detect and resize partitions
        console.log(chalk.cyan('\n  Step 3/3: Auto-resizing partitions...\n'));

        // Get partition list
        const partitions = execSync(`lsblk -nro NAME,TYPE ${targetDrive} | grep part | awk '{print $1}'`, { encoding: 'utf8' }).trim().split('\n');

        if (partitions.length === 0 || partitions[0] === '') {
            display.displayWarning('No partitions found to resize. Clone completed without resize.');
            return true;
        }

        // Resize last partition (usually the data partition)
        const lastPartition = partitions[partitions.length - 1];
        const partDevice = `/dev/${lastPartition}`;
        const partNum = lastPartition.replace(/[^0-9]/g, '');

        console.log(chalk.dim(`  Resizing partition ${partNum} (${partDevice})...\n`));

        // Detect filesystem
        const fstype = execSync(`blkid -s TYPE -o value ${partDevice} || echo unknown`, { encoding: 'utf8' }).trim();

        // Grow partition to max
        execSync(`parted ${targetDrive} resizepart ${partNum} 100%`, { stdio: 'inherit' });
        execSync(`partprobe ${targetDrive}`, { stdio: 'inherit' });
        execSync('sleep 1');

        // Resize filesystem based on type
        switch (fstype) {
            case 'ext4':
            case 'ext3':
            case 'ext2':
                execSync(`e2fsck -f -y ${partDevice}`, { stdio: 'inherit' });
                execSync(`resize2fs ${partDevice}`, { stdio: 'inherit' });
                break;
            case 'btrfs':
                // Need to mount for btrfs resize
                const tempMount = `/tmp/resize-mount-${Date.now()}`;
                execSync(`mkdir -p ${tempMount}`);
                execSync(`mount ${partDevice} ${tempMount}`);
                execSync(`btrfs filesystem resize max ${tempMount}`, { stdio: 'inherit' });
                execSync(`umount ${tempMount}`);
                execSync(`rm -rf ${tempMount}`);
                break;
            case 'xfs':
                // XFS requires mounting
                const xfsMount = `/tmp/resize-mount-${Date.now()}`;
                execSync(`mkdir -p ${xfsMount}`);
                execSync(`mount ${partDevice} ${xfsMount}`);
                execSync(`xfs_growfs ${xfsMount}`, { stdio: 'inherit' });
                execSync(`umount ${xfsMount}`);
                execSync(`rm -rf ${xfsMount}`);
                break;
            default:
                display.displayWarning(`Filesystem ${fstype} resizing not supported. Partition table resized only.`);
        }

        display.displaySuccess(`Clone with auto-resize completed: ${targetDrive}`);
        return true;
    } catch (err) {
        display.displayError(`Clone failed: ${err.message}`);
        return false;
    }
}

// Restore drive
async function restoreDrive(backupPath, targetDevice) {
    const boxen = require('boxen');

    console.log(boxen(
        chalk.red.bold('⚠️  WARNING: DATA WILL BE DESTROYED ⚠️\n\n') +
        `Target device: ${targetDevice}\n` +
        `Backup source: ${backupPath}\n\n` +
        'ALL DATA ON TARGET WILL BE ERASED!',
        { padding: 1, borderColor: 'red', borderStyle: 'double', margin: 1 }
    ));

    const { confirm1 } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm1',
        message: 'Are you absolutely sure?',
        default: false
    }]);

    if (!confirm1) {
        display.displayInfo('Restore cancelled');
        return false;
    }

    const { confirmText } = await inquirer.prompt([{
        type: 'input',
        name: 'confirmText',
        message: `Type "DESTROY ${targetDevice}" to confirm:`,
    }]);

    if (confirmText !== `DESTROY ${targetDevice}`) {
        display.displayError('Confirmation text did not match. Restore cancelled.');
        return false;
    }

    // Detect backup type
    const isS3 = backupPath.startsWith('s3://');
    const isBlockLevel = backupPath.endsWith('.img') || backupPath.endsWith('.img.gz');

    try {
        if (isBlockLevel) {
            await restoreBlockLevel(backupPath, targetDevice, isS3);
        } else {
            await restoreFilesystem(backupPath, targetDevice, isS3);
        }

        display.displaySuccess('Restore completed successfully!');
        return true;
    } catch (err) {
        display.displayError(`Restore failed: ${err.message}`);
        return false;
    }
}

// Restore block-level
async function restoreBlockLevel(backupPath, targetDevice, isS3) {
    console.log(chalk.cyan('\n  Restoring block-level backup...\n'));

    if (isS3) {
        const config = getBackupConfig();
        const endpoint = config.s3.endpoint ? `--endpoint-url=${config.s3.endpoint}` : '';

        execSync(
            `aws s3 cp ${backupPath} - ${endpoint} --region ${config.s3.region} | ` +
            (backupPath.endsWith('.gz') ? 'gunzip -c | ' : '') +
            `dd of=${targetDevice} bs=4M status=progress`,
            {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    AWS_ACCESS_KEY_ID: config.s3.accessKey,
                    AWS_SECRET_ACCESS_KEY: config.s3.secretKey
                }
            }
        );
    } else {
        const decompressCmd = backupPath.endsWith('.gz') ? 'gunzip -c ${backupPath} |' : '';
        execSync(
            `${decompressCmd} dd if=${backupPath} of=${targetDevice} bs=4M status=progress`,
            { stdio: 'inherit' }
        );
    }
}

// Restore filesystem
async function restoreFilesystem(backupPath, targetDevice, isS3) {
    console.log(chalk.cyan('\n  Restoring filesystem backup...\n'));

    // Format target first
    console.log(chalk.yellow('  Formatting target as ext4...\n'));
    execSync(`mkfs.ext4 -F ${targetDevice}`, { stdio: 'inherit' });

    // Mount target
    const mountpoint = `/tmp/restore-mount-${Date.now()}`;
    execSync(`mkdir -p ${mountpoint}`);
    execSync(`mount ${targetDevice} ${mountpoint}`);

    try {
        if (isS3) {
            const config = getBackupConfig();
            const endpoint = config.s3.endpoint ? `--endpoint-url=${config.s3.endpoint}` : '';

            execSync(
                `aws s3 cp ${backupPath} - ${endpoint} --region ${config.s3.region} | ` +
                `tar xzf - -C ${mountpoint}`,
                {
                    stdio: 'inherit',
                    env: {
                        ...process.env,
                        AWS_ACCESS_KEY_ID: config.s3.accessKey,
                        AWS_SECRET_ACCESS_KEY: config.s3.secretKey
                    }
                }
            );
        } else {
            execSync(`tar xzf ${backupPath} -C ${mountpoint}`, { stdio: 'inherit' });
        }
    } finally {
        execSync(`umount ${mountpoint}`);
        execSync(`rm -rf ${mountpoint}`);
    }
}

module.exports = {
    configureCloudBackup,
    backupDrive,
    restoreDrive,
    cloneDriveWithResize,
    getBackupConfig
};
