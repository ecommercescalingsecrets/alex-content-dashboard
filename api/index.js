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

PureLife Organics. 41 days running this exact ad. They're not stopping because it's working.

Look at this shit. UGC. Woman lifting her shirt. No fancy studio. No $10K production. Just a real person with a real gut problem.

The hook — "Doing This Deflated My Cortisol Belly" — is fucking smart. Nobody knows what cortisol is but it sounds scientific enough to make you stop scrolling. And "deflated" is way better than "lose weight." It's specific. It's visual. You can feel it.

They niched down HARD. This isn't for "people who want to lose weight." This is for stressed out women 40+ who've tried everything and still have that stubborn belly. That specificity is why their CPMs are probably stupid low.

Cortisol is the new gut health. Every supplement brand should be testing this angle yesterday.

NOW GO PRINT 🔥`,
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

Happy Mammoth. "Hormone Harmony." Running 91-score ads targeting women 40+ going through menopause.

Read that copy. "At 52, I got my figure back. It's been 12 years since I've felt this good in my body."

That's not an ad. That's a fucking testimonial that hits you in the chest. Every woman over 45 just stopped scrolling.

Product shot with REAL stats. Not "clinically proven" bullshit. Actual numbers — weight loss, energy, bloating. They let the results sell it.

Pink branding. Clean. Feminine. Doesn't look like a supplement — looks like something your girlfriend would recommend. That's intentional. They're building a lifestyle brand, not a pill company.

And "Hormone Harmony" as a product name? Genius. It tells you EXACTLY what it does in two words. No confusion. No explanation needed.

The menopause supplement market is absolutely massive and most brands are running garbage creative. Happy Mammoth gets it — lead with the transformation, not the ingredients.

NOW GO PRINT 🔥`,
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

O Positiv with URO. A vaginal health vitamin. Yeah, you read that right.

"I used to avoid sex. Now I want him all the time." That's the actual ad copy. On Facebook. And it's working.

Why? Because everyone else in this space is being clinical and boring. "Supports vaginal pH balance." Cool, nobody gives a shit. O Positiv went straight for the emotional outcome. Better sex life. Period.

UGC selfie. Woman holding the product, smiling. Bright pink bottle. Looks like she's recommending it to her best friend, not selling you something.

This is a masterclass in going where other brands won't. Most supplement companies would never run copy this direct. And that's exactly why it works — it cuts through all the safe, sanitized garbage in the feed.

The women's health supplement space is wide open for brands willing to actually talk like real people. If your ad copy reads like a doctor's note, you've already lost.

NOW GO PRINT 🔥`,
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

Purely Nutrient. Black seed oil. They found an angle nobody else is using.

"Watch what happens when you put a parasite in contact with Oregano Oil." Actual microscope footage of a parasite dying. On your feed. While you're eating breakfast.

Disgusting? Yes. Scroll-stopping? Absolutely.

This is the gross-out hook done perfectly. You can't NOT watch it. And once you're watching a parasite squirm under a microscope, you're 100% buying whatever kills it.

But here's the real play — they're not even selling oregano oil. They're selling black seed oil with higher thymoquinone concentration. The parasite video is just the hook to get you in the door. Bait and switch but make it educational.

The gut health / parasite cleanse market is blowing up right now. People are convinced they have parasites (thanks TikTok). Smart brands are riding that wave hard.

If you're in the supplement space and not testing a "what's living inside you" angle... you're sleeping.

NOW GO PRINT 🔥`,
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

Dr. Blane Schilling. 200+ knee replacements. Full scrubs. Hospital hallway. And he's telling you surgery might not be the answer.

"For years, I believed it was the right thing to do..."

A surgeon telling you NOT to get surgery. That's the hook. That's the whole ad. Your brain short-circuits because it goes against everything you'd expect.

This is authority marketing at its absolute peak. Real doctor. Real credentials. Real setting. And the contrarian angle — the surgeon who changed his mind — makes it impossible to ignore.

The ad doesn't even need to be good after the hook. You're already in. You're already thinking "wait, what does he recommend instead?"

If you're selling a joint supplement and you're not using doctor authority content, you're fighting with one hand tied behind your back. Find a real practitioner. Put them in scrubs. Give them a contrarian take. Let them sell.

NOW GO PRINT 🔥`,
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

SereneSkincare. PDRN patches. Anti-aging but with a twist.

"I'm 42 and people think I'm in my early 30s." Five stars. Testimonial lead. Nothing fancy.

But here's what's smart — PDRN. Most people have never heard of it. That's the secret weapon. It's not retinol. It's not collagen. It's something NEW. And "new" in skincare is crack for women scrolling Facebook at 10pm.

The "secret weapon" framing turns a random ingredient into something exclusive. Like she found a cheat code nobody else knows about.

Patches as a delivery mechanism is also genius. It's different. It's visual. It's not another cream or serum. People are tired of those. A patch feels medical. Feels serious. Feels like it actually does something.

Anti-aging is a $60B+ market and it's crowded as hell. But if you find a novel mechanism — something people haven't seen 10,000 times — you can still carve out space fast.

NOW GO PRINT 🔥`,
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

FemiClear. 34 days running. Doctor authority + embarrassing health problem = unstoppable combo.

"Over 90% of users reported less severe symptoms." They're selling a herpes treatment. On Facebook. With a woman in a lab coat.

Most brands wouldn't touch this niche with a ten-foot pole. And that's exactly why FemiClear is crushing it. Zero competition on the creative side because everyone else is too scared to run ads about it.

Think about the person seeing this ad. They've been too embarrassed to go to the pharmacy. Too ashamed to ask their doctor. And here's a solution showing up in their feed that looks clinical and legitimate.

The doctor/authority figure removes the shame. Makes it feel medical, not personal. "Before you panic... watch this" — that hook is doing therapy and selling product at the same time.

Taboo health niches are goldmines if you have the balls to run the ads. Less competition. Desperate buyers. High LTV because they NEED the product.

NOW GO PRINT 🔥`,
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

Savanna Skin. Tanning gummies. A supplement that gives you a tan without the sun.

Look at this creative. Woman laying in bed, tanned, with cheeky text written on her back. It's fun. It's sexy. It doesn't feel like an ad at all — it feels like a meme your friend sent you.

That's the whole play. In a feed full of "CLINICAL STUDIES SHOW" and "DOCTOR RECOMMENDED" bullshit, this looks like entertainment. And entertainment gets engagement.

Tanning gummies are a perfect DTC product. Consumable. Repeat purchase. Massive TAM (every woman who wants a tan). Low COGS. And the before/after content practically makes itself.

The branding is smart too. Brown pouch, minimal design. Looks premium. Looks Instagram-worthy. She'll post it on her story. Free marketing.

Novel product formats win on Facebook. Nobody's scrolling past "gummies that make you tan." It's too weird NOT to click.

NOW GO PRINT 🔥`,
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

This is the listicle authority play. And it's one of the most effective formats on Facebook right now. Here's why:

It doesn't feel like an ad. It feels like expert advice. A specialist who's tested everything is telling you what actually works. You trust it immediately.

The creative is clean as hell too. Split layout — problem on the left (thinning hair photo), solution on the right (list format). Your eye goes straight to "which ones made the cut?"

And notice — this isn't even Emunah's page running the ad. It's the specialist's page. Third-party credibility. The brand pays the expert, the expert recommends the product, the customer trusts the expert over the brand. Everyone wins.

If you're selling any supplement and not running a "specialist reviews top 5" format, test it this week. It works across every health niche.

NOW GO PRINT 🔥`,
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

Try UltimaPeak. Shilajit + Ashwagandha + Sea Moss. All in one gummy.

They took the three most hyped men's health ingredients on TikTok and combined them into a single product. That's not innovation — that's reading the room and moving fast.

The hook on this video is a POV shot looking down at your feet in the bathroom. Weird? Yes. Attention-grabbing? Hell yes. You have no idea what's coming next and that's the whole point.

"See results in 6-8 weeks." They're setting expectations upfront. Smart. Under-promise so when guys feel something in 2 weeks, they think it's a miracle. That's how you get organic reviews and repeat orders.

The men's supplement stack market is exploding. Shilajit went from nobody knowing what it is to every dude on the internet talking about it in like 6 months. Sea moss same thing.

Trend-jacking ingredients while they're hot is one of the fastest ways to build a supplement brand. You don't need to invent anything. Just combine what's already working.

NOW GO PRINT 🔥`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    }
};

// Add scheduling fields to existing content
Object.values(contentDatabase).forEach(item => {
    if (!item.hasOwnProperty('scheduledAt')) item.scheduledAt = null;
    if (!item.hasOwnProperty('scheduledStatus')) item.scheduledStatus = null;
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
