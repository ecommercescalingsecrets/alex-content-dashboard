#!/usr/bin/env node
/**
 * 180-Day Twitter Analytics Fetcher & Analyzer
 * Pulls all tweets with metrics from Twitter API Pro, then generates analysis.
 *
 * Usage: node scripts/analyze-180-days.js
 * Or via API: GET /api/analytics/fetch-180-days
 */

const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || '2U2KZG8ljE1wLXCySzhBswCyO',
    appSecret: process.env.TWITTER_API_SECRET || 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP'
});

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_FILE = path.join(DATA_DIR, 'tweets-180-days.json');
const ANALYSIS_FILE = path.join(DATA_DIR, 'analytics-report.json');

async function fetchAllTweets() {
    const me = await client.v2.me();
    console.log(`Authenticated as @${me.data.username} (ID: ${me.data.id})`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180);

    const allTweets = [];
    const allMedia = {};
    let nextToken = undefined;
    let page = 0;

    while (true) {
        page++;
        console.log(`Fetching page ${page}...`);

        const params = {
            max_results: 100,
            start_time: startDate.toISOString(),
            'tweet.fields': ['created_at', 'public_metrics', 'attachments', 'entities', 'text', 'referenced_tweets', 'in_reply_to_user_id'],
            'media.fields': ['type', 'url', 'preview_image_url', 'duration_ms', 'public_metrics'],
            expansions: ['attachments.media_keys']
        };
        if (nextToken) params.pagination_token = nextToken;

        const result = await client.v2.userTimeline(me.data.id, params);

        // Collect media lookup
        if (result.data.includes?.media) {
            for (const m of result.data.includes.media) {
                allMedia[m.media_key] = m;
            }
        }

        const tweets = result.data.data || [];
        allTweets.push(...tweets);
        console.log(`  Got ${tweets.length} tweets (total: ${allTweets.length})`);

        nextToken = result.data.meta?.next_token;
        if (!nextToken || tweets.length === 0) break;

        // Rate limit safety
        await new Promise(r => setTimeout(r, 1000));
    }

    // Enrich tweets with media info
    for (const tweet of allTweets) {
        tweet._media = [];
        if (tweet.attachments?.media_keys) {
            for (const key of tweet.attachments.media_keys) {
                if (allMedia[key]) tweet._media.push(allMedia[key]);
            }
        }
    }

    console.log(`\nTotal tweets fetched: ${allTweets.length}`);
    return { username: me.data.username, userId: me.data.id, tweets: allTweets, fetchedAt: new Date().toISOString() };
}

function classifyContent(text) {
    const lower = text.toLowerCase();

    // Content type
    let type = 'general';
    if (/ad autopsy|breakdown|analyze|dissect/i.test(text)) type = 'ad-autopsy';
    else if (/swipe file|swipe|hook swipe/i.test(text)) type = 'swipe-file';
    else if (/\bvs\b|versus|battle/i.test(text)) type = 'vs-battle';
    else if (/top \d|ranking|list/i.test(text)) type = 'listicle';
    else if (/category|niche|market/i.test(text) && /war|battle|fight/i.test(text)) type = 'category-war';
    else if (/hot take|unpopular|myth|most brands/i.test(text)) type = 'hot-take';
    else if (/how to|step|guide|strategy|playbook/i.test(text)) type = 'how-to';
    else if (/data|analyzed|found|study|pattern/i.test(text)) type = 'data-insight';
    else if (/thread|🧵/i.test(text)) type = 'thread';

    // Structure detection
    const structure = {
        hasEmoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(text),
        hasArrows: text.includes('→') || text.includes('->'),
        hasNumbers: /\d+\s*(active|ads|days|brands|%)/i.test(text),
        hasBrandMention: /@\w+/.test(text),
        hasLink: /https?:\/\//.test(text) || /gethookd\.ai/i.test(text),
        hasQuestion: /\?/.test(text),
        startsWithQuote: text.startsWith('"') || text.startsWith('"'),
        startsWithHook: /^(this|most|stop|hot take|unpopular|nobody|everyone)/i.test(text.trim()),
        hasList: (text.match(/→/g) || []).length >= 3,
        paragraphCount: text.split(/\n\n+/).filter(Boolean).length,
        wordCount: text.split(/\s+/).length,
        charCount: text.length,
    };

    // Hook type
    let hookType = 'statement';
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.startsWith('"') || firstLine.startsWith('"')) hookType = 'quote-hook';
    else if (firstLine.endsWith('?')) hookType = 'question-hook';
    else if (/^\d/.test(firstLine)) hookType = 'number-hook';
    else if (/^(this|these|that)/i.test(firstLine)) hookType = 'curiosity-hook';
    else if (/^(stop|don't|never|most brands)/i.test(firstLine)) hookType = 'contrarian-hook';
    else if (/^(hot take|unpopular)/i.test(firstLine)) hookType = 'hot-take-hook';

    return { type, structure, hookType };
}

function analyze(data) {
    const tweets = data.tweets.filter(t => {
        // Exclude pure replies to other users
        if (t.in_reply_to_user_id && t.in_reply_to_user_id !== data.userId) return false;
        // Exclude pure retweets
        if (t.referenced_tweets?.some(r => r.type === 'retweeted')) return false;
        return true;
    });

    console.log(`Analyzing ${tweets.length} original tweets (excluded replies/RTs)...`);

    // Enrich each tweet
    const enriched = tweets.map(t => {
        const metrics = t.public_metrics || {};
        const classification = classifyContent(t.text);
        const mediaTypes = (t._media || []).map(m => m.type);
        const hasImage = mediaTypes.includes('photo');
        const hasVideo = mediaTypes.includes('video') || mediaTypes.includes('animated_gif');

        let mediaType = 'text-only';
        if (hasVideo) mediaType = 'video';
        else if (hasImage) mediaType = 'image';

        const engagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) +
            (metrics.reply_count || 0) + (metrics.quote_count || 0) + (metrics.bookmark_count || 0);
        const engagementRate = metrics.impression_count > 0
            ? (engagement / metrics.impression_count * 100) : 0;

        return {
            id: t.id,
            date: t.created_at,
            text: t.text,
            impressions: metrics.impression_count || 0,
            likes: metrics.like_count || 0,
            retweets: metrics.retweet_count || 0,
            replies: metrics.reply_count || 0,
            bookmarks: metrics.bookmark_count || 0,
            quotes: metrics.quote_count || 0,
            engagement,
            engagementRate: Math.round(engagementRate * 100) / 100,
            mediaType,
            contentType: classification.type,
            hookType: classification.hookType,
            structure: classification.structure,
            isThread: (t.referenced_tweets || []).some(r => r.type === 'replied_to') &&
                      (!t.in_reply_to_user_id || t.in_reply_to_user_id === data.userId),
        };
    });

    // Sort by impressions
    const byImpressions = [...enriched].sort((a, b) => b.impressions - a.impressions);
    const byEngagement = [...enriched].sort((a, b) => b.engagement - a.engagement);
    const byEngagementRate = [...enriched].filter(t => t.impressions > 100).sort((a, b) => b.engagementRate - a.engagementRate);

    // Aggregate by content type
    const byContentType = {};
    for (const t of enriched) {
        if (!byContentType[t.contentType]) byContentType[t.contentType] = { tweets: 0, totalImpressions: 0, totalEngagement: 0, totalLikes: 0, totalRetweets: 0, totalBookmarks: 0 };
        const ct = byContentType[t.contentType];
        ct.tweets++;
        ct.totalImpressions += t.impressions;
        ct.totalEngagement += t.engagement;
        ct.totalLikes += t.likes;
        ct.totalRetweets += t.retweets;
        ct.totalBookmarks += t.bookmarks;
    }
    for (const [key, val] of Object.entries(byContentType)) {
        val.avgImpressions = Math.round(val.totalImpressions / val.tweets);
        val.avgEngagement = Math.round(val.totalEngagement / val.tweets);
        val.avgLikes = Math.round(val.totalLikes / val.tweets);
        val.engagementRate = val.totalImpressions > 0
            ? Math.round(val.totalEngagement / val.totalImpressions * 10000) / 100 : 0;
    }

    // Aggregate by media type
    const byMediaType = {};
    for (const t of enriched) {
        if (!byMediaType[t.mediaType]) byMediaType[t.mediaType] = { tweets: 0, totalImpressions: 0, totalEngagement: 0, totalLikes: 0, totalBookmarks: 0 };
        const mt = byMediaType[t.mediaType];
        mt.tweets++;
        mt.totalImpressions += t.impressions;
        mt.totalEngagement += t.engagement;
        mt.totalLikes += t.likes;
        mt.totalBookmarks += t.bookmarks;
    }
    for (const [key, val] of Object.entries(byMediaType)) {
        val.avgImpressions = Math.round(val.totalImpressions / val.tweets);
        val.avgEngagement = Math.round(val.totalEngagement / val.tweets);
        val.engagementRate = val.totalImpressions > 0
            ? Math.round(val.totalEngagement / val.totalImpressions * 10000) / 100 : 0;
    }

    // Aggregate by hook type
    const byHookType = {};
    for (const t of enriched) {
        if (!byHookType[t.hookType]) byHookType[t.hookType] = { tweets: 0, totalImpressions: 0, totalEngagement: 0 };
        const ht = byHookType[t.hookType];
        ht.tweets++;
        ht.totalImpressions += t.impressions;
        ht.totalEngagement += t.engagement;
    }
    for (const [key, val] of Object.entries(byHookType)) {
        val.avgImpressions = Math.round(val.totalImpressions / val.tweets);
        val.avgEngagement = Math.round(val.totalEngagement / val.tweets);
        val.engagementRate = val.totalImpressions > 0
            ? Math.round(val.totalEngagement / val.totalImpressions * 10000) / 100 : 0;
    }

    // Day of week analysis
    const byDayOfWeek = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const t of enriched) {
        const day = dayNames[new Date(t.date).getUTCDay()];
        if (!byDayOfWeek[day]) byDayOfWeek[day] = { tweets: 0, totalImpressions: 0, totalEngagement: 0 };
        byDayOfWeek[day].tweets++;
        byDayOfWeek[day].totalImpressions += t.impressions;
        byDayOfWeek[day].totalEngagement += t.engagement;
    }
    for (const val of Object.values(byDayOfWeek)) {
        val.avgImpressions = Math.round(val.totalImpressions / val.tweets);
        val.avgEngagement = Math.round(val.totalEngagement / val.tweets);
    }

    // Hour of day analysis
    const byHour = {};
    for (const t of enriched) {
        const hour = new Date(t.date).getUTCHours();
        const estHour = ((hour - 4) + 24) % 24; // Rough EDT
        const label = `${estHour}:00 EST`;
        if (!byHour[label]) byHour[label] = { tweets: 0, totalImpressions: 0, totalEngagement: 0 };
        byHour[label].tweets++;
        byHour[label].totalImpressions += t.impressions;
        byHour[label].totalEngagement += t.engagement;
    }
    for (const val of Object.values(byHour)) {
        val.avgImpressions = Math.round(val.totalImpressions / val.tweets);
        val.avgEngagement = Math.round(val.totalEngagement / val.tweets);
    }

    // Structure analysis: which structural elements correlate with high performance
    const structureCorrelations = {};
    const structureKeys = ['hasEmoji', 'hasArrows', 'hasNumbers', 'hasList', 'hasQuestion', 'startsWithQuote', 'startsWithHook', 'hasLink'];
    for (const key of structureKeys) {
        const withFeature = enriched.filter(t => t.structure[key]);
        const withoutFeature = enriched.filter(t => !t.structure[key]);
        structureCorrelations[key] = {
            withCount: withFeature.length,
            withoutCount: withoutFeature.length,
            withAvgImpressions: withFeature.length > 0 ? Math.round(withFeature.reduce((s, t) => s + t.impressions, 0) / withFeature.length) : 0,
            withoutAvgImpressions: withoutFeature.length > 0 ? Math.round(withoutFeature.reduce((s, t) => s + t.impressions, 0) / withoutFeature.length) : 0,
            withAvgEngagement: withFeature.length > 0 ? Math.round(withFeature.reduce((s, t) => s + t.engagement, 0) / withFeature.length) : 0,
            withoutAvgEngagement: withoutFeature.length > 0 ? Math.round(withoutFeature.reduce((s, t) => s + t.engagement, 0) / withoutFeature.length) : 0,
        };
        const w = structureCorrelations[key];
        w.impressionLift = w.withoutAvgImpressions > 0
            ? Math.round((w.withAvgImpressions - w.withoutAvgImpressions) / w.withoutAvgImpressions * 100) : 0;
        w.engagementLift = w.withoutAvgEngagement > 0
            ? Math.round((w.withAvgEngagement - w.withoutAvgEngagement) / w.withoutAvgEngagement * 100) : 0;
    }

    // Word count buckets
    const wordBuckets = { 'short (1-50)': [], 'medium (51-150)': [], 'long (151-280)': [], 'thread (280+)': [] };
    for (const t of enriched) {
        const wc = t.structure.wordCount;
        if (wc <= 50) wordBuckets['short (1-50)'].push(t);
        else if (wc <= 150) wordBuckets['medium (51-150)'].push(t);
        else if (wc <= 280) wordBuckets['long (151-280)'].push(t);
        else wordBuckets['thread (280+)'].push(t);
    }
    const byWordCount = {};
    for (const [bucket, tweets] of Object.entries(wordBuckets)) {
        byWordCount[bucket] = {
            tweets: tweets.length,
            avgImpressions: tweets.length > 0 ? Math.round(tweets.reduce((s, t) => s + t.impressions, 0) / tweets.length) : 0,
            avgEngagement: tweets.length > 0 ? Math.round(tweets.reduce((s, t) => s + t.engagement, 0) / tweets.length) : 0,
        };
    }

    // Weekly trend
    const weeklyTrend = {};
    for (const t of enriched) {
        const d = new Date(t.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split('T')[0];
        if (!weeklyTrend[key]) weeklyTrend[key] = { tweets: 0, impressions: 0, engagement: 0 };
        weeklyTrend[key].tweets++;
        weeklyTrend[key].impressions += t.impressions;
        weeklyTrend[key].engagement += t.engagement;
    }

    const report = {
        summary: {
            period: '180 days',
            totalTweets: enriched.length,
            totalImpressions: enriched.reduce((s, t) => s + t.impressions, 0),
            totalEngagement: enriched.reduce((s, t) => s + t.engagement, 0),
            totalLikes: enriched.reduce((s, t) => s + t.likes, 0),
            totalRetweets: enriched.reduce((s, t) => s + t.retweets, 0),
            totalBookmarks: enriched.reduce((s, t) => s + t.bookmarks, 0),
            avgImpressionsPerTweet: enriched.length > 0 ? Math.round(enriched.reduce((s, t) => s + t.impressions, 0) / enriched.length) : 0,
            avgEngagementPerTweet: enriched.length > 0 ? Math.round(enriched.reduce((s, t) => s + t.engagement, 0) / enriched.length) : 0,
        },
        top20byImpressions: byImpressions.slice(0, 20).map(t => ({
            id: t.id, date: t.date, impressions: t.impressions, engagement: t.engagement,
            engagementRate: t.engagementRate, likes: t.likes, retweets: t.retweets,
            bookmarks: t.bookmarks, contentType: t.contentType, hookType: t.hookType,
            mediaType: t.mediaType, text: t.text.substring(0, 200)
        })),
        top20byEngagement: byEngagement.slice(0, 20).map(t => ({
            id: t.id, date: t.date, impressions: t.impressions, engagement: t.engagement,
            engagementRate: t.engagementRate, contentType: t.contentType, hookType: t.hookType,
            text: t.text.substring(0, 200)
        })),
        top10byEngagementRate: byEngagementRate.slice(0, 10).map(t => ({
            id: t.id, impressions: t.impressions, engagement: t.engagement,
            engagementRate: t.engagementRate, contentType: t.contentType, hookType: t.hookType,
            text: t.text.substring(0, 200)
        })),
        byContentType,
        byMediaType,
        byHookType,
        byDayOfWeek,
        byHour,
        structureCorrelations,
        byWordCount,
        weeklyTrend,
        generatedAt: new Date().toISOString()
    };

    return report;
}

async function main() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    console.log('=== 180-Day Twitter Analytics ===\n');

    // Step 1: Fetch
    console.log('STEP 1: Fetching tweets...');
    const raw = await fetchAllTweets();
    fs.writeFileSync(RAW_FILE, JSON.stringify(raw, null, 2));
    console.log(`Saved raw data to ${RAW_FILE}\n`);

    // Step 2: Analyze
    console.log('STEP 2: Analyzing...');
    const report = analyze(raw);
    fs.writeFileSync(ANALYSIS_FILE, JSON.stringify(report, null, 2));
    console.log(`Saved report to ${ANALYSIS_FILE}\n`);

    // Step 3: Print summary
    console.log('=== SUMMARY ===');
    console.log(`Tweets analyzed: ${report.summary.totalTweets}`);
    console.log(`Total impressions: ${report.summary.totalImpressions.toLocaleString()}`);
    console.log(`Avg impressions/tweet: ${report.summary.avgImpressionsPerTweet.toLocaleString()}`);
    console.log(`Total engagement: ${report.summary.totalEngagement.toLocaleString()}`);
    console.log(`Avg engagement/tweet: ${report.summary.avgEngagementPerTweet.toLocaleString()}`);

    console.log('\n=== BY CONTENT TYPE (avg impressions) ===');
    const sortedTypes = Object.entries(report.byContentType).sort((a, b) => b[1].avgImpressions - a[1].avgImpressions);
    for (const [type, data] of sortedTypes) {
        console.log(`  ${type}: ${data.avgImpressions.toLocaleString()} avg imp | ${data.tweets} tweets | ${data.engagementRate}% ER`);
    }

    console.log('\n=== BY MEDIA TYPE ===');
    for (const [type, data] of Object.entries(report.byMediaType)) {
        console.log(`  ${type}: ${data.avgImpressions.toLocaleString()} avg imp | ${data.tweets} tweets`);
    }

    console.log('\n=== BY HOOK TYPE ===');
    const sortedHooks = Object.entries(report.byHookType).sort((a, b) => b[1].avgImpressions - a[1].avgImpressions);
    for (const [type, data] of sortedHooks) {
        console.log(`  ${type}: ${data.avgImpressions.toLocaleString()} avg imp | ${data.tweets} tweets`);
    }

    console.log('\n=== STRUCTURE ELEMENTS (impression lift %) ===');
    const sortedStructure = Object.entries(report.structureCorrelations).sort((a, b) => b[1].impressionLift - a[1].impressionLift);
    for (const [key, data] of sortedStructure) {
        console.log(`  ${key}: ${data.impressionLift > 0 ? '+' : ''}${data.impressionLift}% imp lift | ${data.withCount} tweets with, ${data.withoutCount} without`);
    }

    console.log('\n=== BY DAY OF WEEK (avg impressions) ===');
    const sortedDays = Object.entries(report.byDayOfWeek).sort((a, b) => b[1].avgImpressions - a[1].avgImpressions);
    for (const [day, data] of sortedDays) {
        console.log(`  ${day}: ${data.avgImpressions.toLocaleString()} avg imp | ${data.tweets} tweets`);
    }

    console.log('\nDone! Full report saved to data/analytics-report.json');
}

// Export for use as API endpoint
module.exports = { fetchAllTweets, analyze, main };

// Run standalone
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
