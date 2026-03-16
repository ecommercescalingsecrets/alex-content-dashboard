const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { TwitterApi } = require('twitter-api-v2');
const { getAllContent, getContent, upsertContent, deleteContent, getCount } = require('./db');
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

// Media directory: local only
const MEDIA_DIR = path.join(__dirname, '..', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

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
    appKey: process.env.TWITTER_API_KEY || '2U2KZG8ljE1wLXCySzhBswCyO',
    appSecret: process.env.TWITTER_API_SECRET || 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP'
});

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
        const itemsToPost = allContent.filter(item => 
            item.scheduledStatus === 'scheduled' &&
            item.scheduledAt &&
            item.status === 'approved' &&
            new Date(item.scheduledAt) <= now
        );

        if (itemsToPost.length > 0) {
            console.log(`⏰ Found ${itemsToPost.length} scheduled item(s) to post at ${now.toISOString()}`);
        }

        // Process each post independently
        for (const item of itemsToPost) {
            console.log(`📅 Auto-posting scheduled content: ${item.title}`);
            item.scheduledStatus = 'posting';
            upsertContent(item);

            try {
                const text = item.content;
                let mediaId = null;

                if (item.mediaUrl) {
                    try {
                        const mediaPath = path.join(MEDIA_DIR, path.basename(item.mediaUrl));
                        if (fs.existsSync(mediaPath)) {
                            mediaId = await twitterClient.v1.uploadMedia(mediaPath);
                        }
                    } catch (mediaError) {
                        console.error('Scheduled media upload failed:', mediaError);
                    }
                }

                const tweets = splitIntoTweets(text);
                let lastTweetId = null;
                const tweetIds = [];

                for (let i = 0; i < tweets.length; i++) {
                    if (i === 0) {
                        const opts = { text: tweets[i] };
                        if (mediaId) opts.media = { media_ids: [mediaId] };
                        const result = await twitterClient.v2.tweet(opts);
                        lastTweetId = result.data.id;
                    } else {
                        const result = await twitterClient.v2.reply(tweets[i], lastTweetId);
                        lastTweetId = result.data.id;
                    }
                    tweetIds.push(lastTweetId);
                }

                item.status = 'posted';
                item.scheduledStatus = 'posted';
                item.tweetIds = tweetIds;
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

// Health check endpoint
app.get('/api/health', (req, res) => {
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
function splitIntoTweets(text, maxLen = 280) {
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

    if (item.mediaUrl) {
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
    console.log(`Posting ${tweets.length} tweet(s), media: ${!!mediaId}`);

    let lastTweetId = null;
    const tweetIds = [];

    for (let i = 0; i < tweets.length; i++) {
        if (i === 0) {
            const opts = { text: tweets[i] };
            if (mediaId) opts.media = { media_ids: [mediaId] };
            const result = await twitterClient.v2.tweet(opts);
            lastTweetId = result.data.id;
        } else {
            const result = await twitterClient.v2.reply(tweets[i], lastTweetId);
            lastTweetId = result.data.id;
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

    try {
        const { tweetIds, hasMedia } = await postItemToTwitter(item);
        item.status = 'posted';
        item.tweetIds = tweetIds;
        item.postedAt = new Date().toISOString();
        upsertContent(item);
        res.json({ success: true, tweetIds, item, hasMedia });
    } catch (err) {
        console.error('Twitter post-now error:', err);
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
    const { title, content, target } = req.body;
    const id = 'post-' + Date.now();
    const item = {
        id, title, content, target: target || 'Solo ecommerce founders',
        status: 'review', createdAt: new Date().toISOString(), feedbackHistory: []
    };
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
    
    const fields = ['content', 'title', 'mediaUrl', 'videoUrl', 'mediaType', 'status', 'target', 'replyContent', 'scheduledAt', 'scheduledStatus'];
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

// ── Google Sheets Integration (via Apps Script webhook) ──
const GOOGLE_SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbzxUuXQiLE93pFTXXKtVKfN3M8P2fMUuajTZL4YnV0CkL3dWX9sDsaUKYshoAmabFz8/exec';

app.post('/api/google-sheets/push', async (req, res) => {
    try {
        const { status } = req.body;
        let content = getAllContent();

        if (status && status !== 'all') {
            if (status === 'scheduled') {
                content = content.filter(p => p.status === 'approved' && p.scheduledAt);
            } else {
                content = content.filter(p => p.status === status);
            }
        }

        const rows = content.map(post => ({
            id: post.id || '',
            title: post.title || '',
            content: post.content || '',
            status: post.status || '',
            target: post.target || '',
            createdAt: post.createdAt || '',
            approvedAt: post.approvedAt || '',
            scheduledAt: post.scheduledAt || '',
            postedAt: post.postedAt || '',
            tweetIds: Array.isArray(post.tweetIds) ? post.tweetIds.join(', ') : (post.tweetIds || ''),
            mediaUrl: post.mediaUrl || ''
        }));

        const response = await fetch(GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows }),
            redirect: 'follow'
        });

        const text = await response.text();
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }

        res.json({ success: true, rowsPushed: rows.length, filter: status || 'all' });
    } catch (error) {
        console.error('Google Sheets push error:', error);
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

app.get('/api/media/list', (req, res) => {
    const mediaDir = path.join(__dirname, '..', 'media');
    const files = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir).map(f => ({
        name: f, size: fs.statSync(path.join(mediaDir, f)).size
    })) : [];
    res.json({ count: files.length, files });
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
    const mediaDir = path.join(__dirname, '..', 'media');
    const exists = fs.existsSync(mediaDir);
    const files = exists ? fs.readdirSync(mediaDir) : [];
    res.json({ __dirname, mediaDir, exists, fileCount: files.length, files: files.slice(0, 10) });
});

// Validate all media files referenced in content
app.get('/api/validate-media', (req, res) => {
    const allContent = getAllContent();
    const mediaDir = path.join(__dirname, '..', 'media');
    const results = {
        totalPosts: allContent.length,
        postsWithMedia: 0,
        validMedia: 0,
        missingMedia: 0,
        issues: []
    };
    
    for (const post of allContent) {
        if (post.mediaUrl) {
            results.postsWithMedia++;
            
            const urls = post.mediaUrl.split(',').map(u => u.trim()).filter(u => u);
            
            for (const url of urls) {
                if (url.startsWith('/media/')) {
                    const filename = url.replace('/media/', '');
                    const filePath = path.join(mediaDir, filename);
                    
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        results.validMedia++;
                        
                        // Check for suspiciously small video files
                        if (filename.endsWith('.mp4') && stats.size < 1000) {
                            results.issues.push({
                                postId: post.id,
                                postTitle: post.title,
                                mediaUrl: url,
                                issue: 'Suspiciously small video file',
                                size: stats.size
                            });
                        }
                    } else {
                        results.missingMedia++;
                        results.issues.push({
                            postId: post.id,
                            postTitle: post.title,
                            mediaUrl: url,
                            issue: 'File not found',
                            filePath
                        });
                    }
                }
            }
        }
    }
    
    res.json(results);
});
