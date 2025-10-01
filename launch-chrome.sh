#!/bin/bash
# Launch Chrome on the correct display and bring to foreground

# Save the display we're launching from
# If DISPLAY is set, use it; otherwise default to :0
if [ -n "$DISPLAY" ]; then
    LAUNCH_DISPLAY="$DISPLAY"
else
    LAUNCH_DISPLAY=":0"
fi

# If no URL/arguments provided, open new tab page
if [ $# -eq 0 ]; then
    set -- "chrome://newtab"
fi

# Call the original chromium launcher with correct DISPLAY
# Use --password-store=basic to avoid keyring blocking network access
exec env DISPLAY="$LAUNCH_DISPLAY" /usr/bin/chromium.original --password-store=basic "$@"
