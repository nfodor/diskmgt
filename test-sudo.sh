#!/bin/bash
# Quick test to verify dm-sudo is working correctly

echo "Testing dm-sudo wrapper..."
echo ""

echo "1. Running as current user:"
echo "   EUID: $EUID"
echo "   HOME: $HOME"
echo ""

echo "2. Running dm-sudo with root check:"
sudo /home/pi/dev/diskmgt/dm-sudo --test-env 2>&1 | head -1 &
sleep 1
pid=$!

# Check if the node process is running as root
node_pid=$(pgrep -f "node /home/pi/dev/diskmgt/index.js" | head -1)
if [ -n "$node_pid" ]; then
    user=$(ps -o user= -p $node_pid)
    echo "   Node process running as: $user"
    echo "   Process ID: $node_pid"

    # Check environment of the process
    echo ""
    echo "3. Environment variables passed to node:"
    sudo cat /proc/$node_pid/environ | tr '\0' '\n' | grep -E "^(HOME|ANTHROPIC|SUDO_USER)=" | head -5
else
    echo "   Process not found"
fi

# Cleanup
pkill -f "node /home/pi/dev/diskmgt/index.js" 2>/dev/null

echo ""
echo "4. Config directory check:"
ls -la ~/.config/diskmgt/ 2>/dev/null || echo "   No config directory"
