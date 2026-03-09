const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'content.db'));
const result = db.prepare(
    "UPDATE content SET status = 'approved' WHERE status IN ('draft', 'review')"
).run();
console.log(`Updated ${result.changes} posts to approved`);
db.close();
