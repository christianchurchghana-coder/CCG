/* Church-managed prayer schedule with authenticated, live room attendance. */
(function () {
    'use strict';
    var ADMIN_EMAIL = 'christianchurchghana@gmail.com';
    var sb = window.CCG && window.CCG.supabase;
    var $ = function (id) { return document.getElementById(id); };
    var list = $('prayer-sessions'), note = $('prayer-connection'), form = $('live-prayer-admin');
    var user = null, name = 'Church member', sessions = [], roomChannel = null, current = null, tick = 0;
    if (!list) return;

    function escape(value) { var span = document.createElement('span'); span.textContent = value == null ? '' : String(value); return span.innerHTML; }
    function setNote(text) { note.textContent = text; }
    function typeLabel(type) { return type === 'morning-devotion' ? 'Morning devotion' : type === 'fasting-prayer' ? 'Fasting & prayer' : 'Prayer meeting'; }
    function dateText(value) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value)); }
    function clockText(seconds) {
        seconds = Math.max(0, Math.ceil(seconds));
        var h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
        return h ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    function bounds(session) {
        var start = new Date(session.starts_at).getTime();
        return { start: start, end: start + Number(session.duration_minutes) * 60000 };
    }
    function renderSessions() {
        var now = Date.now();
        var shown = sessions.filter(function (session) { return bounds(session).end > now - 3600000; });
        if (!shown.length) { list.innerHTML = '<p class="prayer-empty">No prayer sessions are scheduled right now. Check back soon.</p>'; return; }
        list.innerHTML = shown.map(function (session) {
            var time = bounds(session), live = now >= time.start && now < time.end, ended = now >= time.end;
            var isAdmin = user && String(user.email || '').toLowerCase() === ADMIN_EMAIL;
            var action = ended ? '<span class="prayer-session-ended">Session ended</span>' : '<button class="btn-sm primary" type="button" data-join-session="' + escape(session.id) + '">' + (live ? 'Join live prayer' : 'Enter waiting room') + '</button>';
            if (session.stream_url && !ended) action += '<a class="btn-sm prayer-stream-link" href="' + escape(session.stream_url) + '" target="_blank" rel="noopener noreferrer">Open livestream</a>';
            if (!user) action += '<a class="prayer-login-link" href="login.html">Sign in to join</a>';
            var remove = isAdmin && !live && !ended ? '<button class="btn-sm prayer-remove-session" type="button" data-remove-session="' + escape(session.id) + '">Remove</button>' : '';
            return '<article class="prayer-session-card ' + (live ? 'is-live' : '') + '"><div class="prayer-session-top"><span class="prayer-session-type">' + escape(typeLabel(session.session_type)) + '</span>' + (live ? '<span class="prayer-live-pill"><i></i> LIVE</span>' : '') + '</div><h3>' + escape(session.title) + '</h3><p class="prayer-session-date">' + escape(dateText(session.starts_at)) + '</p><p class="prayer-session-length">' + escape(String(session.duration_minutes)) + ' minute' + (Number(session.duration_minutes) === 1 ? '' : 's') + '</p><div class="prayer-session-actions">' + action + remove + '</div></article>';
        }).join('');
    }
    function renderAttendees() {
        if (!roomChannel) return;
        var state = roomChannel.presenceState(), people = Object.create(null);
        Object.keys(state || {}).forEach(function (key) { (state[key] || []).forEach(function (item) { if (item && item.user_id) people[item.user_id] = item.display_name || 'Church member'; }); });
        var entries = Object.keys(people).map(function (id) { return people[id]; }).sort(function (a, b) { return a.localeCompare(b); });
        $('room-attendee-count').textContent = String(entries.length);
        $('room-attendees').innerHTML = entries.length ? entries.map(function (person) { return '<span class="prayer-attendee"><i></i>' + escape(person) + '</span>'; }).join('') : '<p class="prayer-empty">Waiting for members to join…</p>';
    }
    function updateRoomClock() {
        if (!current) return;
        var time = bounds(current), now = Date.now();
        if (now < time.start) {
            $('room-clock').textContent = clockText((time.start - now) / 1000);
            $('room-live-label').textContent = 'WAITING ROOM';
            $('room-message').textContent = 'Prayer begins at ' + new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(time.start)) + '. You can wait here or leave and return later.';
        } else if (now < time.end) {
            $('room-clock').textContent = clockText((time.end - now) / 1000);
            $('room-live-label').textContent = 'LIVE PRAYER';
            $('room-message').textContent = 'The church prayer session is live. Pray at your own pace with the church.';
        } else {
            $('room-clock').textContent = '00:00';
            $('room-live-label').textContent = 'SESSION COMPLETE';
            $('room-message').textContent = 'This scheduled prayer time has ended. Thank you for joining.';
        }
    }
    async function leaveRoom() {
        window.clearInterval(tick); tick = 0;
        if (roomChannel && sb) { var old = roomChannel; roomChannel = null; try { await sb.removeChannel(old); } catch (_) {} }
        current = null;
        $('prayer-room').hidden = true;
    }
    async function joinRoom(session) {
        if (!user) { location.href = 'login.html'; return; }
        await leaveRoom();
        current = session;
        $('room-title').textContent = session.title;
        $('room-session-meta').textContent = typeLabel(session.session_type) + ' · ' + dateText(session.starts_at);
        var stream = $('room-stream');
        stream.innerHTML = session.stream_url ? '<a class="btn-sm primary prayer-stream-link" href="' + escape(session.stream_url) + '" target="_blank" rel="noopener noreferrer">Open the church livestream</a>' : '';
        $('prayer-room').hidden = false;
        $('prayer-room').scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateRoomClock();
        tick = window.setInterval(updateRoomClock, 1000);
        var topic = 'ccg-prayer-' + session.id;
        var channel = sb.channel(topic, { config: { private: true, presence: { key: user.id } } });
        roomChannel = channel;
        channel.on('presence', { event: 'sync' }, renderAttendees).on('presence', { event: 'join' }, renderAttendees).on('presence', { event: 'leave' }, renderAttendees);
        channel.subscribe(async function (status) {
            if (roomChannel !== channel) return;
            if (status === 'SUBSCRIBED') {
                var tracked = await channel.track({ user_id: user.id, display_name: name, joined_at: new Date().toISOString() });
                if (tracked && tracked !== 'ok') $('room-message').textContent = 'Room opened. Could not update the live attendee list.';
                renderAttendees();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                $('room-message').textContent = 'Could not connect to the prayer room. Run prayer-live-schema.sql in Supabase, then try again.';
            }
        });
    }
    async function loadSessions() {
        if (!sb) { list.innerHTML = '<p class="prayer-empty">Prayer sessions need a Supabase connection. Check supabase-config.js.</p>'; setNote('Prayer schedule is offline.'); return; }
        var result = await sb.from('prayer_sessions').select('id,title,session_type,starts_at,duration_minutes,stream_url').gte('starts_at', new Date(Date.now() - 3600000).toISOString()).order('starts_at', { ascending: true }).limit(100);
        if (result.error) {
            var missing = result.error.code === '42P01' || result.error.code === 'PGRST205' || /prayer_sessions.*(not found|does not exist)/i.test(result.error.message || '');
            list.innerHTML = '<p class="prayer-empty">' + (missing ? 'One-time setup needed: run prayer-live-schema.sql in the Supabase SQL Editor.' : 'Could not load the church schedule. Check the connection and refresh.') + '</p>';
            setNote('Church schedule unavailable.');
            return;
        }
        sessions = result.data || [];
        renderSessions();
        setNote('Church prayer schedule is up to date.');
    }
    async function init() {
        if (!sb) { await loadSessions(); return; }
        try {
            var auth = await sb.auth.getUser(); user = auth.data && auth.data.user;
            if (user) {
                name = user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name || user.user_metadata.name) || user.email || name;
                try { var profile = await window.CCG.getProfile(user); if (profile && profile.display_name) name = profile.display_name; } catch (_) {}
                if (String(user.email || '').toLowerCase() === ADMIN_EMAIL) form.hidden = false;
            }
        } catch (_) { /* Schedule remains publicly readable without login. */ }
        await loadSessions();
        window.setInterval(function () { renderSessions(); }, 15000);
        window.setInterval(function () { loadSessions().catch(function () { setNote('Could not refresh the schedule.'); }); }, 60000);
    }
    list.addEventListener('click', function (event) {
        var join = event.target.closest('[data-join-session]');
        if (join) { var session = sessions.find(function (item) { return item.id === join.dataset.joinSession; }); if (session) joinRoom(session).catch(function () { setNote('Could not join the prayer room. Check your sign-in and connection.'); }); return; }
        var remove = event.target.closest('[data-remove-session]');
        if (remove && user && window.confirm('Remove this scheduled prayer session?')) {
            sb.from('prayer_sessions').delete().eq('id', remove.dataset.removeSession).then(function (result) { if (result.error) throw result.error; setNote('Session removed.'); return loadSessions(); }).catch(function () { setNote('Could not remove that session. Check the church admin sign-in.'); });
        }
    });
    $('leave-prayer-room').addEventListener('click', leaveRoom);
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        var status = $('live-admin-status'), startsAt = new Date($('live-start').value), duration = Number($('live-duration').value), title = $('live-title').value.trim();
        if (!user || String(user.email || '').toLowerCase() !== ADMIN_EMAIL) { status.textContent = 'Sign in with the church administrator account to publish sessions.'; return; }
        if (!title || !Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now() || !Number.isInteger(duration) || duration < 5 || duration > 1440) { status.textContent = 'Enter a title, a future start time, and a session length from 5 minutes to 24 hours.'; return; }
        status.textContent = 'Publishing the session…';
        var streamUrl = $('live-stream-url').value.trim();
        if (streamUrl && (!/^https:\/\//i.test(streamUrl) || streamUrl.length > 500)) { status.textContent = 'Livestream links must start with https://'; return; }
        var result = await sb.from('prayer_sessions').insert({ title: title, session_type: $('live-type').value, starts_at: startsAt.toISOString(), duration_minutes: duration, stream_url: streamUrl || null, created_by: user.id });
        if (result.error) {
            var missing = result.error.code === '42P01' || result.error.code === 'PGRST205';
            status.textContent = missing ? 'Run prayer-live-schema.sql in Supabase before publishing.' : 'Could not publish. Check the church administrator sign-in and try again.';
            return;
        }
        form.reset(); $('live-duration').value = '30'; status.textContent = 'Published. Church members can now see and join this session.'; await loadSessions();
    });
    window.addEventListener('beforeunload', function () { if (roomChannel && sb) sb.removeChannel(roomChannel); });
    init().catch(function () { setNote('Could not connect to the church prayer schedule.'); });
})();
