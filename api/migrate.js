#!/usr/bin/env node
/**
 * One-time migration: extract hardcoded posts from old index.js and insert into SQLite.
 * Run: node api/migrate.js
 */
const fs = require('fs');
const path = require('path');

// Read the original index.js
const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

// Extract the contentDatabase object using a hacky but effective approach:
// We'll eval just the contentDatabase portion
const startMarker = 'let contentDatabase = {';
const startIdx = src.indexOf(startMarker);
if (startIdx === -1) {
  console.log('contentDatabase already removed or migrated. Checking if DB has data...');
  const { getCount } = require('./db');
  console.log(`DB has ${getCount()} posts.`);
  process.exit(0);
}

// Find the matching closing brace by counting braces
let braceCount = 0;
let endIdx = -1;
for (let i = startIdx + startMarker.length - 1; i < src.length; i++) {
  if (src[i] === '{') braceCount++;
  if (src[i] === '}') braceCount--;
  if (braceCount === 0) {
    endIdx = i + 1;
    break;
  }
}

const dbCode = src.substring(startIdx, endIdx);

// Eval it (safe - it's our own code)
const contentDatabase = eval('(' + dbCode.replace('let contentDatabase = ', '') + ')');

const { upsertContent, getCount } = require('./db');

if (getCount() > 0) {
  console.log(`DB already has ${getCount()} posts. Skipping migration.`);
  process.exit(0);
}

let count = 0;
for (const [id, item] of Object.entries(contentDatabase)) {
  item.id = id;
  item.feedbackHistory = item.feedbackHistory || [];
  item.createdAt = item.createdAt || new Date().toISOString();
  upsertContent(item);
  count++;
}

console.log(`✅ Migrated ${count} posts to SQLite.`);
