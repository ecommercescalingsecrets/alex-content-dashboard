#!/usr/bin/env node
/**
 * Google Sheets API utility — full control over the spreadsheet.
 *
 * Usage:
 *   node sheets-api.js listTabs
 *   node sheets-api.js createTab "My New Tab"
 *   node sheets-api.js read "Sheet1"
 *   node sheets-api.js clear "Sheet1"                    # clears all data
 *   node sheets-api.js clear "Sheet1" --keep-headers     # keeps header row
 *   node sheets-api.js push "Tab Name"                   # push all DB content to tab
 *   node sheets-api.js push "Tab Name" --status approved # push filtered content
 *   node sheets-api.js overwrite "Tab Name"              # replace all data in tab
 *   node sheets-api.js hyperlinks "Tab Name"             # make media URLs clickable
 *   node sheets-api.js deleteTab "Tab Name"
 */

const fetch = require('node-fetch');
const { getAllContent } = require('./api/db');

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL
    || 'https://script.google.com/macros/s/AKfycbxuukgV4C8toGsg_tdu9n_J5gi047QOimbmXpojdxuP68Z8nP3-nCtR-_KMKnkDCB_6/exec';

const HEADERS = ['ID', 'Title', 'Content', 'Status', 'Target', 'Created At', 'Approved At', 'Scheduled At', 'Posted At', 'Tweet IDs', 'Media URL'];

async function callSheets(payload) {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow'
    });

    const text = await res.text();
    let result;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }

    if (result.status === 'error') {
        console.error('Error:', result.message);
        process.exit(1);
    }
    return result;
}

function postToRow(post) {
    return [
        post.id || '',
        post.title || '',
        post.content || '',
        post.status || '',
        post.target || '',
        post.createdAt || '',
        post.approvedAt || '',
        post.scheduledAt || '',
        post.postedAt || '',
        Array.isArray(post.tweetIds) ? post.tweetIds.join(', ') : (post.tweetIds || ''),
        post.mediaUrl || ''
    ];
}

function getPostRows(statusFilter) {
    let posts = getAllContent();
    if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'scheduled') {
            posts = posts.filter(p => p.status === 'approved' && p.scheduledAt);
        } else {
            posts = posts.filter(p => p.status === statusFilter);
        }
    }
    return posts.map(postToRow);
}

async function main() {
    const args = process.argv.slice(2);
    const action = args[0];
    const tabName = args[1];

    if (!action) {
        console.log('Usage: node sheets-api.js <action> [tab] [options]');
        console.log('Actions: listTabs, createTab, read, clear, push, overwrite, hyperlinks, deleteTab');
        process.exit(0);
    }

    switch (action) {
        case 'listTabs': {
            const result = await callSheets({ action: 'listTabs' });
            console.log('Tabs:', result.tabs.join(', '));
            break;
        }

        case 'createTab': {
            if (!tabName) { console.error('Usage: node sheets-api.js createTab "Tab Name"'); process.exit(1); }
            const result = await callSheets({ action: 'createTab', tab: tabName, headers: HEADERS });
            console.log(`Tab "${tabName}": ${result.status}`);
            break;
        }

        case 'read': {
            const result = await callSheets({ action: 'read', tab: tabName || 'Sheet1' });
            if (result.data) {
                result.data.forEach((row, i) => console.log(`Row ${i}: ${JSON.stringify(row)}`));
            } else {
                console.log('Empty or not found');
            }
            break;
        }

        case 'clear': {
            const keepHeaders = args.includes('--keep-headers');
            const result = await callSheets({ action: 'clear', tab: tabName || 'Sheet1', keepHeaders });
            console.log(`Tab "${tabName}": ${result.status}`);
            break;
        }

        case 'push': {
            if (!tabName) { console.error('Usage: node sheets-api.js push "Tab Name" [--status approved]'); process.exit(1); }
            const statusIdx = args.indexOf('--status');
            const statusFilter = statusIdx !== -1 ? args[statusIdx + 1] : null;
            const rows = getPostRows(statusFilter);
            if (rows.length === 0) { console.log('No posts to push.'); process.exit(0); }
            const result = await callSheets({ action: 'append', tab: tabName, rows });
            console.log(`Pushed ${result.count} rows to "${tabName}"`);
            break;
        }

        case 'overwrite': {
            if (!tabName) { console.error('Usage: node sheets-api.js overwrite "Tab Name" [--status approved]'); process.exit(1); }
            const statusIdx = args.indexOf('--status');
            const statusFilter = statusIdx !== -1 ? args[statusIdx + 1] : null;
            const rows = getPostRows(statusFilter);
            const result = await callSheets({ action: 'overwrite', tab: tabName, headers: HEADERS, rows });
            console.log(`Overwrote "${tabName}" with ${result.count} rows`);
            break;
        }

        case 'hyperlinks': {
            const result = await callSheets({ action: 'hyperlinks', tab: tabName || 'Sheet1' });
            console.log(`Hyperlinks: ${result.status}`);
            break;
        }

        case 'deleteTab': {
            if (!tabName) { console.error('Usage: node sheets-api.js deleteTab "Tab Name"'); process.exit(1); }
            const result = await callSheets({ action: 'deleteTab', tab: tabName });
            console.log(`Tab "${tabName}": ${result.status}`);
            break;
        }

        default:
            console.error(`Unknown action: ${action}`);
            process.exit(1);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
