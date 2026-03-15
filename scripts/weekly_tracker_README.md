# Weekly Twitter Performance Tracker

Automated script to pull weekly Twitter metrics for @gethookdai and save to CSV.

## ⚠️ Current Status: Limited API Access

The provided Twitter API credentials have **limited access**:
- ✅ Basic authentication works
- ❌ User timeline and metrics access denied (401 Unauthorized)  
- ❌ Search endpoints denied

This is likely due to **Free/Basic tier API limitations**.

## What the Script Does

When working with full API access:
- Pulls tweets from @gethookdai for specified week(s)
- Extracts public metrics (impressions, likes, retweets, bookmarks, replies)
- Calculates weekly aggregated data
- Classifies media types (video/image)
- Saves to CSV with proper structure

## Output CSV Columns

```
week_start, week_end, tweets_posted, total_impressions, avg_impressions, 
total_likes, total_retweets, total_bookmarks, total_replies, 
video_tweets, video_avg_imp, image_tweets, image_avg_imp, 
top_tweet_text, top_tweet_impressions, trials
```

**Notes:**
- `week_start` and `week_end` define Monday-Sunday weeks
- `trials` defaults to NULL for manual entry by Alex
- `top_tweet_text` is truncated to 100 characters

## Usage

### Basic Usage
```bash
# Pull last week's data
python3 weekly_tracker.py

# Backfill last 4 weeks  
python3 weekly_tracker.py --weeks 4

# Create placeholder structure despite API limitations
python3 weekly_tracker.py --force
```

### With Virtual Environment
```bash
cd /Users/johnd/Projects/alex-content-dashboard/scripts
source .venv/bin/activate
python3 weekly_tracker.py --force
```

## Twitter API Requirements

For full functionality, you need:

### Required Access Level
- **Twitter API v2 Pro** ($100+/month) or **Enterprise** 
- OR **Academic Research** access (free, application required)

### Required Endpoints
- `GET /2/users/:id/tweets` with public_metrics
- Tweet fields: public_metrics, created_at, attachments
- User authentication with read permissions

## Current Workarounds

Since API access is limited, you have these options:

### 1. Manual Data Entry
1. Run script with `--force` to create CSV structure
2. Export data from Twitter Analytics monthly
3. Manually populate the CSV with actual metrics

### 2. Upgrade API Access
- Apply for Twitter API Pro/Enterprise  
- Use social media management tools (Hootsuite, Buffer, Sprout Social)
- Consider third-party analytics tools

### 3. Alternative Data Sources
- Twitter Analytics native exports
- Social media management platforms with API access
- Manual weekly screenshot tracking

## File Structure

```
alex-content-dashboard/
├── scripts/
│   ├── weekly_tracker.py          # Main script
│   ├── weekly_tracker_README.md   # This file
│   ├── .venv/                     # Python virtual environment
│   └── requirements.txt           # Dependencies (tweepy==4.14.0)
└── data/
    └── weekly_metrics.csv         # Output CSV file
```

## Features

### ✅ Working Features
- CSV structure creation
- Week range calculation (Monday-Sunday)
- Backfill functionality (`--weeks N`)
- Duplicate prevention
- Rate limiting with delays
- Comprehensive error handling and reporting

### 🔄 API-Dependent Features  
- Actual tweet data fetching
- Real metrics calculation
- Media type classification
- Top tweet identification

### 📋 Manual Features
- `trials` column (for Alex to fill from dashboard)
- Actual metrics (requires Twitter Analytics export)

## Scheduling for Automation

To run automatically every Monday:

### Option 1: Cron Job (macOS/Linux)
```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 9 AM)
0 9 * * 1 cd /Users/johnd/Projects/alex-content-dashboard/scripts && source .venv/bin/activate && python3 weekly_tracker.py --force
```

### Option 2: macOS LaunchAgent
Create a plist file for more reliable scheduling on macOS.

## Troubleshooting

### Common Issues

**401 Unauthorized**
- This is expected with current API credentials
- Use `--force` flag to create structure anyway

**Duplicate entries**
- Script automatically prevents duplicates
- Manually remove duplicates from CSV if needed

**Missing virtual environment**
```bash
cd scripts/
python3 -m venv .venv
source .venv/bin/activate  
pip install -r requirements.txt
```

**Date range confusion**
- Script uses Monday-Sunday weeks
- "Last week" = most recently completed Monday-Sunday period
- Use `--weeks N` to go back N completed weeks

## Future Enhancements

When full API access is available:
- Real-time metrics pulling
- Media type detection improvements
- Engagement rate calculations
- Tweet performance comparisons
- Automated reporting and insights

## Support

For issues or questions:
1. Check this README first
2. Verify virtual environment is activated
3. Test with `--force` flag to isolate API issues
4. Consider API access upgrade for full functionality