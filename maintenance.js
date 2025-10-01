const { execSync, spawn } = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');

// Find largest directories on a drive/partition
async function findLargestDirectories(mountpoint) {
    console.log(chalk.cyan(`\n  Analyzing disk usage on ${mountpoint}...\n`));
    console.log(chalk.dim('  This may take a few moments...\n'));

    try {
        // Use du to find largest directories
        const output = execSync(
            `du -h -d 2 "${mountpoint}" 2>/dev/null | sort -rh | head -20`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );

        const lines = output.trim().split('\n');

        console.log(chalk.bold('  Top 20 Largest Directories:\n'));
        lines.forEach((line, index) => {
            const [size, path] = line.split('\t');
            console.log(`  ${index + 1}. ${chalk.yellow(size.padEnd(8))} ${path}`);
        });
        console.log('');

        // Also show summary
        const summary = execSync(`df -h "${mountpoint}"`, { encoding: 'utf8' });
        console.log(chalk.bold('  Disk Usage Summary:\n'));
        console.log('  ' + summary.split('\n').join('\n  '));

    } catch (err) {
        console.log(chalk.red(`\n  Error analyzing disk: ${err.message}\n`));
    }
}

// Launch interactive ncdu for detailed analysis
async function launchInteractiveDiskAnalysis(mountpoint) {
    console.log(chalk.cyan(`\n  Launching interactive disk analyzer for ${mountpoint}...\n`));
    console.log(chalk.dim('  Use arrow keys to navigate, "d" to delete, "q" to quit\n'));

    try {
        // Launch ncdu in the current terminal
        const ncdu = spawn('ncdu', [mountpoint], {
            stdio: 'inherit',
            shell: true
        });

        return new Promise((resolve, reject) => {
            ncdu.on('close', (code) => {
                resolve();
            });
            ncdu.on('error', (err) => {
                reject(err);
            });
        });
    } catch (err) {
        console.log(chalk.red(`\n  Error launching ncdu: ${err.message}\n`));
    }
}

// Check filesystem for errors
async function checkFilesystem(device, fstype) {
    console.log(chalk.cyan(`\n  Checking filesystem on ${device} (${fstype})...\n`));

    // Determine appropriate fsck command based on filesystem type
    let checkCmd;
    switch (fstype) {
        case 'ext4':
        case 'ext3':
        case 'ext2':
            checkCmd = `e2fsck -n ${device}`;
            console.log(chalk.yellow('  Running e2fsck in read-only mode (-n flag)...\n'));
            break;
        case 'btrfs':
            checkCmd = `btrfs check --readonly ${device}`;
            console.log(chalk.yellow('  Running btrfs check in read-only mode...\n'));
            break;
        case 'xfs':
            checkCmd = `xfs_repair -n ${device}`;
            console.log(chalk.yellow('  Running xfs_repair in read-only mode (-n flag)...\n'));
            break;
        case 'vfat':
        case 'fat32':
            checkCmd = `fsck.vfat -n ${device}`;
            console.log(chalk.yellow('  Running fsck.vfat in read-only mode...\n'));
            break;
        default:
            console.log(chalk.red(`  Filesystem type "${fstype}" not supported for checking.\n`));
            return;
    }

    let fsckOutput = '';
    let hasIssues = false;

    try {
        const output = execSync(checkCmd, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
        console.log(chalk.green('  ✓ Filesystem check completed\n'));
        console.log(output);
        fsckOutput = output;
    } catch (err) {
        // fsck returns non-zero if errors found
        hasIssues = true;
        fsckOutput = err.stdout || err.message;
        console.log(chalk.yellow('  ⚠ Filesystem check found issues:\n'));
        console.log(fsckOutput);
        console.log(chalk.yellow('\n  Note: This was a read-only check. To fix issues, unmount the drive first.\n'));
    }

    // Offer AI analysis if issues found
    if (hasIssues) {
        const claudeHelper = require('./claude-helper');

        if (claudeHelper.isAIAvailable()) {
            const { analyzeWithAI } = await inquirer.prompt([{
                type: 'confirm',
                name: 'analyzeWithAI',
                message: 'Would you like AI to analyze these filesystem issues?',
                default: true
            }]);

            if (analyzeWithAI) {
                console.log(chalk.dim('\n  Analyzing filesystem issues with AI...\n'));

                try {
                    const analysis = await claudeHelper.troubleshoot(
                        device,
                        'Analyze these filesystem check errors and suggest repair strategy',
                        {
                            fsck_output: fsckOutput,
                            fstype: fstype,
                            device_info: execSync(`lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT ${device}`, { encoding: 'utf8' })
                        }
                    );

                    console.log(chalk.cyan('─'.repeat(60)));
                    console.log(chalk.bold.cyan('\n  AI Analysis:\n'));
                    console.log(analysis);
                    console.log(chalk.cyan('\n' + '─'.repeat(60) + '\n'));
                } catch (err) {
                    console.log(chalk.yellow(`  ⚠ AI analysis failed: ${err.message}\n`));
                }
            }
        }
    }
}

// Check SMART health status
async function checkSmartHealth(device) {
    console.log(chalk.cyan(`\n  Checking SMART health for ${device}...\n`));

    let smartData = '';
    let hasConcerns = false;

    try {
        // Get SMART health status
        const health = execSync(`smartctl -H ${device}`, { encoding: 'utf8' });
        console.log(health);
        smartData += health;

        // Check if health shows issues
        if (health.includes('FAILING') || health.includes('FAILED')) {
            hasConcerns = true;
        }

        // Get detailed SMART attributes
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Show detailed SMART attributes?',
            default: false
        }]);

        if (confirm) {
            const attributes = execSync(`smartctl -A ${device}`, { encoding: 'utf8' });
            console.log('\n' + attributes);
            smartData += '\n' + attributes;

            // Check for common warning indicators
            if (attributes.includes('Reallocated_Sector') ||
                attributes.includes('Current_Pending_Sector') ||
                attributes.includes('Offline_Uncorrectable')) {
                hasConcerns = true;
            }
        }

        // Offer AI analysis
        const claudeHelper = require('./claude-helper');
        if (claudeHelper.isAIAvailable() && smartData) {
            const { analyzeWithAI } = await inquirer.prompt([{
                type: 'confirm',
                name: 'analyzeWithAI',
                message: hasConcerns ?
                    'Issues detected. Would you like AI to analyze SMART data?' :
                    'Would you like AI to analyze SMART data?',
                default: hasConcerns
            }]);

            if (analyzeWithAI) {
                console.log(chalk.dim('\n  Analyzing SMART data with AI...\n'));

                try {
                    const analysis = await claudeHelper.troubleshoot(
                        device,
                        'Analyze this SMART data and assess drive health',
                        {
                            smart_output: smartData,
                            device_info: execSync(`lsblk -o NAME,SIZE,MODEL ${device}`, { encoding: 'utf8' })
                        }
                    );

                    console.log(chalk.cyan('─'.repeat(60)));
                    console.log(chalk.bold.cyan('\n  AI Analysis:\n'));
                    console.log(analysis);
                    console.log(chalk.cyan('\n' + '─'.repeat(60) + '\n'));
                } catch (err) {
                    console.log(chalk.yellow(`  ⚠ AI analysis failed: ${err.message}\n`));
                }
            }
        }

    } catch (err) {
        if (err.message.includes('Unavailable')) {
            console.log(chalk.yellow(`  ⚠ SMART not available for ${device}\n`));
        } else {
            console.log(chalk.red(`  Error checking SMART: ${err.message}\n`));
        }
    }
}

// Check boot configuration
async function checkBootConfig() {
    console.log(chalk.cyan('\n  Checking Boot Configuration...\n'));

    // Check /etc/fstab
    console.log(chalk.bold('  1. /etc/fstab (Filesystem Mount Table):\n'));
    try {
        const fstab = fs.readFileSync('/etc/fstab', 'utf8');
        const lines = fstab.split('\n').filter(l => l.trim() && !l.startsWith('#'));

        lines.forEach(line => {
            console.log(`     ${line}`);
        });

        // Validate fstab entries
        console.log(chalk.dim('\n     Validating fstab entries...\n'));
        const validation = execSync('findmnt --verify', { encoding: 'utf8' });
        if (validation.trim()) {
            console.log(chalk.yellow('     ⚠ Issues found:\n'));
            console.log('     ' + validation.split('\n').join('\n     '));
        } else {
            console.log(chalk.green('     ✓ All fstab entries are valid\n'));
        }
    } catch (err) {
        console.log(chalk.red(`     Error: ${err.message}\n`));
    }

    // Check boot partition
    console.log(chalk.bold('  2. Boot Partition Status:\n'));
    try {
        const bootInfo = execSync('df -h /boot', { encoding: 'utf8' });
        console.log('     ' + bootInfo.split('\n').join('\n     '));
    } catch (err) {
        console.log(chalk.red(`     Error: ${err.message}\n`));
    }

    // Check for UEFI/BIOS
    console.log(chalk.bold('  3. Boot Mode:\n'));
    if (fs.existsSync('/sys/firmware/efi')) {
        console.log(chalk.green('     ✓ UEFI mode detected\n'));

        // Check EFI boot entries
        try {
            const efibootmgr = execSync('efibootmgr', { encoding: 'utf8' });
            console.log(chalk.bold('     EFI Boot Entries:\n'));
            console.log('     ' + efibootmgr.split('\n').join('\n     '));
        } catch (err) {
            console.log(chalk.dim('     (efibootmgr not available)\n'));
        }
    } else {
        console.log(chalk.yellow('     Legacy BIOS mode\n'));
    }

    // Check initramfs/initrd
    console.log(chalk.bold('  4. Initial RAM Filesystem:\n'));
    try {
        const initrd = execSync('ls -lh /boot/initrd* /boot/initramfs* 2>/dev/null || echo "None found"',
            { encoding: 'utf8' });
        console.log('     ' + initrd.split('\n').join('\n     '));
    } catch (err) {
        console.log(chalk.dim('     No initrd/initramfs files found\n'));
    }

    // Check kernel
    console.log(chalk.bold('  5. Installed Kernels:\n'));
    try {
        const kernels = execSync('ls -lh /boot/vmlinuz* 2>/dev/null', { encoding: 'utf8' });
        console.log('     ' + kernels.split('\n').join('\n     '));

        const current = execSync('uname -r', { encoding: 'utf8' }).trim();
        console.log(chalk.green(`     Current kernel: ${current}\n`));
    } catch (err) {
        console.log(chalk.red(`     Error: ${err.message}\n`));
    }
}

// Check system journal for disk errors
async function checkSystemErrors() {
    console.log(chalk.cyan('\n  Checking system logs for disk errors...\n'));

    let errorText = '';
    let hasErrors = false;

    try {
        // Check journalctl for disk-related errors
        const errors = execSync(
            'journalctl -p err -b | grep -iE "(disk|drive|ata|scsi|nvme|mmc|i/o error)" | tail -20',
            { encoding: 'utf8' }
        );

        if (errors.trim()) {
            hasErrors = true;
            errorText = errors;
            console.log(chalk.yellow('  Recent disk-related errors found:\n'));
            console.log('  ' + errors.split('\n').join('\n  '));
        } else {
            console.log(chalk.green('  ✓ No recent disk errors found\n'));
        }
    } catch (err) {
        console.log(chalk.green('  ✓ No recent disk errors found\n'));
    }

    // Offer AI analysis if errors found and AI is available
    if (hasErrors) {
        const claudeHelper = require('./claude-helper');

        if (claudeHelper.isAIAvailable()) {
            const { analyzeWithAI } = await inquirer.prompt([{
                type: 'confirm',
                name: 'analyzeWithAI',
                message: 'Would you like AI to analyze these errors?',
                default: true
            }]);

            if (analyzeWithAI) {
                console.log(chalk.dim('\n  Analyzing errors with AI...\n'));

                try {
                    const analysis = await claudeHelper.troubleshoot(
                        'system',
                        'Analyze these disk errors and suggest solutions',
                        {
                            errors: errorText,
                            system_info: execSync('uname -a', { encoding: 'utf8' }).trim(),
                            disk_list: execSync('lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT', { encoding: 'utf8' })
                        }
                    );

                    console.log(chalk.cyan('─'.repeat(60)));
                    console.log(chalk.bold.cyan('\n  AI Analysis:\n'));
                    console.log(analysis);
                    console.log(chalk.cyan('\n' + '─'.repeat(60) + '\n'));
                } catch (err) {
                    console.log(chalk.yellow(`  ⚠ AI analysis failed: ${err.message}\n`));
                }
            }
        }
    }
}

module.exports = {
    findLargestDirectories,
    launchInteractiveDiskAnalysis,
    checkFilesystem,
    checkSmartHealth,
    checkBootConfig,
    checkSystemErrors
};
