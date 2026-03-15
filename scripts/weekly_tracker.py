#!/usr/bin/env python3
"""
Weekly Twitter Performance Tracking Script
Pulls weekly Twitter metrics for @gethookdai and saves to CSV

IMPORTANT: Twitter API Access Requirements
==========================================

This script requires Twitter API v2 access with the following capabilities:
- Read user tweets (get_users_tweets endpoint)  
- Tweet fields including public_metrics (impressions, likes, etc.)

CURRENT STATUS: The provided API credentials appear to have LIMITED ACCESS
- Only basic authentication works (get_me)
- User timeline and metrics access returns 401 Unauthorized
- This suggests Free/Basic tier limitations

SOLUTIONS:
1. Upgrade to Twitter API Pro/Enterprise ($100+/month)
2. Apply for Academic Research access (if eligible)
3. Use Twitter Analytics export + manual data entry
4. Use social media management tools with Twitter integration

USAGE:
- python3 weekly_tracker.py              # Pull last week
- python3 weekly_tracker.py --weeks 4    # Backfill last 4 weeks  
- python3 weekly_tracker.py --force      # Create placeholder CSV

The script will create the CSV structure even with limited access,
but you'll need to manually populate metrics from Twitter Analytics.
"""

import tweepy
import csv
import os
import sys
import argparse
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict

# Twitter API Configuration  
TWITTER_CONFIG = {
    'api_key': '2U2KZG8ljE1wLXCySzhBswCyO',
    'api_secret': 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    'access_token': '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    'access_token_secret': 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP',
}

# Target user
USER_ID = '1761047014723268608'  # @gethookdai

# Output file
OUTPUT_CSV = '/Users/johnd/Projects/alex-content-dashboard/data/weekly_metrics.csv'

# CSV columns
CSV_COLUMNS = [
    'week_start', 'week_end', 'tweets_posted', 'total_impressions', 
    'avg_impressions', 'total_likes', 'total_retweets', 'total_bookmarks', 
    'total_replies', 'video_tweets', 'video_avg_imp', 'image_tweets', 
    'image_avg_imp', 'top_tweet_text', 'top_tweet_impressions', 'trials'
]

def get_twitter_client():
    """Initialize Twitter API v2 client"""
    return tweepy.Client(
        consumer_key=TWITTER_CONFIG['api_key'],
        consumer_secret=TWITTER_CONFIG['api_secret'],
        access_token=TWITTER_CONFIG['access_token'],
        access_token_secret=TWITTER_CONFIG['access_token_secret']
    )

def get_week_range(weeks_back=1):
    """Get start and end dates for a week (Monday to Sunday)"""
    today = datetime.now(timezone.utc)
    
    # Calculate the Monday of the current week
    days_since_monday = today.weekday()  # 0=Monday, 6=Sunday
    this_week_monday = today - timedelta(days=days_since_monday)
    
    # Go back the specified number of weeks from this Monday
    target_monday = this_week_monday - timedelta(weeks=weeks_back)
    week_start = target_monday.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Week end is the following Sunday
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    return week_start, week_end

def has_media_type(tweet, media_type):
    """Check if tweet contains specific media type"""
    if not hasattr(tweet, 'attachments') or not tweet.attachments:
        return False
    
    media_keys = tweet.attachments.get('media_keys', [])
    if not media_keys:
        return False
    
    # This is a simplified check - in reality we'd need to fetch media objects
    # to check types, but for basic classification we can use heuristics
    return len(media_keys) > 0

def classify_tweet_media(tweet):
    """Classify tweet media as video, image, or text"""
    # Simplified media classification
    # In a full implementation, you'd fetch media objects to get exact types
    
    if not hasattr(tweet, 'attachments') or not tweet.attachments:
        return 'text'
    
    media_keys = tweet.attachments.get('media_keys', [])
    if media_keys:
        # For now, assume first media key represents the primary media type
        # In practice, you'd need to fetch media objects for accurate classification
        return 'image'  # Default assumption
    
    return 'text'

def fetch_tweets_for_period(client, start_date, end_date, max_results=100):
    """Fetch tweets for a specific time period with retry logic"""
    tweets = []
    
    print(f"Fetching tweets from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    
    try:
        # Try method 1: user tweets endpoint with public metrics
        print("Trying user tweets endpoint...")
        response = client.get_users_tweets(
            id=USER_ID,
            max_results=min(max_results, 100),
            tweet_fields=['public_metrics', 'created_at', 'attachments'],
            start_time=start_date.isoformat(),
            end_time=end_date.isoformat(),
            exclude=['retweets', 'replies']  # Only original tweets
        )
        
        if response.data:
            tweets.extend(response.data)
            print(f"✅ Retrieved {len(response.data)} tweets using user tweets endpoint")
            
            # Handle pagination if there are more tweets
            while len(tweets) < max_results and hasattr(response, 'meta') and 'next_token' in response.meta:
                time.sleep(1)  # Rate limit protection
                
                response = client.get_users_tweets(
                    id=USER_ID,
                    max_results=min(max_results - len(tweets), 100),
                    tweet_fields=['public_metrics', 'created_at', 'attachments'],
                    start_time=start_date.isoformat(),
                    end_time=end_date.isoformat(),
                    exclude=['retweets', 'replies'],
                    pagination_token=response.meta['next_token']
                )
                
                if response.data:
                    tweets.extend(response.data)
                    print(f"Retrieved additional {len(response.data)} tweets (total: {len(tweets)})")
                else:
                    break
        else:
            print("⚠️ No tweets found for this period using user tweets endpoint")
            
    except tweepy.Unauthorized as e:
        print(f"❌ Unauthorized access to user tweets endpoint: {e}")
        print("This might be due to API access level restrictions.")
        print("The Twitter API v2 Basic tier may not support full timeline access with metrics.")
        
        # Try alternative method: search for tweets from this user
        try:
            print("Trying search endpoint as alternative...")
            query = f"from:gethookdai -is:retweet -is:reply"
            
            search_response = client.search_recent_tweets(
                query=query,
                max_results=min(max_results, 100),
                tweet_fields=['public_metrics', 'created_at', 'author_id', 'attachments'],
                start_time=start_date.isoformat(),
                end_time=end_date.isoformat()
            )
            
            if search_response.data:
                # Filter to only tweets from our target user
                user_tweets = [t for t in search_response.data if t.author_id == USER_ID]
                tweets.extend(user_tweets)
                print(f"✅ Retrieved {len(user_tweets)} tweets using search endpoint")
            else:
                print("⚠️ No tweets found using search endpoint")
                
        except Exception as search_error:
            print(f"❌ Search endpoint also failed: {search_error}")
        
    except tweepy.TooManyRequests:
        print("Rate limit hit. Waiting 15 minutes...")
        time.sleep(15 * 60)
        return fetch_tweets_for_period(client, start_date, end_date, max_results)
        
    except Exception as e:
        print(f"❌ Unexpected error fetching tweets: {e}")
        print(f"Error type: {type(e).__name__}")
        
    return tweets

def analyze_weekly_metrics(tweets):
    """Analyze tweets and calculate weekly metrics"""
    if not tweets:
        return {
            'tweets_posted': 0,
            'total_impressions': 0,
            'avg_impressions': 0,
            'total_likes': 0,
            'total_retweets': 0,
            'total_bookmarks': 0,
            'total_replies': 0,
            'video_tweets': 0,
            'video_avg_imp': 0,
            'image_tweets': 0,
            'image_avg_imp': 0,
            'top_tweet_text': '',
            'top_tweet_impressions': 0
        }
    
    # Initialize counters
    total_impressions = 0
    total_likes = 0
    total_retweets = 0
    total_bookmarks = 0
    total_replies = 0
    
    video_tweets = 0
    video_impressions = 0
    image_tweets = 0
    image_impressions = 0
    
    top_tweet = None
    top_impressions = 0
    
    # Analyze each tweet
    for tweet in tweets:
        metrics = tweet.public_metrics
        
        impressions = metrics.get('impression_count', 0)
        likes = metrics.get('like_count', 0)
        retweets = metrics.get('retweet_count', 0)
        bookmarks = metrics.get('bookmark_count', 0)
        replies = metrics.get('reply_count', 0)
        
        # Aggregate totals
        total_impressions += impressions
        total_likes += likes
        total_retweets += retweets
        total_bookmarks += bookmarks
        total_replies += replies
        
        # Track top performing tweet
        if impressions > top_impressions:
            top_impressions = impressions
            top_tweet = tweet
        
        # Classify media type (simplified)
        media_type = classify_tweet_media(tweet)
        
        if media_type == 'video':
            video_tweets += 1
            video_impressions += impressions
        elif media_type == 'image':
            image_tweets += 1
            image_impressions += impressions
    
    # Calculate averages
    avg_impressions = total_impressions / len(tweets) if tweets else 0
    video_avg_imp = video_impressions / video_tweets if video_tweets > 0 else 0
    image_avg_imp = image_impressions / image_tweets if image_tweets > 0 else 0
    
    return {
        'tweets_posted': len(tweets),
        'total_impressions': total_impressions,
        'avg_impressions': round(avg_impressions, 2),
        'total_likes': total_likes,
        'total_retweets': total_retweets,
        'total_bookmarks': total_bookmarks,
        'total_replies': total_replies,
        'video_tweets': video_tweets,
        'video_avg_imp': round(video_avg_imp, 2),
        'image_tweets': image_tweets,
        'image_avg_imp': round(image_avg_imp, 2),
        'top_tweet_text': top_tweet.text[:100] + '...' if top_tweet and len(top_tweet.text) > 100 else (top_tweet.text if top_tweet else ''),
        'top_tweet_impressions': top_impressions
    }

def ensure_data_directory():
    """Ensure data directory exists"""
    data_dir = os.path.dirname(OUTPUT_CSV)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"Created data directory: {data_dir}")

def week_exists_in_csv(week_start):
    """Check if a week already exists in the CSV"""
    if not os.path.exists(OUTPUT_CSV):
        return False
    
    week_start_str = week_start.strftime('%Y-%m-%d')
    
    try:
        with open(OUTPUT_CSV, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if row['week_start'] == week_start_str:
                    return True
    except Exception:
        return False
    
    return False

def save_to_csv(week_data, week_start, week_end):
    """Save weekly metrics to CSV file"""
    ensure_data_directory()
    
    # Check if this week already exists
    if week_exists_in_csv(week_start):
        print(f"⚠️ Week {week_start.strftime('%Y-%m-%d')} already exists in CSV. Skipping to avoid duplicates.")
        return
    
    # Check if file exists to determine if we need headers
    file_exists = os.path.exists(OUTPUT_CSV)
    
    # Prepare row data
    row_data = {
        'week_start': week_start.strftime('%Y-%m-%d'),
        'week_end': week_end.strftime('%Y-%m-%d'),
        'trials': None,  # To be filled manually by Alex
        **week_data
    }
    
    # Write to CSV
    with open(OUTPUT_CSV, 'a', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CSV_COLUMNS)
        
        # Write header if new file
        if not file_exists:
            writer.writeheader()
            
        writer.writerow(row_data)
    
    print(f"✅ Saved weekly metrics to: {OUTPUT_CSV}")

def print_summary(week_data, week_start, week_end):
    """Print summary of weekly metrics"""
    print("\n" + "="*60)
    print(f"WEEKLY TWITTER METRICS SUMMARY")
    print(f"Week: {week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}")
    print("="*60)
    print(f"📊 Tweets Posted: {week_data['tweets_posted']}")
    print(f"👁️  Total Impressions: {week_data['total_impressions']:,}")
    print(f"📈 Avg Impressions/Tweet: {week_data['avg_impressions']:,}")
    print(f"❤️  Total Likes: {week_data['total_likes']}")
    print(f"🔄 Total Retweets: {week_data['total_retweets']}")
    print(f"🔖 Total Bookmarks: {week_data['total_bookmarks']}")
    print(f"💬 Total Replies: {week_data['total_replies']}")
    print(f"🎥 Video Tweets: {week_data['video_tweets']} (avg: {week_data['video_avg_imp']:,} imp)")
    print(f"📷 Image Tweets: {week_data['image_tweets']} (avg: {week_data['image_avg_imp']:,} imp)")
    
    if week_data['top_tweet_text']:
        print(f"\n🏆 Top Tweet ({week_data['top_tweet_impressions']:,} impressions):")
        print(f"   \"{week_data['top_tweet_text']}\"")
    
    print("="*60)

def check_api_access(client):
    """Check what level of API access is available"""
    print("🔍 Checking Twitter API access level...")
    
    try:
        # Test basic authentication
        me = client.get_me()
        print(f"✅ Basic authentication: {me.data.username}")
        
        # Test user tweets access
        try:
            test_tweets = client.get_users_tweets(
                id=USER_ID,
                max_results=5,
                tweet_fields=['public_metrics']
            )
            print("✅ User tweets access: Available")
            return True
        except tweepy.Unauthorized:
            print("❌ User tweets access: Denied (401 Unauthorized)")
            return False
        except Exception as e:
            print(f"❌ User tweets access: Error ({e})")
            return False
            
    except Exception as e:
        print(f"❌ Basic authentication failed: {e}")
        return False

def create_placeholder_data(week_start, week_end):
    """Create placeholder data when API access is limited"""
    return {
        'tweets_posted': 0,
        'total_impressions': 0,
        'avg_impressions': 0,
        'total_likes': 0,
        'total_retweets': 0,
        'total_bookmarks': 0,
        'total_replies': 0,
        'video_tweets': 0,
        'video_avg_imp': 0,
        'image_tweets': 0,
        'image_avg_imp': 0,
        'top_tweet_text': 'API_ACCESS_LIMITED',
        'top_tweet_impressions': 0
    }

def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description='Weekly Twitter Performance Tracker')
    parser.add_argument('--weeks', type=int, default=1, 
                       help='Number of weeks to pull (for backfilling)')
    parser.add_argument('--force', action='store_true',
                       help='Create placeholder rows even with limited API access')
    args = parser.parse_args()
    
    print("🐦 Weekly Twitter Performance Tracker")
    print("=====================================")
    
    # Initialize Twitter client
    try:
        client = get_twitter_client()
        print("✅ Twitter API client initialized")
    except Exception as e:
        print(f"❌ Failed to initialize Twitter client: {e}")
        return 1
    
    # Check API access level
    has_full_access = check_api_access(client)
    
    if not has_full_access and not args.force:
        print("\n" + "="*60)
        print("⚠️  LIMITED API ACCESS DETECTED")
        print("="*60)
        print("The current Twitter API credentials have limited access.")
        print("This is likely due to:")
        print("• Free/Basic tier API access")
        print("• Missing required permissions")
        print("• Need for elevated API access")
        print()
        print("RECOMMENDATIONS:")
        print("1. Upgrade to Twitter API Pro/Enterprise for full metrics access")
        print("2. Use --force flag to create placeholder CSV structure")
        print("3. Manually collect metrics from Twitter Analytics")
        print()
        print("Run with --force to create CSV structure with placeholder data.")
        print("="*60)
        return 1
    
    # Process each week
    for week_num in range(args.weeks, 0, -1):
        print(f"\n📅 Processing week {args.weeks - week_num + 1} of {args.weeks}")
        
        # Get week range  
        week_start, week_end = get_week_range(week_num)
        
        if has_full_access:
            # Fetch real tweets
            tweets = fetch_tweets_for_period(client, week_start, week_end)
            week_data = analyze_weekly_metrics(tweets)
        else:
            # Create placeholder data
            print("⚠️ Creating placeholder data due to limited API access")
            week_data = create_placeholder_data(week_start, week_end)
        
        # Save to CSV
        save_to_csv(week_data, week_start, week_end)
        
        # Print summary
        print_summary(week_data, week_start, week_end)
        
        # Add delay between weeks to respect rate limits
        if week_num > 1:
            print("⏳ Waiting 5 seconds before next week...")
            time.sleep(5)
    
    print(f"\n✅ Completed! Weekly metrics saved to {OUTPUT_CSV}")
    
    if not has_full_access:
        print("\n" + "⚠️" * 20)
        print("📝 IMPORTANT: Placeholder data was created due to limited API access.")
        print("   You'll need to manually populate the metrics from Twitter Analytics.")
        print("   The 'trials' column defaults to null - Alex can fill this manually.")
        print("⚠️" * 20)
    else:
        print("📝 Note: The 'trials' column defaults to null - Alex can fill this manually from his dashboard")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())