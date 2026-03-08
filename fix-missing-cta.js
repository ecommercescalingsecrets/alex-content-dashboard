#!/usr/bin/env node
const { getContent, upsertContent, getAllContent } = require('./api/db');

// Define CTA section
const ctaSection = `\n\n2/2\n\nWant to find ads like this instantly? \n\nI use @GetHookdAI to spy on 70M+ winning ads. They scrape 110,000+ brands daily on Facebook.\n\n→ See what's converting in your niche\n→ Swipe proven hooks & angles  \n→ Skip months of trial & error\n\nTry it free: gethookd.ai`;

// Fix post-3 (O Positiv) - add missing Gethookd CTA
const post = getContent('post-3');

if (post) {
  console.log('Current content ends with:', post.content.slice(-50));
  
  // Only add CTA if it's missing
  if (!post.content.includes('I use @GetHookdAI')) {
    post.content = post.content + ctaSection;
    upsertContent(post);
    console.log('✅ Added Gethookd CTA to post-3');
    console.log('New content ends with:', post.content.slice(-100));
  } else {
    console.log('❌ CTA already exists');
  }
} else {
  console.log('Post not found');
}

// Check all posts missing CTA
console.log('\n🔍 Checking all posts for missing CTAs...');
const allPosts = getAllContent();

let fixed = 0;
for (const postItem of allPosts) {
  if (!postItem.content.includes('I use @GetHookdAI')) {
    console.log(`❌ Missing CTA: ${postItem.id} - ${postItem.title}`);
    postItem.content = postItem.content + ctaSection;
    upsertContent(postItem);
    fixed++;
    console.log(`✅ Fixed ${postItem.id}`);
  }
}

console.log(`\n🎯 Fixed ${fixed} posts with missing CTAs`);