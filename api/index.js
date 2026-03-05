const express = require('express');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || 'YXFGhtTBSbipbkuDI2Lt7vemt',
    appSecret: process.env.TWITTER_API_SECRET || 'rfIzIamcswhW1pGmuxAokivSnkCQUgu1U4Gv79Nc3fM2fDGjNL',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-InwEEOM5NITevI55zn4EBwnYXKsW6P',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'p2yBey5EeDVdswZPBulnM3soaLKusRDsXj1AjsLP9XGIB'
});

// In-memory content DB
let contentDatabase = {
    "post-1": {
        id: "post-1",
        title: "3-Problem Rollup Ad Format - Tactical Breakdown",
        content: `This ad format is printing $50K+/day for supplement brands right now.

It's the "3-problem rollup" structure and most people are doing it wrong.

Here's the exact breakdown from 500+ winning ads: 🧵

1/ Hook: "If you're dealing with [problem 1], [problem 2], AND [problem 3]..."

Example: "If you're dealing with brain fog, afternoon crashes, AND can't focus past 2pm..."

This works because it qualifies 3 different audiences in one hook.

2/ The structure that's working:
- Problem 1 (15 seconds)
- Problem 2 (15 seconds) 
- Problem 3 (15 seconds)
- Single solution reveal (15 seconds)

60-second format dominates right now.

3/ Why most people fail:
They pick random problems. Winners pick problems that CASCADE.

Brain fog → leads to → afternoon crashes → leads to → focus issues

Each problem reinforces the next. It's a problem STORY, not a problem LIST.

4/ The conversion secret:
After the 3 problems, they don't pitch the product.
They pitch the FEELING of the solution.

"Imagine waking up with laser focus that lasts until bedtime..."

5/ Exact creative specs that work:
- First 3 seconds: Fast-cut problem montage
- Seconds 3-45: Single person explaining cascade
- Seconds 45-60: Transformation visual
- CTA: "Get [specific benefit] in [timeframe]"

6/ Testing framework:
Test 3 different problem cascades for same product:
- Physical cascade (pain → fatigue → limitation)
- Mental cascade (stress → overwhelm → burnout)  
- Social cascade (insecurity → isolation → depression)

One will dominate. Scale that.

This format is working across supplements, skincare, productivity tools.

What cascade pattern fits your product? 👇`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-2": {
        id: "post-2",
        title: "Cascade Budget Testing - $30K+ Media Buyers",
        content: `Most media buyers waste 40% of test budget on losers they should've killed on Day 1.

Here's the "Cascade Budget Testing" method I've seen $30K+/day buyers use to find winners 3x faster:

🧵

1/ The problem with equal-split testing:
You give 5 ads $20/day each = $100/day
After 3 days you spent $300 and MAYBE have a signal.

Cascade method: Same $100/day but you know your winner in 24-48 hours.

2/ How it works:
Day 1: All 5 ads get $10/day ($50 total)
- Kill anything with CPM >2x your niche average by hour 6
- Kill anything with <1% CTR by hour 12

Day 2: Survivors get graduated budget:
- Top performer: $40/day
- Runner up: $25/day  
- Third place: $15/day

3/ The graduation metrics (supplement niche specific):
✅ ADVANCE if: CTR >1.8%, CPM <$45, thumb-stop >25%
⚠️ WATCH if: CTR 1.2-1.8%, CPM $45-60
❌ KILL if: CTR <1.2%, CPM >$60, or no adds-to-cart by hour 8

4/ Day 3-4 scaling rules:
Winner from Day 2 → $100/day
If ROAS >2x at $100 → $250/day
If ROAS holds at $250 → $500/day

Each jump = 2.5x. Never more than 3x in one day or you'll reset the learning phase.

5/ The kill discipline most people lack:
Set a HARD rule: If an ad hasn't produced a purchase by 2x your target CPA in spend, it's dead.

Target CPA $30? Kill at $60 spend with zero purchases. No exceptions. No "let it learn."

6/ Why this beats traditional testing:
- Equal split: $300 over 3 days to find a winner
- Cascade: $150 over 2 days with MORE data on the winner

You spend MORE on winners FASTER and cut losers EARLIER.

Real numbers from a supplement brand: Found their best Q4 ad in 36 hours, scaled to $2K/day by Day 5.

Who's testing more than 5 creatives per week? Drop your weekly test volume 👇`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    }
};

// API Routes
app.get('/api/content', (req, res) => {
    res.json(Object.values(contentDatabase));
});

app.get('/api/content/:id', (req, res) => {
    const item = contentDatabase[req.params.id];
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
});

app.post('/api/content/:id/approve', (req, res) => {
    const item = contentDatabase[req.params.id];
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    res.json(item);
});

app.post('/api/content/:id/post', async (req, res) => {
    const item = contentDatabase[req.params.id];
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    try {
        // Split into thread if content is long
        const text = item.content;
        if (text.length <= 280) {
            const tweet = await twitterClient.v2.tweet(text);
            item.status = 'posted';
            item.tweetId = tweet.data.id;
            item.postedAt = new Date().toISOString();
            res.json({ success: true, tweetId: tweet.data.id, item });
        } else {
            // Post as thread — split on numbered sections
            const parts = text.split(/\n\n(?=\d+\/)/).filter(Boolean);
            const hook = parts.shift(); // First part is the hook
            
            let lastTweetId = null;
            const tweetIds = [];
            
            // Post hook
            const first = await twitterClient.v2.tweet(hook.substring(0, 280));
            lastTweetId = first.data.id;
            tweetIds.push(lastTweetId);
            
            // Post thread replies
            for (const part of parts) {
                const chunk = part.substring(0, 280);
                const reply = await twitterClient.v2.reply(chunk, lastTweetId);
                lastTweetId = reply.data.id;
                tweetIds.push(lastTweetId);
            }
            
            item.status = 'posted';
            item.tweetIds = tweetIds;
            item.postedAt = new Date().toISOString();
            res.json({ success: true, tweetIds, item });
        }
    } catch (err) {
        console.error('Twitter post error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/content', (req, res) => {
    const { title, content, target } = req.body;
    const id = 'post-' + Date.now();
    contentDatabase[id] = {
        id, title, content, target: target || 'Solo ecommerce founders',
        status: 'review', createdAt: new Date().toISOString()
    };
    res.json(contentDatabase[id]);
});

app.delete('/api/content/:id', (req, res) => {
    delete contentDatabase[req.params.id];
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Dashboard running on port ${port}`);
});
