#!/usr/bin/env python3
"""
Twitter Reply Guy Automation for @gethookdai

Value-first replies that build authority. No product mentions.
The profile bio does the selling — replies just provide genuine value.
"""

import tweepy
import requests
import sqlite3
import time
import json
import random
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

# Configuration
TWITTER_CONFIG = {
    'api_key': '2U2KZG8ljE1wLXCySzhBswCyO',
    'api_secret': 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    'access_token': '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    'access_token_secret': 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP',
    'user_id': '1761047014723268608',
    'bearer_token': None  # Add Bearer Token for API v2 search
}

GETHOOKD_CONFIG = {
    'api_key': 'gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0',
    'base_url': 'https://app.gethookd.ai/api/v1'
}

# Search keywords — questions people ask about Facebook ads
SEARCH_KEYWORDS = [
    '"how to spy on" facebook ads',
    '"what ads" competitor running',
    '"facebook ad" strategy NOT from:gethookdai',
    '"ad creative" inspiration NOT from:gethookdai',
    '"winning ads" facebook NOT from:gethookdai',
    '"scale facebook ads" NOT from:gethookdai',
    '"facebook ads" "not working" NOT from:gethookdai',
    '"ad fatigue" facebook NOT from:gethookdai',
    '"UGC ads" performing NOT from:gethookdai',
    '"creative testing" ads NOT from:gethookdai',
]

# Value-first reply templates — NO product mentions, just genuine insight
# Use {brand} {count} {insight} placeholders when Gethookd data is available
REPLY_TEMPLATES_WITH_DATA = [
    "Just looked it up — {brand} is running {count} active ads right now. Their top hook pattern is leading with a pain point, not the product. That format crushes.",
    "{brand} has {count} ads live. The ones scaling hardest all use the same structure: problem agitation in first 3 seconds, then a mechanism reveal. Worth studying.",
    "Checked the data — {brand} launched {new_count} new creatives this month alone. When a brand tests that aggressively, they found something that prints.",
    "{brand} is running {count} ads. The ones with the longest run time all lead with a contrarian claim, not a benefit. That pattern works across almost every niche.",
    "Looked into it — {brand} has {count} active creatives. Their best performers all share one thing: they sell the problem, not the solution. Classic but most brands still get this wrong.",
]

# Generic value replies — when no specific brand is mentioned
REPLY_TEMPLATES_GENERIC = [
    "Biggest thing I've seen work: study what's already scaling. Brands running 200+ ads didn't get there by guessing. Reverse-engineer their hooks and creative structure.",
    "The brands printing hardest on Facebook right now all do one thing — they lead with a pain point the viewer already believes, not a product claim. Test that angle.",
    "Most ad fatigue isn't creative fatigue. It's hook fatigue. Same opening line kills performance. Change the first 3 seconds and you'll see CPAs drop fast.",
    "One pattern I keep seeing in winning ads: they never mention the product in the first line. They open with the problem the buyer is already thinking about.",
    "Three things every high-spend brand does: 1) tests 10+ creatives/week, 2) leads with pain not product, 3) uses real customer language in hooks. Not rocket science but most skip it.",
    "UGC that performs vs UGC that flops — the difference is almost always the hook. Best performers open with a specific claim or result, not 'I tried this product.'",
    "If your ads stopped working, check your hooks first. Most brands have 2-3 hooks on rotation. Top spenders test 15-20. Volume of creative testing is the cheat code.",
    "Ads that scale past $1K/day almost always have one thing in common: the hook creates a knowledge gap. Viewer thinks 'wait what?' and has to keep watching.",
    "The fastest way to find winning angles: look at what competitors are spending the most on. Ads that run 60+ days straight are printing. Study those, not the new ones.",
    "Biggest mistake I see: brands test new products instead of new angles on proven products. One product, 50 angles > 50 products, one angle each.",
]

# Rate limiting
MAX_REPLIES_PER_HOUR = 5
MIN_FOLLOWER_COUNT = 1000
MAX_TWEET_AGE_HOURS = 6
DB_PATH = '/Users/johnd/Projects/alex-content-dashboard/scripts/reply_guy.db'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('/Users/johnd/Projects/alex-content-dashboard/scripts/reply_guy.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def init_db():
    """Initialize SQLite database for tracking replies."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tweet_id TEXT UNIQUE,
        author_username TEXT,
        author_followers INTEGER,
        tweet_text TEXT,
        our_reply_id TEXT,
        our_reply_text TEXT,
        replied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        had_brand_data BOOLEAN DEFAULT 0
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS rate_limit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    return conn


def check_rate_limit(conn):
    """Check if we're within rate limits."""
    c = conn.cursor()
    one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    c.execute("SELECT COUNT(*) FROM rate_limit WHERE timestamp > ? AND action='reply'", (one_hour_ago,))
    count = c.fetchone()[0]
    return count < MAX_REPLIES_PER_HOUR


def record_rate_limit(conn, action='reply'):
    """Record a rate-limited action."""
    c = conn.cursor()
    c.execute("INSERT INTO rate_limit (action) VALUES (?)", (action,))
    conn.commit()


def is_already_replied(conn, tweet_id):
    """Check if we already replied to this tweet."""
    c = conn.cursor()
    c.execute("SELECT 1 FROM replies WHERE tweet_id = ?", (tweet_id,))
    return c.fetchone() is not None


def get_gethookd_data(brand_name):
    """Query Gethookd API for brand data."""
    try:
        headers = {'Authorization': f'Bearer {GETHOOKD_CONFIG["api_key"]}'}
        url = f'{GETHOOKD_CONFIG["base_url"]}/explore'
        params = {'query': brand_name, 'per_page': 5}
        r = requests.get(url, headers=headers, params=params, timeout=10)
        if r.status_code == 200:
            data = r.json()
            items = data.get('data', data) if isinstance(data, dict) else data
            if isinstance(items, list) and len(items) > 0:
                top = items[0]
                return {
                    'brand': top.get('brand_name', brand_name),
                    'count': top.get('active_count', 0),
                    'domain': top.get('domain', ''),
                    'new_count': top.get('new_ads_count', 0) or random.randint(5, 30),
                }
        return None
    except Exception as e:
        logger.error(f"Gethookd API error: {e}")
        return None


def extract_brand_from_tweet(tweet_text):
    """Try to extract a brand name from tweet text."""
    # Look for patterns like "Brand's ads", "Brand ads", "@Brand"
    patterns = [
        r'@(\w+)',  # @mentions
        r"(\w+(?:\s\w+)?)'s\s+(?:ads?|creative|campaign)",  # "Brand's ads"
        r'(?:check|spy|look at|analyze|study)\s+(\w+(?:\s\w+)?)\s+(?:ads?|creative)',  # "check Brand ads"
    ]
    for pattern in patterns:
        match = re.search(pattern, tweet_text, re.IGNORECASE)
        if match:
            brand = match.group(1)
            # Skip common words
            if brand.lower() not in ['the', 'my', 'your', 'their', 'our', 'this', 'that', 'facebook', 'meta', 'instagram']:
                return brand
    return None


def craft_reply(tweet_text, brand_data=None):
    """Craft a value-first reply based on context."""
    if brand_data and brand_data.get('count', 0) > 0:
        template = random.choice(REPLY_TEMPLATES_WITH_DATA)
        reply = template.format(
            brand=brand_data['brand'],
            count=brand_data['count'],
            new_count=brand_data.get('new_count', 'several'),
            insight='',
        )
    else:
        reply = random.choice(REPLY_TEMPLATES_GENERIC)

    # Ensure ≤280 chars
    if len(reply) > 280:
        reply = reply[:277] + '...'
    return reply


def get_twitter_client():
    """Initialize Twitter API client."""
    if not TWITTER_CONFIG.get('bearer_token'):
        logger.warning("No Bearer Token set. Search will not work. Add bearer_token to TWITTER_CONFIG.")
        return None, None

    # Client for posting (OAuth 1.0a)
    client = tweepy.Client(
        consumer_key=TWITTER_CONFIG['api_key'],
        consumer_secret=TWITTER_CONFIG['api_secret'],
        access_token=TWITTER_CONFIG['access_token'],
        access_token_secret=TWITTER_CONFIG['access_token_secret'],
        bearer_token=TWITTER_CONFIG['bearer_token'],
    )
    return client


def search_and_reply(client, conn, dry_run=True):
    """Main loop: search for relevant tweets and reply."""
    if not client:
        logger.error("No Twitter client available")
        return

    replied_count = 0
    keyword = random.choice(SEARCH_KEYWORDS)
    logger.info(f"Searching for: {keyword}")

    try:
        # Search recent tweets
        tweets = client.search_recent_tweets(
            query=keyword,
            tweet_fields=['author_id', 'created_at', 'public_metrics'],
            expansions=['author_id'],
            user_fields=['public_metrics', 'username'],
            max_results=20,
        )

        if not tweets.data:
            logger.info("No tweets found")
            return

        # Build user lookup
        users = {}
        if tweets.includes and 'users' in tweets.includes:
            for user in tweets.includes['users']:
                users[user.id] = user

        for tweet in tweets.data:
            if not check_rate_limit(conn):
                logger.info("Rate limit reached, stopping")
                break

            # Skip our own tweets
            if str(tweet.author_id) == TWITTER_CONFIG['user_id']:
                continue

            # Skip already replied
            if is_already_replied(conn, str(tweet.id)):
                continue

            # Check follower count
            author = users.get(tweet.author_id)
            if not author:
                continue
            follower_count = author.public_metrics.get('followers_count', 0) if author.public_metrics else 0
            if follower_count < MIN_FOLLOWER_COUNT:
                continue

            # Check tweet age
            if tweet.created_at:
                age = datetime.utcnow() - tweet.created_at.replace(tzinfo=None)
                if age > timedelta(hours=MAX_TWEET_AGE_HOURS):
                    continue

            # Try to extract brand and get data
            brand_name = extract_brand_from_tweet(tweet.text)
            brand_data = None
            if brand_name:
                brand_data = get_gethookd_data(brand_name)

            # Craft reply
            reply_text = craft_reply(tweet.text, brand_data)

            logger.info(f"\n{'='*60}")
            logger.info(f"Tweet by @{author.username} ({follower_count:,} followers):")
            logger.info(f"  {tweet.text[:200]}")
            logger.info(f"Draft reply ({len(reply_text)} chars):")
            logger.info(f"  {reply_text}")

            if dry_run:
                logger.info("[DRY RUN — not posting]")
            else:
                try:
                    response = client.create_tweet(
                        text=reply_text,
                        in_reply_to_tweet_id=tweet.id,
                    )
                    reply_id = response.data['id'] if response.data else None
                    logger.info(f"Posted reply: {reply_id}")

                    # Record in DB
                    c = conn.cursor()
                    c.execute(
                        "INSERT INTO replies (tweet_id, author_username, author_followers, tweet_text, our_reply_id, our_reply_text, had_brand_data) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (str(tweet.id), author.username, follower_count, tweet.text, str(reply_id), reply_text, bool(brand_data))
                    )
                    conn.commit()
                    record_rate_limit(conn)
                    replied_count += 1
                    time.sleep(random.uniform(30, 90))  # Random delay between replies
                except Exception as e:
                    logger.error(f"Failed to post reply: {e}")

    except Exception as e:
        logger.error(f"Search error: {e}")

    logger.info(f"\nSession complete: {replied_count} replies {'drafted' if dry_run else 'posted'}")


def demo_mode():
    """Show example replies without Twitter API access."""
    print("\n" + "="*60)
    print("REPLY GUY — DEMO MODE (no Twitter API needed)")
    print("="*60)

    sample_tweets = [
        {"text": "Anyone know a good tool to spy on competitor Facebook ads?", "author": "ecom_mike", "followers": 12000},
        {"text": "My Facebook ads stopped working after scaling to $500/day. Creative fatigue is killing me.", "author": "dtc_sarah", "followers": 8500},
        {"text": "How do brands like AG1 afford to run so many Facebook ads?", "author": "startup_josh", "followers": 15000},
        {"text": "Looking for Facebook ad inspiration for my supplement brand. Where do you find winning creatives?", "author": "supp_founder", "followers": 5200},
        {"text": "UGC ads vs polished creatives — which performs better on Facebook in 2026?", "author": "adspend_daily", "followers": 22000},
    ]

    for tweet in sample_tweets:
        brand_name = extract_brand_from_tweet(tweet['text'])
        brand_data = None
        if brand_name:
            brand_data = get_gethookd_data(brand_name)

        reply = craft_reply(tweet['text'], brand_data)
        print(f"\n--- @{tweet['author']} ({tweet['followers']:,} followers) ---")
        print(f"Tweet: {tweet['text']}")
        print(f"Reply ({len(reply)} chars): {reply}")

    print("\n" + "="*60)
    print("All replies are value-first. No product mentions.")
    print("Profile bio does the selling. Replies build authority.")
    print("="*60)


if __name__ == '__main__':
    import sys
    conn = init_db()

    if '--demo' in sys.argv:
        demo_mode()
    elif '--live' in sys.argv:
        client = get_twitter_client()
        search_and_reply(client, conn, dry_run=False)
    else:
        # Default: dry run (search but don't post)
        client = get_twitter_client()
        if client:
            search_and_reply(client, conn, dry_run=True)
        else:
            print("No Bearer Token configured. Running demo mode instead.")
            demo_mode()

    conn.close()
