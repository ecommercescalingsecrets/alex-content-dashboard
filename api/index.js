const express = require('express');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.use('/media', express.static(path.join(__dirname, '..', 'media')));

// Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || 'GE8tk2RiScm2Lgz2w7VrzVmWS',
    appSecret: process.env.TWITTER_API_SECRET || 'sOKyYl47bqpQrf8PVqKsr6jw1wkFOUui2MDnqKWpkIADA17E9N',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-YKK7ctQKOkBRIIVxOnO0vdQD8MH1zy',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'iznbruGURnAgfrH1R0z7RIMxqYZGBbOpvHbfhGpa4tpV6'
});

// In-memory content DB
let contentDatabase = {
    "post-1": {
        id: "post-1",
        title: "PureLife Organics — Cortisol Belly",
        mediaUrl: "/media/purelife_cortisol.mp4",
        videoUrl: "/media/purelife_cortisol.mp4",
        mediaType: "video",
        content: `This brand is printing.

PureLife Organics. 41 days on this exact ad.

UGC. Woman lifting her shirt. No fancy fucking studio. Just a real person with a real gut problem.

The hook — "Doing This Deflated My Cortisol Belly" — is smart. Nobody knows what cortisol is but it sounds scientific enough to stop the scroll. And "deflated" hits different than "lose weight." It's visual. You can feel it.

They niched down HARD. Stressed women 40+ who've tried everything. That specificity is why their CPMs are stupid low.

Cortisol is the new gut health. Test this angle yesterday.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString(),
        scheduledAt: null,
        scheduledStatus: null
    },
    "post-2": {
        id: "post-2",
        title: "Happy Mammoth — Hormone Harmony",
        mediaUrl: "/media/happy_mammoth.jpg",
        mediaType: "image",
        content: `This brand is printing.

Happy Mammoth just hit me with "At 52, I got my figure back."

Not some bullshit before/after. A real woman saying she feels like herself again.

That line does more work than 99% of supplement ads. It's not selling hormones or botanicals. It's selling getting your life back.

Menopause market is fucking massive. Most brands talk about ingredients.

This brand talks about transformation.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-3": {
        id: "post-3",
        title: "O Positiv / URO — Vaginal Health Vitamin",
        mediaUrl: "/media/opositiv_vitamin.jpg",
        mediaType: "image",
        content: `This brand is printing.

O Positiv. URO. A vaginal health vitamin.

"I used to avoid sex. Now I want him all the time." That's the ad copy. On Facebook. And it's working.

Everyone else in this space says "supports vaginal pH balance." Nobody gives a shit. O Positiv went straight for the emotional outcome. Better sex life.

UGC selfie. Woman holding the product. Bright pink bottle. Looks like a friend recommending it, not a brand selling you something.

Women's health is wide open for brands willing to talk like real people. If your ad copy reads like a doctor's note, you've already lost.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-4": {
        id: "post-4",
        title: "Purely Nutrient — Black Seed Oil / Parasite Hook",
        mediaUrl: "/media/purely_nutrient_blackseed.mp4",
        videoUrl: "/media/purely_nutrient_blackseed.mp4",
        mediaType: "video",
        content: `This brand is printing.

"Watch what happens when you put a parasite in contact with Oregano Oil."

Microscope footage of a parasite dying. On your feed. While you're eating breakfast.

You can't NOT watch it. And once you're watching a parasite squirm, you're buying whatever kills it.

Purely Nutrient isn't even selling oregano oil. They're selling black seed oil. The parasite video is just the hook. Bait and switch but make it educational.

Parasite cleanse market is blowing up. People are convinced they have parasites.

Smart brands are riding that wave.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-5": {
        id: "post-5",
        title: "Dr. Blane Schilling — Surgeon Contrarian Authority",
        mediaUrl: "/media/dr_blane_joint.jpg",
        mediaType: "image",
        content: `This brand is printing.

Dr. Blane Schilling. 200+ knee replacements. Full scrubs. Hospital hallway.

And he's telling you surgery might not be the answer.

"For years, I believed it was the right thing to do..." A surgeon saying NOT to get surgery. Your brain short-circuits. Goes against everything you'd expect.

Authority marketing at its peak. Real doctor. Real setting. Contrarian angle. Impossible to ignore.

After that hook the ad doesn't even need to be good. You're already thinking "wait, what does he recommend instead?"

Selling a joint supplement without doctor authority content? One hand tied behind your back.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-6": {
        id: "post-6",
        title: "SereneSkincare — PDRN Patches",
        mediaUrl: "/media/serene_skincare.mp4",
        videoUrl: "/media/serene_skincare.mp4",
        mediaType: "video",
        content: `This brand is printing.

SereneSkincare. PDRN patches.

"I'm 42 and people think I'm in my early 30s." Testimonial lead. Simple.

PDRN. Most people have never heard of it. It's not retinol. It's not collagen. It's NEW. And "new" in skincare is crack for women scrolling Facebook at 10pm.

Patches as delivery? Genius. Not another cream or serum. A patch feels medical. Feels like it actually does something.

Anti-aging is a $60B market and crowded as hell. But find a novel mechanism people haven't seen 10,000 times and you carve out space fast.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-7": {
        id: "post-7",
        title: "FemiClear — Taboo Health Niche",
        mediaUrl: "/media/femiclear.mp4",
        videoUrl: "/media/femiclear.mp4",
        mediaType: "video",
        content: `This brand is printing.

FemiClear. 34 days running. Selling a herpes treatment. On Facebook. With a woman in a lab coat.

Most brands wouldn't touch this. That's exactly why FemiClear is crushing it. Zero creative competition because everyone's too scared.

"Before you panic... watch this." That hook is doing therapy and selling product at the same time.

The doctor figure removes the shame. Makes it medical, not personal. The person seeing this ad has been too embarrassed to go to the pharmacy. And here's a solution in their feed that looks legitimate.

Taboo health niches are goldmines. Less competition. Desperate buyers. High LTV because they NEED the product.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-8": {
        id: "post-8",
        title: "Savanna Skin — Tanning Gummies",
        mediaUrl: "/media/savanna_skin.jpg",
        mediaType: "image",
        content: `This brand is printing.

Woman laying in bed, tanned, cheeky text on her back.

Doesn't feel like an ad. Feels like a meme your friend sent you.

Savanna Skin cracked the code. In a feed full of "CLINICAL STUDIES SHOW" bullshit, this looks like entertainment.

Entertainment gets engagement. Engagement gets sales.

Perfect DTC product. Consumable. Repeat purchase. Before/after content makes itself.

Nobody's scrolling past "gummies that make you tan." Too weird NOT to click.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-9": {
        id: "post-9",
        title: "Emunah Beauty — Hair Vitamins Specialist Listicle",
        mediaUrl: "/media/emunah_hair.jpg",
        mediaType: "image",
        content: `This brand is printing.

Emunah Beauty. Hair vitamins. But the ad isn't from the brand — it's from a "Certified Trichologist & Scalp Specialist."

"I've tested hundreds of hair vitamins. Here are the top 5 that actually work."

Doesn't feel like an ad. Feels like expert advice. You trust it immediately.

Clean creative. Split layout — problem on the left, solution on the right. Your eye goes straight to "which ones made the cut?"

This isn't even Emunah's page running the ad. It's the specialist's page. Brand pays the expert, expert recommends the product, customer trusts the expert. Everyone wins.

Not running a "specialist reviews top 5" format? Test it this week. Works across every health niche.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-10": {
        id: "post-10",
        title: "Try UltimaPeak — Shilajit/Ashwagandha/Sea Moss Stack",
        mediaUrl: "/media/ultimapeak.mp4",
        videoUrl: "/media/ultimapeak.mp4",
        mediaType: "video",
        content: `This brand is printing.

POV hook looking down at your feet in the bathroom. You have no idea what's coming.

That's the point.

UltimaPeak found the three most hyped men's health ingredients on TikTok and put them in one gummy. That's not innovation — that's reading the room.

"See results in 6-8 weeks." Under-promise. Guys feel something in 2 weeks, think it's a miracle.

That's how you get organic reviews and repeat orders.

Trend-jack ingredients while they're hot. Don't invent anything. Combine what's already working.

NOW GO FUCKING PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    }
};

// Add scheduling fields to existing content
Object.values(contentDatabase).forEach(item => {
    if (!item.hasOwnProperty('scheduledAt')) item.scheduledAt = null;
    if (!item.hasOwnProperty('scheduledStatus')) item.scheduledStatus = null;
    if (!item.hasOwnProperty('feedbackHistory')) item.feedbackHistory = [];
});

// Scheduler - check every minute for content that should be posted
async function scheduleChecker() {
    console.log('⏰ Checking for scheduled content...');
    const now = new Date();
    
    Object.values(contentDatabase).forEach(async (item) => {
        if (item.scheduledStatus === 'scheduled' && 
            item.scheduledAt && 
            item.status === 'approved' &&
            new Date(item.scheduledAt) <= now) {
            
            console.log(`📅 Auto-posting scheduled content: ${item.title}`);
            item.scheduledStatus = 'posting';
            
            try {
                // Post the content to Twitter (same logic as manual post)
                const text = item.content;
                if (text.length <= 280) {
                    const tweet = await twitterClient.v2.tweet(text);
                    item.status = 'posted';
                    item.scheduledStatus = 'posted';
                    item.tweetId = tweet.data.id;
                    item.postedAt = new Date().toISOString();
                    console.log(`✅ Successfully posted: ${item.title}`);
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
                    item.scheduledStatus = 'posted';
                    item.tweetIds = tweetIds;
                    item.postedAt = new Date().toISOString();
                    console.log(`✅ Successfully posted thread: ${item.title}`);
                }
            } catch (err) {
                console.error(`❌ Failed to post scheduled content ${item.title}:`, err);
                item.scheduledStatus = 'failed';
            }
        }
    });
}

// Start the scheduler
setInterval(scheduleChecker, 60000); // Every minute

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

app.post('/api/content/:id/schedule', (req, res) => {
    const item = contentDatabase[req.params.id];
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });
    
    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    item.scheduledAt = scheduledAt;
    item.scheduledStatus = 'scheduled';
    
    res.json(item);
});

app.post('/api/content/:id/feedback', (req, res) => {
    const item = contentDatabase[req.params.id];
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    const { feedback } = req.body;
    if (!feedback || feedback.trim() === '') {
        return res.status(400).json({ error: 'Feedback text is required' });
    }
    
    const feedbackEntry = {
        text: feedback.trim(),
        createdAt: new Date().toISOString()
    };
    
    item.feedbackHistory.push(feedbackEntry);
    res.json(item);
});

app.get('/api/content/scheduled/week', (req, res) => {
    // Get current week (Monday-Sunday)
    const now = new Date();
    const mondayOfWeek = new Date(now);
    mondayOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    mondayOfWeek.setHours(0, 0, 0, 0);
    
    const sundayOfWeek = new Date(mondayOfWeek);
    sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
    sundayOfWeek.setHours(23, 59, 59, 999);
    
    const scheduledThisWeek = Object.values(contentDatabase).filter(item => {
        if (!item.scheduledAt) return false;
        const scheduledDate = new Date(item.scheduledAt);
        return scheduledDate >= mondayOfWeek && scheduledDate <= sundayOfWeek;
    });
    
    res.json({
        weekStart: mondayOfWeek.toISOString(),
        weekEnd: sundayOfWeek.toISOString(),
        scheduled: scheduledThisWeek
    });
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
