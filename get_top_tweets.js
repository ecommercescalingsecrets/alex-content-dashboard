const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
    appKey: '2U2KZG8ljE1wLXCySzhBswCyO',
    appSecret: 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    accessToken: '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    accessSecret: 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP'
});

(async () => {
    try {
        // Get user ID for fedotoff90
        const user = await client.v2.userByUsername('fedotoff90');
        console.log('User:', JSON.stringify(user.data));
        
        // Get recent tweets with public metrics
        const tweets = await client.v2.userTimeline(user.data.id, {
            max_results: 100,
            'tweet.fields': 'public_metrics,created_at',
            exclude: ['retweets', 'replies']
        });
        
        // Sort by engagement (likes + retweets + impressions)
        const sorted = tweets.data.data
            .map(t => ({
                id: t.id,
                text: t.text.substring(0, 100),
                full_text: t.text,
                created: t.created_at,
                likes: t.public_metrics.like_count,
                retweets: t.public_metrics.retweet_count,
                replies: t.public_metrics.reply_count,
                impressions: t.public_metrics.impression_count,
                engagement: t.public_metrics.like_count + t.public_metrics.retweet_count * 2
            }))
            .sort((a, b) => b.impressions - a.impressions);
        
        console.log(`\nTop 15 tweets by impressions:\n`);
        sorted.slice(0, 15).forEach((t, i) => {
            console.log(`${i+1}. ${t.impressions.toLocaleString()} imp | ${t.likes} ❤️ | ${t.retweets} 🔁 | ${t.created.substring(0,10)}`);
            console.log(`   ${t.text}...`);
            console.log(`   ID: ${t.id}\n`);
        });
        
        console.log(`Total tweets analyzed: ${tweets.data.data.length}`);
    } catch (e) {
        console.error('Error:', e.message);
        if (e.data) console.error('Data:', JSON.stringify(e.data));
    }
})();
