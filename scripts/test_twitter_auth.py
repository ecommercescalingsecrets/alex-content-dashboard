#!/usr/bin/env python3
"""
Simple test to verify Twitter API credentials
"""

import tweepy

# Configuration
TWITTER_CONFIG = {
    'api_key': '2U2KZG8ljE1wLXCySzhBswCyO',
    'api_secret': 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    'access_token': '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    'access_token_secret': 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP',
    'bearer_token': None  # We'll need to get this for API v2
}

def test_auth():
    """Test Twitter API authentication"""
    print("Testing Twitter API v2 authentication...")
    
    try:
        # Try with just API keys first
        client = tweepy.Client(
            consumer_key=TWITTER_CONFIG['api_key'],
            consumer_secret=TWITTER_CONFIG['api_secret'],
            access_token=TWITTER_CONFIG['access_token'],
            access_token_secret=TWITTER_CONFIG['access_token_secret']
        )
        
        # Test by getting our own user info
        me = client.get_me()
        print(f"✅ Authentication successful!")
        print(f"Authenticated as: {me.data.username} (ID: {me.data.id})")
        return True
        
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return False

def test_search():
    """Test a simple search"""
    print("\nTesting search functionality...")
    
    try:
        client = tweepy.Client(
            consumer_key=TWITTER_CONFIG['api_key'],
            consumer_secret=TWITTER_CONFIG['api_secret'],
            access_token=TWITTER_CONFIG['access_token'],
            access_token_secret=TWITTER_CONFIG['access_token_secret']
        )
        
        # Try a simple search
        tweets = client.search_recent_tweets(
            query="facebook ads -is:retweet",
            max_results=10,
            tweet_fields=['author_id', 'created_at']
        )
        
        if tweets.data:
            print(f"✅ Search successful! Found {len(tweets.data)} tweets")
            for i, tweet in enumerate(tweets.data[:3], 1):
                print(f"{i}. {tweet.text[:80]}...")
        else:
            print("⚠️ Search returned no results")
            
        return True
        
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return False

if __name__ == "__main__":
    success = test_auth()
    if success:
        test_search()