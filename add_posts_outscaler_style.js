// Batch 4: 20 posts reverse-engineered from @Outscaler's content formulas
// Each post breaks down a REAL ad from the Gethookd API
// Run: node add_posts_outscaler_style.js
const fetch = require('node-fetch');
const { upsertContent, getCount } = require('./api/db');

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL
    || 'https://script.google.com/macros/s/AKfycbzw2h8SkxlhgWzElUUm9lSaR6lv6ronDRuvs-3DuQ3ceGGgr5KQdcBMCrfL0UwL5TJP/exec';

const gethookdCTA = `

2/2

Want to find ads like this instantly?

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles
→ Skip months of trial & error

Try it free: gethookd.ai`;

const posts = [
    // ============================================
    // FORMULA 1: REVENUE PROOF + AD BREAKDOWN
    // "$[X] active ads" → real brand → what makes it work → non-obvious insight
    // ============================================
    {
        id: "post-31",
        title: "Somnia — Nasal Dilator (198 Days Active)",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85321096/media-2d6635e9fc86_preview.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/85321096?signature=03f46fb934b5a3704dec9862948c75ee3cb46498645dff22d3b6043288ef4c7b",
        content: `"Save Your Partner's Sleep (and Yours!)"

This ad has been running for 198 days straight. Performance score: 91.

Somnia. 10 active Meta ads. Selling a nasal dilator for snoring.

The hook? They don't sell to the snorer. They sell to the PARTNER.

"Tired of getting the elbow for snoring?" — that's relationship pain, not health pain.

When you reframe who the buyer is, everything changes. The partner buys it as a gift. The snorer never would've bought it themselves.

Sell to the person who suffers from the problem, not the person who HAS the problem.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-32",
        title: "Testolite — Red Light Therapy (89 Active Ads)",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85318048/media-6db473b8c990_resized.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/85318048?signature=1676204bd6814347fb25c94f17157702b96329227fbd827bf457c06cda27a274",
        content: `"Is Testolite a scam?"

That's their actual headline. And it's genius.

Testolite. 89 active Meta ads. Performance score: 91. Selling a red light device for testosterone.

They open with the EXACT objection their audience is thinking. Then spend the entire ad overcoming it.

"10,000+ guys are using Testolite devices right now."
"We've sold out three times this year."
"60-day money-back guarantee."

This is advertorial-style copy running as a Meta ad. Long-form. Story-driven. Objection-first.

Most brands run from objections. The best ones lead with them.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-33",
        title: "Hellobloomkids — ADHD Supplements (109 Days Active)",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84922888/media-025f6d234bf1.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84922888?signature=9069f79f8b69cf54a2135561f3064930609d114c3accd746091ce2678f9e991b",
        content: `"Over-stimulated? Can't sit still? Easily frustrated?"

This brand is printing.

Hellobloomkids. 85 active Meta ads. Running for 109+ days. Performance score: 91.

Saffron + Magnesium chewables for kids with ADHD.

The hook opens with 3 symptoms every parent recognizes instantly. No jargon. No science. Just "does this sound like your kid?"

Then: "Turn Tantrums Into Focused Moments."

Problem → transformation. In 6 words.

Parents don't buy ingredients. They buy the vision of a calmer child.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-34",
        title: "NightCare — Anti-Cellulite Oil (67 Active Ads)",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84684991/media-060bec0a866d.mp4",
        shareUrl: "https://app.gethookd.ai/share/ad/84684991?signature=060bec0a866d794f1eab2a8cd22bf3846a7c7cb03940df4442535859e4a9f8bc",
        content: `"Thousands of women are using this collagen-infused massage oil after every shower."

This ad has been running 36 days. Performance score: 91.

NightCare. 67 active Meta ads. Selling anti-cellulite massage oil.

The genius move? They attached the product to an EXISTING habit.

"After every shower" — no new routine needed. Just add this one step.

The easier you make adoption, the higher your conversion rate. Attach to habits they already have.

Shower → apply oil. That's it. No 10-step routine. No lifestyle change.

Friction kills conversions. Eliminate it.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },

    // ============================================
    // FORMULA 2: MYTH-BUSTER / CONTRARIAN
    // Challenges a common belief using real ad data as proof
    // ============================================
    {
        id: "post-35",
        title: "Myth-Buster — Long Copy Is Dead? (Better Sleep, 195 Ads)",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85255867/media-43c506448abd.mp4",
        shareUrl: "https://app.gethookd.ai/share/ad/85255867?signature=4a1180c12bac8af10860f65e0e285cd0fa2b8bc0057212719279793d50eaf90a",
        content: `"Nobody reads long ad copy anymore."

Really? Then explain this.

Better Sleep / QuietLab. 195 active Meta ads. Every single one uses long-form copy.

"Think nose strips help with snoring? Think again. Snoring has nothing to do with your nose, pillow placement, sleeping position or even weight..."

These ads read like blog posts. Paragraphs. Stories. Education.

And they're SCALING with 195 variations.

Short copy works for impulse buys. But when you're solving a real problem? Long copy educates, builds trust, and converts.

The brands spending the most on Meta are writing the MOST copy, not the least.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-36",
        title: "Myth-Buster — You Need a Unique Product (Grounding Shoes)",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84294930/media-c2af55945726.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84294930?signature=c2af55945726ab559899d4c90b504b0a7d079f52be685d6aa2ed10886db3c1fb",
        content: `"You need a unique product to succeed in ecom."

Nah. You need a unique ANGLE.

Indigenous Living. 49 active Meta ads. Selling grounding shoes. Performance score: 91. Running 51+ days.

Grounding shoes aren't new. Hundreds of brands sell them.

But their angle? "Walk Grounded, Just as Nature Intended." They wrapped a commodity product in ancestral health positioning.

Same product. Different story. Completely different market.

The product is the vehicle. The story is the engine.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-37",
        title: "Myth-Buster — Snoring Market is Saturated",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85255872/media-b8e36bfd0e05.mp4",
        shareUrl: "https://app.gethookd.ai/share/ad/85255872?signature=4c7d191bb43e1315af550e8d095581eabd862afb1ee04c07e53d5a3fbc8da675",
        content: `"The snoring niche is too crowded."

I just pulled the data on Gethookd. Let me show you what "crowded" looks like:

Better Sleep alone: 195 active ads.
Somnia: 10 ads, one running 198 days.
Multiple new brands entering every week.

And they're ALL scaling.

Know why? Because 45% of adults snore. The market refreshes itself every single night.

"Saturated" means "proven demand with high repeat purchase intent."

If 5 brands are scaling, there's room for 50.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },

    // ============================================
    // FORMULA 3: ACTIONABLE FRAMEWORK
    // "Do this" → steps using Gethookd to find/analyze real ads
    // ============================================
    {
        id: "post-38",
        title: "Framework — The 198-Day Ad Test",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85321096/media-2d6635e9fc86_preview.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/85321096?signature=03f46fb934b5a3704dec9862948c75ee3cb46498645dff22d3b6043288ef4c7b",
        content: `How to find ads that are PROVEN to convert:

1. Search your niche on Gethookd
2. Sort by "days active" — longest first
3. Any ad running 60+ days is profitable (brands don't waste money)
4. Study the TOP 3 longest-running ads

Example: This Somnia nasal dilator ad? 198 days active. Score: 91.

That ad has survived algorithm changes, creative fatigue, and budget reviews for 6+ months.

That's not luck. That's a winner.

The market already did the testing for you. Use it.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-39",
        title: "Framework — Reverse Engineer Any Brand's Strategy",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84922885/media-ee26f892f022.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84922885?signature=9216e3703340121b8cca389ee83c34300fb682494e5d507bae81d02be49f16a5",
        content: `Do this to reverse engineer any brand scaling on Meta:

1. Find them on Gethookd (look for 50+ active ads = serious spender)
2. Check their ad formats: what % is video vs image vs carousel?
3. Read their top 5 ad copies — what hook pattern do they repeat?
4. Visit their landing page — product page or advertorial?

Example: Hellobloomkids. 85 active ads. 109 days on their top performer.

Their pattern? Symptom-list hook → emotional transformation promise → ingredient credibility.

They repeat the same formula with different visuals. That's the playbook.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-40",
        title: "Framework — Find Your Winning Hook in 10 Minutes",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85318048/media-6db473b8c990_resized.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/85318048?signature=1676204bd6814347fb25c94f17157702b96329227fbd827bf457c06cda27a274",
        content: `Do this to write hooks that convert:

1. Pull 10 winning ads in your niche (score 80+ on Gethookd)
2. Copy JUST the first line of each ad
3. Categorize them: Question? Statement? Objection? Story?
4. The category that appears most = your market's preferred hook style

Example from what I found today:

"Is Testolite a scam?" → Objection hook
"Save Your Partner's Sleep" → Benefit hook
"Over-stimulated? Can't sit still?" → Symptom hook

Each market responds to a different style. Let the data tell you which one.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },

    // ============================================
    // FORMULA 4: NICHE STORY (narrative + ad data)
    // Emotional story about a market → real brand as proof
    // ============================================
    {
        id: "post-41",
        title: "Niche Story — Parents of Kids with ADHD",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84922888/media-025f6d234bf1.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84922888?signature=9069f79f8b69cf54a2135561f3064930609d114c3accd746091ce2678f9e991b",
        content: `The ADHD kids supplement niche is printing.

Picture this: a parent at 11pm googling "why can't my kid focus in school."

They've tried everything. Teachers are calling. They feel like they're failing.

Then they see an ad: "Turn Tantrums Into Focused Moments."

That's not a supplement. That's hope.

Hellobloomkids. 85 active Meta ads. 109 days on their top ad. Score: 91.

Saffron + Magnesium chewables. Positioned as the natural alternative to medication.

When the emotional stakes are THIS high, price doesn't matter.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-42",
        title: "Niche Story — Men Who Won't Admit They Snore",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85255869/media-57636bb33aa8.mp4",
        shareUrl: "https://app.gethookd.ai/share/ad/85255869?signature=308ac8e1024909caf56439a08c2af7b89b2d3cb3a5d08be7245f7f958cd5f9ef",
        content: `The snoring niche is absolutely unreal.

Men won't go to the doctor for snoring. They'll deny it. They'll blame the pillow. They'll say "everyone snores."

But their wife is sleeping in the spare room.

That's when they start googling at 2am.

Better Sleep / QuietLab. 195 active Meta ads. Running ads that say:

"Most guys think snoring is just annoying. Turns out, it also destroys focus and energy."

They reframed snoring from "embarrassing" to "performance killer." Now men WANT to fix it.

Same product. Better angle. Massive scale.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-43",
        title: "Niche Story — The Grounding/Earthing Movement",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84928289/media-cc85cd58494e.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84928289?signature=bf1fcda338281ad9707b69bb9f4fd01a217f7e3cbeeaa53d001af9206b5b3b83",
        content: `The grounding/earthing niche is cooked.

People literally believe walking barefoot on grass fixes inflammation, sleep, anxiety, everything.

Sounds crazy? Maybe.

But the market doesn't care about your opinion. It cares about buying intent.

Grounding sheets. Grounding shoes. Grounding mats. All printing.

Tiffany Mccomb's advertorial: 132 ads. "Investigation: Do Grounding Sheets Really Work?" Running 17+ days. Score: 91.

Indigenous Living: 49 ads for grounding shoes. 51 days active. Score: 91.

When a belief system drives purchasing, logic doesn't matter. Conviction does.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },

    // ============================================
    // FORMULA 5: PATTERN/STRATEGY REVEAL
    // Non-obvious strategy spotted in real ads → teach the audience
    // ============================================
    {
        id: "post-44",
        title: "Strategy Reveal — The Objection-First Ad",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/85318048/media-6db473b8c990_resized.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/85318048?signature=1676204bd6814347fb25c94f17157702b96329227fbd827bf457c06cda27a274",
        content: `The highest-converting ad format I'm seeing right now?

The "objection-first" ad.

Instead of leading with benefits, lead with the EXACT doubt your customer has.

Testolite does this perfectly:

"Is Testolite a scam? We see this question come up, and honestly — we'd be asking the same thing."

89 active Meta ads. Score: 91.

Why it works:
→ Pattern interrupt (wait, the brand is calling itself a scam?)
→ Instant trust (they're being honest)
→ The reader feels understood, not sold to

Try this: Write your next ad starting with your product's biggest objection.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-45",
        title: "Strategy Reveal — The Advertorial Takeover",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84928277/media-60b8f09d9fbb.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84928277?signature=596407942aca02b2bef9580e02aa44addaab884e8f302b17fef708c1b82d6634",
        content: `The brands scaling hardest on Meta right now aren't sending traffic to product pages.

They're sending to advertorials disguised as blog posts.

Look at this ad from Tiffany Mccomb: "The Actual Problem Behind Grounding Sheets"

132 active ads. Score: 91. Landing page? A blog. Not a store.

"I bought grounding sheets twice before I realized I'd been set up to fail."

That's a STORY. Not a product listing.

It reads like editorial content. Facebook's algorithm loves it. Users trust it. ROAS compounds.

If you're still sending cold traffic to a product page in 2025, you're leaving 2-3x ROAS on the table.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-46",
        title: "Strategy Reveal — Symptom Stacking Hooks",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84922888/media-025f6d234bf1.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84922888?signature=9069f79f8b69cf54a2135561f3064930609d114c3accd746091ce2678f9e991b",
        content: `One pattern I keep seeing in winning health/supplement ads:

Symptom stacking.

Instead of one benefit, they list 3 symptoms in rapid fire:

"Over-stimulated? Can't sit still? Easily frustrated?"

That's Hellobloomkids. 85 ads. 109 days active. Score: 91.

Why 3 symptoms work:
→ 1 symptom = "maybe that's me"
→ 2 symptoms = "okay that's definitely me"
→ 3 symptoms = "holy shit they're describing my kid"

The more specific the symptom stack, the higher the "this is for ME" reaction.

Try writing your next hook as 3 rapid-fire symptoms. Watch your CTR jump.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-47",
        title: "Strategy Reveal — The Habit-Attach Formula",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84684991/media-060bec0a866d.mp4",
        shareUrl: "https://app.gethookd.ai/share/ad/84684991?signature=060bec0a866d794f1eab2a8cd22bf3846a7c7cb03940df4442535859e4a9f8bc",
        content: `The smartest positioning trick in DTC right now?

Attaching your product to a habit that already exists.

NightCare. 67 active ads. Score: 91. 36 days active.

"Use this collagen-infused massage oil after every shower."

After. Every. Shower.

They didn't ask you to create a new routine. They slid into one you already have.

This is why "morning coffee + [supplement]" works.
This is why "after your workout + [recovery product]" works.
This is why "before bed + [sleep product]" works.

Don't sell a new habit. Piggyback on an existing one.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },

    // ============================================
    // FORMULA 6: COMPETITOR COMPARISON / DATA LIST
    // Resource-style posts that position Gethookd naturally
    // ============================================
    {
        id: "post-48",
        title: "Data List — Winning Ad Formats by Niche",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84928289/media-cc85cd58494e.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84928289?signature=bf1fcda338281ad9707b69bb9f4fd01a217f7e3cbeeaa53d001af9206b5b3b83",
        content: `I analyzed 50 winning ads (score 80+) on Gethookd this week.

Here's what's working by niche:

Health/Supplements → Long-form advertorial copy + video (Better Sleep: 195 ads)
Kids/Parenting → Symptom-stack hooks + DCO format (Hellobloomkids: 85 ads)
Beauty/Skincare → Habit-attach positioning + video demos (NightCare: 67 ads)
Men's Health → Objection-first headlines + image ads (Testolite: 89 ads)
Sleep → Relationship-angle hooks + video (Somnia: 198 days active)
Wellness → Investigation-style advertorials (Grounding sheets: 132 ads)

Every niche has a dominant format. Find yours before you waste budget testing blind.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-49",
        title: "Data Reveal — The GLP-1 Gold Rush",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84773073/media-34884441e8f7.jpg",
        shareUrl: "https://app.gethookd.ai/share/ad/84773073?signature=34884441e8f7e145285195350f667f43cd5a41f3d4c2d618d7337946d244b0f3",
        content: `The biggest DTC trend happening right now that nobody's talking about?

GLP-1 companion products.

Ozempic and Wegovy created a MASSIVE new customer base with a MASSIVE new set of problems:

Constipation. Nausea. Muscle loss. Hair thinning.

GLP-1 SOS Supplements. 109 active Meta ads. Score: 91.

"Stuck on the toilet with GLP-1? You're not alone!"

They didn't invent a product. They invented a CATEGORY.

When a drug creates 10 million new customers with a new problem overnight — that's when you move fast.

Find the side effects. Sell the solution.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    },
    {
        id: "post-50",
        title: "Strategy Reveal — The Shower Filter Play",
        mediaUrl: "https://static-gp.gethookd.ai/media/ads_media/84417187/media-1b4b84b738a0.mp4",
        shareUrl: "https://app.gethookd.ai/share/ad/84417187?signature=136325792b97b8073234a502dae61735876142e345534b5bec2bfae23f587617",
        content: `"Beauty starts in your shower, not your skincare."

Read that again.

Filtered Beauty. 68 active ads. 48 days running. Score: 91.

They're selling a shower filter. A $30 shower filter.

But the positioning? "Australia's #1 shower filter for softer skin, shinier hair and cleaner water."

They didn't compete in the water filter market. They entered the BEAUTY market.

Same product, completely different audience, 10x the willingness to pay.

A water filter buyer compares prices.
A beauty buyer compares results.

Repositioning beats product innovation 9 times out of 10.

NOW GO FUCKING PRINT 🔥` + gethookdCTA,
        status: "draft",
        target: "Solo ecommerce founders"
    }
];

// Format as rows for the Google Sheets webhook
const rows = posts.map(p => ({
    id: p.id,
    title: p.title,
    content: p.content,
    status: p.status || 'draft',
    target: p.target || 'Solo ecommerce founders',
    createdAt: new Date().toISOString(),
    approvedAt: '',
    scheduledAt: '',
    postedAt: '',
    tweetIds: '',
    mediaUrl: p.mediaUrl || '',
    shareUrl: p.shareUrl || ''
}));

// Insert into local SQLite DB
function insertIntoDB() {
    console.log(`Inserting ${posts.length} posts into local DB...`);
    const before = getCount();

    for (const p of posts) {
        upsertContent({
            id: p.id,
            title: p.title,
            mediaUrl: p.mediaUrl || null,
            videoUrl: (p.mediaUrl && p.mediaUrl.endsWith('.mp4')) ? p.mediaUrl : null,
            mediaType: (p.mediaUrl && p.mediaUrl.endsWith('.mp4')) ? 'video' : 'image',
            content: p.content,
            status: p.status || 'draft',
            target: p.target || 'Solo ecommerce founders',
            createdAt: new Date().toISOString(),
        });
    }

    const after = getCount();
    console.log(`Done. DB went from ${before} to ${after} posts.`);
}

// Push to Google Sheets
async function pushToSheets() {
    console.log(`\nPushing ${rows.length} posts to Google Sheets...`);

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows }),
            redirect: 'follow'
        });

        const text = await res.text();
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }

        if (res.ok && !text.includes('Page Not Found')) {
            console.log('Sheets push success:', result);
        } else {
            console.error('Sheets push failed - webhook may need redeployment');
            console.error('Response:', text.substring(0, 200));
        }
    } catch (err) {
        console.error('Sheets push failed:', err.message);
        console.log('Posts are in local DB. Run again once webhook URL is updated.');
    }
}

if (require.main === module) {
    // 1. Always insert into local DB
    insertIntoDB();
    // 2. Try pushing to sheets
    pushToSheets();
}

module.exports = { posts, rows };
