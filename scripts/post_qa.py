#!/usr/bin/env python3
"""
Post QA — runs before every post goes live.
Checks: media exists, no emojis, has gethookd link, link works, no markdown formatting.
Quarantines failing posts (sets scheduledStatus=draft).
"""
import requests, json, re, sys

API = "https://web-production-c72a.up.railway.app/api/content"

def has_emoji(text):
    emoji_pattern = re.compile(
        "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251"
        "\U0001f926-\U0001f937\U00010000-\U0010ffff"
        "\u2600-\u26FF\u2700-\u27BF\u200d\ufe0f]+", flags=re.UNICODE)
    return bool(emoji_pattern.search(text or ''))

def check_post(p):
    errors = []
    content = p.get('content') or ''
    title = p.get('title') or ''
    
    # 1. Must have media
    mt = p.get('mediaType') or 'none'
    mu = p.get('mediaUrl') or ''
    vu = p.get('videoUrl') or ''
    if mt == 'none' or (not mu and not vu):
        errors.append('NO_MEDIA')
    
    # 2. No emojis in content
    if has_emoji(content):
        errors.append('EMOJI_IN_CONTENT')
    if has_emoji(title):
        errors.append('EMOJI_IN_TITLE')
    
    # 3. Must have gethookd share link
    if 'gethookd.ai/share/ad/' not in content:
        errors.append('NO_AD_LINK')
    
    # 4. Link must be raw URL (no markdown)
    if re.search(r'\[https?://[^\]]+\]\(', content):
        errors.append('MARKDOWN_LINK')
    
    # 5. No prefix text before link (like "See the ad:")
    if 'See the ad:' in content or 'Found on' in content:
        errors.append('LINK_PREFIX')
    
    # 6. Share URL must return 200
    url_match = re.search(r'(https://app\.gethookd\.ai/share/ad/[^\s]+)', content)
    if url_match:
        try:
            r = requests.head(url_match.group(1), timeout=10, allow_redirects=True)
            if r.status_code != 200:
                errors.append(f'LINK_HTTP_{r.status_code}')
        except:
            errors.append('LINK_TIMEOUT')
    
    return errors

def main():
    r = requests.get(f"{API}?limit=500")
    data = r.json()
    posts = data if isinstance(data, list) else data.get('items', data.get('content', []))
    scheduled = [p for p in posts if p.get('scheduledStatus') == 'scheduled' and p.get('status') == 'approved']
    
    total = len(scheduled)
    passed = 0
    failed = 0
    quarantined = 0
    
    quarantine = '--quarantine' in sys.argv
    
    print(f"QA checking {total} scheduled posts...")
    print(f"Mode: {'QUARANTINE (will draft failing posts)' if quarantine else 'AUDIT ONLY'}\n")
    
    for p in scheduled:
        errors = check_post(p)
        if errors:
            failed += 1
            print(f"FAIL | {(p.get('title') or '')[:45]} | {', '.join(errors)}")
            if quarantine:
                requests.put(f"{API}/{p['id']}", json={'scheduledStatus': 'draft'})
                quarantined += 1
        else:
            passed += 1
    
    print(f"\n{'='*50}")
    print(f"PASSED: {passed}/{total}")
    print(f"FAILED: {failed}/{total}")
    if quarantine:
        print(f"QUARANTINED: {quarantined}")
    print(f"{'='*50}")
    
    return 1 if failed > 0 else 0

if __name__ == '__main__':
    sys.exit(main())
