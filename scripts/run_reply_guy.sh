#!/bin/bash

# Automation script for Twitter Reply Guy
# Add this to your crontab to run automatically

SCRIPT_DIR="/Users/johnd/Projects/alex-content-dashboard/scripts"
LOG_FILE="$SCRIPT_DIR/automation.log"

echo "[$(date)] Starting Twitter Reply Guy automation..." >> "$LOG_FILE"

# Change to script directory
cd "$SCRIPT_DIR" || exit 1

# Activate virtual environment
source venv/bin/activate

# Run the script in live mode
python reply_guy.py --live >> "$LOG_FILE" 2>&1

echo "[$(date)] Twitter Reply Guy automation completed." >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"