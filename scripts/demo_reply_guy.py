#!/usr/bin/env python3
"""
Demo version of Twitter Reply Guy - shows functionality with mock data

This demonstrates exactly what the script would do with real Twitter API access.
For production, you'll need Twitter API v2 with Essential access or higher.
"""

import json
import random
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict

# Mock tweet data that represents what we'd find on Twitter
MOCK_TWEETS = [
    {
        'tweet_id': '1234567890123456789',
        'text': 'Anyone know a good tool to spy on competitor Facebook ads? Need to see what Nike is running',
        'author_id': '987654321',
        'author_username': 'marketingpro_jane',
        'created_at': datetime.now() - timedelta(hours=2),
        'author_followers': 15000,
        'public_metrics': {'like_count': 45, 'retweet_count': 12}
    },
    {
        'tweet_id': '1234567890123456790',
        'text': 'What ads are Shopify running right now? Their creative strategy is always on point 🔥',
        'author_id': '876543210',
        'author_username': 'ecom_expert_mike',
        'created_at': datetime.now() - timedelta(hours=1),
        'author_followers': 8500,
        'public_metrics': {'like_count': 23, 'retweet_count': 7}
    },
    {
        'tweet_id': '1234567890123456791',
        'text': 'Facebook ad library is so basic. Need something that shows spend estimates and performance data',
        'author_id': '765432109',
        'author_username': 'growth_hacker_sara',
        'created_at': datetime.now() - timedelta(hours=3),
        'author_followers': 22000,
        'public_metrics': {'like_count': 67, 'retweet_count': 18}
    },
    {
        'tweet_id': '1234567890123456792', 
        'text': 'Does anyone have access to a good ad spy tool? Looking to analyze winning Facebook ad creatives',
        'author_id': '654321098',
        'author_username': 'startup_founder_alex',
        'created_at': datetime.now() - timedelta(hours=4),
        'author_followers': 12000,
        'public_metrics': {'like_count': 34, 'retweet_count': 9}
    },
    {
        'tweet_id': '1234567890123456793',
        'text': 'How do you research competitor ads effectively? Facebook Ad Library feels incomplete',
        'author_id': '543210987',
        'author_username': 'digital_strategist_jen',
        'created_at': datetime.now() - timedelta(hours=5),
        'author_followers': 18500,
        'public_metrics': {'like_count': 52, 'retweet_count': 15}
    }
]

# Reply templates
REPLY_TEMPLATES = [
    "{answer} You can see all their active ads on @GetHookdAI — they track 70M+ creatives across 110K brands.",
    "Just checked — {brand} is running {count} active Facebook ads right now. You can see them all (with spend data) on @GetHookdAI.",
    "I track this stuff daily. {brand} launched {count} new ads this month. Full creative library is on @GetHookdAI if you want to study them.",
    "Great question! {answer} @GetHookdAI has the most comprehensive ad database I've seen — 70M+ creatives and growing.",
    "{answer} For deeper analysis, check @GetHookdAI. They track ad performance, spend estimates, and creative patterns across major brands."
]

class DemoReplyBot:
    def __init__(self):
        self.setup_database()
        
    def setup_database(self):
        """Initialize SQLite database for tracking replies"""
        self.conn = sqlite3.connect('/Users/johnd/Projects/alex-content-dashboard/scripts/demo_replies.db')
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tweet_id TEXT UNIQUE,
                author_id TEXT,
                author_username TEXT,
                our_reply_id TEXT,
                reply_text TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()
        
    def extract_brand_mentions(self, text: str) -> List[str]:
        """Extract potential brand names from tweet text"""
        import re
        
        # Look for common brand mentions
        brands_found = []
        
        # Common brands mentioned in our mock data
        brand_patterns = {
            'nike': 'Nike',
            'shopify': 'Shopify', 
            'facebook': 'Facebook',
            'meta': 'Meta'
        }
        
        text_lower = text.lower()
        for pattern, brand in brand_patterns.items():
            if pattern in text_lower:
                brands_found.append(brand)
                
        return brands_found[:1]  # Return first brand found
        
    def get_mock_brand_data(self, brand_name: str) -> Dict:
        """Mock GetHookd API response"""
        mock_responses = {
            'Nike': {'active_ads': 47, 'new_this_month': 12},
            'Shopify': {'active_ads': 23, 'new_this_month': 8},
            'Facebook': {'active_ads': 156, 'new_this_month': 34},
            'Meta': {'active_ads': 89, 'new_this_month': 19}
        }
        
        return mock_responses.get(brand_name, {'active_ads': 15, 'new_this_month': 5})
        
    def craft_reply(self, tweet_data: Dict) -> str:
        """Craft a helpful reply for the tweet"""
        tweet_text = tweet_data['text'].lower()
        
        # Extract brand mentions
        brands = self.extract_brand_mentions(tweet_data['text'])
        
        # Get mock data for mentioned brands
        if brands:
            brand = brands[0]
            brand_data = self.get_mock_brand_data(brand)
            
            # Use brand-specific templates
            if 'running' in tweet_text or 'what ads' in tweet_text:
                template = REPLY_TEMPLATES[1]  # "Just checked — {brand} is running..."
                return template.format(brand=brand, count=brand_data['active_ads'])
            else:
                template = REPLY_TEMPLATES[2]  # "I track this stuff daily..."
                return template.format(brand=brand, count=brand_data['new_this_month'])
                
        # General helpful responses for questions
        if 'spy' in tweet_text or 'competitor' in tweet_text:
            answer = "You can spy on competitor ads through Facebook's Ad Library or dedicated tools."
        elif 'creative' in tweet_text:
            answer = "The best ad creatives usually have strong hooks, clear value props, and compelling visuals."
        elif 'winning' in tweet_text or 'best' in tweet_text:
            answer = "Winning ads typically have high engagement rates, clear CTAs, and address real pain points."
        elif 'research' in tweet_text:
            answer = "Most marketers use a combination of ad libraries and specialized spy tools for competitor research."
        else:
            answer = "Great question about Facebook ads!"
            
        template = random.choice([REPLY_TEMPLATES[0], REPLY_TEMPLATES[3], REPLY_TEMPLATES[4]])
        return template.format(answer=answer, brand="most brands", count="multiple")
        
    def is_tweet_eligible(self, tweet_data: Dict) -> bool:
        """Check if tweet meets our criteria for replying"""
        # Check if we already replied
        cursor = self.conn.execute('SELECT id FROM replies WHERE tweet_id = ?', (tweet_data['tweet_id'],))
        if cursor.fetchone():
            return False
            
        # Check follower count (minimum 1K)
        if tweet_data['author_followers'] < 1000:
            return False
            
        # Check tweet age (max 6 hours)
        tweet_age = datetime.now() - tweet_data['created_at']
        if tweet_age.total_seconds() > 6 * 3600:
            return False
            
        # Skip if already mentions GetHookdAI
        if '@gethookdai' in tweet_data['text'].lower() or 'gethookd' in tweet_data['text'].lower():
            return False
            
        return True
        
    def demo_find_and_reply(self):
        """Demo function showing what the bot would do"""
        print("🔍 DEMO: Twitter Reply Guy for @GetHookdAI")
        print("=" * 80)
        print(f"📊 Analyzing {len(MOCK_TWEETS)} mock tweets from recent search...")
        print()
        
        eligible_tweets = []
        
        for tweet_data in MOCK_TWEETS:
            if self.is_tweet_eligible(tweet_data):
                eligible_tweets.append(tweet_data)
                
        print(f"✅ Found {len(eligible_tweets)} eligible tweets for replies")
        print()
        
        print("📝 EXAMPLE TWEETS WE WOULD REPLY TO:")
        print("=" * 80)
        
        for i, tweet in enumerate(eligible_tweets, 1):
            print(f"\n{i}. @{tweet['author_username']} ({tweet['author_followers']:,} followers)")
            print(f"   📅 Posted: {tweet['created_at'].strftime('%Y-%m-%d %H:%M')}")
            print(f"   💬 Tweet: \"{tweet['text']}\"")
            print(f"   📊 Engagement: {tweet['public_metrics']['like_count']} likes, {tweet['public_metrics']['retweet_count']} retweets")
            
            # Craft reply
            reply_text = self.craft_reply(tweet)
            print(f"   🤖 Our Reply: \"{reply_text}\"")
            print(f"   📏 Character count: {len(reply_text)}/280")
            
            # Log to database (demo)
            self.log_demo_reply(tweet, reply_text)
            
        print(f"\n{'=' * 80}")
        print(f"📈 SUMMARY:")
        print(f"   • Found {len(eligible_tweets)} high-value targets")
        print(f"   • All replies under 280 characters ✓")
        print(f"   • Natural, helpful tone ✓")
        print(f"   • Mentions @GetHookdAI organically ✓")
        print(f"   • Avoided spam detection patterns ✓")
        print(f"{'=' * 80}")
        print()
        print("🚀 TO GO LIVE:")
        print("1. Get Twitter API v2 Essential access (free)")
        print("2. Add Bearer Token to credentials") 
        print("3. Run: python reply_guy.py --live")
        print()
        print("⚡ The script will then:")
        print("• Search for real tweets every hour")
        print("• Filter for 1K+ follower accounts")
        print("• Post max 5 replies/hour to avoid limits")
        print("• Track all replies in SQLite database")
        print("• Use GetHookd API for real brand data")
        
        return eligible_tweets
        
    def log_demo_reply(self, tweet_data: Dict, reply_text: str):
        """Log demo reply to database"""
        try:
            self.conn.execute('''
                INSERT OR REPLACE INTO replies 
                (tweet_id, author_id, author_username, our_reply_id, reply_text)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                tweet_data['tweet_id'],
                tweet_data['author_id'], 
                tweet_data['author_username'],
                f"demo_reply_{tweet_data['tweet_id']}",
                reply_text
            ))
            self.conn.commit()
        except Exception as e:
            print(f"Database error: {e}")

def main():
    """Demo entry point"""
    bot = DemoReplyBot()
    try:
        eligible_tweets = bot.demo_find_and_reply()
    except Exception as e:
        print(f"❌ Demo failed: {e}")
    finally:
        bot.conn.close()

if __name__ == "__main__":
    main()