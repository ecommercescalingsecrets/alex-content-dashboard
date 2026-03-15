const express = require('express');
const path = require('path');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const { getAllContent, getContent, upsertContent, deleteContent, getCount } = require('./db');

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

// Enhanced media serving with proper headers for videos
app.use('/media', (req, res, next) => {
    const filePath = path.join(__dirname, '..', 'media', req.path);
    
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
}, express.static(path.join(__dirname, '..', 'media')));

app.use('/swipe-files', express.static(path.join(__dirname, '..', 'swipe-files')));

// Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || '2U2KZG8ljE1wLXCySzhBswCyO',
    appSecret: process.env.TWITTER_API_SECRET || 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP'
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
                        const mediaPath = path.join(__dirname, '..', item.mediaUrl);
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

// API Routes
app.get('/api/content', (req, res) => {
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
            const mediaPath = path.join(__dirname, '..', item.mediaUrl);
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
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'media')),
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
