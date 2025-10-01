# Help Menu Update Checklist

When adding new features to diskmgt, use this checklist to ensure the help menu stays current.

## Files That Trigger Help Updates

When editing these files, review the help menu:
- ✅ `index.js` - Main menu and features
- ✅ `backup.js` - Backup/restore functionality
- ✅ `partitiontools.js` - Partition management tools
- ✅ `maintenance.js` - Disk maintenance features
- ✅ `autoregister.js` - Auto-registration logic

## Help Menu Location

**File:** `index.js`
**Function:** `showHelp()` (lines 13-69)

## Sections to Update

### 1. MAIN FEATURES
Update when adding/changing:
- Menu items in main menu
- Drive management operations
- Registration methods
- Search/export functionality

### 2. BACKUP & RESTORE
Update when adding/changing:
- Backup methods
- Restore options
- Clone operations
- Cloud providers

### 3. BACKUP METHODS
Update when adding/changing:
- Block-level (dd) description
- Filesystem (tar) description
- Incremental (rsync) description
- Snapshot (btrfs) description
- New backup strategies

### 4. DISK MAINTENANCE
Update when adding/changing:
- Health check tools
- Disk analyzers
- Error checking methods
- Boot configuration tools

### 5. PARTITION TOOLS
Update when adding/changing:
- Mount/unmount operations
- Filesystem operations
- Partition modification tools
- Label/resize operations

### 6. AUTO-REGISTRATION
Update when adding/changing:
- Detection methods
- Content analysis
- Smart labeling
- Purpose detection

### 7. STORAGE
Update when:
- Adding new config files
- Changing storage locations
- Adding new data directories

### 8. USAGE
Update when:
- Adding new commands
- Changing alias setup
- Adding command-line options

## Quick Update Process

1. **Edit feature file** (e.g., `backup.js`)
2. **Note the change** - What feature was added/modified?
3. **Open index.js** - Find `showHelp()` function
4. **Locate section** - Which help section needs update?
5. **Add description** - Brief, consistent with existing style
6. **Test** - Run `diskmgt`, select Help, verify display
7. **Commit** - Include help update in same commit as feature

## Style Guide

**Format:** `• Feature name            - Brief description`

**Examples:**
```
Good:  • Clone with auto-resize   - Bootable clone to larger drive (dd + resize)
Good:  • SMART health             - Check drive health status
Good:  • Mount/Unmount            - Safe partition mounting

Bad:   • Clone drive - This feature clones drives with automatic resizing
Bad:   • SMART - health checks
Bad:   • Mount and unmount partitions safely
```

**Spacing:**
- Use `•` bullet for list items
- Align descriptions at column ~30 with dashes
- Keep descriptions under 60 characters
- Use consistent capitalization

## Claude Code Hook

The `.claude/hooks/post-edit.sh` hook will remind you to update help when relevant files are edited.

**Hook output:**
```
🔄 Feature file modified: backup.js
📝 Reminder: Update help menu in index.js showHelp() function
   to reflect any new features or changes.
```

## README.md Updates

After updating help menu, also update:
- `README.md` - Feature list section
- Add any new dependencies to package.json
- Update storage section if new config files added

## Testing Help Display

```bash
# Run diskmgt
node index.js

# Select: ❓ Help - Show all features and usage

# Verify:
- ✅ All sections render correctly
- ✅ No text overflow
- ✅ Consistent formatting
- ✅ New features documented
- ✅ Descriptions accurate
```
