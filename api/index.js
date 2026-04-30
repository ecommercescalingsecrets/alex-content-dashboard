const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { TwitterApi } = require('twitter-api-v2');
const { getAllContent, getContent, upsertContent, deleteContent, getCount, getSetting, setSetting } = require('./db');
const SwipeFileBuilder = require('../swipe-file-builder');

// Auto-seed on first boot if DB is empty
if (getCount() === 0) {
    try {
        const { seedIfEmpty } = require('./seed');
        seedIfEmpty();
    } catch (e) {
        console.log('No seed data available or seed already applied.');
    }
}

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Media directory: use Railway volume if available, fallback to local
const MEDIA_DIR = fs.existsSync('/app/data') ? '/app/data/media' : path.join(__dirname, '..', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Copy any existing media from repo to volume on first boot
const repoMedia = path.join(__dirname, '..', 'media');
if (MEDIA_DIR !== repoMedia && fs.existsSync(repoMedia)) {
    const files = fs.readdirSync(repoMedia);
    for (const f of files) {
        const dest = path.join(MEDIA_DIR, f);
        if (!fs.existsSync(dest)) {
            try { fs.copyFileSync(path.join(repoMedia, f), dest); } catch(e) {}
        }
    }
}

// Enhanced media serving with proper headers for videos
app.use('/media', (req, res, next) => {
    const filePath = path.join(MEDIA_DIR, req.path);
    
    // Set proper MIME types for videos
    if (req.path.toLowerCase().endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4');
    } else if (req.path.toLowerCase().endsWith('.webm')) {
        res.setHeader('Content-Type', 'video/webm');
    } else if (req.path.toLowerCase().endsWith('.mov')) {
        res.setHeader('Content-Type', 'video/quicktime');
    }
    
    // Enable range requests for video streaming
    res.setHeader('Accept-Ranges', 'bytes');
    
    // CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    
    // Cache headers for performance
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    
    next();
}, express.static(MEDIA_DIR));

app.use('/swipe-files', express.static(path.join(__dirname, '..', 'swipe-files')));

// Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || 'afPOMOM5RV4b655Yy56MoTfGY',
    appSecret: process.env.TWITTER_API_SECRET || '30D4XExxLrLWrBiuqjbwqrgMt3glryogYlHTrtlkA01AHDaSdP',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-uNaojr5jHYpZf76mKwzbWMizZTitbu',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'PDAWJO2mLDP2IMa09uI3RMrrIOP65eFrzT7pIsuA3jwRY'
});

// LinkedIn OAuth configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'https://web-production-c72a.up.railway.app/api/linkedin/callback';
const LINKEDIN_SCOPES = 'w_member_social openid profile';

// LinkedIn OAuth - Step 1: Redirect to LinkedIn authorization
app.get('/api/linkedin/auth', (req, res) => {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: LINKEDIN_CLIENT_ID,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        scope: LINKEDIN_SCOPES,
        state: 'linkedin_oauth_' + Date.now()
    });
    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// LinkedIn OAuth - Step 2: Exchange code for access token
app.get('/api/linkedin/callback', async (req, res) => {
    const { code, error, error_description } = req.query;
    if (error) return res.status(400).json({ error, error_description });
    if (!code) return res.status(400).json({ error: 'No authorization code received' });

    try {
        // Exchange code for token
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: LINKEDIN_CLIENT_ID,
                client_secret: LINKEDIN_CLIENT_SECRET,
                redirect_uri: LINKEDIN_REDIRECT_URI
            })
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return res.status(400).json({ error: 'Failed to get access token', details: tokenData });

        const accessToken = tokenData.access_token;
        const expiresIn = tokenData.expires_in || 5184000; // default 60 days
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Get user info (sub = LinkedIn person ID)
        const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const userData = await userRes.json();
        const userId = userData.sub;

        // Store in settings
        setSetting('linkedin_access_token', accessToken);
        setSetting('linkedin_token_expires_at', expiresAt);
        setSetting('linkedin_user_id', userId);

        res.send(`<h1>✅ LinkedIn Connected!</h1><p>User ID: ${userId}</p><p>Token expires: ${expiresAt}</p><p><a href="/">Back to Dashboard</a></p>`);
    } catch (err) {
        console.error('LinkedIn callback error:', err);
        res.status(500).json({ error: err.message });
    }
});

// LinkedIn status check
app.get('/api/linkedin/status', (req, res) => {
    const token = getSetting('linkedin_access_token');
    const expiresAt = getSetting('linkedin_token_expires_at');
    const userId = getSetting('linkedin_user_id');
    const now = new Date();
    const isValid = token && expiresAt && new Date(expiresAt) > now;
    res.json({
        connected: !!token,
        valid: isValid,
        userId,
        expiresAt,
        expiresIn: isValid ? Math.round((new Date(expiresAt) - now) / 1000 / 3600 / 24) + ' days' : null
    });
});

// LinkedIn posting function
async function postToLinkedIn(content, mediaUrl) {
    const accessToken = getSetting('linkedin_access_token');
    const userId = getSetting('linkedin_user_id');
    const expiresAt = getSetting('linkedin_token_expires_at');

    if (!accessToken || !userId) throw new Error('LinkedIn not connected. Visit /api/linkedin/auth first.');
    if (new Date(expiresAt) <= new Date()) throw new Error('LinkedIn token expired. Re-authorize at /api/linkedin/auth');

    const author = `urn:li:person:${userId}`;
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0'
    };

    let imageUrn = null;

    // Upload image if mediaUrl provided
    if (mediaUrl) {
        try {
            const mediaPath = path.join(MEDIA_DIR, path.basename(mediaUrl));
            if (fs.existsSync(mediaPath)) {
                // Step 1: Initialize upload
                const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ initializeUploadRequest: { owner: author } })
                });
                const initData = await initRes.json();
                const uploadUrl = initData.value.uploadUrl;
                imageUrn = initData.value.image;

                // Step 2: Upload binary
                const imageBuffer = fs.readFileSync(mediaPath);
                await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/octet-stream'
                    },
                    body: imageBuffer
                });
            }
        } catch (mediaErr) {
            console.error('LinkedIn media upload failed:', mediaErr.message);
            imageUrn = null;
        }
    }

    // Build post body
    const postBody = {
        author,
        commentary: content,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED'
    };

    if (imageUrn) {
        postBody.content = {
            media: { title: 'Image', id: imageUrn }
        };
    }

    const postRes = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers,
        body: JSON.stringify(postBody)
    });

    if (!postRes.ok) {
        const errText = await postRes.text();
        throw new Error(`LinkedIn post failed (${postRes.status}): ${errText}`);
    }

    // LinkedIn returns the post URN in x-restli-id header
    const linkedinPostId = postRes.headers.get('x-restli-id') || postRes.headers.get('x-linkedin-id') || 'posted';
    return linkedinPostId;
}

// GetHookd API configuration
const GETHOOKD_API_KEY = process.env.GETHOOKD_API_KEY || 'gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0';
const GETHOOKD_BASE_URL = 'https://app.gethookd.ai/api/v1';
const swipeBuilder = new SwipeFileBuilder();

// Simple in-memory cache for GetHookd API responses (15 min TTL)
const gethookdCache = {};
function getCached(key) {
    const entry = gethookdCache[key];
    if (entry && Date.now() - entry.ts < 15 * 60 * 1000) return entry.data;
    return null;
}
function setCache(key, data) {
    gethookdCache[key] = { data, ts: Date.now() };
}

// GetHookd API proxy - explore ads (supports ?query= for search)
app.get('/api/gethookd/explore', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const perPage = Math.min(parseInt(req.query.per_page) || 20, 100);
    const query = req.query.query || '';
    const cacheKey = `explore_${page}_${perPage}_${query}`;

    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const params = new URLSearchParams({ page, per_page: perPage });
        if (query) params.append('query', query);

        const response = await fetch(`${GETHOOKD_BASE_URL}/explore?${params}`, {
            headers: {
                'Authorization': `Bearer ${GETHOOKD_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `GetHookd API returned ${response.status}` });
        }

        const data = await response.json();

        // Enrich ads with analysis from SwipeFileBuilder
        if (data.data) {
            data.data = data.data.map(ad => ({
                ...ad,
                analysis: swipeBuilder.analyzeAd(ad)
            }));
        }

        const result = { ...data, page, per_page: perPage };
        setCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('GetHookd API error:', error.message);
        res.status(502).json({ error: 'Failed to fetch from GetHookd API', details: error.message });
    }
});

// GetHookd API - get ad collections (filtered)
app.get('/api/gethookd/collections', async (req, res) => {
    const pages = Math.min(parseInt(req.query.pages) || 1, 5);
    const cacheKey = `collections_${pages}`;

    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const swipeFiles = await swipeBuilder.createSwipeFiles(pages);
        const result = {};
        for (const [name, collection] of Object.entries(swipeFiles)) {
            result[name] = {
                description: collection.description,
                count: collection.count,
                ads: collection.ads.slice(0, 20).map(ad => ({
                    id: ad.id,
                    brand: ad.brand?.name,
                    title: ad.title,
                    body: ad.body,
                    cta: ad.cta_type,
                    score: ad.performance_score,
                    days_active: ad.days_active,
                    landing_page: ad.landing_page,
                    media: ad.media,
                    analysis: swipeBuilder.analyzeAd(ad)
                }))
            };
        }
        setCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('GetHookd collections error:', error.message);
        res.status(502).json({ error: 'Failed to build collections', details: error.message });
    }
});

// GetHookd API - refresh static swipe files from live API
app.post('/api/gethookd/refresh-swipe-files', async (req, res) => {
    try {
        const swipeFiles = await swipeBuilder.exportToFiles();
        const collections = Object.entries(swipeFiles).map(([name, col]) => ({
            name, count: col.count, description: col.description
        }));
        res.json({ success: true, refreshed: collections });
    } catch (error) {
        console.error('Swipe file refresh error:', error.message);
        res.status(502).json({ error: 'Failed to refresh swipe files', details: error.message });
    }
});

// GetHookd API - import an ad as dashboard content
app.post('/api/gethookd/import', (req, res) => {
    const { ad } = req.body;
    if (!ad) return res.status(400).json({ error: 'Ad data is required in request body' });

    const id = 'gethookd-' + (ad.id || Date.now());

    // Check if already imported
    const existing = getContent(id);
    if (existing) return res.json({ success: true, item: existing, alreadyImported: true });

    const mediaUrl = ad.media?.[0]?.url || null;
    const mediaType = ad.media?.[0]?.type || null;

    const item = {
        id,
        title: ad.brand?.name ? `${ad.brand.name} - ${ad.title || 'Ad'}` : (ad.title || 'GetHookd Import'),
        content: ad.body || '',
        mediaUrl,
        mediaType,
        status: 'review',
        target: 'Solo ecommerce founders',
        createdAt: new Date().toISOString(),
        feedbackHistory: []
    };

    upsertContent(item);
    res.json({ success: true, item });
});

// Scheduler - check every minute for content that should be posted
async function scheduleChecker() {
    try {
        const now = new Date();
        console.log(`🔍 Schedule check at ${now.toISOString()}`);
        const allContent = getAllContent();
        
        // Find items that need to be posted
        // Accept both 'approved' and 'scheduled' status — posts created via API
        // may use either status value
        const itemsToPost = allContent.filter(item => 
            item.scheduledStatus === 'scheduled' &&
            item.scheduledAt &&
            (item.status === 'approved' || item.status === 'scheduled') &&
            item.category !== 'reply' &&
            new Date(item.scheduledAt) <= now
        );

        if (itemsToPost.length > 0) {
            console.log(`⏰ Found ${itemsToPost.length} scheduled item(s) to post at ${now.toISOString()}`);
        }

        // Sort by scheduledAt so oldest posts go first
        itemsToPost.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

        // STAGGER RULE: Only post ONE item per scheduler cycle (60s).
        // This guarantees at least 60 seconds between tweets, even if
        // multiple posts are overdue. Remaining posts will be picked up
        // in subsequent cycles.
        
        // MIN GAP RULE: Don't post if another post was posted within the last 60 minutes
        const recentlyPosted = allContent.filter(item => 
            item.status === 'posted' && item.postedAt &&
            (now - new Date(item.postedAt)) < 5 * 60 * 1000
        );
        if (recentlyPosted.length > 0 && itemsToPost.length > 0) {
            const lastPosted = recentlyPosted.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))[0];
            const minSince = Math.round((now - new Date(lastPosted.postedAt)) / 60000);
            console.log(`⏳ Last post was ${minSince}min ago (${lastPosted.title?.slice(0,40)}). Waiting for 5min gap.`);
            return;
        }

        const batch = itemsToPost.slice(0, 1);

        // Process one post per cycle
        for (const item of batch) {
            // PRE-POST MEDIA CHECK: skip posts with broken/missing media
            if (item.mediaUrl && item.mediaUrl.startsWith('/media/')) {
                const mediaPath = path.join(MEDIA_DIR, item.mediaUrl.replace('/media/', ''));
                if (!fs.existsSync(mediaPath) || fs.statSync(mediaPath).size === 0) {
                    console.log(`🚫 BLOCKED: ${item.title} — media missing or 0 bytes (${item.mediaUrl}). Moving to review.`);
                    item.scheduledStatus = 'blocked';
                    item.status = 'review';
                    item.feedback = (item.feedback || '') + '\n[AUTO] Blocked from posting: media file missing or empty. Run /api/media/auto-repair to fix.';
                    upsertContent(item);
                    continue;
                }
            }
            
            console.log(`📅 Auto-posting scheduled content: ${item.title}`);
            item.scheduledStatus = 'posting';
            upsertContent(item);

            try {
                const postTarget = item.postTarget || 'twitter';

                // Post to Twitter if target includes it
                if (postTarget === 'twitter' || postTarget === 'both') {
                    const { tweetIds } = await postItemToTwitter(item);
                    item.tweetIds = tweetIds;
                }

                // Post to LinkedIn if target includes it
                if (postTarget === 'linkedin' || postTarget === 'both') {
                    try {
                        const linkedinPostId = await postToLinkedIn(item.content, item.mediaUrl);
                        item.linkedinPostId = linkedinPostId;
                    } catch (liErr) {
                        console.error(`LinkedIn scheduled post failed for ${item.title}:`, liErr.message);
                        if (postTarget === 'linkedin') throw liErr;
                    }
                }

                item.status = 'posted';
                item.scheduledStatus = 'posted';
                item.postedAt = new Date().toISOString();
                upsertContent(item);
                console.log(`✅ Successfully posted scheduled: ${item.title}`);
            } catch (err) {
                console.error(`❌ Failed to post scheduled content ${item.title}:`, err);
                item.scheduledStatus = 'failed';
                upsertContent(item);
            }
        }
    } catch (error) {
        console.error('❌ Schedule checker error:', error);
    }
}

setInterval(scheduleChecker, 60000);

// Self-ping to prevent Railway from idling the process
// Runs every 5 minutes to keep setInterval alive
setInterval(() => {
    const http = require('http');
    http.get(`http://localhost:${port}/api/health`, () => {}).on('error', () => {});
}, 5 * 60 * 1000);

// Health check endpoint
app.get('/api/health', (req, res) => {
    // Also trigger schedule check on any health ping
    scheduleChecker().catch(() => {});
    res.json({ ok: true, time: new Date().toISOString() });
});

// API Routes
app.get('/api/content', (req, res) => {
    // Piggyback schedule check on content fetches too
    scheduleChecker().catch(() => {});
    res.json(getAllContent());
});

// Must come BEFORE /api/content/:id to avoid matching :id = "scheduled"
app.get('/api/content/scheduled/week', (req, res) => {
    const now = new Date();
    const mondayOfWeek = new Date(now);
    mondayOfWeek.setDate(now.getDate() - now.getDay() + 1);
    mondayOfWeek.setHours(0, 0, 0, 0);
    const sundayOfWeek = new Date(mondayOfWeek);
    sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
    sundayOfWeek.setHours(23, 59, 59, 999);

    const scheduledThisWeek = getAllContent().filter(item => {
        if (!item.scheduledAt) return false;
        const d = new Date(item.scheduledAt);
        return d >= mondayOfWeek && d <= sundayOfWeek;
    });

    res.json({ weekStart: mondayOfWeek.toISOString(), weekEnd: sundayOfWeek.toISOString(), scheduled: scheduledThisWeek });
});

app.get('/api/content/:id', (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
});

app.post('/api/content/:id/approve', (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    upsertContent(item);
    res.json(item);
});

app.post('/api/content/:id/schedule', (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });
    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    item.scheduledAt = scheduledAt;
    item.scheduledStatus = 'scheduled';
    upsertContent(item);
    res.json(item);
});

app.post('/api/content/:id/unschedule', (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.scheduledAt = null;
    item.scheduledStatus = null;
    upsertContent(item);
    res.json(item);
});

app.post('/api/content/:id/feedback', (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const { feedback } = req.body;
    if (!feedback || feedback.trim() === '') return res.status(400).json({ error: 'Feedback text is required' });
    item.feedbackHistory.push({ text: feedback.trim(), createdAt: new Date().toISOString() });
    upsertContent(item);
    res.json(item);
});

// /api/content/scheduled/week route moved above :id param route to avoid conflicts

// Split long text into tweet-sized chunks at paragraph boundaries
function splitIntoTweets(text, maxLen = 4000) {
    // Explicit thread delimiter takes priority
    const THREAD_DELIM = '---THREAD---';
    if (text.includes(THREAD_DELIM)) {
        return text.split(THREAD_DELIM).map(t => t.trim()).filter(Boolean);
    }

    // If the entire text fits in one tweet, NEVER split it
    if (text.trim().length <= maxLen) {
        return [text.trim()];
    }
    
    // Only split if text actually exceeds the limit
    const paragraphs = text.split('\n\n').filter(Boolean);
    const tweets = [];
    let current = '';
    for (const para of paragraphs) {
        const candidate = current ? current + '\n\n' + para : para;
        if (candidate.length <= maxLen) {
            current = candidate;
        } else {
            if (current) tweets.push(current.trim());
            if (para.length > maxLen) {
                const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
                let chunk = '';
                for (const s of sentences) {
                    const next = chunk ? chunk + ' ' + s.trim() : s.trim();
                    if (next.length <= maxLen) { chunk = next; }
                    else { if (chunk) tweets.push(chunk.trim()); chunk = s.trim(); }
                }
                current = chunk;
            } else {
                current = para;
            }
        }
    }
    if (current) tweets.push(current.trim());
    return tweets;
}

async function postItemToTwitter(item) {
    const text = item.content;
    let mediaId = null;

    // Parse threadMedia if it's a JSON string
    let threadMedia = item.threadMedia;
    if (typeof threadMedia === 'string') {
        try { threadMedia = JSON.parse(threadMedia); } catch(e) { threadMedia = null; }
    }

    // Upload single mediaUrl for non-thread posts (or thread tweet 0 fallback)
    if (item.mediaUrl && !threadMedia) {
        try {
            const mediaPath = path.join(MEDIA_DIR, path.basename(item.mediaUrl));
            if (fs.existsSync(mediaPath)) {
                console.log(`Uploading media: ${mediaPath} (${fs.statSync(mediaPath).size} bytes)`);
                mediaId = await twitterClient.v1.uploadMedia(mediaPath);
                console.log(`Media uploaded: ${mediaId}`);
            }
        } catch (mediaError) {
            console.error('Media upload failed:', mediaError.message || mediaError);
        }
    }

    const tweets = splitIntoTweets(text);
    console.log(`Posting ${tweets.length} tweet(s), media: ${!!mediaId}, threadMedia: ${!!threadMedia}`);

    let lastTweetId = null;
    const tweetIds = [];

    for (let i = 0; i < tweets.length; i++) {
        // Upload per-tweet media if threadMedia is available
        let tweetMediaId = null;
        if (threadMedia && threadMedia[i]) {
            try {
                const mPath = path.join(MEDIA_DIR, path.basename(threadMedia[i]));
                if (fs.existsSync(mPath)) {
                    console.log(`Uploading thread media [${i}]: ${mPath} (${fs.statSync(mPath).size} bytes)`);
                    tweetMediaId = await twitterClient.v1.uploadMedia(mPath);
                    console.log(`Thread media [${i}] uploaded: ${tweetMediaId}`);
                }
            } catch (mErr) {
                console.error(`Thread media [${i}] upload failed:`, mErr.message || mErr);
            }
        }

        // Use per-tweet media, or fallback to single mediaId for first tweet
        const currentMediaId = tweetMediaId || (i === 0 ? mediaId : null);

        if (i === 0) {
            const opts = { text: tweets[i] };
            if (currentMediaId) opts.media = { media_ids: [currentMediaId] };
            const result = await twitterClient.v2.tweet(opts);
            lastTweetId = result.data.id;
        } else {
            // For replies with media, we need to use the v2 tweet endpoint with reply params
            if (currentMediaId) {
                const opts = {
                    text: tweets[i],
                    media: { media_ids: [currentMediaId] },
                    reply: { in_reply_to_tweet_id: lastTweetId }
                };
                const result = await twitterClient.v2.tweet(opts);
                lastTweetId = result.data.id;
            } else {
                const result = await twitterClient.v2.reply(tweets[i], lastTweetId);
                lastTweetId = result.data.id;
            }
        }
        tweetIds.push(lastTweetId);
    }

    // Auto-reply with ad link if replyContent exists
    if (item.replyContent && lastTweetId) {
        try {
            const replyResult = await twitterClient.v2.reply(item.replyContent, lastTweetId);
            tweetIds.push(replyResult.data.id);
            console.log(`Auto-reply posted: ${replyResult.data.id}`);
        } catch (replyErr) {
            console.error('Auto-reply failed:', replyErr.message || replyErr);
        }
    }

    return { tweetIds, hasMedia: !!mediaId };
}

app.post('/api/content/:id/post-now', async (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    // Idempotency: don't re-post if already posted
    if (item.status === 'posted' && item.tweetIds) {
        return res.json({ success: true, tweetIds: item.tweetIds, item, alreadyPosted: true });
    }

    const postTarget = item.postTarget || 'twitter';
    const results = { success: true };

    try {
        // Post to Twitter if target includes it
        if (postTarget === 'twitter' || postTarget === 'both') {
            const { tweetIds, hasMedia } = await postItemToTwitter(item);
            item.tweetIds = tweetIds;
            results.tweetIds = tweetIds;
            results.hasMedia = hasMedia;
        }

        // Post to LinkedIn if target includes it
        if (postTarget === 'linkedin' || postTarget === 'both') {
            try {
                const linkedinPostId = await postToLinkedIn(item.content, item.mediaUrl);
                item.linkedinPostId = linkedinPostId;
                results.linkedinPostId = linkedinPostId;
            } catch (liErr) {
                console.error('LinkedIn post error:', liErr.message);
                results.linkedinError = liErr.message;
                // Don't fail the whole request if Twitter succeeded
                if (postTarget === 'linkedin') throw liErr;
            }
        }

        item.status = 'posted';
        item.postedAt = new Date().toISOString();
        upsertContent(item);
        results.item = item;
        res.json(results);
    } catch (err) {
        console.error('Post-now error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/content/:id/post', async (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    try {
        const { tweetIds, hasMedia } = await postItemToTwitter(item);
        item.status = 'posted';
        item.tweetIds = tweetIds;
        item.postedAt = new Date().toISOString();
        upsertContent(item);
        res.json({ success: true, tweetIds, item, hasMedia });
    } catch (err) {
        console.error('Twitter post error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/content', (req, res) => {
    const id = 'post-' + Date.now();
    const item = {
        id,
        title: req.body.title || null,
        content: req.body.content,
        target: req.body.target || 'Solo ecommerce founders',
        status: req.body.status || 'review',
        scheduledStatus: req.body.scheduledStatus || null,
        scheduledAt: req.body.scheduledAt || null,
        category: req.body.category || null,
        contentType: req.body.contentType || null,
        mediaUrl: req.body.mediaUrl || null,
        mediaType: req.body.mediaType || null,
        videoUrl: req.body.videoUrl || null,
        threadMedia: req.body.threadMedia || null,
        postTarget: req.body.postTarget || 'twitter',
        createdAt: new Date().toISOString(),
        feedbackHistory: []
    };
    // Auto-normalize: if scheduledAt is set and status is 'scheduled', treat as 'approved'
    // so the scheduler picks it up
    if (item.scheduledAt && item.scheduledStatus === 'scheduled' && item.status === 'scheduled') {
        item.status = 'approved';
    }
    upsertContent(item);
    res.json(item);
});

app.post('/api/content/:id/apply-feedback', async (req, res) => {
    const { feedback } = req.body;
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Post not found' });

    try {
        if (!item.feedbackHistory) item.feedbackHistory = [];
        item.feedbackHistory.push({ text: feedback, createdAt: new Date().toISOString() });
        upsertContent(item);
        res.json({ success: true, updatedContent: item.content, learningApplied: true, skillsUpdated: true });
    } catch (error) {
        console.error('Error applying feedback:', error);
        res.status(500).json({ error: 'Failed to apply feedback' });
    }
});

app.put('/api/content/:id', (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    const fields = ['content', 'title', 'mediaUrl', 'videoUrl', 'mediaType', 'status', 'target', 'replyContent', 'scheduledAt', 'scheduledStatus', 'postTarget', 'category', 'threadMedia'];
    for (const f of fields) {
        if (req.body[f] !== undefined) item[f] = req.body[f];
    }
    
    upsertContent(item);
    res.json(item);
});

app.delete('/api/content/:id', (req, res) => {
    deleteContent(req.params.id);
    res.json({ success: true });
});

// Swipe Files viewer (public)
app.get('/swipe-files', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public-swipe-files.html'));
});

app.get('/swipe', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public-swipe-files.html'));
});

// Twitter Analytics — fetch & analyze 180 days of tweet data
const analytics = require('../scripts/analyze-180-days');

app.get('/api/analytics/run', async (req, res) => {
    try {
        console.log('Starting 180-day analytics fetch...');
        const raw = await analytics.fetchAllTweets();
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'tweets-180-days.json'), JSON.stringify(raw, null, 2));

        const report = analytics.analyze(raw);
        fs.writeFileSync(path.join(dataDir, 'analytics-report.json'), JSON.stringify(report, null, 2));

        res.json(report);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/report', (req, res) => {
    const reportPath = path.join(__dirname, '..', 'data', 'analytics-report.json');
    if (fs.existsSync(reportPath)) {
        res.json(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
    } else {
        res.status(404).json({ error: 'No analytics report yet. Hit GET /api/analytics/run first.' });
    }
});

// Google Sheets export endpoint
app.get('/api/google-sheets-export', (req, res) => {
    const allContent = getAllContent();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Filter for secondary content (simplified content format)
    const secondaryContent = allContent.filter(item => 
        item.content && 
        item.content.includes('is printing.') && 
        item.content.includes('Used gethookd.ai to find this.') &&
        item.mediaUrl
    );
    
    // CSV headers
    const headers = [
        'Account',
        'Brand', 
        'Hook Quote',
        'Post Text',
        'Media Download URL',
        'Media Filename',
        'File Size',
        'Reply Text',
        'Gethookd Ad Link',
        'Status',
        'Created Date'
    ];
    
    const rows = secondaryContent.map((item, index) => {
        // Extract hook quote (text before the brand name)
        const lines = item.content.split('\n');
        const hookQuote = lines[0] ? lines[0].replace(/"/g, '') : '';
        
        // Extract brand name (between quote and "is printing")
        const brandMatch = item.content.match(/\n\n(.+?)\s+is printing\./);
        const brand = brandMatch ? brandMatch[1] : item.title.replace(' Brand Printing', '');
        
        // Determine account (alternate between account1 and account2)
        const account = index % 2 === 0 ? 'account1' : 'account2';
        
        // Media filename from URL
        const mediaFilename = item.mediaUrl ? item.mediaUrl.split('/').pop() : '';
        
        // Media download URL
        const mediaDownloadUrl = item.mediaUrl ? `${baseUrl}${item.mediaUrl}` : '';
        
        // File size (if we can get it)
        let fileSize = 'Unknown';
        if (mediaFilename) {
            try {
                const filePath = path.join(MEDIA_DIR, mediaFilename);
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    fileSize = `${(stats.size / 1024 / 1024).toFixed(1)}MB`;
                }
            } catch (e) {
                fileSize = 'Error';
            }
        }
        
        return [
            account,
            brand,
            hookQuote,
            item.content,
            mediaDownloadUrl,
            mediaFilename,
            fileSize,
            item.replyContent || '',
            item.replyContent ? item.replyContent.replace('Full breakdown: ', '') : '',
            item.status,
            item.createdAt || ''
        ];
    });
    
    // Generate CSV
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="content_for_google_sheets.csv"');
    res.send(csvContent);
});

// Simple assistant export endpoint
app.get('/api/secondary-content-export', (req, res) => {
    // Secondary content data with Gethookd ad links
    const secondaryContent = [
        {
            hookQuote: 'When a nutritionist who works with the Royal Family says ...',
            brand: 'KilgourMD',
            adLink: 'https://app.gethookd.ai/share/ad/84198456?signature=c972946bbdce62540f28743dd475700e7f3cc261abc4af3b20fdcbcb84425380'
        },
        {
            hookQuote: 'Men Love This Supplement Duo',
            brand: 'Caleigh Mackenzie',
            adLink: 'https://app.gethookd.ai/share/ad/84162848?signature=8603285e4d5011a503fcdf15b246ad453457757c8a79bfb2283f2a63867cc9fa'
        },
        {
            hookQuote: 'The biggest lesson I learnt in my weight loss journey',
            brand: 'Wild Nutrition',
            adLink: 'https://app.gethookd.ai/share/ad/84161665?signature=a74d08a3761da831b9ed292208de383f06a631d2f79416d83eb1bc01ad9bdec3'
        },
        {
            hookQuote: 'Introducing Sculpt Pro, the supplement system designed to...',
            brand: 'Maxine Laceby',
            adLink: 'https://app.gethookd.ai/share/ad/84153422?signature=7ad560908e2e3dcc433a078518f1023389bd27ac0dd78d81b57f3ae230fb5cde'
        },
        {
            hookQuote: 'As a world-leading expert in intermittent fasting',
            brand: 'Ancestral Supplements',
            adLink: 'https://app.gethookd.ai/share/ad/84072350?signature=22ebb9b6b824bfcc38f87c876e83297b3fe9d39664d72b7c1bfffcbb7a805af1'
        },
        {
            hookQuote: 'Celebrities are ditching expensive IV drips, collagen shots',
            brand: 'Cata-Kor',
            adLink: 'https://app.gethookd.ai/share/ad/84255499?signature=312d76a022db46bc024acf13590a540d8517e68f9dcd37761f23cde8520be58b'
        },
        {
            hookQuote: 'Unlock unstoppable power with Turkesterone',
            brand: 'Enflux Testosterone Support',
            adLink: 'https://app.gethookd.ai/share/ad/84190392?signature=dc28f1119a5e5d758a985971e64e279f6a53130bfbbe51272e3bdb6e87e2ff05'
        },
        {
            hookQuote: 'THEY DIDNT WANT US TO SHOW YOU THESE STATS',
            brand: 'T-Drive Testosterone Booster',
            adLink: 'https://app.gethookd.ai/share/ad/84158944?signature=d14bc506cc2d92b5d4a2f61f858e63ca1563c34cfcb9d0fc091f3b2bb884e685'
        },
        {
            hookQuote: 'Build Lean Muscle and Support Testosterone',
            brand: 'Cutler Nutrition',
            adLink: 'https://app.gethookd.ai/share/ad/84117464?signature=61abf673415b05710a764e6ab0b18663fc3285efca50da6a552210788df59aae'
        }
    ];
    
    // Simple CSV headers
    const headers = [
        'Tweet Copy',
        'Ad Link'
    ];
    
    const rows = secondaryContent.map(item => {
        const tweetCopy = `"${item.hookQuote}"\n\n${item.brand} is printing.\n\nUsed gethookd.ai to find this.`;
        
        return [
            tweetCopy,
            item.adLink
        ];
    });
    
    // Generate CSV
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tweet_copy_and_ads.csv"');
    res.send(csvContent);
});

// Secondary content page (old version)
app.get('/secondary-content', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'secondary-content.html'));
});

// Simple tweets page
app.get('/tweets', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'simple-tweets.html'));
});

// Webhook to send new content to Google Sheets via Apps Script
app.post('/api/webhook/google-sheets', async (req, res) => {
    try {
        const { content } = req.body;
        
        // Apps Script Web App URL (will be provided by Alex)
        const appsScriptUrl = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
        
        // Send content to Apps Script
        const response = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'addContent',
                data: content
            })
        });
        
        const result = await response.text();
        res.json({ success: true, result });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Auto-send content to Google Sheets when new secondary content is created
app.post('/api/content/secondary', async (req, res) => {
    try {
        const { posts } = req.body;
        
        // Format for Google Sheets
        const formattedPosts = posts.map(post => [
            post.content, // Tweet copy
            post.videoLink // Gethookd video link
        ]);
        
        // Send to webhook
        if (process.env.APPS_SCRIPT_URL) {
            await fetch(`${req.protocol}://${req.get('host')}/api/webhook/google-sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: formattedPosts })
            });
        }
        
        res.json({ success: true, posts: formattedPosts.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Dashboard running on port ${port}`);
    console.log(`📦 Database has ${getCount()} posts`);
});

// Migration endpoint - update CTA text in all posts
app.post('/api/migrate/update-cta', (req, res) => {
    const allContent = getAllContent();
    let updated = 0;
    const oldCTA = 'I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.';
    const newCTA = 'I use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.';
    for (const post of allContent) {
        if (post.content && post.content.includes(oldCTA)) {
            post.content = post.content.replace(oldCTA, newCTA);
            upsertContent(post);
            updated++;
        }
    }
    res.json({ updated, total: allContent.length });
});

// Migration endpoint - add missing Gethookd CTAs
app.post('/api/migrate/add-missing-ctas', (req, res) => {
    const allContent = getAllContent();
    const ctaSection = `\n\n2/2\n\nWant to find ads like this instantly? \n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.\n\n→ See what's converting in your niche\n→ Swipe proven hooks & angles  \n→ Skip months of trial & error\n\nTry it free: gethookd.ai`;
    
    let fixed = 0;
    const fixedPosts = [];
    
    for (const post of allContent) {
        if (post.content && !post.content.includes('I use @GetHookdAI')) {
            post.content = post.content + ctaSection;
            upsertContent(post);
            fixed++;
            fixedPosts.push({ id: post.id, title: post.title });
        }
    }
    
    res.json({ 
        fixed, 
        total: allContent.length, 
        fixedPosts,
        message: `Added Gethookd CTA to ${fixed} posts` 
    });
});

// Upload media files directly
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, MEDIA_DIR),
    filename: (req, file, cb) => cb(null, req.query.name || file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/media/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ success: true, filename: req.file.filename, size: req.file.size, path: `/media/${req.file.filename}` });
});

// Download media from URL to persistent storage
app.post('/api/media/download', async (req, res) => {
    const { url, filename } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    const fname = filename || path.basename(new URL(url).pathname);
    const dest = path.join(MEDIA_DIR, fname);
    try {
        const https = require('https');
        const http = require('http');
        const mod = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        await new Promise((resolve, reject) => {
            mod.get(url, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    mod.get(response.headers.location, (r2) => { r2.pipe(file); file.on('finish', () => { file.close(); resolve(); }); }).on('error', reject);
                } else {
                    response.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }
            }).on('error', reject);
        });
        const size = fs.statSync(dest).size;
        res.json({ success: true, filename: fname, size, path: `/media/${fname}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/media/list', (req, res) => {
    const files = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR).map(f => ({
        name: f, size: fs.statSync(path.join(MEDIA_DIR, f)).size
    })) : [];
    res.json({ count: files.length, files });
});

// Ad DNA reports - list HTML reports in media dir
app.get('/api/ad-dna/reports', (req, res) => {
    try {
        const files = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR) : [];
        const reports = files
            .filter(f => f.endsWith('.html') && f.includes('ad-dna'))
            .map(f => {
                const stat = fs.statSync(path.join(MEDIA_DIR, f));
                // Try to extract brand name from filename: brand-name-ad-dna-YYYYMMDD.html
                const match = f.match(/^(.+?)-ad-dna-(\d{4})(\d{2})(\d{2})\.html$/);
                let brand = f, date = '';
                if (match) {
                    brand = match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    date = `${match[2]}-${match[3]}-${match[4]}`;
                }
                // Try to extract scenes/duration from file content (first 2KB)
                let scenes = '', duration = '';
                try {
                    const head = fs.readFileSync(path.join(MEDIA_DIR, f), 'utf8').slice(0, 3000);
                    const scenesMatch = head.match(/(\d+)\s*scenes/);
                    const durationMatch = head.match(/(\d+:\d+)/);
                    if (scenesMatch) scenes = scenesMatch[1];
                    if (durationMatch) duration = durationMatch[1];
                } catch(e) {}
                return { filename: f, brand, date, scenes, duration, size: stat.size };
            })
            .sort((a, b) => b.date.localeCompare(a.date));
        res.json(reports);
    } catch(e) {
        res.json([]);
    }
});

// Debug endpoint - test media upload to Twitter
app.get('/api/debug/upload-test', async (req, res) => {
    try {
        const testFile = path.join(__dirname, '..', 'media', 'happy_mammoth.jpg');
        const exists = fs.existsSync(testFile);
        const size = exists ? fs.statSync(testFile).size : 0;
        if (!exists) return res.json({ error: 'File not found', testFile });
        
        const mediaId = await twitterClient.v1.uploadMedia(testFile);
        res.json({ success: true, mediaId, fileSize: size });
    } catch (e) {
        res.json({ error: e.message, code: e.code, data: e.data });
    }
});

// Debug endpoint - check media files
app.get('/api/debug/media', (req, res) => {
    const exists = fs.existsSync(MEDIA_DIR);
    const files = exists ? fs.readdirSync(MEDIA_DIR) : [];
    res.json({ __dirname, MEDIA_DIR, exists, fileCount: files.length, files: files.slice(0, 10) });
});

// Validate all media files referenced in content
app.get('/api/validate-media', (req, res) => {
    const allContent = getAllContent();
    const results = {
        totalPosts: allContent.length,
        postsWithMedia: 0,
        validMedia: 0,
        missingMedia: 0,
        zeroByteMedia: 0,
        externalMedia: 0,
        typeMismatch: 0,
        issues: []
    };
    
    for (const post of allContent) {
        if (post.mediaUrl) {
            results.postsWithMedia++;
            
            const urls = post.mediaUrl.split(',').map(u => u.trim()).filter(u => u);
            
            for (const url of urls) {
                if (url.startsWith('http')) {
                    results.externalMedia++;
                    continue;
                }
                if (url.startsWith('/media/')) {
                    const filename = url.replace('/media/', '');
                    const filePath = path.join(MEDIA_DIR, filename);
                    
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        
                        if (stats.size === 0) {
                            results.zeroByteMedia++;
                            results.issues.push({
                                postId: post.id,
                                postTitle: post.title,
                                mediaUrl: url,
                                issue: 'Zero-byte file',
                                status: post.status,
                                scheduledAt: post.scheduledAt
                            });
                        } else if (stats.size < 1000) {
                            results.issues.push({
                                postId: post.id,
                                postTitle: post.title,
                                mediaUrl: url,
                                issue: 'Suspiciously small file',
                                size: stats.size,
                                status: post.status,
                                scheduledAt: post.scheduledAt
                            });
                        } else {
                            results.validMedia++;
                        }
                    } else {
                        results.missingMedia++;
                        results.issues.push({
                            postId: post.id,
                            postTitle: post.title,
                            mediaUrl: url,
                            issue: 'File not found',
                            status: post.status,
                            scheduledAt: post.scheduledAt
                        });
                    }
                }
            }
        }
    }
    
    res.json(results);
});

// Auto-repair: re-download broken media from Gethookd API
app.post('/api/media/auto-repair', async (req, res) => {
    const GETHOOKD_API = 'https://api.gethookd.ai/api/v1';
    const GETHOOKD_KEY = process.env.GETHOOKD_API_KEY || 'gh_3ZgE6JQdC0xMcHYvO8JprHdfWE83jjuhHSv8kMWp9184aba0';
    const allContent = getAllContent();
    const results = { repaired: 0, failed: 0, skipped: 0, details: [] };
    
    // Only repair scheduled/approved posts with broken local media
    const needsRepair = allContent.filter(p => {
        if (p.status === 'posted' || p.status === 'draft') return false;
        if (!p.mediaUrl || p.mediaUrl.startsWith('http')) return false;
        const filePath = path.join(MEDIA_DIR, p.mediaUrl.replace('/media/', ''));
        return !fs.existsSync(filePath) || fs.statSync(filePath).size === 0;
    });
    
    for (const post of needsRepair) {
        try {
            // Extract ad ID from post content
            const adMatch = (post.content || '').match(/share\/ad\/(\d+)/);
            if (!adMatch) {
                // Try videoUrl as fallback
                if (post.videoUrl && post.videoUrl.startsWith('http')) {
                    const resp = await fetch(post.videoUrl);
                    if (resp.ok) {
                        const buffer = Buffer.from(await resp.arrayBuffer());
                        const filename = path.basename(new URL(post.videoUrl).pathname);
                        fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
                        updateContent(post.id, { mediaUrl: '/media/' + filename, mediaType: 'video' });
                        results.repaired++;
                        results.details.push({ id: post.id, action: 'downloaded from videoUrl' });
                        continue;
                    }
                }
                results.skipped++;
                results.details.push({ id: post.id, reason: 'no ad ID found in content' });
                continue;
            }
            
            const adId = adMatch[1];
            const adResp = await fetch(`${GETHOOKD_API}/ads/${adId}`, {
                headers: { 'Authorization': `Bearer ${GETHOOKD_KEY}` }
            });
            
            if (!adResp.ok) {
                results.failed++;
                results.details.push({ id: post.id, reason: `API ${adResp.status}` });
                continue;
            }
            
            const adData = await adResp.json();
            const media = (adData.media || adData.data?.media || []);
            
            if (!media.length) {
                results.failed++;
                results.details.push({ id: post.id, reason: 'no media in API response' });
                continue;
            }
            
            // Find best media URL
            let mediaUrl = null;
            let isVideo = false;
            
            // Prefer video
            for (const m of media) {
                const url = m.url || m.thumbnail_url || '';
                if (url.endsWith('.mp4')) { mediaUrl = url; isVideo = true; break; }
            }
            // Fallback to image
            if (!mediaUrl) {
                for (const m of media) {
                    const url = m.url || m.thumbnail_url || '';
                    if (url.match(/\.(jpg|jpeg|png|webp)/i)) { mediaUrl = url; break; }
                }
            }
            // Last resort: any URL
            if (!mediaUrl && media[0]) {
                mediaUrl = media[0].url || media[0].thumbnail_url;
            }
            
            if (!mediaUrl) {
                results.failed++;
                results.details.push({ id: post.id, reason: 'no usable URL in media array' });
                continue;
            }
            
            // Download
            const dlResp = await fetch(mediaUrl);
            if (!dlResp.ok) {
                results.failed++;
                results.details.push({ id: post.id, reason: `download failed ${dlResp.status}` });
                continue;
            }
            
            const buffer = Buffer.from(await dlResp.arrayBuffer());
            if (buffer.length < 1000) {
                results.failed++;
                results.details.push({ id: post.id, reason: `downloaded file too small (${buffer.length}b)` });
                continue;
            }
            
            const ext = isVideo ? '.mp4' : (mediaUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[0] || '.jpg');
            const filename = `${post.id.replace(/[^a-zA-Z0-9-]/g, '_')}${ext}`;
            fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
            updateContent(post.id, { mediaUrl: '/media/' + filename, mediaType: isVideo ? 'video' : 'image' });
            results.repaired++;
            results.details.push({ id: post.id, action: 'repaired', size: buffer.length, type: isVideo ? 'video' : 'image' });
            
            // Rate limit
            await new Promise(r => setTimeout(r, 200));
        } catch (e) {
            results.failed++;
            results.details.push({ id: post.id, reason: e.message });
        }
    }
    
    results.totalBroken = needsRepair.length;
    res.json(results);
});
