const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
    appKey: '2U2KZG8ljE1wLXCySzhBswCyO',
    appSecret: 'nAAEWk2x6ofyhdMpe1pCmJOm141w6s7rW2Vmdt83lSxvoIPDoU',
    accessToken: '1761047014723268608-zen0WfNRJeARDWAGV9iRgSKU5vTb91',
    accessSecret: 'KtseVJNS72KTf7xwVrElWTmyb9LOgPkmwCkIu5IiFuIfP'
});

const topIds = [
    '2034328787458941178', '2033177953102672111', '2033268605777768620',
    '2033216929125802324', '2032893606478918098', '2033828120793399315',
    '2033566692039954477', '2033905017619415225', '2034303542891290818',
    '2033295714608947282'
];

(async () => {
    const tweets = await client.v2.tweets(topIds, {
        'tweet.fields': 'public_metrics,created_at,note_tweet',
        expansions: 'attachments.media_keys',
        'media.fields': 'url,preview_image_url,type'
    });
    
    tweets.data.forEach((t, i) => {
        const m = t.public_metrics;
        const fullText = t.note_tweet?.text || t.text;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`#${i+1} | ${m.impression_count.toLocaleString()} imp | ${m.like_count} ❤️ | ${t.created_at.substring(0,10)}`);
        console.log(`${'='.repeat(60)}`);
        console.log(fullText);
    });
})();
