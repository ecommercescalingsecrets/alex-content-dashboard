#!/bin/bash
# Takes a screenshot of a Gethookd board and uploads to Railway
# Usage: ./take_board_screenshot.sh <board_url> <filename>
BOARD_URL="$1"
FILENAME="$2"

# Use puppeteer/playwright to screenshot - fallback to curl if not available
if command -v npx &> /dev/null; then
  npx -y puppeteer-screenshot "$BOARD_URL" --output "/tmp/$FILENAME" --width 1200 --height 800 2>/dev/null
fi

# Upload to Railway
curl -s -X POST "https://web-production-c72a.up.railway.app/api/media/upload" \
  -F "file=@/tmp/$FILENAME" -F "filename=$FILENAME"
