const { upsertContent, getCount } = require('./db');
const seedData = require('./seed-data.json');

function seedIfEmpty() {
  if (getCount() === 0) {
    console.log('📦 Seeding database with initial content...');
    for (const post of seedData) {
      post.feedbackHistory = post.feedbackHistory || [];
      post.createdAt = post.createdAt || new Date().toISOString();
      upsertContent(post);
    }
    console.log(`✅ Seeded ${seedData.length} posts`);
    return true;
  }
  return false;
}

module.exports = { seedIfEmpty };
