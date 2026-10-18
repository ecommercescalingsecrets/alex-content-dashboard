// Disk guard (2026-10-18). The /app/data volume (50GB) filled up with
// media-resolver downloads -> SQLITE_FULL -> crash loop -> 502 for everyone.
//
// 1. freeBytes(): free space on the data volume.
// 2. reclaimIfLow(): if free < LOW, delete ORPHAN media files (filenames that
//    do not appear anywhere in content.db / content.db-wal bytes), oldest first,
//    until free >= TARGET. Scans raw DB bytes so it works even when SQLite
//    itself cannot open (disk full breaks the WAL -shm pragma on boot).
//    Referenced files are never touched.
const fs = require('fs');
const path = require('path');

const GB = 1024 ** 3;
const LOW = 3 * GB;      // start reclaiming below this
const TARGET = 8 * GB;   // reclaim up to this much free space
const MIN_FOR_DOWNLOADS = 2 * GB;

const DATA_DIR = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..', 'data');
const MEDIA_DIR = fs.existsSync('/app/data') ? '/app/data/media' : path.join(__dirname, '..', 'media');
const DB_DIR = path.join(__dirname, '..', 'data');

function freeBytes() {
    try {
        const s = fs.statfsSync(DATA_DIR);
        return s.bavail * s.bsize;
    } catch (e) {
        return Infinity; // unknown -> don't block anything
    }
}

function referencedNames() {
    const names = new Set();
    const re = /[A-Za-z0-9_.\-]+\.(?:mp4|mov|webm|m4v|jpg|jpeg|png|gif|webp)/gi;
    for (const f of ['content.db', 'content.db-wal']) {
        const p = path.join(DB_DIR, f);
        if (!fs.existsSync(p)) continue;
        const fd = fs.openSync(p, 'r');
        const CH = 64 * 1024 * 1024;
        const buf = Buffer.alloc(CH + 512);
        let pos = 0, carry = '';
        while (true) {
            const n = fs.readSync(fd, buf, 0, CH, pos);
            if (n <= 0) break;
            const s = carry + buf.toString('latin1', 0, n);
            for (const m of s.matchAll(re)) names.add(m[0].toLowerCase());
            carry = s.slice(-300);
            pos += n;
        }
        fs.closeSync(fd);
    }
    return names;
}

function reclaimIfLow(reason = 'check') {
    const free = freeBytes();
    if (free >= LOW || !fs.existsSync(MEDIA_DIR)) return { skipped: true, freeGB: +(free / GB).toFixed(2) };
    const t0 = Date.now();
    const refs = referencedNames();
    const files = fs.readdirSync(MEDIA_DIR).map(name => {
        try {
            const st = fs.statSync(path.join(MEDIA_DIR, name));
            return st.isFile() ? { name, size: st.size, mtime: st.mtimeMs } : null;
        } catch { return null; }
    }).filter(Boolean);
    // Only names the reference regex can fully match are eligible (a file like
    // "My Video.mp4" could be referenced but would never appear in refs whole).
    const SAFE = /^[A-Za-z0-9_.\-]+\.(?:mp4|mov|webm|m4v|jpg|jpeg|png|gif|webp)$/i;
    const orphans = files.filter(f => SAFE.test(f.name) && !refs.has(f.name.toLowerCase())).sort((a, b) => a.mtime - b.mtime);
    let freed = 0, deleted = 0;
    for (const f of orphans) {
        if (freeBytes() >= TARGET) break;
        try { fs.unlinkSync(path.join(MEDIA_DIR, f.name)); freed += f.size; deleted++; } catch {}
    }
    const out = {
        reason, files: files.length, refs: refs.size, orphans: orphans.length, deleted,
        freedGB: +(freed / GB).toFixed(2), freeGB: +(freeBytes() / GB).toFixed(2), ms: Date.now() - t0,
    };
    console.log('[disk-guard] reclaim', JSON.stringify(out));
    return out;
}

module.exports = { freeBytes, reclaimIfLow, MIN_FOR_DOWNLOADS, GB };
