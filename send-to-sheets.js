// Script to send current secondary content to Google Sheets
const fetch = require('node-fetch');

async function sendToGoogleSheets(appsScriptUrl) {
    // The 9 posts with proper formatting
    const contentData = [
        [
            `"When a nutritionist who works with the Royal Family says ..."\n\nThis brand is printing.\n\nKilgourMD. 167 active ads. One of the most aggressive supplement brands on Facebook.\n\nAuthority hook from someone who "works with the Royal Family." That's not selling supplements — that's selling access to elite insider knowledge.\n\nMost supplement brands focus on ingredients. KilgourMD sells exclusivity.\n\nThe supplement market is oversaturated. But royal authority? That's a blue ocean with desperate buyers who'll pay premium.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/82514129/media-e3ee3ed0d611.mp4'
        ],
        [
            `"Men Love This Supplement Duo"\n\nThis brand is printing.\n\nCaleigh Mackenzie. 142 active ads. Targeting men through a female influencer's voice.\n\nHook that flips the script. Most supplement brands use male authority figures to sell to men. This brand uses a woman's perspective on what men want.\n\nPsychological trigger: Social proof from the opposite gender hits different. Men trust women's opinions on what makes them attractive.\n\nThe men's supplement space is crowded with aggressive masculinity. This brand wins with feminine validation.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/69780897/media-74a0551a6c6a.mp4'
        ],
        [
            `"The biggest lesson I learnt in my weight loss journey"\n\nThis brand is printing.\n\nWild Nutrition. 89 active ads. Personal transformation story that creates relatability.\n\nStory-driven hook that positions the founder as someone who's been through the struggle. Not another expert selling theory — someone who lived the problem.\n\nMost weight loss brands sell quick fixes. Wild Nutrition sells wisdom earned through personal experience.\n\nThe weight loss market is full of before/after pics. This brand wins with authentic storytelling and hard-earned lessons.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/84161665/media-963877bed06f.mp4'
        ],
        [
            `"Introducing Sculpt Pro, the supplement system designed to..."\n\nThis brand is printing.\n\nMaxine Laceby. 73 active ads. Product launch hook that creates anticipation.\n\n"System designed to..." — that's not selling pills. That's selling a complete transformation methodology.\n\nMost supplement brands sell individual products. Maxine Laceby sells comprehensive solutions.\n\nThe fitness supplement market is crowded with single-ingredient promises. This brand wins with systematic approaches.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/81782236/media-3a203927a246.mp4'
        ],
        [
            `"As a world-leading expert in intermittent fasting"\n\nThis brand is printing.\n\nAncestral Supplements. 298 active ads. Authority positioning that establishes credibility before the pitch.\n\n"World-leading expert" — immediate authority establishment. Not just another supplement company, but THE authority in the space.\n\nMost supplement brands lead with benefits. Ancestral Supplements leads with credentials.\n\nThe fasting market is full of wannabe gurus. This brand wins with legitimate expertise and proven track record.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/84279024/media-623398ca536a.jpg'
        ],
        [
            `"Celebrities are ditching expensive IV drips, collagen shots"\n\nThis brand is printing.\n\nCata-Kor. 156 active ads. Trend disruption hook that positions against expensive alternatives.\n\nHook creates urgency by showing celebrities moving away from expensive treatments. If celebs are switching, you should too.\n\nMost collagen brands compete on price. Cata-Kor competes on being the smart alternative to celebrity treatments.\n\nThe anti-aging market is obsessed with expensive procedures. This brand wins by being the insider secret.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/84255499/media-6fe62b5abd60.mp4'
        ],
        [
            `"Unlock unstoppable power with Turkesterone"\n\nThis brand is printing.\n\nEnflux. 91 active ads. Power-driven hook that taps into masculine desire for dominance.\n\n"Unstoppable power" — that's not selling testosterone support. That's selling transformation into an alpha version of yourself.\n\nMost test boosters focus on clinical benefits. Enflux focuses on how you'll FEEL.\n\nThe testosterone market is crowded with lab reports. This brand wins with emotional transformation promises.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/82303365/media-e1610bf3f712.mp4'
        ],
        [
            `"THEY DIDNT WANT US TO SHOW YOU THESE STATS"\n\nThis brand is printing.\n\nT-Drive. 134 active ads. Conspiracy hook that creates forbidden fruit appeal.\n\nALL CAPS urgency + "they didn't want us to show you" = banned information psychology. Makes viewers desperate to see what's hidden.\n\nMost supplement brands share studies openly. T-Drive makes their data feel like classified information.\n\nThe testosterone market is full of boring clinical data. This brand wins by making science feel like a secret.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/84158946/media-ea8358fd83f4.jpg'
        ],
        [
            `"Build Lean Muscle and Support Testosterone"\n\nThis brand is printing.\n\nCutler Nutrition. 187 active ads. Dual-benefit hook that addresses two major male concerns simultaneously.\n\nDirect benefit promise that hits both aesthetics (lean muscle) and performance (testosterone). Two pain points, one solution.\n\nMost supplement brands focus on single benefits. Cutler Nutrition stacks value propositions.\n\nThe bodybuilding supplement space is oversaturated. This brand wins by solving multiple problems with one product.\n\nNOW GO FUCKING PRINT 🔥\n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.`,
            'https://static-gp.gethookd.ai/media/ads_media/83118753/media-c46dd76b5b00.mp4'
        ]
    ];

    try {
        const response = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'addContent',
                data: contentData
            })
        });

        const result = await response.json();
        console.log('Success:', result);
        return result;
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        return { success: false, error: error.message };
    }
}

// Export for use
module.exports = { sendToGoogleSheets };

// If run directly
if (require.main === module) {
    const appsScriptUrl = process.argv[2];
    if (!appsScriptUrl) {
        console.log('Usage: node send-to-sheets.js <APPS_SCRIPT_URL>');
        process.exit(1);
    }
    sendToGoogleSheets(appsScriptUrl);
}