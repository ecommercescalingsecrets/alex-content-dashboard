#!/usr/bin/env python3
"""
Test Twitter API access levels and available endpoints
"""

import tweepy

# Twitter API Configuration  
TWITTER_CONFIG = {
    'api_key': '2U2KZG8ljE1wLXCySzhBswCyO',
    'api_secret': 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    'access_token': '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    'access_token_secret': 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP',
}

USER_ID = '1761047014723268608'  # @gethookdai

def test_endpoints():
    """Test various Twitter API endpoints to determine access level"""
    
    client = tweepy.Client(
        consumer_key=TWITTER_CONFIG['api_key'],
        consumer_secret=TWITTER_CONFIG['api_secret'],
        access_token=TWITTER_CONFIG['access_token'],
        access_token_secret=TWITTER_CONFIG['access_token_secret']
    )
    
    print("🧪 Testing Twitter API Access Levels")
    print("=" * 40)
    
    # Test 1: Basic user info (should work)
    try:
        me = client.get_me()
        print("✅ get_me() - SUCCESS")
        print(f"   User: {me.data.username} (ID: {me.data.id})")
    except Exception as e:
        print(f"❌ get_me() - FAILED: {e}")
    
    # Test 2: Get user by ID
    try:
        user = client.get_user(id=USER_ID)
        print("✅ get_user() - SUCCESS") 
        print(f"   User: {user.data.username}")
    except Exception as e:
        print(f"❌ get_user() - FAILED: {e}")
    
    # Test 3: User tweets (main endpoint we need)
    try:
        tweets = client.get_users_tweets(
            id=USER_ID,
            max_results=5,
            tweet_fields=['public_metrics', 'created_at']
        )
        print("✅ get_users_tweets() - SUCCESS")
        if tweets.data:
            print(f"   Retrieved {len(tweets.data)} tweets")
            for tweet in tweets.data[:2]:
                metrics = tweet.public_metrics
                print(f"   Tweet: {tweet.text[:50]}... (impressions: {metrics.get('impression_count', 'N/A')})")
        else:
            print("   No tweets returned")
    except Exception as e:
        print(f"❌ get_users_tweets() - FAILED: {e}")
    
    # Test 4: Search recent tweets
    try:
        search_tweets = client.search_recent_tweets(
            query="gethookdai -is:retweet",
            max_results=5,
            tweet_fields=['public_metrics', 'created_at', 'author_id']
        )
        print("✅ search_recent_tweets() - SUCCESS")
        if search_tweets.data:
            print(f"   Retrieved {len(search_tweets.data)} tweets from search")
        else:
            print("   No tweets found in search")
    except Exception as e:
        print(f"❌ search_recent_tweets() - FAILED: {e}")
        
    # Test 5: Try specific user search
    try:
        user_search = client.search_recent_tweets(
            query=f"from:gethookdai -is:retweet",
            max_results=5,
            tweet_fields=['public_metrics', 'created_at', 'author_id']
        )
        print("✅ search for user tweets - SUCCESS")
        if user_search.data:
            print(f"   Retrieved {len(user_search.data)} user tweets from search")
            for tweet in user_search.data[:2]:
                metrics = tweet.public_metrics  
                print(f"   Tweet: {tweet.text[:50]}... (impressions: {metrics.get('impression_count', 'N/A')})")
        else:
            print("   No user tweets found in search")
    except Exception as e:
        print(f"❌ search for user tweets - FAILED: {e}")

if __name__ == "__main__":
    test_endpoints()