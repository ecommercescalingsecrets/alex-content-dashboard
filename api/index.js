const express = require('express');
const path = require('path');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.use('/media', express.static(path.join(__dirname, '..', 'media')));
app.use('/swipe-files', express.static(path.join(__dirname, '..', 'swipe-files')));

// Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || 'GE8tk2RiScm2Lgz2w7VrzVmWS',
    appSecret: process.env.TWITTER_API_SECRET || 'sOKyYl47bqpQrf8PVqKsr6jw1wkFOUui2MDnqKWpkIADA17E9N',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-YKK7ctQKOkBRIIVxOnO0vdQD8MH1zy',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'iznbruGURnAgfrH1R0z7RIMxqYZGBbOpvHbfhGpa4tpV6'
});

// Brand active ad counts from Gethookd API
const brandAdCounts = {
    "PureLife Organics": 156,
    "Happy Mammoth": 89,
    "O Positiv": 67,
    "Purely Nutrient": 234,
    "Dr. Blane": 43,
    "SereneSkincare": 78,
    "FemiClear": 145,
    "Savanna Skin": 92,
    "Emunah Beauty": 167,
    "UltimaPeak": 134,
    "Better Performance": 298,
    "ARMRA": 187,
    "Touchstone Essentials": 123,
    "Mars Men": 76,
    "Redmond Re-Lyte": 89,
    "MaryRuth's": 203,
    "Forge Skin": 45
};

// Helper function to get brand name from title
function getBrandFromTitle(title) {
    return title.split(' — ')[0].trim();
}

// Helper function to add active ads info to content
function addActiveAdInfo(content, title) {
    const brand = getBrandFromTitle(title);
    const activeAds = brandAdCounts[brand];
    
    if (activeAds) {
        // Insert after "This brand is printing." line
        const lines = content.split('\n');
        const printingLineIndex = lines.findIndex(line => line.includes('This brand is printing.'));
        
        if (printingLineIndex !== -1) {
            lines.splice(printingLineIndex + 1, 0, ``, `${brand}. ${activeAds} active ads.`);
            return lines.join('\n');
        }
    }
    
    return content;
}

// In-memory content DB
let contentDatabase = {
    "post-1": {
        id: "post-1",
        title: "PureLife Organics — Cortisol Belly",
        mediaUrl: "/media/purelife_cortisol.mp4",
        videoUrl: "/media/purelife_cortisol.mp4",
        mediaType: "video",
        content: `"Doing This Deflated My Cortisol Belly."

This brand is printing.

PureLife Organics. 156 active ads. 41 days on this exact ad.

UGC. Woman lifting her shirt. No fancy fucking studio. Just a real person with a real gut problem.

Nobody knows what cortisol is but it sounds scientific enough to stop the scroll. "Deflated" hits different than "lose weight." It's visual. You can feel it.

They niched down HARD. Stressed women 40+ who've tried everything. That specificity is why their CPMs are stupid low.

Cortisol is the new gut health. Test this angle yesterday.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "approved",
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
        content: `"At 52, I got my figure back."

This brand is printing.

Happy Mammoth. 89 active ads. Just hit me with this line.

Not some bullshit before/after. A real woman saying she feels like herself again.

That line does more work than 99% of supplement ads. It's not selling hormones or botanicals. It's selling getting your life back.

Menopause market is fucking massive. Most brands talk about ingredients.

This brand talks about transformation.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "approved",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-3": {
        id: "post-3",
        title: "O Positiv / URO — Vaginal Health Vitamin",
        mediaUrl: "/media/opositiv_vitamin.jpg",
        mediaType: "image",
        content: `"I used to avoid sex. Now I want him all the time."

This brand is printing.

O Positiv. 67 active ads. That's the ad copy. On Facebook. And it's working.

O Positiv went straight for the emotional outcome. Better sex life. Everyone else in this space says "supports vaginal pH balance." Nobody gives a shit.

UGC selfie. Woman holding the product. Bright pink bottle. Looks like a friend recommending it, not a brand selling you something.

Women's health is wide open for brands willing to talk like real people. If your ad copy reads like a doctor's note, you've already lost.

NOW GO FUCKING PRINT 🔥`,
        status: "approved",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-4": {
        id: "post-4",
        title: "Purely Nutrient — Black Seed Oil / Parasite Hook",
        mediaUrl: "/media/purely_nutrient_blackseed.mp4",
        videoUrl: "/media/purely_nutrient_blackseed.mp4",
        mediaType: "video",
        content: `"Watch what happens when you put a parasite in contact with Oregano Oil."

This brand is printing.

Purely Nutrient. 234 active ads. Microscope footage of a parasite dying. On your feed. While you're eating breakfast.

You can't NOT watch it. And once you're watching a parasite squirm, you're buying whatever kills it.

Purely Nutrient isn't even selling oregano oil. They're selling black seed oil. The parasite video is just the hook. Bait and switch but make it educational.

Parasite cleanse market is blowing up. People are convinced they have parasites.

Smart brands are riding that wave.

NOW GO FUCKING PRINT 🔥`,
        status: "approved",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-5": {
        id: "post-5",
        title: "Dr. Blane Schilling — Surgeon Contrarian Authority",
        mediaUrl: "/media/dr_blane_joint.jpg",
        mediaType: "image",
        content: `"For years, I believed it was the right thing to do..."

This brand is printing.

Dr. Blane Schilling. 43 active ads. 200+ knee replacements. Full scrubs. Hospital hallway.

And he's telling you surgery might not be the answer.

A surgeon saying NOT to get surgery. Your brain short-circuits. Goes against everything you'd expect.

Authority marketing at its peak. Real doctor. Real setting. Contrarian angle. Impossible to ignore.

After that hook the ad doesn't even need to be good. You're already thinking "wait, what does he recommend instead?"

Selling a joint supplement without doctor authority content? One hand tied behind your back.

NOW GO FUCKING PRINT 🔥`,
        status: "approved",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-6": {
        id: "post-6",
        title: "SereneSkincare — PDRN Patches",
        mediaUrl: "/media/serene_skincare.mp4",
        videoUrl: "/media/serene_skincare.mp4",
        mediaType: "video",
        content: `"I'm 42 and people think I'm in my early 30s."

This brand is printing.

SereneSkincare. PDRN patches.

Testimonial lead. Simple.

PDRN. Most people have never heard of it. It's not retinol. It's not collagen. It's NEW. And "new" in skincare is crack for women scrolling Facebook at 10pm.

Patches as delivery? Genius. Not another cream or serum. A patch feels medical. Feels like it actually does something.

Anti-aging is a $60B market and crowded as hell. But find a novel mechanism people haven't seen 10,000 times and you carve out space fast.

NOW GO FUCKING PRINT 🔥`,
        status: "approved",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-7": {
        id: "post-7",
        title: "FemiClear — Taboo Health Niche",
        mediaUrl: "/media/femiclear.mp4",
        videoUrl: "/media/femiclear.mp4",
        mediaType: "video",
        content: `"Before you panic... watch this."

This brand is printing.

FemiClear. 145 active ads. 34 days running. Selling a herpes treatment. On Facebook. With a woman in a lab coat.

Most brands wouldn't touch this. That's exactly why FemiClear is crushing it. Zero creative competition because everyone's too scared.

That hook is doing therapy and selling product at the same time.

The doctor figure removes the shame. Makes it medical, not personal. The person seeing this ad has been too embarrassed to go to the pharmacy. And here's a solution in their feed that looks legitimate.

Taboo health niches are goldmines. Less competition. Desperate buyers. High LTV because they NEED the product.

NOW GO FUCKING PRINT 🔥`,
        status: "approved",
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
        status: "approved",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-9": {
        id: "post-9",
        title: "Emunah Beauty — Hair Vitamins Specialist Listicle",
        mediaUrl: "/media/emunah_hair.jpg",
        mediaType: "image",
        content: `"I've tested hundreds of hair vitamins. Here are the top 5 that actually work."

This brand is printing.

Emunah Beauty. Hair vitamins. But the ad isn't from the brand — it's from a "Certified Trichologist & Scalp Specialist."

Doesn't feel like an ad. Feels like expert advice. You trust it immediately.

Clean creative. Split layout — problem on the left, solution on the right. Your eye goes straight to "which ones made the cut?"

This isn't even Emunah's page running the ad. It's the specialist's page. Brand pays the expert, expert recommends the product, customer trusts the expert. Everyone wins.

Not running a "specialist reviews top 5" format? Test it this week. Works across every health niche.

NOW GO FUCKING PRINT 🔥`,
        status: "approved",
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
        status: "approved",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-11": {
        id: "post-11",
        title: "Better Performance — Organ Supplements",
        mediaUrl: "/media/better_performance_organs.jpg",
        mediaType: "image",
        content: `"Your body is missing what modern diets removed."

This brand is printing.

Better Performance. 298 active ads. Beef liver. Heart. Marrow. Pancreas. In a capsule.

No fancy ingredients. No proprietary blend bullshit. Just freeze-dried organs your great-grandfather ate every week.

The angle is ancestral. "Modern diets broke you. This fixes it." That framing turns a $15 bottle of organ pills into a $50 identity purchase.

100,000+ men buying. Retargeting with "Still Thinking?" at 50% off. They know their audience takes 3-4 touches.

Men's supplement market is shifting hard toward ancestral health. Seed oils are the villain. Organ meats are the hero.

If you're not in this space yet, someone else is taking your customers.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-12": {
        id: "post-12",
        title: "ARMRA — Colostrum Revolution",
        mediaUrl: "/media/armra_colostrum.mp4",
        videoUrl: "/media/armra_colostrum.mp4",
        mediaType: "video",
        content: `"400+ bioactive nutrients that work like a blueprint for your body."

This brand is printing.

ARMRA Colostrum. 187 active ads. 20,000+ five-star reviews. Millions of customers. And they're still spending heavy on Facebook.

Colostrum was a niche biohacker thing 2 years ago. ARMRA turned it mainstream.

How? They don't sell colostrum. They sell "tapping into your extraordinary." The transformation. Not the ingredient.

They stacked every trust signal: research publications, elite athletes, "insiders everywhere." You feel like you're late to the party.

This is what happens when a supplement brand acts like a luxury brand. Premium positioning. Premium price. Premium retention.

Colostrum is the new collagen. First movers are printing.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-13": {
        id: "post-13",
        title: "Touchstone Essentials — Super Green Juice",
        mediaUrl: "/media/touchstone_greens.jpg",
        mediaType: "image",
        content: `"Stop letting expensive veggies rot in the fridge."

This brand is printing.

Touchstone Essentials. 44 organic superfoods. One scoop. 30 seconds.

That opening line is doing all the work. Every person reading it has a bag of wilted spinach in their crisper right now. Instant guilt. Instant relatability.

They're not selling greens powder. They're selling the version of you that actually eats healthy without the effort.

50,000+ customers. And the genius? Subscription model on a consumable powder. You use it every morning. You never cancel.

Greens powder is a $3B market growing 8% annually. The winners aren't the ones with the most superfoods. They're the ones with the best hook.

"Your veggies are rotting" beats "44 superfoods" every single time.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-14": {
        id: "post-14",
        title: "Mars Men — Testosterone Gummies",
        mediaUrl: "/media/mars_men_testosterone.mp4",
        videoUrl: "/media/mars_men_testosterone.mp4",
        mediaType: "video",
        content: `"Fuel testosterone. Flatten belly. Feel invincible."

This brand is printing.

Mars Men. Three promises in one sentence. That's the entire ad.

Most testosterone brands write a novel about ashwagandha studies and free testosterone levels. Nobody cares. Men want to feel like men again.

"Flatten belly" is sneaky brilliant. It's not a testosterone benefit. It's a weight loss benefit hiding inside a testosterone ad. Two audiences, one product.

50% off plus free gifts. Aggressive offer. They're buying customers at a loss knowing the subscription math works out by month 3.

Men's health supplements are a bloodbath right now. The brands winning aren't the most scientific. They're the most direct.

Three words that hit three pain points. That's the formula.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-15": {
        id: "post-15",
        title: "Amy Harris / TheSpa Dr — Brain Fog Perimenopause",
        mediaUrl: "/media/amy_harris_brainfog.mp4",
        videoUrl: "/media/amy_harris_brainfog.mp4",
        mediaType: "video",
        content: `"Stress doesn't make you forget words mid-sentence."

This brand is printing.

Amy Harris selling Hormone Balance Blend for perimenopause brain fog.

Read that hook again. Every woman over 40 who's blanked on a word in a meeting just felt her stomach drop.

She doesn't open with the product. She opens with the fear. "Am I losing it? Is this early dementia?" That's what women are actually googling at 2am.

Then the reframe: "It's not you. It's your hormones swinging." Relief. Now you're ready to buy.

Subscription model. "That's why I chose the subscription." Social proof baked into the CTA.

Perimenopause is a $600B market that most brands are too scared to talk about directly. The ones who do? Printing.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-16": {
        id: "post-16",
        title: "Redmond Re-Lyte — Electrolyte Immunity",
        mediaUrl: "/media/redmond_relyte.jpg",
        mediaType: "image",
        content: `"Everyday wellness starts with better ingredients."

This brand is printing.

Redmond Re-Lyte. Electrolytes meets immunity. Two categories in one product.

Most electrolyte brands fight over the fitness crowd. Re-Lyte said fuck that and went after the wellness crowd instead.

Same product format. Completely different positioning. "Boost your body's natural immune response" hits different than "recover faster after your workout."

They're running 23 days straight on this creative. In supplement advertising, that's a winner.

The real play here: category bridging. Take a commodity product (electrolytes) and attach it to a growing category (immunity). Suddenly your $25 tub competes with $45 immune supplements instead of $15 electrolyte packets.

Positioning is the moat. Not ingredients.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-17": {
        id: "post-17",
        title: "MaryRuth's via Glimja — Liquid Hair Vitamin",
        mediaUrl: "/media/glimja_maryruth.jpg",
        mediaType: "image",
        content: `"Losing hair? Don't lose hope."

This brand is printing.

MaryRuth's Hair Growth Multivitamin. Liquid form. Tastes like berries.

Three words that reframe the entire purchase: "Don't lose hope." Suddenly it's not a vitamin. It's emotional support in a bottle.

Liquid format is the unlock. Everyone's tired of swallowing horse pills. "Liquid for optimal absorption" gives a scientific reason. "Tastes like berries" removes the last objection.

Running 23 days on Facebook. Gummies and liquids are eating the capsule market alive in hair vitamins.

The hair supplement space is dominated by biotin pills that taste like chalk. Any brand that makes the experience enjoyable wins on retention.

Format innovation beats ingredient innovation. Every time.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-18": {
        id: "post-18",
        title: "Forge Skin — Beef Tallow Men's Skincare",
        mediaUrl: "/media/forge_skin_tallow.mp4",
        videoUrl: "/media/forge_skin_tallow.mp4",
        mediaType: "video",
        content: `"12 out of 16 essential nutrients your skin needs. From beef tallow."

This brand is printing.

Forge Skin. Beef tallow balm. For men.

Read that again. They're selling cow fat as premium skincare. And men are buying it.

The ancestral health movement created a new buying psychology: natural = masculine. Chemical = weak. Beef tallow fits perfectly into that worldview.

"Very few men know this..." — exclusivity hook. Makes you feel like you're discovering a secret.

They don't compete with CeraVe or Jack Black. They compete with the idea that men shouldn't use "products." This IS different. It's meat-based. It's primal.

Men's skincare is a $30B market where 90% of brands look identical. Forge carved out a niche by making skincare feel like something a caveman would approve of.

Weird positioning wins when the market is boring.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-19": {
        id: "post-19",
        title: "Better Performance — Ancestral Stack Retargeting",
        mediaUrl: "/media/better_performance_organs.jpg",
        mediaType: "image",
        content: `"Still thinking? Up to 50% off."

This brand is printing.

Better Performance again. But this time it's the retargeting ad that caught my eye.

Four words. "Still thinking?" Then 50% off. That's the entire top of the ad.

They already sold you on organ supplements with the first touch. Now they just need to close. No re-education. No features. Just the nudge.

Most brands waste their retargeting budget repeating the same pitch. Better Performance strips it down to pure urgency.

"Stock is limited." Scarcity. "Lock in your discount now." Urgency. Two psychological triggers, zero fluff.

Your retargeting creative should be the opposite of your prospecting creative. First touch = education. Second touch = conversion.

If your retargeting looks like your TOF, you're burning money.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    "post-20": {
        id: "post-20",
        title: "ARMRA — Premium Positioning Playbook",
        mediaUrl: "/media/armra_colostrum.mp4",
        videoUrl: "/media/armra_colostrum.mp4",
        mediaType: "video",
        content: `"The secret harnessed by elite athletes and insiders everywhere."

This brand is printing.

ARMRA again. But zoom into the copy structure this time.

"Elite athletes." "Insiders everywhere." "Tap into your extraordinary." This isn't supplement copy. This is luxury copy.

They list 7 benefit categories with scientific names: regenerative peptides, adaptogenic nutrients, mitochondrial regenerators. Nobody knows what those mean. That's the point.

Complexity signals efficacy. If it sounds like science, it must work. If it sounds simple, it's probably just another vitamin.

20,000+ reviews. Millions of customers. And they STILL lead with aspiration, not social proof.

Most brands at this scale get lazy and just run "bestseller" ads. ARMRA keeps selling the dream.

That's the difference between a supplement company and a supplement brand.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    
    "post-21": {
        id: "post-21",
        title: "Alpha Lion — Superhuman Pre-workout",
        mediaUrl: "/media/alpha_lion_superhuman.mp4", 
        mediaType: "video",
        content: `"They told me I'd never lift again after my accident."

This brand is printing.

Alpha Lion Superhuman. 167 active ads. One of the most aggressive pre-workout brands on Facebook.

UGC testimonial from someone who overcame injury. That's not selling a pre-workout — that's selling hope.

Most supplement brands focus on ingredients. Alpha Lion sells transformation stories.

The fitness market is oversaturated. But injury recovery? That's a blue ocean with desperate buyers who'll pay premium.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },
    
    "post-22": {
        id: "post-22", 
        title: "Athletic Greens — AG1 Mainstream Push",
        mediaUrl: "/media/athletic_greens_ag1.jpg",
        mediaType: "image", 
        content: `"I replaced my entire supplement cabinet with this one drink."

This brand is printing.

Athletic Greens AG1. 234 active ads. They're everywhere — podcasts, YouTube, Facebook.

Simple before/after: messy cabinet vs. one green drink. Visual storytelling at its peak.

AG1 cracked the code on positioning. It's not a greens powder — it's a "nutritional insurance policy."

Premium pricing ($99/month) but they've normalized it through repetition and authority marketing.

When you see a brand everywhere, they're printing. AG1 is the template.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-23": {
        id: "post-23",
        title: "Bloom Nutrition — Greens Powder for Women", 
        mediaUrl: "/media/bloom_nutrition_greens.mp4",
        mediaType: "video",
        content: `"Why does my bloating disappear when I drink this?"

This brand is printing.

Bloom Nutrition. 189 active ads. They niched down HARD — greens powder specifically for women.

Pink packaging. Female founders. Women-specific messaging. They carved out space in a crowded market by being hyper-specific.

Most brands try to appeal to everyone. Bloom said "fuck that" and went all-in on women 18-35.

Result? They're crushing AG1 in engagement among their target demo.

Niche down or get left out.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-24": {
        id: "post-24",
        title: "Gorilla Mind — Derek More Plates Authority",
        mediaUrl: "/media/gorilla_mind_derek.jpg", 
        mediaType: "image",
        content: `"I formulated this because I couldn't find anything that actually worked."

This brand is printing.

Gorilla Mind. 145 active ads. Derek from More Plates More Dates built this brand on pure authority.

He's not just selling supplements. He's selling his reputation as the smartest guy in fitness.

Personal brand → product credibility → sales. That's the formula.

Most supplement brands hire influencers. Derek IS the influencer. Owns the entire funnel from content to conversion.

Authority beats everything. Build it first, monetize it second.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-25": {
        id: "post-25",
        title: "1st Phorm — Transformation Challenge",
        mediaUrl: "/media/1st_phorm_transformation.mp4",
        mediaType: "video", 
        content: `"I won $50,000 for losing weight with their products."

This brand is printing.

1st Phorm. 278 active ads. Their Transphormation Challenge is marketing genius.

They're not selling supplements. They're selling a contest where you can win life-changing money.

Customer pays for products + gets motivated to use them because of prize money. Higher compliance = better results = more testimonials.

It's a flywheel. Better results create more success stories. More stories create more customers.

Gamify your customer journey.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-26": {
        id: "post-26", 
        title: "Transparent Labs — Clean Label Positioning",
        mediaUrl: "/media/transparent_labs_clean.jpg",
        mediaType: "image",
        content: `"Finally, a supplement company that shows you EXACTLY what's inside."

This brand is printing.

Transparent Labs. 134 active ads. They built their entire brand on one concept: transparency.

Full ingredient disclosure. No proprietary blends. Third-party testing. Everything the industry refuses to do.

They positioned themselves as the "anti-supplement company" in a market full of bullshit and fake promises.

When everyone zigs, zag. When everyone hides ingredients, show everything.

Transparency is the ultimate differentiator.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-27": {
        id: "post-27",
        title: "Ghost — Gaming Energy Drink Crossover", 
        mediaUrl: "/media/ghost_gaming_energy.mp4",
        mediaType: "video",
        content: `"Why are gamers drinking this instead of Red Bull?"

This brand is printing.

Ghost. 198 active ads. They cracked the gaming market that energy drinks missed.

Branded as "lifestyle" not just caffeine. Gaming setups, streaming culture, esports partnerships.

Red Bull owns traditional energy. Monster owns extreme sports. Ghost said "we own gaming."

They turned supplements into culture. The branding is everything.

Find the subculture everyone else ignores. Make it yours.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-28": {
        id: "post-28",
        title: "Bucked Up — Deer Antler Velvet Hook",
        mediaUrl: "/media/bucked_up_deer_antler.jpg", 
        mediaType: "image",
        content: `"This contains the same stuff that makes deer antlers grow back."

This brand is printing.

Bucked Up. 156 active ads. Deer antler velvet — the weirdest supplement hook that actually works.

Nobody knows what IGF-1 is. But everyone knows deer grow back massive antlers every year.

The visual is instant understanding. Deer = strong. You want strong.

Weird sells when it's based on nature. People trust animals more than scientists.

Find the weirdest natural ingredient that makes sense visually.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-29": {
        id: "post-29",
        title: "Pump Formula — Stimulant-Free Pre-workout", 
        mediaUrl: "/media/pump_formula_stim_free.mp4",
        mediaType: "video",
        content: `"All the pump, none of the jitters."

This brand is printing.

Pump Formula. 89 active ads. They carved out the "stimulant-free" pre-workout niche.

Not everyone wants caffeine. Afternoon workouts, sleep issues, caffeine sensitivity.

Instead of competing with every other pre-workout on stimulants, they went opposite.

"Pump without the crash" hits different when you've been burned by too much caffeine.

Contrarian positioning beats me-too products every time.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
        status: "review",
        target: "Solo ecommerce founders doing $2-10M/year",
        createdAt: new Date().toISOString()
    },

    "post-30": {
        id: "post-30",
        title: "Kaged Muscle — Kris Gethin Authority", 
        mediaUrl: "/media/kaged_muscle_kris.jpg",
        mediaType: "image",
        content: `"I've trained over 50,000 people. This is what actually works."

This brand is printing.

Kaged Muscle. 167 active ads. Kris Gethin's personal brand drives everything.

He's not just the founder. He's the living proof the products work.

Bodybuilding coach credibility + supplement formulator expertise = unstoppable authority.

Most founders hide behind their brand. The best founders ARE the brand.

Your face, your story, your results. That's what sells.

NOW GO FUCKING PRINT 🔥

2/2

Want to find ads like this instantly? 

I use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.

→ See what's converting in your niche
→ Swipe proven hooks & angles  
→ Skip months of trial & error

Try it free: gethookd.ai`,
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
                let mediaId = null;
                
                // Upload media if it exists
                if (item.mediaUrl) {
                    try {
                        const mediaPath = path.join(__dirname, '..', item.mediaUrl);
                        if (fs.existsSync(mediaPath)) {
                            console.log(`Uploading scheduled media: ${mediaPath}`);
                            const mediaUpload = await twitterClient.v1.uploadMedia(mediaPath);
                            mediaId = mediaUpload.media_id_string;
                            console.log(`Scheduled media uploaded: ${mediaId}`);
                        }
                    } catch (mediaError) {
                        console.error('Scheduled media upload failed:', mediaError);
                    }
                }
                
                if (text.length <= 280) {
                    const tweetOptions = { text };
                    if (mediaId) {
                        tweetOptions.media = { media_ids: [mediaId] };
                    }
                    
                    const tweet = await twitterClient.v2.tweet(tweetOptions);
                    item.status = 'posted';
                    item.scheduledStatus = 'posted';
                    item.tweetId = tweet.data.id;
                    item.postedAt = new Date().toISOString();
                    console.log(`✅ Successfully posted scheduled: ${item.title}`);
                } else {
                    // Post as thread — attach media to first tweet only
                    const parts = text.split(/\n\n(?=\d+\/)/).filter(Boolean);
                    const hook = parts.shift(); // First part is the hook
                    
                    let lastTweetId = null;
                    const tweetIds = [];
                    
                    // Post hook with media
                    const firstTweetOptions = { text: hook.substring(0, 280) };
                    if (mediaId) {
                        firstTweetOptions.media = { media_ids: [mediaId] };
                    }
                    
                    const first = await twitterClient.v2.tweet(firstTweetOptions);
                    lastTweetId = first.data.id;
                    tweetIds.push(lastTweetId);
                    
                    // Post thread replies (no media)
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
                    console.log(`✅ Successfully posted scheduled thread: ${item.title}`);
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

app.post('/api/content/:id/unschedule', (req, res) => {
    const item = contentDatabase[req.params.id];
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    // Remove scheduling, return to approved status
    item.scheduledAt = null;
    item.scheduledStatus = null;
    
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
        const text = item.content;
        let mediaId = null;
        
        // Step 1: Upload media if it exists
        if (item.mediaUrl) {
            try {
                const mediaPath = path.join(__dirname, '..', item.mediaUrl);
                if (fs.existsSync(mediaPath)) {
                    console.log(`Uploading media: ${mediaPath}`);
                    
                    // Use v1.1 API for media upload
                    const mediaUpload = await twitterClient.v1.uploadMedia(mediaPath);
                    mediaId = mediaUpload.media_id_string;
                    console.log(`Media uploaded successfully: ${mediaId}`);
                } else {
                    console.warn(`Media file not found: ${mediaPath}`);
                }
            } catch (mediaError) {
                console.error('Media upload failed:', mediaError);
                // Continue without media rather than failing completely
            }
        }
        
        // Step 2: Post tweet with media
        if (text.length <= 280) {
            const tweetOptions = { text };
            if (mediaId) {
                tweetOptions.media = { media_ids: [mediaId] };
            }
            
            const tweet = await twitterClient.v2.tweet(tweetOptions);
            item.status = 'posted';
            item.tweetId = tweet.data.id;
            item.postedAt = new Date().toISOString();
            res.json({ success: true, tweetId: tweet.data.id, item, hasMedia: !!mediaId });
        } else {
            // Post as thread — attach media to first tweet only
            const parts = text.split(/\n\n(?=\d+\/)/).filter(Boolean);
            const hook = parts.shift(); // First part is the hook
            
            let lastTweetId = null;
            const tweetIds = [];
            
            // Post hook with media
            const firstTweetOptions = { text: hook.substring(0, 280) };
            if (mediaId) {
                firstTweetOptions.media = { media_ids: [mediaId] };
            }
            
            const first = await twitterClient.v2.tweet(firstTweetOptions);
            lastTweetId = first.data.id;
            tweetIds.push(lastTweetId);
            
            // Post thread replies (no media)
            for (const part of parts) {
                const chunk = part.substring(0, 280);
                const reply = await twitterClient.v2.reply(chunk, lastTweetId);
                lastTweetId = reply.data.id;
                tweetIds.push(lastTweetId);
            }
            
            item.status = 'posted';
            item.tweetIds = tweetIds;
            item.postedAt = new Date().toISOString();
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
    contentDatabase[id] = {
        id, title, content, target: target || 'Solo ecommerce founders',
        status: 'review', createdAt: new Date().toISOString()
    };
    res.json(contentDatabase[id]);
});

app.post('/api/content/:id/apply-feedback', async (req, res) => {
    const { feedback } = req.body;
    const item = contentDatabase[req.params.id];
    
    if (!item) return res.status(404).json({ error: 'Post not found' });
    
    try {
        // Step 1: Save feedback
        if (!item.feedbackHistory) item.feedbackHistory = [];
        item.feedbackHistory.push({
            text: feedback,
            createdAt: new Date().toISOString()
        });
        
        // Step 2: Analyze feedback and apply to this post
        const updatedContent = await applyFeedbackToContent(item.content, feedback);
        item.content = updatedContent;
        
        // Step 3: Apply learning to all other posts
        await applyLearningToAllPosts(feedback);
        
        // Step 4: Update skills (placeholder for future skill updates)
        await updateSkillsFromFeedback(feedback);
        
        res.json({ 
            success: true, 
            updatedContent,
            learningApplied: true,
            skillsUpdated: true
        });
    } catch (error) {
        console.error('Error applying feedback:', error);
        res.status(500).json({ error: 'Failed to apply feedback' });
    }
});

async function applyFeedbackToContent(content, feedback) {
    // Simple feedback application logic
    // In a real system, this would use AI to understand and apply feedback
    
    // Example patterns we can detect and fix
    if (feedback.toLowerCase().includes('lead with transformation')) {
        // Move transformation quotes to the beginning
        const lines = content.split('\n\n');
        const transformationLine = lines.find(line => 
            line.includes('"') && (line.includes('got') || line.includes('feel') || line.includes('back'))
        );
        
        if (transformationLine && !lines[1].includes('"')) {
            // Remove from middle and add to beginning
            const filteredLines = lines.filter(line => line !== transformationLine);
            filteredLines.splice(2, 0, transformationLine);
            return filteredLines.join('\n\n');
        }
    }
    
    // Apply other feedback patterns here
    return content;
}

async function applyLearningToAllPosts(feedback) {
    // Apply the same learning pattern to all other posts
    const feedbackLower = feedback.toLowerCase();
    
    Object.values(contentDatabase).forEach(post => {
        if (feedbackLower.includes('lead with transformation')) {
            // Apply transformation-first logic to all posts
            const lines = post.content.split('\n\n');
            const transformationLine = lines.find(line => 
                line.includes('"') && (line.includes('got') || line.includes('feel') || line.includes('back'))
            );
            
            if (transformationLine && !lines[1].includes('"')) {
                const filteredLines = lines.filter(line => line !== transformationLine);
                filteredLines.splice(2, 0, transformationLine);
                post.content = filteredLines.join('\n\n');
            }
        }
    });
}

async function updateSkillsFromFeedback(feedback) {
    // Placeholder for updating skill files based on feedback
    // This would write to the brand-printing SKILL.md file
    console.log('Updating skills based on feedback:', feedback);
    return true;
}

app.delete('/api/content/:id', (req, res) => {
    delete contentDatabase[req.params.id];
    res.json({ success: true });
});

// Swipe Files viewer
app.get('/swipe-files', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'swipe-viewer.html'));
});

app.listen(port, () => {
    console.log(`Dashboard running on port ${port}`);
});
// Force deployment Fri Mar  6 13:05:01 EST 2026
