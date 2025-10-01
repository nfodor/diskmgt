const { execSync } = require('child_process');
const chalk = require('chalk');
const Table = require('cli-table3');

// Check if smartctl is available
function isSmartctlAvailable() {
    try {
        execSync('which smartctl', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// Get SMART health for a device
function getSmartHealth(device) {
    try {
        const output = execSync(`smartctl -H ${device}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });

        // Parse health status
        if (output.includes('PASSED')) {
            return { status: 'PASS', message: 'Healthy' };
        } else if (output.includes('FAILED')) {
            return { status: 'FAIL', message: 'FAILING' };
        } else {
            return { status: 'UNKNOWN', message: 'Unknown' };
        }
    } catch (err) {
        // Device might not support SMART
        return { status: 'N/A', message: 'No SMART' };
    }
}

// Get temperature for a device
function getTemperature(device) {
    try {
        const output = execSync(`smartctl -A ${device}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });

        // Look for temperature in output
        const tempMatch = output.match(/Temperature.*?(\d+)\s*Celsius/i) ||
                         output.match(/Airflow_Temperature.*?(\d+)/i) ||
                         output.match(/190\s+.*?(\d+)/); // ID 190 is temperature

        if (tempMatch) {
            return parseInt(tempMatch[1]);
        }
        return null;
    } catch {
        return null;
    }
}

// Get power-on hours
function getPowerOnHours(device) {
    try {
        const output = execSync(`smartctl -A ${device}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });

        // Look for Power_On_Hours
        const hoursMatch = output.match(/Power_On_Hours.*?(\d+)/i) ||
                          output.match(/9\s+Power_On_Hours.*?(\d+)/);

        if (hoursMatch) {
            return parseInt(hoursMatch[1]);
        }
        return null;
    } catch {
        return null;
    }
}

// Get wear level (for SSDs)
function getWearLevel(device) {
    try {
        const output = execSync(`smartctl -A ${device}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });

        // Look for Wear_Leveling_Count or Media_Wearout_Indicator
        const wearMatch = output.match(/Wear_Leveling_Count.*?(\d+)/i) ||
                         output.match(/Media_Wearout_Indicator.*?(\d+)/i) ||
                         output.match(/177\s+Wear_Leveling_Count.*?(\d+)/);

        if (wearMatch) {
            return parseInt(wearMatch[1]);
        }
        return null;
    } catch {
        return null;
    }
}

// Format hours to human readable
function formatHours(hours) {
    if (!hours) return 'N/A';

    const days = Math.floor(hours / 24);
    const years = Math.floor(days / 365);

    if (years > 0) {
        return `${years}y ${days % 365}d`;
    } else if (days > 0) {
        return `${days}d`;
    } else {
        return `${hours}h`;
    }
}

// Get health status with color
function formatStatus(status) {
    switch (status) {
        case 'PASS':
            return chalk.green('✓ PASS');
        case 'FAIL':
            return chalk.red('✗ FAIL');
        case 'N/A':
            return chalk.dim('- N/A');
        default:
            return chalk.yellow('? ' + status);
    }
}

// Get temperature with color
function formatTemp(temp) {
    if (!temp) return chalk.dim('N/A');

    if (temp > 60) {
        return chalk.red(`${temp}°C HOT!`);
    } else if (temp > 50) {
        return chalk.yellow(`${temp}°C`);
    } else {
        return chalk.green(`${temp}°C`);
    }
}

// Get wear level with color
function formatWear(wear) {
    if (!wear) return chalk.dim('N/A');

    if (wear < 50) {
        return chalk.red(`${wear}% WORN`);
    } else if (wear < 80) {
        return chalk.yellow(`${wear}%`);
    } else {
        return chalk.green(`${wear}%`);
    }
}

// Display health dashboard
function displayHealthDashboard() {
    const boxen = require('boxen');

    console.log(boxen(
        chalk.bold('Drive Health Dashboard'),
        { padding: 1, borderColor: 'cyan', margin: 1 }
    ));

    if (!isSmartctlAvailable()) {
        console.log(chalk.yellow('⚠ smartctl not installed. Install with: sudo apt install smartmontools\n'));
        return;
    }

    // Get all disk devices
    const detect = require('./detect');
    const drives = detect.detectDrives();
    const disks = drives.filter(d => d.type === 'disk');

    if (disks.length === 0) {
        console.log(chalk.yellow('No disk drives detected.\n'));
        return;
    }

    // Create table
    const table = new Table({
        head: [
            chalk.bold('Device'),
            chalk.bold('Model'),
            chalk.bold('Size'),
            chalk.bold('Health'),
            chalk.bold('Temp'),
            chalk.bold('Wear'),
            chalk.bold('Hours')
        ],
        style: {
            head: ['cyan']
        }
    });

    // Collect health data for each disk
    disks.forEach(disk => {
        const health = getSmartHealth(disk.device);
        const temp = getTemperature(disk.device);
        const wear = getWearLevel(disk.device);
        const hours = getPowerOnHours(disk.device);

        table.push([
            disk.name,
            disk.model || 'Unknown',
            disk.size,
            formatStatus(health.status),
            formatTemp(temp),
            formatWear(wear),
            formatHours(hours)
        ]);
    });

    console.log(table.toString());
    console.log('');

    // Show warnings
    const warnings = [];
    disks.forEach(disk => {
        const health = getSmartHealth(disk.device);
        const temp = getTemperature(disk.device);
        const wear = getWearLevel(disk.device);

        if (health.status === 'FAIL') {
            warnings.push(chalk.red(`⚠ ${disk.name}: SMART failure detected - backup immediately!`));
        }
        if (temp && temp > 60) {
            warnings.push(chalk.yellow(`⚠ ${disk.name}: High temperature (${temp}°C) - check cooling`));
        }
        if (wear && wear < 50) {
            warnings.push(chalk.yellow(`⚠ ${disk.name}: High wear (${100 - wear}%) - consider replacement`));
        }
    });

    if (warnings.length > 0) {
        console.log(chalk.bold('⚠ Warnings:\n'));
        warnings.forEach(w => console.log('  ' + w));
        console.log('');
    } else {
        console.log(chalk.green('✓ All drives healthy!\n'));
    }

    console.log(chalk.dim('Tip: Run \'smartctl -a /dev/sdX\' for detailed SMART data\n'));
}

module.exports = {
    displayHealthDashboard,
    isSmartctlAvailable
};
