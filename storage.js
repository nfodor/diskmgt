const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'diskmgt');
const DRIVES_FILE = path.join(CONFIG_DIR, 'drives.json');

// Initialize storage
function initStorage() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (!fs.existsSync(DRIVES_FILE)) {
        fs.writeFileSync(DRIVES_FILE, JSON.stringify({ drives: [] }, null, 2));
    }
}

// Read all drives
function getAllDrives() {
    initStorage();
    try {
        const data = fs.readFileSync(DRIVES_FILE, 'utf8');
        return JSON.parse(data).drives;
    } catch (err) {
        return [];
    }
}

// Get drive by UUID
function getDriveByUUID(uuid) {
    const drives = getAllDrives();
    return drives.find(d => d.uuid === uuid);
}

// Add new drive
function addDrive(driveData) {
    initStorage();
    const data = JSON.parse(fs.readFileSync(DRIVES_FILE, 'utf8'));

    // Check if drive already exists
    if (data.drives.some(d => d.uuid === driveData.uuid)) {
        return false;
    }

    const timestamp = new Date().toISOString();
    data.drives.push({
        ...driveData,
        first_seen: timestamp,
        last_seen: timestamp
    });

    fs.writeFileSync(DRIVES_FILE, JSON.stringify(data, null, 2));
    return true;
}

// Update drive last_seen timestamp
function updateLastSeen(uuid) {
    initStorage();
    const data = JSON.parse(fs.readFileSync(DRIVES_FILE, 'utf8'));
    const drive = data.drives.find(d => d.uuid === uuid);

    if (drive) {
        drive.last_seen = new Date().toISOString();
        fs.writeFileSync(DRIVES_FILE, JSON.stringify(data, null, 2));
    }
}

// Update drive field
function updateDriveField(uuid, field, value) {
    initStorage();
    const data = JSON.parse(fs.readFileSync(DRIVES_FILE, 'utf8'));
    const drive = data.drives.find(d => d.uuid === uuid);

    if (drive) {
        drive[field] = value;
        fs.writeFileSync(DRIVES_FILE, JSON.stringify(data, null, 2));
        return true;
    }
    return false;
}

// Remove drive
function removeDrive(uuid) {
    initStorage();
    const data = JSON.parse(fs.readFileSync(DRIVES_FILE, 'utf8'));
    data.drives = data.drives.filter(d => d.uuid !== uuid);
    fs.writeFileSync(DRIVES_FILE, JSON.stringify(data, null, 2));
}

// Count drives
function countDrives() {
    return getAllDrives().length;
}

module.exports = {
    initStorage,
    getAllDrives,
    getDriveByUUID,
    addDrive,
    updateLastSeen,
    updateDriveField,
    removeDrive,
    countDrives
};
