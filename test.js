#!/usr/bin/env node

/**
 * Automated test suite for diskmgt
 * Run with: node test.js
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('═'.repeat(60));
console.log('  DISKMGT Automated Test Suite');
console.log('═'.repeat(60) + '\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (err) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${err.message}`);
        failed++;
    }
}

// Test 1: Module loading
console.log('\n📦 Module Loading Tests\n');

test('storage.js loads without errors', () => {
    require('./storage.js');
});

test('detect.js loads without errors', () => {
    require('./detect.js');
});

test('display.js loads without errors', () => {
    require('./display.js');
});

test('maintenance.js loads without errors', () => {
    require('./maintenance.js');
});

test('diskinfo.js loads without errors', () => {
    require('./diskinfo.js');
});

// Test 2: Storage operations
console.log('\n💾 Storage Tests\n');

const storage = require('./storage.js');

test('storage.initStorage() creates config directory', () => {
    storage.initStorage();
    if (!fs.existsSync(require('os').homedir() + '/.config/diskmgt')) {
        throw new Error('Config directory not created');
    }
});

test('storage.getAllDrives() returns array', () => {
    const drives = storage.getAllDrives();
    if (!Array.isArray(drives)) {
        throw new Error('getAllDrives did not return array');
    }
});

test('storage.countDrives() returns number', () => {
    const count = storage.countDrives();
    if (typeof count !== 'number') {
        throw new Error('countDrives did not return number');
    }
});

// Test 3: Detect operations
console.log('\n🔍 Drive Detection Tests\n');

const detect = require('./detect.js');

test('detect.detectDrives() returns array', () => {
    const drives = detect.detectDrives();
    if (!Array.isArray(drives)) {
        throw new Error('detectDrives did not return array');
    }
});

test('detect.detectDrives() finds at least one drive', () => {
    const drives = detect.detectDrives();
    if (drives.length === 0) {
        throw new Error('No drives detected');
    }
});

test('detected drives have required fields', () => {
    const drives = detect.detectDrives();
    const drive = drives[0];
    const requiredFields = ['name', 'size', 'type', 'device', 'uuid'];
    requiredFields.forEach(field => {
        if (!drive[field]) {
            throw new Error(`Missing field: ${field}`);
        }
    });
});

test('detect.getDriveType() returns string', () => {
    const type = detect.getDriveType('nvme0n1');
    if (typeof type !== 'string') {
        throw new Error('getDriveType did not return string');
    }
});

// Test 4: Display operations
console.log('\n🎨 Display Tests\n');

const display = require('./display.js');

test('display.displaySuccess() does not crash', () => {
    // Capture output but don't display
    const oldLog = console.log;
    console.log = () => {};
    display.displaySuccess('Test message');
    console.log = oldLog;
});

test('display.displayError() does not crash', () => {
    const oldLog = console.log;
    console.log = () => {};
    display.displayError('Test error');
    console.log = oldLog;
});

test('display.displayInfo() does not crash', () => {
    const oldLog = console.log;
    console.log = () => {};
    display.displayInfo('Test info');
    console.log = oldLog;
});

// Test 5: Disk info operations
console.log('\n📊 Disk Info Tests\n');

const diskinfo = require('./diskinfo.js');

test('diskinfo.getDetailedDiskInfo() returns object', () => {
    const drives = detect.detectDrives();
    const diskDrive = drives.find(d => d.type === 'disk');
    if (diskDrive) {
        const info = diskinfo.getDetailedDiskInfo(diskDrive.device);
        if (typeof info !== 'object') {
            throw new Error('getDetailedDiskInfo did not return object');
        }
    }
});

// Test 6: Integration test
console.log('\n🔗 Integration Tests\n');

test('Can add and remove test drive', () => {
    const testDrive = {
        uuid: 'test-uuid-12345',
        label: 'Test Drive',
        size: '1GB',
        type: 'Test Type',
        purpose: 'Testing',
        device: '/dev/test'
    };

    // Add drive
    const added = storage.addDrive(testDrive);
    if (!added) {
        throw new Error('Failed to add test drive');
    }

    // Verify it exists
    const found = storage.getDriveByUUID('test-uuid-12345');
    if (!found || found.label !== 'Test Drive') {
        throw new Error('Test drive not found after adding');
    }

    // Remove drive
    storage.removeDrive('test-uuid-12345');

    // Verify it's gone
    const removed = storage.getDriveByUUID('test-uuid-12345');
    if (removed) {
        throw new Error('Test drive still exists after removal');
    }
});

// Summary
console.log('\n' + '═'.repeat(60));
console.log('  Test Results');
console.log('═'.repeat(60));
console.log(`  ✓ Passed: ${passed}`);
console.log(`  ✗ Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log('═'.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
