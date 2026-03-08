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
app.use('/media', express.static(path.join(__dirname, '..', 'media')));
app.use('/swipe-files', express.static(path.join(__dirname, '..', 'swipe-files')));

// Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || 'GE8tk2RiScm2Lgz2w7VrzVmWS',
    appSecret: process.env.TWITTER_API_SECRET || '0qkd32x0zrFCMwz82jQ1rEiIMz4bZcjsn5VMQ2dJotcBF',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-N87IPBArKrnFK3RgkzKMjEHgTLSiGi',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'GP71kjepc0z20uc8j3f9ZURpNwe_CKmFEasOCoG_MXCwMCQjwF'
});

// Scheduler - check every minute for content that should be posted
async function scheduleChecker() {
    console.log('⏰ Checking for scheduled content...');
    const now = new Date();
    const allContent = getAllContent();

    for (const item of allContent) {
        if (item.scheduledStatus === 'scheduled' &&
            item.scheduledAt &&
            item.status === 'approved' &&
            new Date(item.scheduledAt) <= now) {

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
                            const mediaUpload = await twitterClient.v1.uploadMedia(mediaPath);
                            mediaId = mediaUpload.media_id_string;
                        }
                    } catch (mediaError) {
                        console.error('Scheduled media upload failed:', mediaError);
                    }
                }

                if (text.length <= 280) {
                    const tweetOptions = { text };
                    if (mediaId) tweetOptions.media = { media_ids: [mediaId] };
                    const tweet = await twitterClient.v2.tweet(tweetOptions);
                    item.status = 'posted';
                    item.scheduledStatus = 'posted';
                    item.tweetId = tweet.data.id;
                    item.postedAt = new Date().toISOString();
                } else {
                    const parts = text.split(/\n\n(?=\d+\/)/).filter(Boolean);
                    const hook = parts.shift();
                    let lastTweetId = null;
                    const tweetIds = [];

                    const firstTweetOptions = { text: hook.substring(0, 280) };
                    if (mediaId) firstTweetOptions.media = { media_ids: [mediaId] };
                    const first = await twitterClient.v2.tweet(firstTweetOptions);
                    lastTweetId = first.data.id;
                    tweetIds.push(lastTweetId);

                    for (const part of parts) {
                        const reply = await twitterClient.v2.reply(part.substring(0, 280), lastTweetId);
                        lastTweetId = reply.data.id;
                        tweetIds.push(lastTweetId);
                    }

                    item.status = 'posted';
                    item.scheduledStatus = 'posted';
                    item.tweetIds = tweetIds;
                    item.postedAt = new Date().toISOString();
                }
                upsertContent(item);
                console.log(`✅ Successfully posted scheduled: ${item.title}`);
            } catch (err) {
                console.error(`❌ Failed to post scheduled content ${item.title}:`, err);
                item.scheduledStatus = 'failed';
                upsertContent(item);
            }
        }
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

app.post('/api/content/:id/post', async (req, res) => {
    const item = getContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    try {
        const text = item.content;
        let mediaId = null;

        if (item.mediaUrl) {
            try {
                const mediaPath = path.join(__dirname, '..', item.mediaUrl);
                if (fs.existsSync(mediaPath)) {
                    const mediaUpload = await twitterClient.v1.uploadMedia(mediaPath);
                    mediaId = mediaUpload.media_id_string;
                }
            } catch (mediaError) {
                console.error('Media upload failed:', mediaError);
            }
        }

        if (text.length <= 280) {
            const tweetOptions = { text };
            if (mediaId) tweetOptions.media = { media_ids: [mediaId] };
            const tweet = await twitterClient.v2.tweet(tweetOptions);
            item.status = 'posted';
            item.tweetId = tweet.data.id;
            item.postedAt = new Date().toISOString();
            upsertContent(item);
            res.json({ success: true, tweetId: tweet.data.id, item, hasMedia: !!mediaId });
        } else {
            const parts = text.split(/\n\n(?=\d+\/)/).filter(Boolean);
            const hook = parts.shift();
            let lastTweetId = null;
            const tweetIds = [];

            const firstTweetOptions = { text: hook.substring(0, 280) };
            if (mediaId) firstTweetOptions.media = { media_ids: [mediaId] };
            const first = await twitterClient.v2.tweet(firstTweetOptions);
            lastTweetId = first.data.id;
            tweetIds.push(lastTweetId);

            for (const part of parts) {
                const reply = await twitterClient.v2.reply(part.substring(0, 280), lastTweetId);
                lastTweetId = reply.data.id;
                tweetIds.push(lastTweetId);
            }

            item.status = 'posted';
            item.tweetIds = tweetIds;
            item.postedAt = new Date().toISOString();
            upsertContent(item);
            res.json({ success: true, tweetIds, item, hasMedia: !!mediaId });
        }
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
