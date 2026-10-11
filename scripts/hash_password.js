#!/usr/bin/env node
// Usage: node scripts/hash_password.js <username> <password>
// Prints a "username:salt:hash" entry for the DASHBOARD_USERS env var (entries joined with ';').
const crypto = require('crypto');
const [user, pass] = process.argv.slice(2);
if (!user || !pass) { console.error('usage: node scripts/hash_password.js <username> <password>'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(pass, salt, 32).toString('hex');
console.log(`${user.toLowerCase()}:${salt}:${hash}`);
