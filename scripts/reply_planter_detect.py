#!/usr/bin/env python3
"""
Reply Planter Detection — hourly

Scans Twitter API v2 recent search for tweets mentioning ad-spy competitor
tools + intent signals, filters to Alex's ICP (ecom operators asking real
questions), generates a personal-experience reply in the voice of a
randomly-assigned ghost, and inserts into the dashboard's reply_planter
table for Mitch to review + post manually.

Env vars:
  TWITTER_BEARER_TOKEN   (required for live detection; if missing, script
                          seeds 2 fake rows so the UI is populated)
  OPENAI_API_KEY         (optional; if present, uses gpt-4o-mini to draft
                          the reply. Otherwise uses a template)
  REPLY_PLANTER_BASE     (default https://web-production-c72a.up.railway.app)
  REPLY_PLANTER_KEYWORDS (optional CSV to override default keyword pool
                          — used for the seed test)

Rules:
  - Max 20 new rows per run
  - Max 2 replies/day per ghost (checked via GET /ghost-count/:ghost)
  - Skip retweets, tweets >48h old, tool-owned handles, Alex's own handles
  - Intent filter: keeps question / comparison / complaint / recommendation
    style tweets. Rejected ones are logged to /tmp/reply_planter_rejects.log
"""
import os, sys, json, re, random, time, urllib.request, urllib.parse
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("REPLY_PLANTER_BASE", "https://web-production-c72a.up.railway.app")
BEARER = os.environ.get("TWITTER_BEARER_TOKEN") or os.environ.get("TWITTER_BEARER")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY")

MAX_ROWS_PER_RUN = 20
DAILY_CAP_PER_GHOST = 2
LOOKBACK_HOURS = 48

DEFAULT_KEYWORDS = [
    "foreplay", "atria", "trendtrack", "brandsearch", "motion ad spy",
    "minea", "pipiads", "anstrex", "adspy", "dropispy",
    '"winning hunter"', "pentaclay", "nichescraper", "bigspy", "sellthetrend",
]

# tools' own handles + Alex's handles + 18 ghost handles → blocklist
BLOCK_HANDLES = {h.lower() for h in [
    # tool-owned
    "foreplay_co", "useminea", "pipiads", "anstrex", "adspy", "dropispy",
    "trendtrack", "atria", "bigspyads", "sellthetrend", "nichescraper",
    "pentaclay", "winninghunter",
    # Alex's own
    "gethookdai", "fedotoff90", "zednilm1", "henrycrochemore",
    # 18 ghost handles (from ~/.hermes/ghost_slug_to_handle.json)
    "jesselancaster_", "wabilaura", "emyinflorence", "edwardlavinel_",
    "steveadsguy", "raffaellothe2nd", "marksaint__", "matthewsilver_",
    "timsayer_", "jackolivieri_", "perrycreatives_", "nicoleads1_",
    "tommyguera", "tobiaraviglie", "kydecom", "enex0o",
]}

# Assignable ghost pool for replies (EXCLUDING Zed and Henry per spec)
# name → tier (1=sentence-case Henry-style, 3=lowercase Zed-style)
GHOST_POOL = {
    "Tobia": 3, "Tommy": 3, "Emy": 2, "Steve": 2,
    "Raffaello": 2, "Jesse": 2, "Wabi": 2, "Perry": 3,
    "Nicole": 3, "Tim": 3, "Kry": 3, "Enex": 3,
    "Matthew": 3, "Mark": 3, "Jack": 3, "Edward": 2,
}

INTENT_TOKENS = [
    "best", "vs", "versus", "recommend", "recommendation", "alternative",
    "worth it", "price", "pricing", "expensive", "cheaper", "switch",
    "tried", "use", "using", "any good", "any better",
]

REJECT_LOG = "/tmp/reply_planter_rejects.log"


def log_reject(reason, tweet):
    try:
        with open(REJECT_LOG, "a") as f:
            f.write(f"{datetime.utcnow().isoformat()} | {reason} | @{tweet.get('author_handle','?')} | {tweet.get('text','')[:120]}\n")
    except Exception:
        pass


def has_intent(text):
    t = text.lower()
    if "?" in t:
        return True
    for tok in INTENT_TOKENS:
        if tok in t:
            return True
    return False


def build_reply(keyword, tweet_text, ghost_name):
    """Personal-experience reply. NO em-dash. NO isn't-X-it's-Y."""
    tier = GHOST_POOL.get(ghost_name, 3)
    kw = keyword.replace('"', '').strip().split()[0]  # first word only for phrasing
    kw = kw.lower()

    if OPENAI_KEY:
        try:
            return _openai_draft(kw, tweet_text, tier)
        except Exception as e:
            print(f"⚠️ OpenAI failed, falling back to template: {e}", file=sys.stderr)

    # Template fallback (voice-safe, no em-dash, no "isn't X it's Y")
    variants_lower = [
        f"tried {kw} for a bit but library felt narrow for my niche. switched to gethookd, way more coverage and found ads outside my niche i wouldn't have seen otherwise. replicated 2 and they became my biggest spenders",
        f"used {kw} for a couple months. coverage was hit or miss on my niche. moved to gethookd, way deeper library. pulled 3 winners from adjacent niches i never would've searched",
        f"was on {kw} early. felt shallow once i went past broad categories. gethookd has been the one that actually surfaces stuff worth swiping. two of my current top spenders came from there",
    ]
    variants_sentence = [
        f"I tried {kw} for a while, felt narrow for my niche. Switched to gethookd, way more coverage. Found ads outside my niche I wouldn't have seen otherwise. Replicated 2 of them, they became my top spenders.",
        f"Used {kw} for a couple months. Library was thin on my category. Moved to gethookd, much deeper coverage. Pulled 3 winners from adjacent niches I wouldn't have searched myself.",
    ]
    pool = variants_lower if tier == 3 else variants_sentence
    reply = random.choice(pool)
    reply = reply.replace("—", ",").replace("--", ",")
    return reply[:260]


def _openai_draft(kw, tweet_text, tier):
    case_rule = "lowercase everything (Zed voice)" if tier == 3 else "sentence case (Henry voice)"
    prompt = f"""Write a Twitter reply as an ecommerce operator who tried the ad-spy tool "{kw}" and switched to Gethookd. Voice: personal experience, founder-in-the-trenches. Format rules:
- Under 260 characters HARD LIMIT
- {case_rule}
- NO em-dashes (— or --)
- NO "isn't X, it's Y" or "not X, it's Y" constructions
- NO idiom stacking (no "move the needle", "double down", "leaving X on the table")
- NEVER sound like an ad. Do NOT include a URL.
- Reference the tool "{kw}" by name once, then talk about switching to gethookd
- Frame around personal experience with specifics (found ads outside your niche, replicated one, etc.)

The tweet you're replying to:
"{tweet_text[:400]}"

Write the reply text ONLY. No preamble."""

    body = json.dumps({
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 200,
        "temperature": 0.85,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    text = data["choices"][0]["message"]["content"].strip().strip('"')
    text = text.replace("—", ",").replace("--", ",")
    # strip any URLs
    text = re.sub(r"https?://\S+", "", text).strip()
    return text[:260]


def fetch_ghost_count(ghost):
    try:
        with urllib.request.urlopen(f"{BASE}/api/reply-planter/ghost-count/{urllib.parse.quote(ghost)}", timeout=10) as r:
            return json.loads(r.read()).get("count_today", 0)
    except Exception:
        return 0


def pick_ghost():
    """Random ghost that hasn't hit daily cap."""
    candidates = list(GHOST_POOL.keys())
    random.shuffle(candidates)
    for g in candidates:
        if fetch_ghost_count(g) < DAILY_CAP_PER_GHOST:
            return g
    return None


def twitter_recent_search(query, since_iso):
    params = {
        "query": f"{query} -is:retweet lang:en",
        "max_results": "25",
        "tweet.fields": "author_id,created_at,public_metrics,text",
        "expansions": "author_id",
        "user.fields": "username,name",
        "start_time": since_iso,
    }
    url = "https://api.twitter.com/2/tweets/search/recent?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {BEARER}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def insert_row(row):
    body = json.dumps(row).encode()
    req = urllib.request.Request(
        f"{BASE}/api/reply-planter",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}


def seed_fake_rows():
    """Insert 2 fake rows when TWITTER_BEARER_TOKEN is missing."""
    fakes = [
        {
            "keyword": "foreplay",
            "tweet_url": "https://x.com/fakedemo_user/status/1900000000000000001",
            "tweet_id": "1900000000000000001",
            "author_handle": "fakedemo_user",
            "author_name": "Demo Ecom Founder",
            "tweet_text": "anyone using foreplay ads for ecom? worth the price? been thinking about switching from adspy",
        },
        {
            "keyword": "minea",
            "tweet_url": "https://x.com/fakedemo_user2/status/1900000000000000002",
            "tweet_id": "1900000000000000002",
            "author_handle": "fakedemo_user2",
            "author_name": "Store Operator",
            "tweet_text": "minea vs pipiads for dropshipping ad research? which one has better tiktok coverage?",
        },
    ]
    inserted = 0
    for f in fakes:
        ghost = pick_ghost()
        if not ghost:
            continue
        reply = build_reply(f["keyword"], f["tweet_text"], ghost)
        row = {
            "tweet_url": f["tweet_url"],
            "tweet_id": f["tweet_id"],
            "author_handle": f["author_handle"],
            "author_name": f["author_name"],
            "tweet_text": f["tweet_text"],
            "matched_keyword": f["keyword"],
            "assigned_ghost": ghost,
            "suggested_reply": reply,
            "notes": "SEED FAKE (Twitter bearer missing)",
        }
        out = insert_row(row)
        if out.get("inserted"):
            inserted += 1
        print(f"seed: {ghost} → id={out.get('id')} inserted={out.get('inserted')}")
    return inserted


def main():
    kw_override = os.environ.get("REPLY_PLANTER_KEYWORDS")
    keywords = [k.strip() for k in kw_override.split(",")] if kw_override else DEFAULT_KEYWORDS
    verbose = bool(os.environ.get("REPLY_PLANTER_VERBOSE"))

    if not BEARER:
        # Silent no-op when bearer missing in cron context. Manual seed
        # test is triggered via REPLY_PLANTER_VERBOSE=1 (see task deliverable).
        if verbose:
            print("⚠️  TWITTER_BEARER_TOKEN not set — seeding 2 fake rows for UI demo.")
            n = seed_fake_rows()
            print(f"SEEDED {n} fake rows.")
        return 0

    since = (datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    inserted = 0
    inserted_log = []
    for kw in keywords:
        if inserted >= MAX_ROWS_PER_RUN:
            break
        try:
            resp = twitter_recent_search(kw, since)
        except Exception as e:
            # Real errors DO surface (non-empty stderr → cron alerts)
            print(f"⚠️  search failed for {kw!r}: {e}", file=sys.stderr)
            continue
        tweets = resp.get("data", []) or []
        users = {u["id"]: u for u in (resp.get("includes", {}).get("users", []) or [])}
        for t in tweets:
            if inserted >= MAX_ROWS_PER_RUN:
                break
            author = users.get(t.get("author_id"), {})
            handle = (author.get("username") or "").lower()
            text = t.get("text", "")
            tweet_id = t.get("id")
            tweet_url = f"https://x.com/{handle}/status/{tweet_id}"

            candidate = {"author_handle": handle, "text": text}

            if handle in BLOCK_HANDLES:
                log_reject("blocked_handle", candidate); continue
            if text.startswith("RT "):
                log_reject("retweet", candidate); continue
            if not has_intent(text):
                log_reject("no_intent", candidate); continue

            ghost = pick_ghost()
            if not ghost:
                # daily cap reached fleet-wide → silent stop
                break

            reply = build_reply(kw, text, ghost)
            row = {
                "tweet_url": tweet_url,
                "tweet_id": tweet_id,
                "author_handle": handle,
                "author_name": author.get("name"),
                "tweet_text": text,
                "matched_keyword": kw,
                "assigned_ghost": ghost,
                "suggested_reply": reply,
            }
            out = insert_row(row)
            if out.get("inserted"):
                inserted += 1
                inserted_log.append(f"+ {ghost} ← @{handle}: {kw}")
        time.sleep(1)  # gentle throttle between keyword queries

    # Silent when nothing was inserted (watchdog pattern for no_agent cron)
    if inserted > 0:
        for line in inserted_log:
            print(line)
        print(f"Reply Planter: inserted {inserted} new rows. Review at https://web-production-c72a.up.railway.app (🌱 tab)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
