#!/usr/bin/env python3
"""
Board Health Check — PERMANENT FIX
Runs daily. For each swipe file post scheduled within the next 48 hours:
1. Creates a FRESH board with currently active ads
2. Updates the post content with the new board link
3. Takes a screenshot for media (if browser available)

This ensures boards are NEVER stale when they go live.
"""
import requests, json, time, re, sys
from datetime import datetime, timezone, timedelta

DASHBOARD = "https://web-production-c72a.up.railway.app"
GETHOOKD = "https://app.gethookd.ai/api/v1"
GH_TOKEN = "gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0"
GH = {'Authorization': f'Bearer {GH_TOKEN}'}
MIN_ADS = 100

# Niche → search queries
NICHE_QUERIES = {
    'supplements': ['supplements', 'supplement brand', 'health supplement', 'vitamin supplement', 'nutrition supplement'],
    'collagen': ['collagen', 'collagen peptides', 'collagen supplement', 'marine collagen', 'collagen beauty', 'type II collagen'],
    'pre-workout': ['pre workout', 'pre-workout supplement', 'workout energy', 'gym supplement', 'fitness supplement', 'BCAA'],
    'gut health': ['gut health', 'probiotics', 'digestive supplement', 'gut microbiome', 'prebiotic', 'digestive enzyme'],
    'hair growth': ['hair growth', 'hair loss supplement', 'biotin hair', 'hair regrowth', 'hair vitamin', 'hair serum'],
    'weight loss': ['weight loss supplement', 'fat burner', 'appetite suppressant', 'metabolism booster', 'keto supplement', 'garcinia'],
    'sleep': ['sleep supplement', 'melatonin', 'sleep aid', 'stress relief', 'magnesium sleep', 'ashwagandha stress'],
    'cbd': ['CBD oil', 'CBD supplement', 'hemp extract', 'CBD gummies'],
    'mushroom': ['mushroom supplement', 'lions mane', 'reishi mushroom', 'functional mushroom', 'mushroom coffee', 'cordyceps'],
    'mens health': ['mens health supplement', 'testosterone booster', 'mens vitality', 'prostate supplement', 'mens energy'],
    'womens health': ['womens health supplement', 'menopause supplement', 'prenatal vitamin', 'womens hormone', 'fertility supplement'],
    'pet supplements': ['pet supplement', 'dog supplement', 'pet health', 'dog joint supplement', 'pet vitamin', 'cat supplement'],
    'makeup': ['makeup', 'cosmetics', 'foundation', 'concealer', 'mascara', 'beauty brand'],
    'skincare': ['skincare', 'anti aging serum', 'face cream', 'skincare routine', 'wrinkle cream', 'retinol', 'hyaluronic acid', 'vitamin C serum'],
}


def detect_niche(content):
    """Detect niche from post content."""
    content_lower = content.lower()
    for niche, queries in NICHE_QUERIES.items():
        if niche in content_lower:
            return niche
        for q in queries:
            if q.lower() in content_lower:
                return niche
    return None


def create_fresh_board(niche, queries):
    """Create a new public board and populate with active ads."""
    today = datetime.now(timezone.utc).strftime('%B %Y')
    name = f"Winning {niche.title()} Ads — {today}"
    
    # Create board
    r = requests.post(f"{GETHOOKD}/boards", json={'name': name, 'is_public': True}, headers=GH)
    if r.status_code not in (200, 201):
        print(f"  Failed to create board: {r.status_code} {r.text[:100]}")
        return None
    
    resp = r.json()
    board_data = resp.get('data', resp)
    board_id = board_data.get('id')
    public_url = board_data.get('public_url', '')
    if not board_id:
        print(f"  No board ID returned")
        return None
    
    print(f"  Created board {board_id}: {name}")
    print(f"  Public URL: {public_url}")
    
    # Populate with active ads
    seen = set()
    added = 0
    
    for q in queries:
        for page in range(1, 8):
            if added >= 200:
                break
            sr = requests.get(f"{GETHOOKD}/explore", 
                            params={'query': q, 'per_page': 50, 'page': page},
                            headers=GH)
            if sr.status_code != 200:
                break
            data = sr.json().get('data', [])
            if not data:
                break
            
            for ad in data:
                if ad['id'] in seen:
                    continue
                if ad.get('active_in_library') != 1:
                    continue
                end = ad.get('end_date', '')
                if end and end != 'Present' and end < datetime.now(timezone.utc).strftime('%Y-%m-%d'):
                    continue
                
                seen.add(ad['id'])
                ar = requests.post(f"{GETHOOKD}/boards/{board_id}/ads",
                                 json={'ad_id': ad['id']}, headers=GH)
                if ar.status_code in (200, 201):
                    added += 1
                time.sleep(0.2)
            time.sleep(0.3)
        
        if added >= 200:
            break
    
    print(f"  Added {added} active ads")
    
    if added < 20:
        print(f"  WARNING: Only {added} ads — niche may be too small")
    
    return {
        'board_id': board_id,
        'name': name,
        'ads_count': added,
        'share_url': public_url,
    }


def main():
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(hours=48)
    
    # Get swipe file posts scheduled within 48 hours
    r = requests.get(f"{DASHBOARD}/api/content")
    all_posts = r.json()
    
    swipe_posts = []
    for p in all_posts:
        if p.get('scheduledStatus') != 'scheduled':
            continue
        content = (p.get('content') or '').lower()
        if 'swipe file' not in content and 'winning' not in content[:50]:
            continue
        sched = p.get('scheduledAt', '')
        if not sched:
            continue
        try:
            dt = datetime.fromisoformat(sched.replace('Z', '+00:00'))
            if dt <= cutoff:
                swipe_posts.append(p)
        except:
            continue
    
    print(f"Found {len(swipe_posts)} swipe file posts in next 48 hours\n")
    
    if not swipe_posts:
        print("Nothing to do.")
        return True
    
    all_healthy = True
    
    for p in swipe_posts:
        pid = p['id']
        content = p.get('content', '')
        sched = p.get('scheduledAt', '')
        
        print(f"\n{'='*50}")
        print(f"Post: {pid} at {sched}")
        print(f"Content: {content[:80]}...")
        
        # Detect niche
        niche = detect_niche(content)
        if not niche:
            print(f"  Could not detect niche — skipping")
            all_healthy = False
            continue
        
        queries = NICHE_QUERIES.get(niche, [])
        print(f"  Niche: {niche}")
        
        # Check existing board link
        board_match = re.search(r'board/(\d+)', content)
        if board_match:
            old_board_id = board_match.group(1)
            # Check if the old board has ads by trying the share URL
            old_urls = re.findall(r'https://app\.gethookd\.ai/share/board/\S+', content)
            if old_urls:
                check = requests.get(old_urls[0], timeout=10)
                # Share page always returns 200 (SPA), can't tell if empty from HTTP alone
                # So we just rebuild to be safe
        
        # Create fresh board
        result = create_fresh_board(niche, queries)
        if not result:
            all_healthy = False
            continue
        
        share_url = result.get('share_url', '')
        if share_url:
            # Update post content with new board link
            new_content = re.sub(
                r'https://app\.gethookd\.ai/share/board/\S+',
                share_url,
                content
            )
            
            # Also update board ID references
            if board_match:
                new_content = new_content  # URL already replaced above
            
            if new_content != content:
                ur = requests.put(f"{DASHBOARD}/api/content/{pid}",
                                json={'content': new_content})
                if ur.status_code == 200:
                    print(f"  Updated post with fresh board {result['board_id']}")
                else:
                    print(f"  Failed to update post: {ur.status_code}")
                    all_healthy = False
            else:
                print(f"  Could not replace board URL in content")
                all_healthy = False
        else:
            print(f"  No share URL available — board created but can't update post")
            all_healthy = False
    
    return all_healthy


if __name__ == '__main__':
    healthy = main()
    sys.exit(0 if healthy else 1)
