const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'content.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    title TEXT,
    mediaUrl TEXT,
    videoUrl TEXT,
    mediaType TEXT,
    content TEXT,
    status TEXT DEFAULT 'review',
    target TEXT,
    createdAt TEXT,
    approvedAt TEXT,
    scheduledAt TEXT,
    scheduledStatus TEXT,
    tweetId TEXT,
    tweetIds TEXT,
    postedAt TEXT,
    feedbackHistory TEXT DEFAULT '[]',
    replyContent TEXT
  )
`);

// Add replyContent column if missing (migration)
try { db.prepare('ALTER TABLE content ADD COLUMN replyContent TEXT').run(); } catch(e) {}

// LinkedIn integration migrations
try { db.prepare('ALTER TABLE content ADD COLUMN postTarget TEXT DEFAULT \'twitter\'').run(); } catch(e) {}
try { db.prepare('ALTER TABLE content ADD COLUMN linkedinPostId TEXT').run(); } catch(e) {}

// Category column (reply, swipe, breakdown, etc.)
try { db.prepare('ALTER TABLE content ADD COLUMN category TEXT').run(); } catch(e) {}

// Settings table for LinkedIn tokens etc.
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);

const stmts = {
  getAll: db.prepare('SELECT * FROM content'),
  get: db.prepare('SELECT * FROM content WHERE id = ?'),
  upsert: db.prepare(`INSERT OR REPLACE INTO content 
    (id, title, mediaUrl, videoUrl, mediaType, content, status, target, createdAt, approvedAt, scheduledAt, scheduledStatus, tweetId, tweetIds, postedAt, feedbackHistory, replyContent, postTarget, linkedinPostId, category)
    VALUES (@id, @title, @mediaUrl, @videoUrl, @mediaType, @content, @status, @target, @createdAt, @approvedAt, @scheduledAt, @scheduledStatus, @tweetId, @tweetIds, @postedAt, @feedbackHistory, @replyContent, @postTarget, @linkedinPostId, @category)`),
  delete: db.prepare('DELETE FROM content WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) as cnt FROM content'),
};

function deserialize(row) {
  if (!row) return null;
  row.feedbackHistory = JSON.parse(row.feedbackHistory || '[]');
  row.tweetIds = row.tweetIds ? JSON.parse(row.tweetIds) : undefined;
  return row;
}

function serialize(item) {
  return {
    id: item.id,
    title: item.title || null,
    mediaUrl: item.mediaUrl || null,
    videoUrl: item.videoUrl || null,
    mediaType: item.mediaType || null,
    content: item.content || null,
    status: item.status || 'review',
    target: item.target || null,
    createdAt: item.createdAt || null,
    approvedAt: item.approvedAt || null,
    scheduledAt: item.scheduledAt || null,
    scheduledStatus: item.scheduledStatus || null,
    tweetId: item.tweetId || null,
    tweetIds: item.tweetIds ? JSON.stringify(item.tweetIds) : null,
    postedAt: item.postedAt || null,
    feedbackHistory: JSON.stringify(item.feedbackHistory || []),
    replyContent: item.replyContent || null,
    postTarget: item.postTarget || 'twitter',
    linkedinPostId: item.linkedinPostId || null,
    category: item.category || null,
  };
}

function getAllContent() {
  return stmts.getAll.all().map(deserialize);
}

function getContent(id) {
  return deserialize(stmts.get.get(id));
}

function upsertContent(item) {
  stmts.upsert.run(serialize(item));
  return getContent(item.id);
}

function deleteContent(id) {
  stmts.delete.run(id);
}

function getCount() {
  return stmts.count.get().cnt;
}

// Settings helpers
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, new Date().toISOString());
}

module.exports = { getAllContent, getContent, upsertContent, deleteContent, getCount, db, getSetting, setSetting };
