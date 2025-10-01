const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Detect if a mount point is used for LXD storage
function detectLXDStorage(mountpoint) {
    const lxdInfo = {
        isLXD: false,
        pools: [],
        containers: [],
        totalSize: 0,
        usedSize: 0
    };

    // Check for common LXD storage paths
    const lxdPaths = [
        path.join(mountpoint, 'lxd'),
        path.join(mountpoint, 'storage'),
        path.join(mountpoint, 'lxd/storage-pools')
    ];

    let foundLXD = false;

    for (const lxdPath of lxdPaths) {
        if (fs.existsSync(lxdPath)) {
            foundLXD = true;
            lxdInfo.isLXD = true;
            break;
        }
    }

    if (!foundLXD) {
        return lxdInfo;
    }

    try {
        // Get LXD storage pools
        const poolsOutput = execSync('lxc storage list --format csv 2>/dev/null || true', { encoding: 'utf8' });

        if (poolsOutput.trim()) {
            const lines = poolsOutput.trim().split('\n');
            lines.forEach(line => {
                const [name, driver, source, description, used] = line.split(',');

                // Check if this pool is on our mountpoint
                if (source && (source.includes(mountpoint) || mountpoint.includes(source))) {
                    lxdInfo.pools.push({
                        name: name,
                        driver: driver || 'unknown',
                        source: source || mountpoint,
                        description: description || '',
                        used: used || 'unknown'
                    });
                }
            });
        }

        // Get LXD containers
        const containersOutput = execSync('lxc list --format csv -c ns 2>/dev/null || true', { encoding: 'utf8' });

        if (containersOutput.trim()) {
            const lines = containersOutput.trim().split('\n');
            lines.forEach(line => {
                const [name, status] = line.split(',');

                if (name && status) {
                    // Try to get container info
                    try {
                        const containerInfo = execSync(`lxc config device show ${name} 2>/dev/null || echo ""`, { encoding: 'utf8' });

                        // Check if container uses storage from this pool
                        const usesThisStorage = lxdInfo.pools.some(pool => {
                            return containerInfo.includes(pool.name) || containerInfo.includes(mountpoint);
                        });

                        // Get container storage info
                        const storageInfo = execSync(`lxc info ${name} 2>/dev/null | grep -E "(Disk usage|Storage)" || true`, { encoding: 'utf8' });

                        lxdInfo.containers.push({
                            name: name,
                            status: status,
                            usesThisStorage: usesThisStorage,
                            storageInfo: storageInfo.trim()
                        });
                    } catch (err) {
                        // If we can't get container info, still add basic info
                        lxdInfo.containers.push({
                            name: name,
                            status: status,
                            usesThisStorage: false,
                            storageInfo: ''
                        });
                    }
                }
            });
        }

        // Get disk usage for LXD directories
        const lxdDir = path.join(mountpoint, 'lxd');
        const storageDir = path.join(mountpoint, 'storage');

        if (fs.existsSync(lxdDir)) {
            try {
                const duOutput = execSync(`du -sb "${lxdDir}" 2>/dev/null || echo "0"`, { encoding: 'utf8' });
                const bytes = parseInt(duOutput.trim().split('\t')[0]);
                lxdInfo.usedSize += bytes;
            } catch (err) {
                // Ignore
            }
        }

        if (fs.existsSync(storageDir)) {
            try {
                const duOutput = execSync(`du -sb "${storageDir}" 2>/dev/null || echo "0"`, { encoding: 'utf8' });
                const bytes = parseInt(duOutput.trim().split('\t')[0]);
                lxdInfo.usedSize += bytes;
            } catch (err) {
                // Ignore
            }
        }

    } catch (err) {
        console.error(chalk.dim(`  Note: LXD detected but couldn't query details: ${err.message}`));
    }

    return lxdInfo;
}

// Format bytes to human readable
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Display LXD storage information
function displayLXDInfo(lxdInfo) {
    const boxen = require('boxen');
    const Table = require('cli-table3');

    if (!lxdInfo.isLXD) {
        return;
    }

    // LXD Storage Pools
    if (lxdInfo.pools.length > 0) {
        const poolTable = new Table({
            head: [
                chalk.cyan.bold('Pool Name'),
                chalk.cyan.bold('Driver'),
                chalk.cyan.bold('Source'),
                chalk.cyan.bold('Used')
            ],
            style: {
                head: [],
                border: ['cyan']
            }
        });

        lxdInfo.pools.forEach(pool => {
            poolTable.push([
                chalk.yellow(pool.name),
                pool.driver,
                chalk.dim(pool.source),
                pool.used
            ]);
        });

        console.log('\n' + boxen(poolTable.toString(), {
            padding: { left: 1, right: 1, top: 0, bottom: 0 },
            margin: 1,
            borderStyle: 'round',
            borderColor: 'magenta',
            title: '🗄️  LXD Storage Pools',
            titleAlignment: 'center'
        }));
    }

    // LXD Containers
    if (lxdInfo.containers.length > 0) {
        const containerTable = new Table({
            head: [
                chalk.cyan.bold('Container'),
                chalk.cyan.bold('Status'),
                chalk.cyan.bold('Uses This Storage')
            ],
            style: {
                head: [],
                border: ['cyan']
            },
            colWidths: [30, 15, 20]
        });

        lxdInfo.containers.forEach(container => {
            const statusColor = container.status === 'RUNNING' ? chalk.green : chalk.gray;
            const usesStorage = container.usesThisStorage ? chalk.green('Yes') : chalk.dim('No');

            containerTable.push([
                chalk.yellow(container.name),
                statusColor(container.status),
                usesStorage
            ]);
        });

        console.log(boxen(containerTable.toString(), {
            padding: { left: 1, right: 1, top: 0, bottom: 0 },
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue',
            title: `📦 LXD Containers (${lxdInfo.containers.length} total)`,
            titleAlignment: 'center'
        }));
    } else if (lxdInfo.pools.length > 0) {
        console.log(boxen(chalk.dim('No containers found'), {
            padding: 1,
            margin: 1,
            borderColor: 'yellow',
            title: '📦 LXD Containers',
            titleAlignment: 'center'
        }));
    }

    // Storage usage summary
    if (lxdInfo.usedSize > 0) {
        const summary = [
            `${chalk.bold('LXD Storage Used:')} ${chalk.yellow(formatBytes(lxdInfo.usedSize))}`,
            `${chalk.bold('Storage Pools:')} ${lxdInfo.pools.length}`,
            `${chalk.bold('Containers:')} ${lxdInfo.containers.length}`
        ].join('\n');

        console.log(boxen(summary, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            title: '📊 LXD Usage Summary',
            titleAlignment: 'center'
        }));
    }
}

module.exports = {
    detectLXDStorage,
    displayLXDInfo,
    formatBytes
};
