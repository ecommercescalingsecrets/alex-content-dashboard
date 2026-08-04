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

// Thread media array (per-tweet media for thread posts)
try { db.prepare('ALTER TABLE content ADD COLUMN threadMedia TEXT').run(); } catch(e) {}

// Ad link (permanent share URL for Mitch to download media + paste in first reply)
try { db.prepare('ALTER TABLE content ADD COLUMN adLink TEXT').run(); } catch(e) {}

// Settings table for LinkedIn tokens etc.
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);

// Follow targets table (Twitter handles for Mitch to follow)
db.exec(`
  CREATE TABLE IF NOT EXISTS follow_targets (
    handle TEXT PRIMARY KEY,
    profile_url TEXT NOT NULL,
    added_at INTEGER,
    followed_at INTEGER
  )
`);

const followTargetStmts = {
  listPending: db.prepare('SELECT handle, profile_url, added_at FROM follow_targets WHERE followed_at IS NULL ORDER BY added_at ASC'),
  markFollowed: db.prepare('UPDATE follow_targets SET followed_at = ? WHERE handle = ?'),
  bulkInsert: db.prepare('INSERT OR IGNORE INTO follow_targets (handle, profile_url, added_at, followed_at) VALUES (?, ?, ?, NULL)'),
};

function listPendingFollowTargets() {
  return followTargetStmts.listPending.all();
}

function markFollowTargetFollowed(handle) {
  const info = followTargetStmts.markFollowed.run(Date.now(), handle);
  return info.changes > 0;
}

function bulkInsertFollowTargets(targets) {
  const now = Date.now();
  const insertMany = db.transaction((items) => {
    let inserted = 0;
    for (const t of items) {
      if (!t || !t.handle || !t.profile_url) continue;
      const h = String(t.handle).replace(/^@/, '').toLowerCase();
      const info = followTargetStmts.bulkInsert.run(h, t.profile_url, now);
      if (info.changes > 0) inserted++;
    }
    return inserted;
  });
  return insertMany(targets || []);
}

// ===== Reply Planter table (tweets to reply-to via ghost accounts) =====
db.exec(`
  CREATE TABLE IF NOT EXISTS reply_planter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tweet_url TEXT UNIQUE NOT NULL,
    tweet_id TEXT,
    author_handle TEXT,
    author_name TEXT,
    tweet_text TEXT,
    matched_keyword TEXT,
    assigned_ghost TEXT,
    suggested_reply TEXT,
    status TEXT DEFAULT 'pending',
    detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    posted_at TEXT,
    notes TEXT
  )
`);
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_reply_planter_status ON reply_planter(status)').run(); } catch(e) {}
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_reply_planter_detected ON reply_planter(detected_at)').run(); } catch(e) {}

const replyPlanterStmts = {
  list: db.prepare('SELECT * FROM reply_planter ORDER BY detected_at DESC LIMIT ?'),
  insert: db.prepare(`INSERT OR IGNORE INTO reply_planter
    (tweet_url, tweet_id, author_handle, author_name, tweet_text, matched_keyword, assigned_ghost, suggested_reply, status, detected_at, notes)
    VALUES (@tweet_url, @tweet_id, @author_handle, @author_name, @tweet_text, @matched_keyword, @assigned_ghost, @suggested_reply, @status, @detected_at, @notes)`),
  get: db.prepare('SELECT * FROM reply_planter WHERE id = ?'),
  updateStatus: db.prepare('UPDATE reply_planter SET status = ?, posted_at = ?, notes = COALESCE(?, notes), suggested_reply = COALESCE(?, suggested_reply) WHERE id = ?'),
  countGhostToday: db.prepare(`SELECT COUNT(*) as cnt FROM reply_planter WHERE assigned_ghost = ? AND date(detected_at) = date('now')`),
};

function listReplyPlanter({ status, keyword, ghost, limit = 500 } = {}) {
  let rows = replyPlanterStmts.list.all(limit);
  if (status) rows = rows.filter(r => r.status === status);
  if (keyword) rows = rows.filter(r => r.matched_keyword === keyword);
  if (ghost) rows = rows.filter(r => r.assigned_ghost === ghost);
  return rows;
}

function insertReplyPlanter(row) {
  const payload = {
    tweet_url: row.tweet_url,
    tweet_id: row.tweet_id || null,
    author_handle: row.author_handle || null,
    author_name: row.author_name || null,
    tweet_text: row.tweet_text || null,
    matched_keyword: row.matched_keyword || null,
    assigned_ghost: row.assigned_ghost || null,
    suggested_reply: row.suggested_reply || null,
    status: row.status || 'pending',
    detected_at: row.detected_at || new Date().toISOString(),
    notes: row.notes || null,
  };
  const info = replyPlanterStmts.insert.run(payload);
  return { inserted: info.changes > 0, id: info.lastInsertRowid };
}

function updateReplyPlanter(id, { status, notes, suggested_reply } = {}) {
  const posted_at = status === 'posted' ? new Date().toISOString() : null;
  const info = replyPlanterStmts.updateStatus.run(status || null, posted_at, notes || null, suggested_reply || null, id);
  if (info.changes === 0) return null;
  return replyPlanterStmts.get.get(id);
}

function countGhostRepliesToday(ghost) {
  return replyPlanterStmts.countGhostToday.get(ghost).cnt;
}

const stmts = {
  getAll: db.prepare('SELECT * FROM content'),
  get: db.prepare('SELECT * FROM content WHERE id = ?'),
  upsert: db.prepare(`INSERT OR REPLACE INTO content 
    (id, title, mediaUrl, videoUrl, mediaType, content, status, target, createdAt, approvedAt, scheduledAt, scheduledStatus, tweetId, tweetIds, postedAt, feedbackHistory, replyContent, postTarget, linkedinPostId, category, threadMedia, adLink)
    VALUES (@id, @title, @mediaUrl, @videoUrl, @mediaType, @content, @status, @target, @createdAt, @approvedAt, @scheduledAt, @scheduledStatus, @tweetId, @tweetIds, @postedAt, @feedbackHistory, @replyContent, @postTarget, @linkedinPostId, @category, @threadMedia, @adLink)`),
  delete: db.prepare('DELETE FROM content WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) as cnt FROM content'),
};

function deserialize(row) {
  if (!row) return null;
  row.feedbackHistory = JSON.parse(row.feedbackHistory || '[]');
  row.tweetIds = row.tweetIds ? JSON.parse(row.tweetIds) : undefined;
  row.threadMedia = row.threadMedia ? JSON.parse(row.threadMedia) : undefined;
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
    threadMedia: item.threadMedia ? JSON.stringify(item.threadMedia) : null,
    adLink: item.adLink || null,
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

module.exports = { getAllContent, getContent, upsertContent, deleteContent, getCount, db, getSetting, setSetting, listPendingFollowTargets, markFollowTargetFollowed, bulkInsertFollowTargets, listReplyPlanter, insertReplyPlanter, updateReplyPlanter, countGhostRepliesToday };
