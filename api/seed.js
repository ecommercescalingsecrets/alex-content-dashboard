/**
 * Seed the database with initial content posts.
 * Run once: node api/seed.js
 * Or automatically on first start when DB is empty.
 */
const { upsertContent, getCount } = require('./db');

const seedData = [
  {
    id: "post-1",
    title: "PureLife Organics — Cortisol Belly",
    mediaUrl: "/media/purelife_cortisol.mp4",
    videoUrl: "/media/purelife_cortisol.mp4",
    mediaType: "video",
    status: "approved",
    target: "Solo ecommerce founders doing $2-10M/year",
    content: `"Doing This Deflated My Cortisol Belly."\n\nThis brand is printing.\n\nPureLife Organics. 156 active ads. 41 days on this exact ad.\n\nUGC. Woman lifting her shirt. No fancy fucking studio. Just a real person with a real gut problem.\n\nNobody knows what cortisol is but it sounds scientific enough to stop the scroll. "Deflated" hits different than "lose weight." It's visual. You can feel it.\n\nThey niched down HARD. Stressed women 40+ who've tried everything. That specificity is why their CPMs are stupid low.\n\nCortisol is the new gut health. Test this angle yesterday.\n\nNOW GO FUCKING PRINT 🔥\n\n2/2\n\nWant to find ads like this instantly? \n\nI use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.\n\n→ See what's converting in your niche\n→ Swipe proven hooks & angles  \n→ Skip months of trial & error\n\nTry it free: gethookd.ai`
  },
  {
    id: "post-2",
    title: "Happy Mammoth — Hormone Harmony",
    mediaUrl: "/media/happy_mammoth.jpg",
    mediaType: "image",
    status: "approved",
    target: "Solo ecommerce founders doing $2-10M/year",
    content: `"At 52, I got my figure back."\n\nThis brand is printing.\n\nHappy Mammoth. 89 active ads. Just hit me with this line.\n\nNot some bullshit before/after. A real woman saying she feels like herself again.\n\nThat line does more work than 99% of supplement ads. It's not selling hormones or botanicals. It's selling getting your life back.\n\nMenopause market is fucking massive. Most brands talk about ingredients.\n\nThis brand talks about transformation.\n\nNOW GO FUCKING PRINT 🔥\n\n2/2\n\nWant to find ads like this instantly? \n\nI use @GetHookdAI to spy on 21M+ winning ads across Facebook, TikTok & Google.\n\n→ See what's converting in your niche\n→ Swipe proven hooks & angles  \n→ Skip months of trial & error\n\nTry it free: gethookd.ai`
  },
  {
    id: "post-3",
    title: "O Positiv / URO — Vaginal Health Vitamin",
    mediaUrl: "/media/opositiv_vitamin.jpg",
    mediaType: "image",
    status: "approved",
    target: "Solo ecommerce founders doing $2-10M/year",
    content: `"I used to avoid sex. Now I want him all the time."\n\nThis brand is printing.\n\nO Positiv. 67 active ads. That's the ad copy. On Facebook. And it's working.\n\nO Positiv went straight for the emotional outcome. Better sex life. Everyone else in this space says "supports vaginal pH balance." Nobody gives a shit.\n\nUGC selfie. Woman holding the product. Bright pink bottle. Looks like a friend recommending it, not a brand selling you something.\n\nWomen's health is wide open for brands willing to talk like real people. If your ad copy reads like a doctor's note, you've already lost.\n\nNOW GO FUCKING PRINT 🔥`
  },
  {
    id: "post-4",
    title: "Purely Nutrient — Black Seed Oil / Parasite Hook",
    mediaUrl: "/media/purely_nutrient_blackseed.mp4",
    videoUrl: "/media/purely_nutrient_blackseed.mp4",
    mediaType: "video",
    status: "approved",
    target: "Solo ecommerce founders doing $2-10M/year",
    content: `"Watch what happens when you put a parasite in contact with Oregano Oil."\n\nThis brand is printing.\n\nPurely Nutrient. 234 active ads. Microscope footage of a parasite dying. On your feed. While you're eating breakfast.\n\nYou can't NOT watch it. And once you're watching a parasite squirm, you're buying whatever kills it.\n\nPurely Nutrient isn't even selling oregano oil. They're selling black seed oil. The parasite video is just the hook. Bait and switch but make it educational.\n\nParasite cleanse market is blowing up. People are convinced they have parasites.\n\nSmart brands are riding that wave.\n\nNOW GO FUCKING PRINT 🔥`
  },
  {
    id: "post-5",
    title: "Dr. Blane Schilling — Surgeon Contrarian Authority",
    mediaUrl: "/media/dr_blane_joint.jpg",
    mediaType: "image",
    status: "approved",
    target: "Solo ecommerce founders doing $2-10M/year",
    content: `"For years, I believed it was the right thing to do..."\n\nThis brand is printing.\n\nDr. Blane Schilling. 43 active ads. 200+ knee replacements. Full scrubs. Hospital hallway.\n\nAnd he's telling you surgery might not be the answer.\n\nA surgeon saying NOT to get surgery. Your brain short-circuits. Goes against everything you'd expect.\n\nAuthority marketing at its peak. Real doctor. Real setting. Contrarian angle. Impossible to ignore.\n\nAfter that hook the ad doesn't even need to be good. You're already thinking "wait, what does he recommend instead?"\n\nSelling a joint supplement without doctor authority content? One hand tied behind your back.\n\nNOW GO FUCKING PRINT 🔥`
  }
];

// Only posts 1-5 shown for brevity — the full 30 posts will be seeded from the running app's data
// The real seeding happens in index.js on first boot

function seedIfEmpty() {
  if (getCount() === 0) {
    console.log('📦 Seeding database with initial content...');
    for (const post of seedData) {
      post.createdAt = post.createdAt || new Date().toISOString();
      post.feedbackHistory = post.feedbackHistory || [];
      upsertContent(post);
    }
    console.log(`✅ Seeded ${seedData.length} posts`);
    return true;
  }
  return false;
}

module.exports = { seedIfEmpty, seedData };
