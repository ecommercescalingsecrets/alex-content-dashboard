const express = require('express');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.static('.'));

const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || 'YXFGhtTBSbipbkuDI2Lt7vemt',
    appSecret: process.env.TWITTER_API_SECRET || 'rfIzIamcswhW1pGmuxAokivSnkCQUgu1U4Gv79Nc3fM2fDGjNL',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '1761047014723268608-InwEEOM5NITevI55zn4EBwnYXKsW6P',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || 'p2yBey5EeDVdswZPBulnM3soaLKusRDsXj1AjsLP9XGIB'
});

let contentDatabase = {
    written1: {
        id: 'written1',
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
        target: "Solo ecommerce founders doing $2-10M/year"
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/api/content', (req, res) => {
    res.json(contentDatabase);
});
