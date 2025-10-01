# Chrome Display Fix

## Problem
Chrome launches on the wrong display (VNC monitor instead of the current terminal's display) when clicked from a status bar or launched from certain contexts.

## Solution

Use the provided launch script that:
1. Detects the correct DISPLAY variable
2. Launches Chrome on that display
3. Uses xdotool to bring the window to the foreground

## Usage

### Option 1: Direct Script
```bash
/home/pi/dev/diskmgt/launch-chrome.sh [URL]
```

### Option 2: Add Alias (Recommended)
```bash
echo "alias chrome='/home/pi/dev/diskmgt/launch-chrome.sh'" >> ~/.bashrc
source ~/.bashrc

# Now use:
chrome https://example.com
```

### Option 3: Replace System Chrome Command
```bash
sudo mv /usr/bin/chromium-browser /usr/bin/chromium-browser.orig
sudo ln -s /home/pi/dev/diskmgt/launch-chrome.sh /usr/bin/chromium-browser
```

**Warning:** Option 3 affects all Chrome launches system-wide.

## How It Works

The script:
1. **Captures DISPLAY** from the launching terminal
2. **Finds Chrome binary** (google-chrome, chromium-browser, or chromium)
3. **Launches with correct DISPLAY** variable set
4. **Waits for window** to appear (2 seconds)
5. **Uses xdotool** to:
   - Find the Chrome window ID
   - Activate the window
   - Raise it to the foreground

## Troubleshooting

### Chrome still on wrong display?

**Check your current display:**
```bash
echo $DISPLAY
```

**Manually set display:**
```bash
DISPLAY=:0 /home/pi/dev/diskmgt/launch-chrome.sh
```

**Find all X displays:**
```bash
who | grep "(:.*)"
```

### Chrome not appearing at all?

**Check the log:**
```bash
cat /tmp/chrome-launch.log
```

**Find hidden Chrome windows:**
```bash
xdotool search --name "Chromium|Chrome"
```

**Bring hidden window to front:**
```bash
xdotool windowactivate $(xdotool search --name "Chrome" | tail -1)
```

### Multiple monitors?

If you have multiple physical monitors, Chrome might appear on a different monitor but correct display. Use xdotool to move it:

```bash
# Get window ID
WINDOW_ID=$(xdotool search --name "Chrome" | tail -1)

# Move to specific position (x, y)
xdotool windowmove $WINDOW_ID 0 0

# Or center on screen
xdotool windowmove --sync $WINDOW_ID 50% 50%
```

## Environment Variables

The script respects:
- `$DISPLAY` - Current X display
- `$SSH_CONNECTION` - Detects SSH sessions

## Dependencies

- **Required:** chromium-browser OR chromium OR google-chrome
- **Optional:** xdotool (for auto-focusing)

Install xdotool:
```bash
sudo apt-get install xdotool
```

## Advanced Configuration

### Force specific display
Edit the script and change:
```bash
LAUNCH_DISPLAY="${DISPLAY:-:0}"
```
To:
```bash
LAUNCH_DISPLAY=":1"  # Force display :1
```

### Disable auto-focus
Comment out the xdotool section (lines 39-56)

### Kill existing Chrome first
Uncomment line 24:
```bash
pkill -f "$CHROME_BIN" 2>/dev/null
```

## Integration with Status Bars

### Polybar
```ini
[module/chrome]
type = custom/script
exec = echo ""
click-left = /home/pi/dev/diskmgt/launch-chrome.sh
```

### i3 keybinding
```
bindsym $mod+c exec /home/pi/dev/diskmgt/launch-chrome.sh
```

### Desktop Entry
Create `~/.local/share/applications/chrome-fixed.desktop`:
```desktop
[Desktop Entry]
Name=Chrome (Fixed Display)
Exec=/home/pi/dev/diskmgt/launch-chrome.sh %U
Type=Application
Categories=Network;WebBrowser;
```

## VNC-Specific Issues

If Chrome always goes to VNC display:

1. **Check VNC DISPLAY:**
   ```bash
   ps aux | grep vnc | grep DISPLAY
   ```

2. **Override VNC display:**
   ```bash
   unset VNCDESKTOP
   DISPLAY=:0 /home/pi/dev/diskmgt/launch-chrome.sh
   ```

3. **Set display in .bashrc:**
   ```bash
   echo "export DISPLAY=:0" >> ~/.bashrc
   ```

## Common Display Values

- `:0` - Primary physical display
- `:1` - VNC server display
- `:10` - SSH X11 forwarding

Use `w` or `who` command to see active displays.
