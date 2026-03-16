#!/usr/bin/env node
/**
 * Push content directly to Google Sheets via Apps Script webhook.
 * No server, no Railway — just run this script.
 *
 * Usage:
 *   node push-to-sheets.js                           # push all content from DB
 *   node push-to-sheets.js --status approved          # push only approved
 *   node push-to-sheets.js --title "My Post" --content "Post body here..."  # push a single post
 */

const fetch = require('node-fetch');
const { getAllContent } = require('./api/db');

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL
    || 'https://script.google.com/macros/s/AKfycbzE0IWLFZrPaV46m5gkqkI6TtPEY1LZjRfI3hgUf25WKxYObXgdaAoQ9p9cOYkRrRTkYQ/exec';

async function pushRows(rows) {
    console.log(`Pushing ${rows.length} row(s) to Google Sheets...`);

    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
        redirect: 'follow'
    });

    if (!res.ok) {
        console.error(`Failed: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.error(text);
        process.exit(1);
    }

    const text = await res.text();
    let result;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }
    console.log('Done:', result);
}

// Parse args
const args = process.argv.slice(2);
function getArg(name) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const title = getArg('title');
const content = getArg('content');
const status = getArg('status');

if (title && content) {
    // Push a single post directly — no DB needed
    pushRows([{
        id: 'manual-' + Date.now(),
        title,
        content,
        status: status || 'draft',
        target: 'Solo ecommerce founders',
        createdAt: new Date().toISOString(),
        approvedAt: '',
        scheduledAt: '',
        postedAt: '',
        tweetIds: '',
        mediaUrl: ''
    }]);
} else {
    // Push from local DB
    let posts = getAllContent();

    if (status && status !== 'all') {
        if (status === 'scheduled') {
            posts = posts.filter(p => p.status === 'approved' && p.scheduledAt);
        } else {
            posts = posts.filter(p => p.status === status);
        }
    }

    if (posts.length === 0) {
        console.log('No posts to push.' + (status ? ` (filter: ${status})` : ''));
        process.exit(0);
    }

    const rows = posts.map(post => ({
        id: post.id || '',
        title: post.title || '',
        content: post.content || '',
        status: post.status || '',
        target: post.target || '',
        createdAt: post.createdAt || '',
        approvedAt: post.approvedAt || '',
        scheduledAt: post.scheduledAt || '',
        postedAt: post.postedAt || '',
        tweetIds: Array.isArray(post.tweetIds) ? post.tweetIds.join(', ') : (post.tweetIds || ''),
        mediaUrl: post.mediaUrl || ''
    }));

    pushRows(rows);
}
