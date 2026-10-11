// Dashboard access control.
//
// Three ways in:
//   1. Team login (browser)  -> signed session cookie, 30 days
//   2. API key (scripts/crons) -> header `x-api-key: <key>` or `Authorization: Bearer <key>`
//   3. Trusted IP (Hermes Mac) -> DASHBOARD_TRUSTED_IPS, matched on the RIGHTMOST
//      X-Forwarded-For entry (added by Railway's edge, can't be spoofed by the client)
//
// Env vars (set in Railway):
//   DASHBOARD_USERS        "alex:<salt>:<scrypt-hex>;mitch:<salt>:<scrypt-hex>"  (make with scripts/hash_password.js)
//   DASHBOARD_SESSION_SECRET  random string, signs cookies. Rotating it logs everyone out.
//   DASHBOARD_API_KEY      random string for machine access
//   DASHBOARD_TRUSTED_IPS  comma-separated IPs; trailing '*' = prefix match (IPv6 /64)
//   DASHBOARD_AUTH         set to "off" to disable the gate (emergency only)
//   DASHBOARD_PUBLIC_PATHS optional comma-separated extra path prefixes to leave public

const crypto = require('crypto');

const COOKIE = 'dash_session';
const SESSION_DAYS = 30;

const PUBLIC_EXACT = new Set(['/login', '/api/login', '/api/logout', '/api/health', '/favicon.ico']);

// Never serve these as static files, even to logged-in users.
const BLOCKED = [/^\/data(\/|$)/, /^\/scripts(\/|$)/, /^\/node_modules(\/|$)/, /^\/api\/[^/]+\.js$/i,
    /\.db(-wal|-shm)?$/i, /^\/package(-lock)?\.json$/i, /^\/railway\.json$/i, /^\/\.git/];

function parseUsers() {
    const users = {};
    for (const entry of (process.env.DASHBOARD_USERS || '').split(';')) {
        const [name, salt, hash] = entry.trim().split(':');
        if (name && salt && hash) users[name.toLowerCase()] = { salt, hash };
    }
    return users;
}

function safeEqual(a, b) {
    const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function checkPassword(username, password) {
    const u = parseUsers()[String(username || '').toLowerCase().trim()];
    if (!u || !password) return false;
    const got = crypto.scryptSync(String(password), u.salt, 32).toString('hex');
    return safeEqual(got, u.hash);
}

function secret() {
    return process.env.DASHBOARD_SESSION_SECRET || '';
}

function sign(payload) {
    return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function makeSession(username) {
    const exp = Date.now() + SESSION_DAYS * 864e5;
    const payload = `${Buffer.from(username).toString('base64url')}.${exp}`;
    return `${payload}.${sign(payload)}`;
}

function readSession(req) {
    const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
    if (!raw || !secret()) return null;
    const val = decodeURIComponent(raw.slice(COOKIE.length + 1));
    const parts = val.split('.');
    if (parts.length !== 3) return null;
    const [u64, exp, sig] = parts;
    if (!safeEqual(sig, sign(`${u64}.${exp}`))) return null;
    if (Date.now() > Number(exp)) return null;
    const username = Buffer.from(u64, 'base64url').toString();
    if (!parseUsers()[username]) return null; // user removed -> session dies
    return username;
}

function clientIp(req) {
    // Railway's edge sets X-Real-IP to the true client IP (overwrites any client-sent value).
    if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']).trim();
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
    return xff.length ? xff[xff.length - 1] : (req.socket.remoteAddress || '');
}

function hasApiKey(req) {
    const key = process.env.DASHBOARD_API_KEY;
    if (!key) return false;
    const auth = String(req.headers.authorization || '');
    const given = req.headers['x-api-key'] || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
    return !!given && safeEqual(given, key);
}

function isTrustedIp(req) {
    const list = (process.env.DASHBOARD_TRUSTED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
    const ip = clientIp(req).replace(/^::ffff:/, '').toLowerCase();
    // Entries ending in '*' are prefixes (e.g. an IPv6 /64 like "2603:3020:1807:1a00:*").
    return list.some(e => e.endsWith('*') ? ip.startsWith(e.slice(0, -1).toLowerCase()) : ip === e.toLowerCase());
}

function isPublic(path) {
    if (PUBLIC_EXACT.has(path)) return true;
    const extra = (process.env.DASHBOARD_PUBLIC_PATHS || '').split(',').map(s => s.trim()).filter(Boolean);
    return extra.some(p => path === p || path.startsWith(p.endsWith('/') ? p : p + '/'));
}

// Basic brute-force brake: 10 failed logins per IP per 15 min.
const fails = new Map();
function tooManyFails(ip) {
    const now = Date.now();
    const rec = fails.get(ip);
    if (!rec || now - rec.start > 15 * 60e3) return false;
    return rec.count >= 10;
}
function noteFail(ip) {
    const now = Date.now();
    const rec = fails.get(ip);
    if (!rec || now - rec.start > 15 * 60e3) fails.set(ip, { start: now, count: 1 });
    else rec.count++;
}

const LOGIN_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard login</title><meta name="robots" content="noindex">
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#e6e6e6}
form{background:#181b22;padding:32px;border-radius:12px;width:300px;box-shadow:0 8px 30px rgba(0,0,0,.4)}
h1{font-size:18px;margin:0 0 20px}
label{display:block;font-size:12px;color:#9aa0aa;margin:12px 0 4px}
input{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #2a2f3a;background:#0f1115;color:#fff;font-size:14px}
button{margin-top:20px;width:100%;padding:11px;border:0;border-radius:8px;background:#4f7cff;color:#fff;font-weight:600;font-size:14px;cursor:pointer}
#err{color:#ff6b6b;font-size:13px;margin-top:12px;min-height:16px}
</style></head><body>
<form id="f"><h1>Content Dashboard</h1>
<label>Username</label><input name="username" autocomplete="username" autofocus required>
<label>Password</label><input name="password" type="password" autocomplete="current-password" required>
<button type="submit">Log in</button><div id="err"></div></form>
<script>
document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({username: fd.get('username'), password: fd.get('password')})});
  if (r.ok) {
    const next = new URLSearchParams(location.search).get('next') || '/';
    location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  } else {
    const j = await r.json().catch(() => ({}));
    document.getElementById('err').textContent = j.error || 'Wrong username or password';
  }
});
</script></body></html>`;

function install(app) {
    // Block sensitive static files for everyone.
    app.use((req, res, next) => {
        if (BLOCKED.some(re => re.test(req.path))) return res.status(404).send('Not found');
        next();
    });

    app.get('/login', (req, res) => {
        res.set('Cache-Control', 'no-store').type('html').send(LOGIN_HTML);
    });

    app.post('/api/login', (req, res) => {
        const ip = clientIp(req);
        if (tooManyFails(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
        const { username, password } = req.body || {};
        if (!secret()) return res.status(500).json({ error: 'Login not configured' });
        if (!checkPassword(username, password)) {
            noteFail(ip);
            return res.status(401).json({ error: 'Wrong username or password' });
        }
        const name = String(username).toLowerCase().trim();
        res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(makeSession(name))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
        console.log(`🔐 login ok: ${name} from ${ip}`);
        res.json({ ok: true, user: name });
    });

    const logout = (req, res) => {
        res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
        if (req.method === 'GET') return res.redirect('/login');
        res.json({ ok: true });
    };
    app.post('/api/logout', logout);
    app.get('/api/logout', logout);

    // The gate.
    app.use((req, res, next) => {
        if (process.env.DASHBOARD_AUTH === 'off') return next();
        if (req.method === 'OPTIONS' || isPublic(req.path)) return next();
        const user = readSession(req);
        if (user) { req.dashboardUser = user; return next(); }
        if (hasApiKey(req) || isTrustedIp(req)) { req.dashboardUser = 'machine'; return next(); }

        const wantsHtml = req.method === 'GET' && !req.path.startsWith('/api/') && (req.headers.accept || '').includes('text/html');
        if (wantsHtml) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
        res.status(401).json({ error: 'Login required' });
    });

    app.get('/api/whoami', (req, res) => {
        res.json({ user: req.dashboardUser || null, ip: clientIp(req), xff: req.headers['x-forwarded-for'] || null, realIp: req.headers['x-real-ip'] || null, envoy: req.headers['x-envoy-external-address'] || null });
    });
}

module.exports = { install, clientIp };
