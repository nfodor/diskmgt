const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');
const Table = require('cli-table3');
const boxen = require('boxen');

// Display cool ASCII header
function displayHeader(title) {
    console.clear();

    // Create gradient ASCII art for main title
    if (title === 'Drive Manager') {
        const ascii = figlet.textSync('DISKMGT', {
            font: 'ANSI Shadow',
            horizontalLayout: 'default'
        });
        console.log(gradient.pastel.multiline(ascii));
        console.log(chalk.dim.italic('  Advanced Drive Management & Monitoring System\n'));
    } else {
        // Subtitles with boxen
        console.log(boxen(chalk.bold.cyan(title), {
            padding: { left: 2, right: 2, top: 0, bottom: 0 },
            margin: { top: 1, bottom: 1 },
            borderStyle: 'double',
            borderColor: 'cyan',
            align: 'center',
            width: 60
        }));
    }
}

// Display drive list with status using tables
function displayDriveList(detectedDrives, knownDrives) {
    const detectedUUIDs = new Set(detectedDrives.map(d => d.uuid));

    if (knownDrives.length === 0) {
        console.log(boxen(chalk.yellow('No drives registered yet'), {
            padding: 1,
            margin: 1,
            borderColor: 'yellow'
        }));
        return;
    }

    const table = new Table({
        head: [
            chalk.cyan.bold('#'),
            chalk.cyan.bold('Label'),
            chalk.cyan.bold('Status'),
            chalk.cyan.bold('Size'),
            chalk.cyan.bold('Type'),
            chalk.cyan.bold('Mount')
        ],
        colWidths: [5, 20, 18, 12, 15, 25],
        style: {
            head: [],
            border: ['cyan']
        }
    });

    knownDrives.forEach((drive, index) => {
        const isConnected = detectedUUIDs.has(drive.uuid);
        const status = isConnected ? chalk.green('● CONNECTED') : chalk.gray('○ Offline');

        let mount = chalk.dim('N/A');
        if (isConnected) {
            const detected = detectedDrives.find(d => d.uuid === drive.uuid);
            if (detected && detected.mountpoint !== 'not mounted') {
                mount = chalk.green(detected.mountpoint);
            }
        }

        table.push([
            chalk.white(index + 1),
            chalk.bold(drive.label || 'Unlabeled'),
            status,
            drive.size,
            drive.type,
            mount
        ]);
    });

    console.log(table.toString());
}

// Display detected drives with tree view
function displayDetectedDrives(drives) {
    if (drives.length === 0) {
        console.log(boxen(chalk.yellow('No drives detected'), {
            padding: 1,
            margin: 1,
            borderColor: 'yellow'
        }));
        return;
    }

    console.log('\n' + boxen(chalk.bold.cyan('Currently Detected Drives'), {
        padding: { left: 1, right: 1, top: 0, bottom: 0 },
        borderColor: 'cyan',
        borderStyle: 'round'
    }) + '\n');

    const table = new Table({
        head: [
            chalk.cyan.bold('Device'),
            chalk.cyan.bold('Size'),
            chalk.cyan.bold('FS Type'),
            chalk.cyan.bold('Mount Point'),
            chalk.cyan.bold('Model')
        ],
        style: {
            head: [],
            border: ['cyan']
        }
    });

    drives.forEach(drive => {
        const isPartition = drive.type === 'part';
        const deviceName = isPartition ? '  └─ ' + drive.name : drive.name;

        table.push([
            chalk.bold(deviceName),
            drive.size,
            drive.fstype || chalk.dim('unknown'),
            drive.mountpoint !== 'not mounted' ? chalk.green(drive.mountpoint) : chalk.dim('not mounted'),
            !isPartition ? (drive.model !== 'Unknown Model' ? drive.model : chalk.dim('N/A')) : ''
        ]);
    });

    console.log(table.toString());
}

// Display single drive details in a beautiful card
function displayDriveDetails(drive) {
    const details = [
        `${chalk.bold('Label:')}       ${chalk.yellow(drive.label)}`,
        `${chalk.bold('Size:')}        ${drive.size}`,
        `${chalk.bold('Type:')}        ${drive.type}`,
        `${chalk.bold('Purpose:')}     ${drive.purpose || chalk.dim('Not specified')}`,
        `${chalk.bold('UUID:')}        ${chalk.dim(drive.uuid)}`,
        `${chalk.bold('First Seen:')}  ${chalk.dim(new Date(drive.first_seen).toLocaleString())}`,
        `${chalk.bold('Last Seen:')}   ${chalk.dim(new Date(drive.last_seen).toLocaleString())}`
    ].join('\n');

    console.log('\n' + boxen(details, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: 'Drive Details',
        titleAlignment: 'center'
    }));
}

// Display success message
function displaySuccess(message) {
    console.log('\n' + boxen(chalk.green('✓ ' + message), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        margin: { top: 1, bottom: 1 },
        borderColor: 'green',
        borderStyle: 'round'
    }));
}

// Display error message
function displayError(message) {
    console.log('\n' + boxen(chalk.red('✗ ' + message), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        margin: { top: 1, bottom: 1 },
        borderColor: 'red',
        borderStyle: 'round'
    }));
}

// Display info message
function displayInfo(message) {
    console.log('\n' + boxen(chalk.blue('ℹ ' + message), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        margin: { top: 1, bottom: 1 },
        borderColor: 'blue',
        borderStyle: 'round'
    }));
}

module.exports = {
    displayHeader,
    displayDriveList,
    displayDetectedDrives,
    displayDriveDetails,
    displaySuccess,
    displayError,
    displayInfo
};
