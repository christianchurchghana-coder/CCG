'use strict';
/*
 * Christian Church of Ghana: community backend.
 * Zero dependencies (Node 18+). Run:  node server.js
 *
 * - Serves the website files from the parent folder, so one deploy hosts both.
 * - REST API for members, event RSVPs, friends and messages.
 * - Live delivery with Server-Sent Events (GET /api/stream).
 * - Data is saved to data.json next to this file.
 *
 * Env: PORT (default 3000), ALLOWED_ORIGIN (default *), DATA_FILE, SITE_DIR
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const SITE_DIR = path.resolve(process.env.SITE_DIR || path.join(__dirname, '..'));
const MAX_MEMBERS = 5000;
const MAX_BODY = 8 * 1024;
const MAX_MSG = 500;
const HISTORY_LIMIT = 200;

/* ---------------- storage ---------------- */
var db = { users: {}, rsvps: {}, friends: {}, messages: {} };
try {
    var raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    db = Object.assign(db, raw);
} catch (e) { /* first run */ }

var saveTimer = null;
function saveSoon() {
    if (saveTimer) { return; }
    saveTimer = setTimeout(function () {
        saveTimer = null;
        var tmp = DATA_FILE + '.tmp';
        try {
            fs.writeFileSync(tmp, JSON.stringify(db));
            fs.renameSync(tmp, DATA_FILE);
        } catch (e) { console.error('Could not save data:', e.message); }
    }, 300);
}
function flushSync() {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch (e) { /* ignore */ }
}
process.on('SIGINT', function () { flushSync(); process.exit(0); });
process.on('SIGTERM', function () { flushSync(); process.exit(0); });

/* ---------------- helpers ---------------- */
function clean(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function id() { return crypto.randomBytes(6).toString('hex'); }
function threadKey(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
function publicUser(u) { return { id: u.id, name: u.name, interest: u.interest || '' }; }

var tokens = {};
Object.keys(db.users).forEach(function (uid) { tokens[db.users[uid].token] = uid; });

function authUser(req, url) {
    var h = req.headers.authorization || '';
    var t = h.indexOf('Bearer ') === 0 ? h.slice(7) : (url && url.searchParams.get('token')) || '';
    var uid = tokens[t];
    return uid ? db.users[uid] : null;
}

/* simple per-IP / per-user rate limiter */
var hits = {};
function limited(key, max, windowMs) {
    var now = Date.now();
    var h = hits[key] = (hits[key] || []).filter(function (t) { return now - t < windowMs; });
    if (h.length >= max) { return true; }
    h.push(now);
    return false;
}
setInterval(function () {
    var now = Date.now();
    Object.keys(hits).forEach(function (k) {
        hits[k] = hits[k].filter(function (t) { return now - t < 120000; });
        if (!hits[k].length) { delete hits[k]; }
    });
}, 60000).unref();

function clientIp(req) {
    var xf = req.headers['x-forwarded-for'];
    return (xf ? String(xf).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
}

/* ---------------- live streams (SSE) ---------------- */
var streams = {}; /* userId -> Set(res) */
function isOnline(uid) { return !!(streams[uid] && streams[uid].size); }
function pushTo(uid, event, data) {
    var set = streams[uid];
    if (!set) { return; }
    var payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
    set.forEach(function (res) { try { res.write(payload); } catch (e) { /* closed */ } });
}
function broadcast(event, data) {
    Object.keys(streams).forEach(function (uid) { pushTo(uid, event, data); });
}

/* ---------------- http plumbing ---------------- */
function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
}
function send(res, code, obj) {
    var body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
}
function readBody(req, cb) {
    var size = 0, chunks = [];
    req.on('data', function (c) {
        size += c.length;
        if (size > MAX_BODY) { req.destroy(); return; }
        chunks.push(c);
    });
    req.on('end', function () {
        try { cb(null, chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
        catch (e) { cb(e); }
    });
    req.on('error', function () { cb(new Error('read error')); });
}

/* ---------------- API ---------------- */
function stateFor(me) {
    var members = Object.keys(db.users).filter(function (u) { return u !== me.id; }).map(function (u) {
        var m = publicUser(db.users[u]);
        m.online = isOnline(u);
        return m;
    });
    return {
        me: publicUser(me),
        members: members,
        rsvps: db.rsvps,
        friends: db.friends[me.id] || []
    };
}

function handleApi(req, res, url) {
    var route = req.method + ' ' + url.pathname;
    var ip = clientIp(req);

    if (route === 'GET /api/health') { return send(res, 200, { ok: true }); }

    if (route === 'GET /api/stream') {
        var su = authUser(req, url);
        if (!su) { return send(res, 401, { error: 'Please join first.' }); }
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        res.write('retry: 3000\n\n');
        var first = !isOnline(su.id);
        (streams[su.id] = streams[su.id] || new Set()).add(res);
        if (first) { broadcast('presence', { id: su.id, online: true }); }
        var beat = setInterval(function () { try { res.write(': ping\n\n'); } catch (e) { /* closed */ } }, 25000);
        req.on('close', function () {
            clearInterval(beat);
            var set = streams[su.id];
            if (set) {
                set.delete(res);
                if (!set.size) { delete streams[su.id]; broadcast('presence', { id: su.id, online: false }); }
            }
        });
        return;
    }

    if (route === 'POST /api/join') {
        if (limited('join:' + ip, 10, 3600000)) { return send(res, 429, { error: 'Too many sign-ups from this network. Try later.' }); }
        return readBody(req, function (err, b) {
            if (err) { return send(res, 400, { error: 'Bad request.' }); }
            var name = clean(b.name, 40);
            if (name.length < 2) { return send(res, 400, { error: 'Please enter your name.' }); }
            if (Object.keys(db.users).length >= MAX_MEMBERS) { return send(res, 503, { error: 'Community is full.' }); }
            var u = { id: id(), name: name, interest: clean(b.interest, 60), token: crypto.randomBytes(24).toString('hex'), joined: Date.now() };
            db.users[u.id] = u;
            tokens[u.token] = u.id;
            saveSoon();
            broadcast('member', publicUser(u));
            send(res, 200, { token: u.token, user: publicUser(u) });
        });
    }

    var me = authUser(req, url);
    if (!me) { return send(res, 401, { error: 'Please join first.' }); }

    if (route === 'GET /api/state') { return send(res, 200, stateFor(me)); }

    if (route === 'POST /api/profile') {
        return readBody(req, function (err, b) {
            if (err) { return send(res, 400, { error: 'Bad request.' }); }
            var name = clean(b.name, 40);
            if (name.length >= 2) { me.name = name; }
            if (b.interest != null) { me.interest = clean(b.interest, 60); }
            saveSoon();
            broadcast('member', publicUser(me));
            send(res, 200, { user: publicUser(me) });
        });
    }

    if (route === 'POST /api/rsvp') {
        if (limited('rsvp:' + me.id, 30, 60000)) { return send(res, 429, { error: 'Slow down.' }); }
        return readBody(req, function (err, b) {
            if (err) { return send(res, 400, { error: 'Bad request.' }); }
            var ev = clean(b.event, 60);
            if (!ev) { return send(res, 400, { error: 'Missing event.' }); }
            var list = db.rsvps[ev] = db.rsvps[ev] || [];
            var ix = list.indexOf(me.id);
            if (b.going && ix === -1) { list.push(me.id); }
            if (!b.going && ix !== -1) { list.splice(ix, 1); }
            saveSoon();
            broadcast('rsvp', { event: ev, going: list });
            send(res, 200, { event: ev, going: list });
        });
    }

    if (route === 'POST /api/friends') {
        if (limited('fr:' + me.id, 60, 60000)) { return send(res, 429, { error: 'Slow down.' }); }
        return readBody(req, function (err, b) {
            if (err) { return send(res, 400, { error: 'Bad request.' }); }
            var other = db.users[String(b.id)];
            if (!other || other.id === me.id) { return send(res, 404, { error: 'Member not found.' }); }
            var mine = db.friends[me.id] = db.friends[me.id] || [];
            var theirs = db.friends[other.id] = db.friends[other.id] || [];
            if (b.add) {
                if (mine.indexOf(other.id) === -1) { mine.push(other.id); }
                if (theirs.indexOf(me.id) === -1) { theirs.push(me.id); }
            } else {
                db.friends[me.id] = mine.filter(function (x) { return x !== other.id; });
                db.friends[other.id] = theirs.filter(function (x) { return x !== me.id; });
            }
            saveSoon();
            pushTo(other.id, 'friends', { friends: db.friends[other.id] });
            pushTo(me.id, 'friends', { friends: db.friends[me.id] });
            send(res, 200, { friends: db.friends[me.id] });
        });
    }

    if (route === 'GET /api/messages') {
        var withId = url.searchParams.get('with');
        if (!withId || !db.users[withId]) { return send(res, 404, { error: 'Member not found.' }); }
        if ((db.friends[me.id] || []).indexOf(withId) === -1) { return send(res, 403, { error: 'Add this person as a friend first.' }); }
        return send(res, 200, { messages: db.messages[threadKey(me.id, withId)] || [] });
    }

    if (route === 'POST /api/messages') {
        if (limited('msg:' + me.id, 30, 60000)) { return send(res, 429, { error: 'You are sending messages too fast.' }); }
        return readBody(req, function (err, b) {
            if (err) { return send(res, 400, { error: 'Bad request.' }); }
            var to = String(b.to || '');
            var text = clean(b.text, MAX_MSG);
            if (!db.users[to] || to === me.id) { return send(res, 404, { error: 'Member not found.' }); }
            if (!text) { return send(res, 400, { error: 'Empty message.' }); }
            if ((db.friends[me.id] || []).indexOf(to) === -1 || (db.friends[to] || []).indexOf(me.id) === -1) {
                return send(res, 403, { error: 'You can only message friends.' });
            }
            var key = threadKey(me.id, to);
            var list = db.messages[key] = db.messages[key] || [];
            var msg = { id: id(), from: me.id, to: to, text: text, t: Date.now() };
            list.push(msg);
            if (list.length > HISTORY_LIMIT) { list.splice(0, list.length - HISTORY_LIMIT); }
            saveSoon();
            pushTo(to, 'message', msg);
            pushTo(me.id, 'message', msg); /* keeps the sender's other tabs in sync */
            send(res, 200, { message: msg });
        });
    }

    send(res, 404, { error: 'Not found.' });
}

/* ---------------- static site ---------------- */
var TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.txt': 'text/plain'
};
function serveStatic(req, res, url) {
    var rel = decodeURIComponent(url.pathname);
    if (rel === '/') { rel = '/index.html'; }
    var file = path.normalize(path.join(SITE_DIR, rel));
    var base = path.basename(file);
    var inServer = file.indexOf(path.join(SITE_DIR, 'server') + path.sep) === 0;
    if (file.indexOf(SITE_DIR + path.sep) !== 0 || inServer || base.charAt(0) === '.') {
        res.writeHead(404); return res.end('Not found');
    }
    fs.stat(file, function (err, st) {
        if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
}

http.createServer(function (req, res) {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    var url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
    try {
        if (url.pathname.indexOf('/api/') === 0) { return handleApi(req, res, url); }
        if (req.method === 'GET' || req.method === 'HEAD') { return serveStatic(req, res, url); }
        res.writeHead(405); res.end();
    } catch (e) {
        console.error(e);
        if (!res.headersSent) { send(res, 500, { error: 'Server error.' }); }
    }
}).listen(PORT, function () {
    console.log('CCG community server on http://localhost:' + PORT);
});