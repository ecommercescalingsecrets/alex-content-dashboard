# Twitter Reply Guy for @GetHookdAI

An automated Twitter bot that finds relevant tweets about ad spy tools and crafts helpful replies that naturally mention @GetHookdAI.

## 🎯 What It Does

1. **Searches Twitter** for tweets containing keywords like:
   - "facebook ads", "ad spy tool", "competitor ads"
   - "what ads are they running", "ad creative", "winning ads"
   - "ad library", "facebook ad library", etc.

2. **Filters for high-value targets**:
   - Accounts with 1K+ followers
   - Tweets less than 6 hours old
   - Tweets that don't already mention @GetHookdAI
   - Skip our own tweets

3. **Crafts helpful replies** that:
   - Answer the user's question with real data when possible
   - Naturally mention @GetHookdAI
   - Stay under 280 characters
   - Avoid spammy language

4. **Rate limiting & tracking**:
   - Max 5 replies per hour (avoid spam detection)
   - SQLite database tracks all replies to prevent duplicates
   - Comprehensive logging

## 📁 Files

- `reply_guy.py` - Main production script
- `demo_reply_guy.py` - Demo with mock data (ready to run)
- `test_twitter_auth.py` - Test Twitter API credentials
- `requirements.txt` - Python dependencies

## 🚀 Quick Demo

To see exactly what the bot would do:

```bash
cd /Users/johnd/Projects/alex-content-dashboard/scripts
source venv/bin/activate
python demo_reply_guy.py
```

This shows:
- 5 example tweets it would reply to
- Exact replies it would craft
- Character counts and engagement metrics
- How it extracts brand names and uses real data

## ⚙️ Setup for Production

### 1. Twitter API Access

**Current Status**: Basic app authentication works, but search requires elevated access.

**What you have**:
- App Key: `2U2KZG8ljE1wLXCySzhBswCyO`
- App Secret: `nAAE...` (configured)
- Access Token: `1761047014723268608-zen0...` (configured)
- Access Secret: `Ktse...` (configured)

**What you need**:
- Twitter API v2 **Essential access** (free)
- Or add a **Bearer Token** for app-only authentication

### 2. Get Essential Access

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Log in with the @GetHookdAI account
3. Navigate to your app dashboard
4. Apply for Essential access (usually approved instantly)
5. Get your Bearer Token from the "Keys and tokens" tab

### 3. Add Bearer Token

Edit `reply_guy.py` and add your Bearer Token:

```python
TWITTER_CONFIG = {
    'api_key': '2U2KZG8ljE1wLXCySzhBswCyO',
    'api_secret': 'nAAE...',
    'access_token': '1761047014723268608-zen0...',
    'access_token_secret': 'Ktse...',
    'bearer_token': 'YOUR_BEARER_TOKEN_HERE'  # Add this line
}
```

### 4. Install Dependencies

```bash
cd /Users/johnd/Projects/alex-content-dashboard/scripts
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 5. Test Authentication

```bash
python test_twitter_auth.py
```

Should show:
- ✅ Authentication successful!
- ✅ Search successful! Found X tweets

### 6. Run Production Script

```bash
# Dry run first (shows what it would do)
python reply_guy.py

# Go live (actually posts replies)
python reply_guy.py --live
```

## 📊 Monitoring

### Logs
- Console output shows real-time activity
- `reply_guy.log` contains detailed logs
- Database tracks all replies with timestamps

### Database
```bash
sqlite3 reply_guy.db
.tables
SELECT * FROM replies ORDER BY timestamp DESC LIMIT 10;
```

### Rate Limiting
The script automatically:
- Tracks replies per hour
- Stops at 5 replies/hour limit
- Resets counter each hour
- Logs rate limit status

## 🎯 Reply Examples

**Template 1** (with real brand data):
```
"Just checked — Nike is running 47 active Facebook ads right now. You can see them all (with spend data) on @GetHookdAI."
```

**Template 2** (general helpful):
```
"You can spy on competitor ads through Facebook's Ad Library or dedicated tools. You can see all their active ads on @GetHookdAI — they track 70M+ creatives across 110K brands."
```

**Template 3** (specific insights):
```
"I track this stuff daily. Shopify launched 12 new ads this month. Full creative library is on @GetHookdAI if you want to study them."
```

## 🔧 Configuration

### Keywords
Edit `SEARCH_KEYWORDS` in `reply_guy.py`:
```python
SEARCH_KEYWORDS = [
    "facebook ads", "ad spy tool", "competitor ads",
    # Add more keywords...
]
```

### Reply Templates
Edit `REPLY_TEMPLATES` for different messaging:
```python
REPLY_TEMPLATES = [
    "Your custom template with @GetHookdAI mention...",
    # Add more templates...
]
```

### Rate Limits
```python
MAX_REPLIES_PER_HOUR = 5  # Adjust as needed
MIN_FOLLOWER_COUNT = 1000  # Minimum followers to reply to
MAX_TWEET_AGE_HOURS = 6  # Only reply to recent tweets
```

## 🚦 Safety Features

- **Dry run mode** by default (use `--live` to post)
- **Rate limiting** prevents spam detection
- **Duplicate prevention** via SQLite tracking
- **Quality filters** (follower count, tweet age)
- **Comprehensive logging** for monitoring

## 🔄 Automation

To run automatically every hour:

```bash
# Add to crontab
0 * * * * cd /Users/johnd/Projects/alex-content-dashboard/scripts && source venv/bin/activate && python reply_guy.py --live >> cron.log 2>&1
```

## ⚠️ Important Notes

1. **Start with dry run** - always test before going live
2. **Monitor engagement** - adjust templates based on response
3. **Respect rate limits** - Twitter will suspend accounts that spam
4. **Quality over quantity** - better to post fewer, more helpful replies
5. **Regular monitoring** - check logs and database regularly

## 🆘 Troubleshooting

**Authentication errors**:
```bash
python test_twitter_auth.py
```

**No tweets found**:
- Check if keywords are too specific
- Verify time range (only searches recent tweets)
- Check if Twitter API quota is exhausted

**Rate limit errors**:
- Script automatically handles Twitter rate limits
- If persistent, increase delays between requests

**Database errors**:
- Check file permissions on `reply_guy.db`
- Ensure SQLite is available

## 📈 Next Steps

1. **Test thoroughly** with dry runs
2. **Start with 1-2 keywords** to test engagement
3. **Monitor reply quality** and adjust templates
4. **Scale up gradually** as you see positive responses
5. **Track metrics** (replies, engagement, followers gained)

---

**Ready to go live? Run the demo first, then get Essential access! 🚀**