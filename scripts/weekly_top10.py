#!/usr/bin/env python3
"""
Weekly Top 10 Fastest Growing Supplement Brands data drop system
Queries Gethookd API, generates Twitter post, uploads to content dashboard
"""

import requests
import json
from datetime import datetime, timezone
from collections import defaultdict
import sys

# API Configuration
GETHOOKD_BASE_URL = "https://app.gethookd.ai/api/v1"
GETHOOKD_TOKEN = "gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0"

CONTENT_DASHBOARD_BASE_URL = "https://web-production-c72a.up.railway.app"

# Supplement search terms
SEARCH_TERMS = [
    "supplements",
    "vitamins",
    "protein",
    "collagen",
    "probiotics",
    "creatine",
    "omega",
    "multivitamin",
    "nutrition",
    "skincare"
]

def get_brands_for_term(term, max_pages=3):
    """Query Gethookd API for a specific search term"""
    brands = {}
    headers = {"Authorization": f"Bearer {GETHOOKD_TOKEN}"}
    
    for page in range(1, max_pages + 1):
        try:
            url = f"{GETHOOKD_BASE_URL}/explore"
            params = {
                "query": term,
                "per_page": 50,
                "page": page
            }
            
            print(f"Querying {term}, page {page}...")
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            for item in data.get("data", []):
                brand = item.get("brand", {})
                brand_name = brand.get("name")
                active_count = brand.get("active_ads", 0)
                domain = brand.get("domain")
                
                if brand_name and active_count > 0:
                    # Use domain as key if available, otherwise brand name
                    key = domain if domain else brand_name.lower()
                    
                    # Keep the brand with highest active count if duplicate
                    if key not in brands or brands[key]["active_count"] < active_count:
                        brands[key] = {
                            "brand_name": brand_name,
                            "active_count": active_count,
                            "domain": domain
                        }
            
        except Exception as e:
            print(f"Error querying {term} page {page}: {e}")
            continue
    
    return brands

def aggregate_all_brands():
    """Query all search terms and aggregate brand data"""
    print("Starting brand data aggregation...")
    all_brands = {}
    
    for term in SEARCH_TERMS:
        term_brands = get_brands_for_term(term)
        
        for key, brand_data in term_brands.items():
            if key not in all_brands or all_brands[key]["active_count"] < brand_data["active_count"]:
                all_brands[key] = brand_data
    
    # Convert to list and sort by active count
    brand_list = list(all_brands.values())
    brand_list.sort(key=lambda x: x["active_count"], reverse=True)
    
    print(f"Found {len(brand_list)} unique brands")
    return brand_list

def generate_tweet_text(brands, max_brands=5):
    """Generate tweet text within 280 character limit"""
    
    # Try with top 5 first
    brand_list = []
    for i, brand in enumerate(brands[:max_brands]):
        brand_list.append(f"{brand['brand_name']} ({brand['active_count']} ads)")
    
    brands_text = ", ".join(brand_list)
    required_text = "I use @GetHookdAI to spy on 70M+ winning ads."
    
    tweet = f"Brands scaling the hardest on Facebook this week: {brands_text}... {required_text}"
    
    # If too long, try shorter format
    if len(tweet) > 280:
        # Try just top 3
        brand_list = []
        for i, brand in enumerate(brands[:3]):
            brand_list.append(f"{brand['brand_name']} ({brand['active_count']})")
        
        brands_text = ", ".join(brand_list)
        tweet = f"Top supplement brands by ad volume: {brands_text}. {required_text}"
    
    # If still too long, try even shorter
    if len(tweet) > 280:
        brand_list = []
        for i, brand in enumerate(brands[:3]):
            brand_list.append(f"{brand['brand_name']} ({brand['active_count']})")
        
        brands_text = ", ".join(brand_list)
        tweet = f"Scaling hard: {brands_text}. {required_text}"
    
    return tweet

def create_content_post(tweet_text):
    """Create post in content dashboard"""
    url = f"{CONTENT_DASHBOARD_BASE_URL}/api/content"
    
    post_data = {
        "content": tweet_text,
        "platform": "twitter",
        "status": "approved",
        "metadata": {
            "source": "weekly_top10_automation",
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    }
    
    try:
        response = requests.post(url, json=post_data)
        response.raise_for_status()
        
        result = response.json()
        post_id = result.get("id")
        
        print(f"Created post with ID: {post_id}")
        return post_id
        
    except Exception as e:
        print(f"Error creating post: {e}")
        return None

def schedule_post(post_id):
    """Schedule post for Monday March 17, 2025 at 21:00 UTC (5 PM EST)"""
    if not post_id:
        return False
    
    # Monday March 17, 2025 at 21:00 UTC
    schedule_datetime = datetime(2025, 3, 17, 21, 0, 0, tzinfo=timezone.utc)
    
    url = f"{CONTENT_DASHBOARD_BASE_URL}/api/content/{post_id}/schedule"
    
    schedule_data = {
        "scheduledAt": schedule_datetime.isoformat()
    }
    
    try:
        response = requests.post(url, json=schedule_data)
        response.raise_for_status()
        
        print(f"Scheduled post {post_id} for {schedule_datetime.isoformat()}")
        return True
        
    except Exception as e:
        print(f"Error scheduling post: {e}")
        return False

def main():
    """Main execution function"""
    print("🚀 Weekly Top 10 Supplement Brands Generator")
    print("=" * 50)
    
    # Step 1: Aggregate brand data
    brands = aggregate_all_brands()
    
    if not brands:
        print("❌ No brands found!")
        return 1
    
    # Show top 10 brands found
    print("\n📊 Top 10 brands by active ad count:")
    for i, brand in enumerate(brands[:10]):
        print(f"{i+1}. {brand['brand_name']}: {brand['active_count']} ads")
    
    # Step 2: Generate tweet text
    tweet_text = generate_tweet_text(brands)
    
    print(f"\n📝 Generated tweet ({len(tweet_text)} chars):")
    print(f"'{tweet_text}'")
    
    if len(tweet_text) > 280:
        print("⚠️  WARNING: Tweet exceeds 280 characters!")
        return 1
    
    # Step 3: Create post in content dashboard
    post_id = create_content_post(tweet_text)
    
    if not post_id:
        print("❌ Failed to create post!")
        return 1
    
    # Step 4: Schedule the post
    if schedule_post(post_id):
        print("✅ Successfully created and scheduled post!")
        print(f"📅 Will post on Monday March 17, 2025 at 5 PM EST")
    else:
        print("❌ Failed to schedule post!")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())