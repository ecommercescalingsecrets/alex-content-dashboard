#!/usr/bin/env python3
"""
Test version of weekly top 10 supplement brands script
"""

import requests
import json
from datetime import datetime, timezone
from collections import defaultdict

# API Configuration  
GETHOOKD_BASE_URL = "https://app.gethookd.ai/api/v1"
GETHOOKD_TOKEN = "gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0"

# Reduced search terms for testing
SEARCH_TERMS = ["supplements", "protein", "vitamins"]

def get_brands_for_term(term, max_pages=2):
    """Query Gethookd API for a specific search term"""
    print(f"🔍 Searching for '{term}'...")
    brands = {}
    headers = {"Authorization": f"Bearer {GETHOOKD_TOKEN}"}
    
    for page in range(1, max_pages + 1):
        try:
            url = f"{GETHOOKD_BASE_URL}/explore"
            params = {
                "query": term,
                "per_page": 20,
                "page": page
            }
            
            print(f"  📄 Page {page}...")
            response = requests.get(url, headers=headers, params=params, timeout=10)
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
            print(f"  ❌ Error on page {page}: {e}")
            continue
    
    print(f"  ✅ Found {len(brands)} unique brands for '{term}'")
    return brands

def aggregate_all_brands():
    """Query all search terms and aggregate brand data"""
    print("🚀 Starting brand data aggregation...")
    all_brands = {}
    
    for term in SEARCH_TERMS:
        term_brands = get_brands_for_term(term)
        
        for key, brand_data in term_brands.items():
            if key not in all_brands or all_brands[key]["active_count"] < brand_data["active_count"]:
                all_brands[key] = brand_data
    
    # Convert to list and sort by active count
    brand_list = list(all_brands.values())
    brand_list.sort(key=lambda x: x["active_count"], reverse=True)
    
    print(f"📊 Total unique brands found: {len(brand_list)}")
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

def main():
    """Main execution function"""
    print("🧪 Testing Weekly Top 10 Supplement Brands Generator")
    print("=" * 60)
    
    # Step 1: Aggregate brand data
    brands = aggregate_all_brands()
    
    if not brands:
        print("❌ No brands found!")
        return 1
    
    # Show top 10 brands found
    print("\n📊 Top 10 brands by active ad count:")
    for i, brand in enumerate(brands[:10]):
        print(f"{i+1:2d}. {brand['brand_name']:<30} {brand['active_count']:>4} ads")
    
    # Step 2: Generate tweet text
    tweet_text = generate_tweet_text(brands)
    
    print(f"\n📝 Generated tweet ({len(tweet_text)} chars):")
    print("=" * 60)
    print(f"'{tweet_text}'")
    print("=" * 60)
    
    if len(tweet_text) > 280:
        print("⚠️  WARNING: Tweet exceeds 280 characters!")
        return 1
    
    print("✅ Tweet is within 280 character limit!")
    print(f"📏 Character count: {len(tweet_text)}/280")
    
    # For testing, just print what would happen next
    print("\n🔄 Next steps would be:")
    print("  1. POST to content dashboard API")
    print("  2. Schedule for Monday March 17, 2026 at 21:00 UTC")
    
    return 0

if __name__ == "__main__":
    exit(main())