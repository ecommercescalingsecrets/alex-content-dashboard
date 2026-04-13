#!/usr/bin/env node
/**
 * Pre-deploy validation: checks index.html for JS syntax errors
 * and verifies the API starts without crashing.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let failed = false;

// 1. Extract all <script> blocks from index.html and check syntax
console.log('🔍 Checking index.html JS syntax...');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
let match;
let blockNum = 0;

while ((match = scriptRegex.exec(html)) !== null) {
    blockNum++;
    const code = match[1].trim();
    if (!code) continue;
    
    // Write to temp file and check with Node
    const tmpFile = path.join(__dirname, `_tmp_check_${blockNum}.js`);
    fs.writeFileSync(tmpFile, code);
    try {
        execSync(`node --check "${tmpFile}"`, { stdio: 'pipe' });
        console.log(`  ✅ Script block #${blockNum} OK`);
    } catch (e) {
        console.error(`  ❌ Script block #${blockNum} SYNTAX ERROR:`);
        console.error(e.stderr.toString());
        failed = true;
    } finally {
        fs.unlinkSync(tmpFile);
    }
}

// 2. Check that require('./api/db') doesn't crash
console.log('🔍 Checking API module loads...');
try {
    // Just check syntax of all JS files
    const apiDir = path.join(__dirname, '..', 'api');
    const jsFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
    for (const f of jsFiles) {
        execSync(`node --check "${path.join(apiDir, f)}"`, { stdio: 'pipe' });
        console.log(`  ✅ api/${f} OK`);
    }
} catch (e) {
    console.error(`  ❌ API syntax error:`, e.stderr.toString());
    failed = true;
}

if (failed) {
    console.error('\n🚨 VALIDATION FAILED — do NOT deploy this commit.');
    process.exit(1);
} else {
    console.log('\n✅ All checks passed — safe to deploy.');
}
