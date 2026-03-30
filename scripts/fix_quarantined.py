#!/usr/bin/env python3
"""Fix quarantined posts by adding Gethookd share URLs."""
import requests, json, re, time

CONTENT_API = "https://web-production-c72a.up.railway.app/api/content"
GETHOOKD_BASE_URL = "https://app.gethookd.ai/api/v1"
GETHOOKD_TOKEN = "gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0"
HEADERS = {"Authorization": f"Bearer {GETHOOKD_TOKEN}"}

def has_emoji(text):
    emoji_pattern = re.compile(
        "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251"
        "\U0001f926-\U0001f937\U00010000-\U0010ffff"
        "\u2600-\u26FF\u2700-\u27BF\u200d\ufe0f]+", flags=re.UNICODE)
    return emoji_pattern.sub('', text or '')

def find_share_url(brand_name):
    """Find a high-quality ad share URL for the brand."""
    try:
        r = requests.get(f"{GETHOOKD_BASE_URL}/explore", headers=HEADERS,
                        params={"query": brand_name, "per_page": 20}, timeout=15)
        r.raise_for_status()
        data = r.json()
        
        ads = data.get("data", [])
        # Filter: matching brand, prefer high performance
        matching = [a for a in ads if a.get("brand", {}).get("name", "").lower() == brand_name.lower()
                    and a.get("share_url")]
        
        if not matching:
            # Looser match
            matching = [a for a in ads if brand_name.lower() in a.get("brand", {}).get("name", "").lower()
                        and a.get("share_url")]
        
        if not matching and ads:
            # Just use first result with share_url
            matching = [a for a in ads if a.get("share_url")]
        
        if matching:
            # Sort by performance score descending
            matching.sort(key=lambda a: a.get("performance_score") or 0, reverse=True)
            best = matching[0]
            return best["share_url"], best.get("brand", {}).get("active_ads", 0)
    except Exception as e:
        print(f"  API error for {brand_name}: {e}")
    return None, 0

def verify_url(url):
    try:
        r = requests.head(url, timeout=10, allow_redirects=True)
        return r.status_code == 200
    except:
        return False

def main():
    # Get all posts
    r = requests.get(f"{CONTENT_API}?limit=500")
    data = r.json()
    posts = data if isinstance(data, list) else data.get('items', data.get('content', []))
    
    quarantined = [p for p in posts if p.get('scheduledStatus') == 'draft'
                   and 'Printing' in (p.get('title') or '')
                   and 'gethookd.ai/share/ad/' not in (p.get('content') or '')]
    
    print(f"Found {len(quarantined)} quarantined posts to fix")
    
    # Group by brand
    brand_posts = {}
    for p in quarantined:
        brand = (p.get('title') or '').replace(' - Printing', '').strip()
        brand_posts.setdefault(brand, []).append(p)
    
    print(f"Across {len(brand_posts)} unique brands\n")
    
    # Cache share URLs per brand
    brand_urls = {}
    fixed = 0
    skipped = 0
    
    for brand, posts_list in sorted(brand_posts.items()):
        if brand not in brand_urls:
            share_url, active_ads = find_share_url(brand)
            if share_url and verify_url(share_url):
                brand_urls[brand] = share_url
                print(f"OK {brand}: found URL (active_ads={active_ads})")
            else:
                brand_urls[brand] = None
                print(f"SKIP {brand}: no valid share URL found")
            time.sleep(0.3)  # rate limit
        
        url = brand_urls[brand]
        if not url:
            skipped += len(posts_list)
            continue
        
        for p in posts_list:
            content = p.get('content', '')
            
            # Remove emojis
            content = has_emoji(content)  # returns cleaned text
            
            # Remove "See the ad:" or "Found on" prefixes if any
            content = re.sub(r'See the ad:\s*', '', content)
            content = re.sub(r'Found on\s+', '', content)
            
            # Remove any existing broken links
            content = re.sub(r'https?://app\.gethookd\.ai/\S+', '', content)
            
            # Append share URL on its own line
            content = content.rstrip() + "\n\n" + url
            
            # Update post
            update = {
                'content': content,
                'scheduledStatus': 'scheduled'
            }
            
            try:
                resp = requests.put(f"{CONTENT_API}/{p['id']}", json=update)
                if resp.status_code == 200:
                    fixed += 1
                else:
                    print(f"  FAIL update {p['id']}: HTTP {resp.status_code}")
                    skipped += 1
            except Exception as e:
                print(f"  FAIL update {p['id']}: {e}")
                skipped += 1
    
    print(f"\n{'='*50}")
    print(f"FIXED: {fixed}")
    print(f"SKIPPED: {skipped}")
    print(f"{'='*50}")

if __name__ == '__main__':
    main()
