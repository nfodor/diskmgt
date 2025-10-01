#!/usr/bin/env node

const inquirer = require('inquirer');
const storage = require('./storage');
const detect = require('./detect');
const display = require('./display');
const maintenance = require('./maintenance');
const diskinfo = require('./diskinfo');
const autoregister = require('./autoregister');
const partitiontools = require('./partitiontools');
const backup = require('./backup');
const claudeHelper = require('./claude-helper');

// Configure AI features
async function configureAI() {
    const chalk = require('chalk');
    const boxen = require('boxen');

    display.displayHeader('Configure AI Features');

    const currentKey = claudeHelper.getApiKey();
    const hasKey = currentKey !== null;

    console.log(boxen(
        chalk.bold('Claude AI Integration\n\n') +
        'AI features enable:\n' +
        '• Semantic drive search (understand "lxc", "backup", etc.)\n' +
        '• Intelligent troubleshooting (future)\n\n' +
        `Status: ${hasKey ? chalk.green('✓ Configured') : chalk.yellow('⚠ Not configured')}\n` +
        (hasKey ? `API Key: ${currentKey.substring(0, 10)}...` : '') + '\n\n' +
        'Cost: ~$0.0001 per search (essentially free)\n' +
        'Get your key: https://console.anthropic.com/',
        { padding: 1, borderColor: 'cyan', margin: 1 }
    ));

    const choices = [
        { name: hasKey ? 'Update API key' : 'Set API key', value: 'set' },
        { name: 'Test AI search', value: 'test', disabled: !hasKey },
        new inquirer.Separator(),
        { name: 'Remove API key', value: 'remove', disabled: !hasKey },
        new inquirer.Separator(),
        { name: 'Back to main menu', value: 'back' }
    ];

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices
    }]);

    if (action === 'back') return;

    if (action === 'set') {
        const { apiKey } = await inquirer.prompt([{
            type: 'password',
            name: 'apiKey',
            message: 'Enter your Anthropic API key:',
            mask: '*',
            validate: input => {
                if (!input.trim()) return 'API key cannot be empty';
                if (!input.startsWith('sk-ant-')) return 'Invalid API key format (should start with sk-ant-)';
                return true;
            }
        }]);

        claudeHelper.saveApiKey(apiKey);
        display.displaySuccess('API key saved successfully!');
        console.log(chalk.dim('\n  AI features are now enabled.\n'));
    } else if (action === 'test') {
        console.log(chalk.cyan('\n  Testing AI search with query: "lxc"\n'));

        const known = storage.getAllDrives();
        try {
            const matchingUUIDs = await claudeHelper.semanticSearch('lxc', known);
            const results = known.filter(d => matchingUUIDs.includes(d.uuid));

            if (results.length > 0) {
                display.displaySuccess(`AI search working! Found ${results.length} drive(s):`);
                results.forEach(d => console.log(`  - ${d.label} (${d.purpose})`));
            } else {
                display.displayInfo('AI search working, but no LXC/LXD drives found.');
            }
        } catch (err) {
            display.displayError(`Test failed: ${err.message}`);
        }
    } else if (action === 'remove') {
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Remove API key from config?',
            default: false
        }]);

        if (confirm) {
            claudeHelper.saveApiKey('');
            display.displaySuccess('API key removed.');
        }
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Help menu
async function showHelp() {
    const boxen = require('boxen');
    const chalk = require('chalk');

    console.log(boxen(
        chalk.bold.cyan('Drive Manager (diskmgt) - Help\n\n') +
        chalk.bold('MAIN FEATURES:\n') +
        '• Show drives       - View connected + known (tree)\n' +
        '• Detailed info     - Hardware, partitions, OS, LXD\n' +
        '• Add/register      - Manual or auto by content\n' +
        '• Edit info         - Update labels, types, purpose\n' +
        '• Remove drive      - Remove from tracking\n' +
        '• Search drives     - AI semantic or basic text\n' +
        '• Export list       - Export all drive data\n\n' +
        chalk.bold('AI FEATURES:\n') +
        '• Semantic search   - Natural language queries\n' +
        '  "lxc", "backup", "big drives", "mounted"\n' +
        '• Auto-understand   - No hardcoded aliases\n' +
        '• Cost: ~$0.0001 per search (essentially free)\n' +
        '• Optional: Works without AI (basic search)\n\n' +
        chalk.bold('BACKUP & RESTORE:\n') +
        '• Backup drive      - dd, tar, rsync, btrfs\n' +
        '• Restore drive     - From local or S3 cloud\n' +
        '• Clone+resize      - Bootable clone to larger\n' +
        '• Cloud config      - S3, B2, DO, Wasabi, MinIO\n\n' +
        chalk.bold('BACKUP METHODS:\n') +
        '1. dd (block)       - Exact, bootable, slow\n' +
        '2. tar (files)      - Fast, compressed\n' +
        '3. rsync (incr)     - Changed files only\n' +
        '4. btrfs (snap)     - Instant COW snapshots\n\n' +
        chalk.bold('DISK MAINTENANCE:\n') +
        '• Find large dirs   - Locate space hogs\n' +
        '• Interactive ncdu  - Browse disk usage\n' +
        '• Filesystem check  - Run fsck for errors\n' +
        '• SMART health      - Check drive health\n' +
        '• Boot config       - Verify boot setup\n' +
        '• System logs       - Check disk errors\n\n' +
        chalk.bold('PARTITION TOOLS:\n') +
        '• Mount/Unmount     - Safe mounting\n' +
        '• FS check          - Scan or repair\n' +
        '• Backup part       - Create .img with dd\n' +
        '• Clone part        - Duplicate to device\n' +
        '• Format part       - ext4, btrfs, xfs, ntfs\n' +
        '• Resize part       - Grow/shrink filesystem\n' +
        '• Set label         - Change partition label\n\n' +
        chalk.bold('AUTO-REGISTRATION:\n') +
        'Smart: LXD, OS installs, boot, mounts\n\n' +
        chalk.bold('STORAGE:\n') +
        '~/.config/diskmgt/drives.json\n' +
        '~/.config/diskmgt/backup-config.json\n' +
        '~/.config/diskmgt/config.json (AI key)\n\n' +
        chalk.bold('USAGE:\n') +
        'diskmgt  or  dm  (with alias)',
        { padding: 1, borderColor: 'cyan', margin: 1 }
    ));

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Main menu
async function mainMenu() {
    display.displayHeader('Drive Manager');

    const choices = [
        { name: '❓ Help - Show all features and usage', value: 'help' },
        new inquirer.Separator(),
        { name: 'Show all drives (connected + known)', value: 'show' },
        { name: 'Detailed disk information panel', value: 'detailed_info' },
        { name: 'Add/register a drive', value: 'add' },
        { name: 'Edit drive info', value: 'edit' },
        { name: 'Remove drive from tracking', value: 'remove' },
        { name: 'Search drives', value: 'search' },
        { name: 'Export drive list', value: 'export' },
        new inquirer.Separator(),
        { name: 'Backup & Restore', value: 'backup' },
        { name: 'Disk Maintenance & Health', value: 'maintenance' },
        new inquirer.Separator(),
        { name: '⚙️  Configure AI features', value: 'configure' },
        new inquirer.Separator(),
        { name: 'Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices
        }
    ]);

    switch (action) {
        case 'help':
            await showHelp();
            break;
        case 'show':
            await showDrives();
            break;
        case 'detailed_info':
            await showDetailedDiskInfo();
            break;
        case 'add':
            await addDrive();
            break;
        case 'edit':
            await editDrive();
            break;
        case 'remove':
            await removeDrive();
            break;
        case 'search':
            await searchDrives();
            break;
        case 'export':
            await exportDrives();
            break;
        case 'backup':
            await backupRestoreMenu();
            break;
        case 'maintenance':
            await maintenanceMenu();
            break;
        case 'configure':
            await configureAI();
            break;
        case 'exit':
            console.log('\nGoodbye!\n');
            process.exit(0);
    }

    // Return to main menu
    await mainMenu();
}

// Show all drives
async function showDrives() {
    display.displayHeader('All Drives');

    const detected = detect.detectDrives();
    const known = storage.getAllDrives();

    // Update last_seen for connected drives
    detected.forEach(d => {
        if (storage.getDriveByUUID(d.uuid)) {
            storage.updateLastSeen(d.uuid);
        }
    });

    display.displayDriveList(detected, known);

    console.log('\n');
    display.displayDetectedDrives(detected);

    // Offer partition management option
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
            { name: 'Manage partition (advanced tools)', value: 'partition' },
            new inquirer.Separator(),
            { name: 'Back to main menu', value: 'back' }
        ]
    }]);

    if (action === 'partition') {
        await managePartition(detected);
    }
}

// Show detailed disk information
async function showDetailedDiskInfo() {
    display.displayHeader('Detailed Disk Information');

    const detected = detect.detectDrives();

    // Get unique disk devices (not partitions)
    const disks = [];
    const seenDisks = new Set();

    detected.forEach(d => {
        // Extract disk device (remove partition number)
        const diskDevice = d.device.replace(/p?\d+$/, '');

        if (!seenDisks.has(diskDevice) && d.type === 'disk') {
            seenDisks.add(diskDevice);
            disks.push({
                name: `${d.name} (${d.size}) - ${d.model}`,
                device: d.device
            });
        }
    });

    if (disks.length === 0) {
        display.displayInfo('No disk drives detected.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const choices = disks.map(d => ({ name: d.name, value: d.device }));
    choices.push(new inquirer.Separator());
    choices.push({ name: 'Back to main menu', value: null });

    const { selectedDisk } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedDisk',
            message: 'Select disk for detailed information:',
            choices
        }
    ]);

    if (!selectedDisk) return;

    console.log('\n  Loading detailed information...\n');

    const info = diskinfo.getDetailedDiskInfo(selectedDisk);
    diskinfo.displayDetailedDiskInfo(info);

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Add new drive
async function addDrive() {
    display.displayHeader('Add Drive');

    const detected = detect.detectDrives();
    const known = storage.getAllDrives();
    const knownUUIDs = new Set(known.map(d => d.uuid));

    // Only show partitions (not whole disks) to avoid confusion
    const partitions = detected.filter(d => d.type === 'part');
    const unregistered = partitions.filter(d => !knownUUIDs.has(d.uuid));

    if (unregistered.length === 0) {
        display.displayInfo('All detected drives are already registered.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const choices = unregistered.map(d => ({
        name: `${d.name} - ${d.size} (${d.model})`,
        value: d
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: 'Auto-register all drives', value: 'auto_all' });
    choices.push({ name: 'Cancel', value: null });

    const { selectedDrive } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedDrive',
            message: 'Select drive to register:',
            choices
        }
    ]);

    if (!selectedDrive) return;

    // Handle auto-register all
    if (selectedDrive === 'auto_all') {
        console.log('\n  Auto-registering all unregistered drives...\n');

        const autoRegistered = autoregister.autoRegisterAll(unregistered, known);

        if (autoRegistered.length === 0) {
            display.displayError('No drives were registered.');
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
            return;
        }

        // Show preview and confirm
        const Table = require('cli-table3');
        const chalk = require('chalk');

        const previewTable = new Table({
            head: [
                chalk.cyan.bold('Drive'),
                chalk.cyan.bold('Label'),
                chalk.cyan.bold('Type'),
                chalk.cyan.bold('Purpose')
            ],
            style: {
                head: [],
                border: ['cyan']
            }
        });

        autoRegistered.forEach(drive => {
            const driveName = drive.device.split('/').pop();
            previewTable.push([
                chalk.yellow(driveName),
                chalk.bold(drive.label),
                drive.type,
                drive.purpose
            ]);
        });

        console.log(previewTable.toString());
        console.log('');

        const { confirmAll } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmAll',
                message: `Register all ${autoRegistered.length} drive(s) with these settings?`,
                default: true
            }
        ]);

        if (!confirmAll) {
            display.displayInfo('Auto-registration cancelled.');
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
            return;
        }

        // Register all drives
        let successCount = 0;
        autoRegistered.forEach(driveData => {
            if (storage.addDrive(driveData)) {
                successCount++;
            }
        });

        display.displaySuccess(`Successfully registered ${successCount} of ${autoRegistered.length} drive(s)!`);
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    // Manual registration
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'label',
            message: 'Enter a label/nickname for this drive:',
            validate: input => input.trim().length > 0 || 'Label cannot be empty'
        },
        {
            type: 'list',
            name: 'type',
            message: 'Drive type:',
            choices: ['USB Drive', 'SD Card', 'NVMe SSD', 'SATA Drive', 'External HDD', 'Other'],
            default: detect.getDriveType(selectedDrive.name)
        },
        {
            type: 'input',
            name: 'purpose',
            message: 'Purpose (e.g., Backup, Projects, Media):',
            default: ''
        }
    ]);

    const driveData = {
        uuid: selectedDrive.uuid,
        label: answers.label,
        size: selectedDrive.size,
        type: answers.type,
        purpose: answers.purpose,
        device: selectedDrive.device
    };

    if (storage.addDrive(driveData)) {
        display.displaySuccess(`Drive "${answers.label}" registered successfully!`);
    } else {
        display.displayError('Failed to register drive.');
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Edit drive
async function editDrive() {
    display.displayHeader('Edit Drive');

    const known = storage.getAllDrives();

    if (known.length === 0) {
        display.displayInfo('No drives registered yet.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const choices = known.map(d => ({
        name: `${d.label} (${d.size})`,
        value: d
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: 'Cancel', value: null });

    const { selectedDrive } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedDrive',
            message: 'Select drive to edit:',
            choices
        }
    ]);

    if (!selectedDrive) return;

    display.displayDriveDetails(selectedDrive);

    const { field } = await inquirer.prompt([
        {
            type: 'list',
            name: 'field',
            message: 'What would you like to edit?',
            choices: [
                { name: 'Label', value: 'label' },
                { name: 'Type', value: 'type' },
                { name: 'Purpose', value: 'purpose' },
                new inquirer.Separator(),
                { name: 'Cancel', value: null }
            ]
        }
    ]);

    if (!field) return;

    let newValue;

    if (field === 'type') {
        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'value',
                message: 'Select new type:',
                choices: ['USB Drive', 'SD Card', 'NVMe SSD', 'SATA Drive', 'External HDD', 'Other']
            }
        ]);
        newValue = answer.value;
    } else {
        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'value',
                message: `Enter new ${field}:`,
                default: selectedDrive[field]
            }
        ]);
        newValue = answer.value;
    }

    if (storage.updateDriveField(selectedDrive.uuid, field, newValue)) {
        display.displaySuccess(`${field} updated successfully!`);
    } else {
        display.displayError('Failed to update drive.');
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Remove drive
async function removeDrive() {
    display.displayHeader('Remove Drive');

    const known = storage.getAllDrives();

    if (known.length === 0) {
        display.displayInfo('No drives registered yet.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const choices = known.map(d => ({
        name: `${d.label} (${d.size})`,
        value: d
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: 'Cancel', value: null });

    const { selectedDrive } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedDrive',
            message: 'Select drive to remove:',
            choices
        }
    ]);

    if (!selectedDrive) return;

    display.displayDriveDetails(selectedDrive);

    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to remove "${selectedDrive.label}" from tracking?`,
            default: false
        }
    ]);

    if (confirm) {
        storage.removeDrive(selectedDrive.uuid);
        display.displaySuccess(`Drive "${selectedDrive.label}" removed from tracking.`);
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Search drives with AI or basic fallback
async function searchDrives() {
    const chalk = require('chalk');
    display.displayHeader('Search Drives');

    const { query } = await inquirer.prompt([
        {
            type: 'input',
            name: 'query',
            message: 'Enter search term (label, type, or purpose):'
        }
    ]);

    if (!query.trim()) return;

    const known = storage.getAllDrives();

    // Check if AI search is available
    let results = [];
    let useAI = false;

    if (claudeHelper.isAIAvailable()) {
        const { aiChoice } = await inquirer.prompt([{
            type: 'list',
            name: 'aiChoice',
            message: 'Search method:',
            choices: [
                { name: '🤖 AI-powered semantic search (recommended)', value: 'ai' },
                { name: '🔍 Basic text search', value: 'basic' }
            ],
            default: 'ai'
        }]);

        useAI = (aiChoice === 'ai');
    }

    if (useAI) {
        // AI-powered semantic search
        try {
            console.log(chalk.dim('\n  Analyzing with AI...'));

            const matchingUUIDs = await claudeHelper.semanticSearch(query, known);
            results = known.filter(d => matchingUUIDs.includes(d.uuid));

            console.log(chalk.green('  ✓ AI search completed\n'));
        } catch (err) {
            console.log(chalk.yellow(`  ⚠ AI search failed: ${err.message}`));
            console.log(chalk.dim('  Falling back to basic search...\n'));
            useAI = false; // Fall back to basic search
        }
    }

    if (!useAI) {
        // Basic search with hardcoded aliases
        const queryLower = query.toLowerCase();

        results = known.filter(d => {
            const searchText = `${d.label} ${d.type} ${d.purpose} ${d.device}`.toLowerCase();

            // Check direct match
            if (searchText.includes(queryLower)) return true;

            // Handle common aliases
            if (queryLower === 'lxc' && searchText.includes('lxd')) return true;
            if (queryLower === 'lxd' && searchText.includes('lxc')) return true;
            if (queryLower === 'container' && searchText.includes('lxd')) return true;
            if (queryLower === 'os' && searchText.includes('operating system')) return true;
            if (queryLower === 'system' && searchText.includes('operating system')) return true;
            if (queryLower === 'root' && searchText.includes('root-system')) return true;

            return false;
        });
    }

    if (results.length === 0) {
        display.displayInfo('No drives found matching your search.');
    } else {
        console.log(`\n  Found ${results.length} drive(s):\n`);
        results.forEach(d => display.displayDriveDetails(d));
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Export drives
async function exportDrives() {
    display.displayHeader('Export Drives');

    const known = storage.getAllDrives();

    if (known.length === 0) {
        display.displayInfo('No drives to export.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    console.log('');
    known.forEach(d => {
        console.log(`Label: ${d.label}`);
        console.log(`UUID: ${d.uuid}`);
        console.log(`Size: ${d.size}`);
        console.log(`Type: ${d.type}`);
        console.log(`Purpose: ${d.purpose || 'Not specified'}`);
        console.log(`First Seen: ${new Date(d.first_seen).toLocaleString()}`);
        console.log(`Last Seen: ${new Date(d.last_seen).toLocaleString()}`);
        console.log('─'.repeat(50));
    });

    display.displaySuccess(`Exported ${known.length} drive(s).`);
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Maintenance menu
async function maintenanceMenu() {
    display.displayHeader('Disk Maintenance & Health');

    const choices = [
        { name: 'Find largest directories', value: 'largest_dirs' },
        { name: 'Interactive disk analyzer (ncdu)', value: 'interactive' },
        { name: 'Check filesystem for errors', value: 'fsck' },
        { name: 'Check SMART health status', value: 'smart' },
        { name: 'Check boot configuration', value: 'boot_config' },
        { name: 'Check system logs for disk errors', value: 'system_errors' },
        new inquirer.Separator(),
        { name: 'Back to main menu', value: 'back' }
    ];

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices
        }
    ]);

    if (action === 'back') return;

    // For operations that need a drive selection
    if (['largest_dirs', 'interactive', 'fsck', 'smart'].includes(action)) {
        const detected = detect.detectDrives();

        // Get unique mountpoints and devices
        const targets = [];

        // Add mounted partitions
        detected.filter(d => d.mountpoint !== 'not mounted').forEach(d => {
            targets.push({
                name: `${d.name} (${d.size}) - ${d.mountpoint}`,
                mountpoint: d.mountpoint,
                device: d.device,
                fstype: d.fstype
            });
        });

        // Add unmounted devices for fsck and smart
        if (action === 'fsck' || action === 'smart') {
            detected.filter(d => d.mountpoint === 'not mounted' && d.type === 'part').forEach(d => {
                targets.push({
                    name: `${d.name} (${d.size}) - unmounted`,
                    mountpoint: null,
                    device: d.device,
                    fstype: d.fstype
                });
            });
        }

        if (targets.length === 0) {
            display.displayInfo('No suitable drives/partitions found.');
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
            return;
        }

        const targetChoices = targets.map(t => ({ name: t.name, value: t }));
        targetChoices.push(new inquirer.Separator());
        targetChoices.push({ name: 'Cancel', value: null });

        const { target } = await inquirer.prompt([
            {
                type: 'list',
                name: 'target',
                message: 'Select drive/partition:',
                choices: targetChoices
            }
        ]);

        if (!target) return;

        switch (action) {
            case 'largest_dirs':
                await maintenance.findLargestDirectories(target.mountpoint);
                break;
            case 'interactive':
                await maintenance.launchInteractiveDiskAnalysis(target.mountpoint);
                break;
            case 'fsck':
                if (target.mountpoint) {
                    display.displayError('Drive is mounted. Unmount it first to run filesystem check.');
                } else {
                    await maintenance.checkFilesystem(target.device, target.fstype);
                }
                break;
            case 'smart':
                // Get parent device for SMART (not partition)
                const parentDevice = target.device.replace(/p?\d+$/, '');
                await maintenance.checkSmartHealth(parentDevice);
                break;
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    } else {
        // Operations that don't need drive selection
        switch (action) {
            case 'boot_config':
                await maintenance.checkBootConfig();
                break;
            case 'system_errors':
                await maintenance.checkSystemErrors();
                break;
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    }
}

// Backup & Restore menu
async function backupRestoreMenu() {
    display.displayHeader('Backup & Restore');

    const choices = [
        { name: '💾 Backup a drive', value: 'backup' },
        { name: '♻️  Restore a drive', value: 'restore' },
        { name: '🔄 Clone drive with auto-resize', value: 'clone' },
        new inquirer.Separator(),
        { name: '☁️  Configure cloud backup', value: 'config' },
        new inquirer.Separator(),
        { name: 'Back to main menu', value: 'back' }
    ];

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices
    }]);

    if (action === 'back') return;

    switch (action) {
        case 'backup':
            await performBackup();
            break;
        case 'restore':
            await performRestore();
            break;
        case 'clone':
            await performClone();
            break;
        case 'config':
            await backup.configureCloudBackup();
            break;
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Perform backup
async function performBackup() {
    const detected = detect.detectDrives();
    const partitions = detected.filter(d => d.type === 'part');

    if (partitions.length === 0) {
        display.displayInfo('No partitions found to backup.');
        return;
    }

    const choices = partitions.map(p => ({
        name: `${p.name} (${p.size}) - ${p.mountpoint} [${p.fstype}]`,
        value: p
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: 'Cancel', value: null });

    const { partition } = await inquirer.prompt([{
        type: 'list',
        name: 'partition',
        message: 'Select partition to backup:',
        choices
    }]);

    if (!partition) return;

    const backupPath = await backup.backupDrive(partition.device, partition.name);

    if (backupPath) {
        console.log(chalk.green(`\n  ✓ Backup saved to: ${backupPath}\n`));
    }
}

// Perform clone with auto-resize
async function performClone() {
    const chalk = require('chalk');

    // Get all disks (not partitions)
    const detected = detect.detectDrives();
    const disks = detected.filter(d => d.type === 'disk');

    if (disks.length < 2) {
        display.displayError('Need at least 2 disks for cloning.');
        return;
    }

    // Select source disk
    const sourceChoices = disks.map(d => ({
        name: `${d.name} (${d.size}) - ${d.model}`,
        value: d
    }));

    sourceChoices.push(new inquirer.Separator());
    sourceChoices.push({ name: 'Cancel', value: null });

    const { sourceDisk } = await inquirer.prompt([{
        type: 'list',
        name: 'sourceDisk',
        message: 'Select SOURCE disk to clone FROM:',
        choices: sourceChoices
    }]);

    if (!sourceDisk) return;

    // Select target disk (exclude source)
    const targetChoices = disks
        .filter(d => d.device !== sourceDisk.device)
        .map(d => ({
            name: `${d.name} (${d.size}) - ${d.model}`,
            value: d
        }));

    targetChoices.push(new inquirer.Separator());
    targetChoices.push({ name: 'Cancel', value: null });

    const { targetDisk } = await inquirer.prompt([{
        type: 'list',
        name: 'targetDisk',
        message: chalk.red('⚠️  Select TARGET disk (WILL BE DESTROYED):'),
        choices: targetChoices
    }]);

    if (!targetDisk) return;

    await backup.cloneDriveWithResize(
        sourceDisk.device,
        sourceDisk.name,
        targetDisk.device,
        targetDisk.name
    );
}

// Perform restore
async function performRestore() {
    const chalk = require('chalk');

    // First, select backup source
    const { sourceType } = await inquirer.prompt([{
        type: 'list',
        name: 'sourceType',
        message: 'Backup source:',
        choices: [
            { name: '💻 Local file', value: 'local' },
            { name: '☁️  Cloud (S3)', value: 's3' },
            { name: 'Cancel', value: null }
        ]
    }]);

    if (!sourceType) return;

    let backupPath;

    if (sourceType === 'local') {
        const answer = await inquirer.prompt([{
            type: 'input',
            name: 'path',
            message: 'Enter backup file path:',
            validate: input => fs.existsSync(input) || 'File not found'
        }]);
        backupPath = answer.path;
    } else {
        const config = backup.getBackupConfig();
        if (!config.s3?.enabled) {
            display.displayError('S3 not configured.');
            return;
        }

        const answer = await inquirer.prompt([{
            type: 'input',
            name: 'path',
            message: `Enter S3 path (s3://${config.s3.bucket}/...):`,
            default: `s3://${config.s3.bucket}/`
        }]);
        backupPath = answer.path;
    }

    // Select target partition
    const detected = detect.detectDrives();
    const partitions = detected.filter(d => d.type === 'part');

    const choices = partitions.map(p => ({
        name: `${p.name} (${p.size}) - ${p.mountpoint} [${p.fstype}]`,
        value: p
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: 'Cancel', value: null });

    const { partition } = await inquirer.prompt([{
        type: 'list',
        name: 'partition',
        message: chalk.red('⚠️  Select TARGET partition (ALL DATA WILL BE DESTROYED):'),
        choices
    }]);

    if (!partition) return;

    await backup.restoreDrive(backupPath, partition.device);
}

// Manage partition (advanced tools menu)
async function managePartition(detected) {
    display.displayHeader('Partition Management');

    const chalk = require('chalk');

    // Get only partitions
    const partitions = detected.filter(d => d.type === 'part');

    if (partitions.length === 0) {
        display.displayInfo('No partitions detected.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const choices = partitions.map(p => ({
        name: `${p.name} (${p.size}) - ${p.mountpoint} [${p.fstype}]`,
        value: p
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: 'Back', value: null });

    const { partition } = await inquirer.prompt([{
        type: 'list',
        name: 'partition',
        message: 'Select partition:',
        choices
    }]);

    if (!partition) return;

    // Partition tools menu
    const isMounted = partition.mountpoint !== 'not mounted';

    const toolChoices = [
        { name: `${chalk.blue('ℹ')}  View partition details`, value: 'details' },
        new inquirer.Separator('─── Mount Operations ───'),
        isMounted
            ? { name: `${chalk.yellow('⏏')}  Unmount partition`, value: 'unmount' }
            : { name: `${chalk.green('📌')} Mount partition`, value: 'mount' },
        new inquirer.Separator('─── Recovery & Maintenance ───'),
        { name: `${chalk.cyan('🔍')} Check filesystem (read-only)`, value: 'fsck_ro' },
        { name: `${chalk.red('🔧')} Repair filesystem`, value: 'fsck_repair' },
        { name: `${chalk.green('💾')} Backup partition to image`, value: 'backup' },
        new inquirer.Separator('─── Modification (DANGEROUS) ───'),
        { name: `${chalk.magenta('🏷️')}  Set partition label`, value: 'label' },
        { name: `${chalk.yellow('📏')} Resize partition`, value: 'resize' },
        { name: `${chalk.red('⚠️')}  Format partition (ERASE ALL DATA)`, value: 'format' },
        { name: `${chalk.red('📋')} Clone to another partition`, value: 'clone' },
        new inquirer.Separator(),
        { name: 'Back', value: 'back' }
    ];

    const { tool } = await inquirer.prompt([{
        type: 'list',
        name: 'tool',
        message: `Partition ${partition.name} - Select tool:`,
        choices: toolChoices,
        pageSize: 20
    }]);

    if (tool === 'back') return;

    // Execute selected tool
    switch (tool) {
        case 'details':
            const info = diskinfo.getDetailedDiskInfo(partition.device);
            diskinfo.displayDetailedDiskInfo(info);
            break;

        case 'mount':
            await partitiontools.mountPartition(partition.device);
            break;

        case 'unmount':
            await partitiontools.unmountPartition(partition.device);
            break;

        case 'fsck_ro':
            await partitiontools.checkFilesystem(partition.device, partition.fstype, true);
            break;

        case 'fsck_repair':
            if (isMounted) {
                display.displayError('Partition must be unmounted before repair.');
            } else {
                await partitiontools.checkFilesystem(partition.device, partition.fstype, false);
            }
            break;

        case 'backup':
            await partitiontools.backupPartition(partition.device);
            break;

        case 'label':
            await partitiontools.setPartitionLabel(partition.device, partition.fstype);
            break;

        case 'resize':
            if (isMounted) {
                display.displayError('Partition must be unmounted before resizing.');
            } else {
                await partitiontools.resizePartition(partition.device, partition.fstype);
            }
            break;

        case 'format':
            if (isMounted) {
                display.displayError('Partition must be unmounted before formatting.');
            } else {
                await partitiontools.formatPartition(partition.device);
            }
            break;

        case 'clone':
            const targetChoices = partitions
                .filter(p => p.device !== partition.device)
                .map(p => ({
                    name: `${p.name} (${p.size}) - ${p.mountpoint}`,
                    value: p.device
                }));

            targetChoices.push({ name: 'Cancel', value: null });

            const { target } = await inquirer.prompt([{
                type: 'list',
                name: 'target',
                message: 'Select target partition:',
                choices: targetChoices
            }]);

            if (target) {
                await partitiontools.clonePartition(partition.device, target);
            }
            break;
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

// Start the application
mainMenu().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
