#!/usr/bin/env node
/**
 * Post-deploy smoke test: exercises live endpoints to catch schema drift.
 * Would have caught the tweetId/postedAt whitelist bug in 5 seconds.
 *
 * Usage: BASE_URL=https://web-production-c72a.up.railway.app node scripts/smoke.js
 */
const BASE = process.env.BASE_URL || 'https://web-production-c72a.up.railway.app';
const failures = [];

async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(BASE + path, opts);
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
}

function assert(name, cond, detail) {
    if (cond) {
        console.log(`  ✅ ${name}`);
    } else {
        console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
        failures.push(name);
    }
}

(async () => {
    console.log(`🔍 Smoke test against ${BASE}`);

    // 1. Health
    const health = await req('GET', '/api/health');
    assert('health endpoint', health.status === 200);

    // 2. List content
    const list = await req('GET', '/api/content?limit=1');
    assert('GET /api/content', list.status === 200 && Array.isArray(list.json));

    // 3. Create → PUT → verify metadata whitelist → cleanup
    const testId = 'smoke-' + Date.now();
    const created = await req('POST', '/api/content', {
        id: testId,
        title: 'smoke test — safe to delete',
        content: 'ignore me',
        category: 'reply',
        status: 'draft',
        scheduledStatus: 'unscheduled',
        postTarget: 'twitter',
    });
    assert('POST /api/content', created.status === 200 || created.status === 201,
           `got ${created.status}: ${created.text.slice(0, 200)}`);

    // Full metadata whitelist smoke — all fields that MUST round-trip
    const fields = {
        tweetId: 'SMOKE_TWEETID',
        tweetIds: ['SMOKE_TWEETID'],
        postedAt: '2026-07-30T12:00:00.000Z',
        status: 'posted',
        adLink: 'https://app.gethookd.ai/share/ad/999?signature=smoke',
        target: 'smoke-test',
    };
    const put = await req('PUT', `/api/content/${testId}`, fields);
    assert('PUT /api/content/:id', put.status === 200);

    const got = await req('GET', `/api/content/${testId}`);
    assert('GET single post', got.status === 200);
    for (const [k, v] of Object.entries(fields)) {
        const actual = got.json?.[k];
        const ok = JSON.stringify(actual) === JSON.stringify(v);
        assert(`field "${k}" round-trips through PUT`, ok,
               ok ? '' : `expected ${JSON.stringify(v)}, got ${JSON.stringify(actual)}`);
    }

    // Cleanup
    const del = await req('DELETE', `/api/content/${testId}`);
    assert('DELETE /api/content/:id', del.status === 200);

    if (failures.length) {
        console.error(`\n🚨 SMOKE FAILED — ${failures.length} check(s) failed:`);
        failures.forEach(f => console.error(`  - ${f}`));
        process.exit(1);
    }
    console.log('\n✅ All smoke checks passed.');
})().catch(err => {
    console.error('🚨 SMOKE THREW:', err.message);
    process.exit(1);
});
