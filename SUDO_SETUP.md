# Running diskmgt with sudo

Most disk management operations require root privileges. Here's how to set up `dm` to run with sudo automatically while preserving your user environment.

## Quick Setup

Run this command to update your shell aliases:

```bash
# Remove old aliases and add new sudo-enabled ones
sed -i '/alias diskmgt=/d' ~/.bashrc
sed -i '/alias dm=/d' ~/.bashrc
echo "alias diskmgt='/home/pi/dev/diskmgt/dm-sudo'" >> ~/.bashrc
echo "alias dm='/home/pi/dev/diskmgt/dm-sudo'" >> ~/.bashrc
source ~/.bashrc
```

## What This Does

The `dm-sudo` wrapper script:
1. ✅ Automatically runs with `sudo` when needed
2. ✅ Preserves your user's config directory (`~/.config/diskmgt/`)
3. ✅ Preserves `ANTHROPIC_API_KEY` environment variable
4. ✅ Keeps your drive registrations and settings
5. ✅ No password prompt if you're in sudoers

## Manual Setup (Alternative)

If you prefer to always type `sudo dm`:

```bash
# Keep simple aliases
alias dm='node /home/pi/dev/diskmgt/index.js'
alias diskmgt='node /home/pi/dev/diskmgt/index.js'

# Always run with sudo
sudo dm
```

**Drawback:** Must remember to type `sudo` every time.

## How It Works

### Without dm-sudo wrapper:
```bash
dm                    # Runs as user 'pi'
sudo dm               # Runs as root, uses /root/.config/diskmgt/ ❌
```

### With dm-sudo wrapper:
```bash
dm                    # Automatically runs with sudo ✅
                      # Uses /home/pi/.config/diskmgt/ ✅
                      # Preserves ANTHROPIC_API_KEY ✅
```

## Environment Variables Preserved

- `HOME` - Your user's home directory
- `ANTHROPIC_API_KEY` - Claude AI API key
- `USER` - Original username
- `SUDO_USER` - Tracks who ran sudo

## Configuration Files Used

When running with `dm-sudo`:
- Drive data: `/home/pi/.config/diskmgt/drives.json`
- Backup config: `/home/pi/.config/diskmgt/backup-config.json`
- AI config: `/home/pi/.config/diskmgt/config.json`

**NOT** using root's config at `/root/.config/diskmgt/` ❌

## Sudoers Configuration (Optional)

To avoid password prompts, add to `/etc/sudoers`:

```bash
# Allow user 'pi' to run diskmgt without password
pi ALL=(ALL) NOPASSWD: /home/pi/dev/diskmgt/dm-sudo
```

**Use `visudo` to edit safely:**
```bash
sudo visudo
```

## Testing

```bash
# Test that dm runs with root privileges
dm

# Inside diskmgt, try an admin operation like:
# - Check SMART health (requires root)
# - Mount/unmount partition (requires root)
# - Run fsck (requires root)

# Verify using your config
ls -la ~/.config/diskmgt/
# Should show your drive registrations
```

## Troubleshooting

### "Permission denied" errors
- Make sure dm-sudo is executable: `chmod +x /home/pi/dev/diskmgt/dm-sudo`
- Check you can run sudo: `sudo -v`

### "Config not found"
- Verify HOME is preserved: `echo $HOME` (should show /home/pi, not /root)
- Check wrapper script is being used: `which dm`

### API key not working
- Ensure ANTHROPIC_API_KEY is in environment before running dm
- Add to ~/.bashrc: `export ANTHROPIC_API_KEY="sk-ant-..."`
- Reload shell: `source ~/.bashrc`

### Still using root's config
- Check alias points to dm-sudo: `alias dm`
- Should show: `/home/pi/dev/diskmgt/dm-sudo`
- Not: `node /home/pi/dev/diskmgt/index.js`

## Security Notes

**Safe:**
- dm-sudo only runs diskmgt, nothing else
- Preserves user context for auditing
- No arbitrary command execution

**Consider:**
- Only give sudo access to trusted users
- Review operations before confirming destructive actions
- Keep backups of drive configurations

## Verifying Root Privileges

Once running `dm`, operations that require root will work:

✅ **Will work:**
- fsck (filesystem check)
- mount/unmount
- smartctl (SMART data)
- parted (partition operations)
- dd (disk cloning)

❌ **Would fail without sudo:**
- All of the above

## Uninstalling

To go back to non-sudo mode:

```bash
sed -i '/alias diskmgt=/d' ~/.bashrc
sed -i '/alias dm=/d' ~/.bashrc
echo "alias dm='node /home/pi/dev/diskmgt/index.js'" >> ~/.bashrc
echo "alias diskmgt='node /home/pi/dev/diskmgt/index.js'" >> ~/.bashrc
source ~/.bashrc
```

Then always run with explicit sudo: `sudo dm`
