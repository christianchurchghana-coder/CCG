(function () {
    'use strict';
    var sb = window.CCG && window.CCG.supabase;
    var el = function (id) { return document.getElementById(id); };
    var state = { user: null, profile: null, members: [], rsvps: {}, relations: [], messages: [], statuses: [], streaks: [], active: null, events: [], channel: null };
    function escape(value) { var d = document.createElement('span'); d.textContent = value == null ? '' : String(value); return d.innerHTML; }
    function memberName(profile) { return profile && (profile.nickname || profile.display_name) || 'Church member'; }
    function setNote(text) { var n = el('cm-note'); if (n) n.textContent = text; }
    function statusError(error) { setNote(error && error.message || 'Could not load community data.'); }
    function escInitials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join(''); }
    function eventKey(event, i) { return String(event.id == null ? 'e' + i : event.id); }
    function relationsFor(id) { return state.relations.filter(function (r) { return r.requester === id || r.addressee === id; }); }
    function acceptedIds() { return state.user ? relationsFor(state.user.id).filter(function (r) { return r.status === 'accepted'; }).map(function (r) { return r.requester === state.user.id ? r.addressee : r.requester; }) : []; }
    function streakFor(id) {
        if (!state.user || !id) return null;
        return state.streaks.find(function (s) { return (s.user_low === state.user.id && s.user_high === id) || (s.user_high === state.user.id && s.user_low === id); }) || null;
    }
    function renderMe() {
        var box = el('cm-me'); if (!box) return;
        if (!state.user) { box.innerHTML = 'Sign in to join Meet &amp; Connect. <a href="login.html">Login / Register</a>'; return; }
        box.innerHTML = 'Connected as <strong>' + escape(state.profile && (state.profile.nickname || state.profile.display_name) || state.user.email || 'Member') + '</strong> · Send one message each today to keep a friend streak going.';
    }
    function renderEvents() {
        var grid = el('event-grid'); if (!grid) return;
        if (!state.events.length) { grid.innerHTML = '<p class="section-sub">No upcoming events. Check back soon!</p>'; return; }
        grid.innerHTML = state.events.slice(0, 3).map(function (event, i) {
            var key = eventKey(event, i), going = state.rsvps[key] || [], mine = state.user && going.indexOf(state.user.id) !== -1;
            var names = going.map(function (id) {
                var profile = id === (state.user && state.user.id)
                    ? state.profile
                    : state.members.find(function (member) { return member.id === id; });
                if (profile && (profile.nickname || profile.display_name)) return profile.nickname || profile.display_name;
                if (id === (state.user && state.user.id) && state.user.email) return state.user.email.split('@')[0];
                return '';
            }).filter(Boolean).sort(function (a, b) { return a.localeCompare(b); });
            var preview = names.slice(0, 3).map(escape).join(', ');
            if (names.length > 3) preview += ', and ' + (names.length - 3) + ' other' + (names.length - 3 === 1 ? '' : 's');
            var attendees = !state.user
                ? '<p class="event-attendees">Sign in to see who’s going.</p>'
                : names.length
                    ? '<p class="event-attendees"><strong>Going:</strong> ' + preview + '</p>'
                    : '<p class="event-attendees">Be the first to RSVP.</p>';
            var image = event.image
                ? '<img class="event-card-image" src="' + escape(event.image) + '" alt="' + escape(event.imageAlt || event.title) + '" loading="lazy">'
                : '';
            return '<article class="service-card event-card">' + image +
                '<div class="event-card-content">' +
                '<p class="event-card-date">' + escape(event.dateLabel || event.date || '') + '</p>' +
                '<h3>' + escape(event.title) + '</h3>' +
                (event.bio ? '<p class="event-card-bio-label">About this gathering</p><p>' + escape(event.bio) + '</p>' : '<p>' + escape(event.description || '') + '</p>') +
                (event.location ? '<p class="event-card-location">' + escape(event.location) + '</p>' : '') +
                '<p class="going-count">' + (state.user ? going.length + ' going' : 'Church members are welcome to RSVP') + '</p>' +
                attendees +
                '<div class="ev-actions"><button class="btn-sm ' + (mine ? 'on' : 'primary') + '" data-rsvp="' + escape(key) + '" aria-pressed="' + !!mine + '">' + (mine ? '✓ Going' : 'I’m going') + '</button></div>' +
                '</div></article>';
        }).join('');
    }
    function renderStatuses() {
        var feed = el('status-feed'), input = el('status-input'), send = el('status-send');
        if (!feed) return;
        if (input) input.disabled = !state.user;
        if (send) send.disabled = !state.user;
        if (!state.user) { feed.innerHTML = '<p class="cm-empty">Sign in to see and post community updates.</p>'; return; }
        if (!state.statuses.length) { feed.innerHTML = '<p class="cm-empty">No updates yet. Share the first encouragement.</p>'; return; }
        feed.innerHTML = state.statuses.map(function (item) {
            var author = item.user_id === state.user.id ? memberName(state.profile) : memberName(state.members.find(function (m) { return m.id === item.user_id; }));
            var date = new Date(item.created_at);
            return '<article class="status-card"><div class="status-card-head"><strong>' + escape(author) + '</strong><time datetime="' + escape(item.created_at) + '">' + escape(date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })) + '</time>' + (item.user_id === state.user.id ? '<button class="status-delete" type="button" data-delete-status="' + item.id + '" aria-label="Delete your status">Delete</button>' : '') + '</div><p>' + escape(item.body) + '</p></article>';
        }).join('');
    }
    function renderMembers() {
        var list = el('cm-list'); if (!list) return;
        if (!state.user) { list.innerHTML = '<p class="cm-empty">Login to see members and connect with your church community.</p>'; return; }
        var query = (el('cm-search').value || '').toLowerCase().trim(), filter = el('cm-filter').value;
        var incoming = state.relations.filter(function (r) { return r.addressee === state.user.id && r.status === 'pending'; });
        var rows = state.members.filter(function (m) {
            if (filter !== 'all' && (state.rsvps[filter] || []).indexOf(m.id) < 0) return false;
            return !query || (memberName(m) + ' ' + m.display_name + ' ' + (m.interests || '') + ' ' + (m.bio || '')).toLowerCase().indexOf(query) >= 0;
        }).map(function (m) {
            var relation = relationsFor(state.user.id).find(function (r) { return r.requester === m.id || r.addressee === m.id; });
            var streak = relation && relation.status === 'accepted' ? streakFor(m.id) : null;
            var streakBadge = streak && streak.current_days ? '<span class="streak-badge" title="A streak day counts when both friends message on the same UTC day">🔥 ' + streak.current_days + ' day' + (streak.current_days === 1 ? '' : 's') + '</span>' : '';
            var action = !relation ? '<button class="btn-sm primary" data-add="' + m.id + '">Add friend</button>' : relation.status === 'accepted' ? '<button class="btn-sm primary" data-chat="' + m.id + '">Message</button><button class="btn-sm" data-unfriend="' + relation.id + '">Remove</button>' : relation.addressee === state.user.id ? '<button class="btn-sm primary" data-accept="' + relation.id + '">Accept</button>' : '<span class="cm-note">Request sent</span>';
            var online = window.CCG && window.CCG.isOnline && window.CCG.isOnline(m.id);
            var presence = '<span class="presence-status ' + (online ? 'is-online' : 'is-offline') + '" role="img" aria-label="' + (online ? 'Online' : 'Offline') + '" title="' + (online ? 'Online now' : 'Offline') + '"><span class="presence-dot" aria-hidden="true"></span>' + (online ? 'Online' : 'Offline') + '</span>';
            var profileDetails = [m.bio, m.interests].filter(Boolean).map(escape).join(' · ');
            return '<div class="member"><div class="avatar" aria-hidden="true">' + escape(escInitials(memberName(m))) + '</div><div class="member-info"><div class="member-name">' + escape(memberName(m)) + ' ' + presence + ' ' + streakBadge + '</div><div class="member-meta">' + profileDetails + '</div></div><div class="member-btns">' + action + '<button class="btn-sm" data-report="' + m.id + '">Report</button></div></div>';
        }).join('');
        var requests = incoming.map(function (r) { var p = state.members.find(function (m) { return m.id === r.requester; }); return '<div class="member"><div class="member-info">Friend request from <strong>' + escape(memberName(p)) + '</strong></div><button class="btn-sm primary" data-accept="' + r.id + '">Accept</button><button class="btn-sm" data-unfriend="' + r.id + '">Decline</button></div>'; }).join('');
        list.innerHTML = requests + (rows || '<p class="cm-empty">No members match. Try another search or filter.</p>');
    }
    function renderChat() {
        var tabs = el('friend-tabs'), box = el('chat-msgs'), head = el('chat-head'), input = el('chat-input'), send = el('chat-send'), streakBox = el('chat-streak');
        if (!state.user) { tabs.innerHTML = ''; head.textContent = 'Friends & Chat'; box.innerHTML = '<p class="cm-empty">Sign in to chat with friends.</p>'; input.disabled = send.disabled = true; streakBox.textContent = 'Sign in to start a friend streak.'; return; }
        var ids = acceptedIds();
        if (!ids.length) { tabs.innerHTML = ''; head.textContent = 'Friends & Chat'; box.innerHTML = '<p class="cm-empty">Accept or send a friend request to start chatting.</p>'; input.disabled = send.disabled = true; streakBox.textContent = 'Become friends to start a mutual daily message streak.'; return; }
        if (!ids.includes(state.active)) state.active = ids[0];
        tabs.innerHTML = ids.map(function (id) { var m = state.members.find(function (x) { return x.id === id; }); return '<button type="button" class="btn-sm ' + (id === state.active ? 'primary' : '') + '" data-chat="' + id + '">' + escape(memberName(m)) + '</button>'; }).join('');
        var active = state.members.find(function (m) { return m.id === state.active; });
        head.textContent = 'Chat with ' + memberName(active);
        var streak = streakFor(state.active);
        streakBox.textContent = streak && streak.current_days ? '🔥 ' + streak.current_days + '-day mutual streak · best ' + streak.best_days + ' day' + (streak.best_days === 1 ? '' : 's') : 'Send a message, and ask your friend to reply today to start a mutual streak.';
        var list = state.messages.filter(function (m) { return (m.sender === state.user.id && m.recipient === state.active) || (m.sender === state.active && m.recipient === state.user.id); });
        box.innerHTML = list.length ? list.map(function (m) { return '<div class="msg' + (m.sender === state.user.id ? ' me' : '') + '">' + escape(m.body) + '<time>' + new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</time></div>'; }).join('') : '<p class="cm-empty">Say hello 👋</p>';
        box.scrollTop = box.scrollHeight; input.disabled = send.disabled = false;
    }
    function render() {
        renderEvents(); renderMe(); renderMembers(); renderChat(); renderStatuses();
        var filter = el('cm-filter'), old = filter.value; filter.innerHTML = '<option value="all">All members</option>';
        state.events.slice(0, 3).forEach(function (event, i) { var opt = document.createElement('option'); opt.value = eventKey(event, i); opt.textContent = 'Going to: ' + event.title; filter.appendChild(opt); });
        if (Array.from(filter.options).some(function (o) { return o.value === old; })) filter.value = old;
    }
    async function load() {
        state.events = typeof getEvents === 'function' ? (getEvents() || []) : [];
        if (!sb) { setNote('Supabase is not configured. Add the project settings in supabase-config.js.'); render(); return; }
        var session = await sb.auth.getUser(); state.user = session.data && session.data.user;
        state.profile = state.user ? await window.CCG.getProfile(state.user) : null;
        if (!state.user) { state.members = []; state.relations = []; state.messages = []; state.statuses = []; state.streaks = []; render(); setNote('Sign in to join Meet & Connect.'); return; }
        var uid = state.user.id;
        var results = await Promise.all([
            sb.from('profiles').select('id,display_name,nickname,interests,bio').neq('id', uid),
            sb.from('event_rsvps').select('event_key,user_id'),
            sb.from('friendships').select('id,requester,addressee,status').or('requester.eq.' + uid + ',addressee.eq.' + uid),
            sb.from('messages').select('id,sender,recipient,body,created_at').or('sender.eq.' + uid + ',recipient.eq.' + uid).order('created_at', { ascending: false }).limit(300),
            sb.from('statuses').select('id,user_id,body,created_at').order('created_at', { ascending: false }).limit(100),
            sb.from('friend_streaks').select('user_low,user_high,current_days,best_days,last_completed_on').or('user_low.eq.' + uid + ',user_high.eq.' + uid)
        ]);
        results.forEach(function (r) { if (r.error) throw r.error; });
        state.members = results[0].data || []; state.rsvps = {};
        (results[1].data || []).forEach(function (r) { (state.rsvps[r.event_key] = state.rsvps[r.event_key] || []).push(r.user_id); });
        state.relations = results[2].data || []; state.messages = (results[3].data || []).reverse();
        state.statuses = results[4].data || []; state.streaks = results[5].data || [];
        render(); setNote('Connected to your church community.');
    }
    function subscribe() {
        if (!sb) return;
        if (!state.user) { if (state.channel) { sb.removeChannel(state.channel); state.channel = null; } return; }
        if (state.channel) sb.removeChannel(state.channel);
        state.channel = sb.channel('ccg-community-' + state.user.id)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, function () { load().catch(statusError); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, function () { load().catch(statusError); })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (event) { if (event.new.sender === state.user.id || event.new.recipient === state.user.id) load().catch(statusError); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, function () { load().catch(statusError); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_streaks' }, function () { load().catch(statusError); })
            .subscribe();
    }
    function init() {
        if (!el('cm-list')) return;
        document.addEventListener('click', async function (event) {
            var button = event.target.closest('[data-rsvp],[data-who],[data-add],[data-accept],[data-unfriend],[data-chat],[data-report],[data-delete-status]');
            if (!button) return;
            try {
                if (button.dataset.rsvp) {
                    if (!state.user) { location.href = 'login.html'; return; }
                    var going = (state.rsvps[button.dataset.rsvp] || []).indexOf(state.user.id) >= 0;
                    var query = sb.from('event_rsvps').delete().eq('event_key', button.dataset.rsvp).eq('user_id', state.user.id);
                    if (!going) query = sb.from('event_rsvps').insert({ event_key: button.dataset.rsvp, user_id: state.user.id });
                    var result = await query; if (result.error) throw result.error; await load();
                } else if (button.dataset.who) {
                    var attendees = (state.rsvps[button.dataset.who] || []).map(function (id) { var p = state.members.find(function (x) { return x.id === id; }); return p && p.display_name; }).filter(Boolean);
                    window.alert(attendees.length ? attendees.join('\n') : 'No RSVPs yet.');
                } else if (button.dataset.add) {
                    var added = await sb.from('friendships').insert({ requester: state.user.id, addressee: button.dataset.add, status: 'pending' }); if (added.error) throw added.error; await load();
                } else if (button.dataset.accept) {
                    var accepted = await sb.from('friendships').update({ status: 'accepted' }).eq('id', button.dataset.accept); if (accepted.error) throw accepted.error; await load();
                } else if (button.dataset.unfriend) {
                    var removed = await sb.from('friendships').delete().eq('id', button.dataset.unfriend); if (removed.error) throw removed.error; await load();
                } else if (button.dataset.chat) { state.active = button.dataset.chat; renderChat(); }
                else if (button.dataset.deleteStatus) {
                    var deleted = await sb.from('statuses').delete().eq('id', button.dataset.deleteStatus).eq('user_id', state.user.id); if (deleted.error) throw deleted.error; await load();
                } else if (button.dataset.report) {
                    var reason = window.prompt('Tell us why you are reporting this member (500 characters max):');
                    if (reason && reason.trim()) { var report = await sb.from('reports').insert({ reporter: state.user.id, reported: button.dataset.report, reason: reason.trim().slice(0, 500) }); if (report.error) throw report.error; setNote('Thank you. Your report has been submitted privately.'); }
                }
            } catch (error) { statusError(error); }
        });
        el('cm-search').addEventListener('input', renderMembers); el('cm-filter').addEventListener('change', renderMembers);
        el('chat-form').addEventListener('submit', async function (event) {
            event.preventDefault(); var input = el('chat-input'), body = input.value.trim();
            if (!body || !state.active || !state.user) return;
            input.value = '';
            try { var result = await sb.from('messages').insert({ sender: state.user.id, recipient: state.active, body: body }).select().single(); if (result.error) throw result.error; state.messages.push(result.data); renderChat(); }
            catch (error) { input.value = body; statusError(error); }
        });
        el('status-form').addEventListener('submit', async function (event) {
            event.preventDefault(); var input = el('status-input'), body = input.value.trim();
            if (!body || !state.user) return;
            var button = el('status-send'); button.disabled = true;
            try { var result = await sb.from('statuses').insert({ user_id: state.user.id, body: body.slice(0, 280) }).select().single(); if (result.error) throw result.error; input.value = ''; state.statuses.unshift(result.data); renderStatuses(); setNote('Your status was posted.'); }
            catch (error) { statusError(error); }
            finally { button.disabled = !state.user; }
        });
        if (sb) sb.auth.onAuthStateChange(function () { load().then(subscribe).catch(statusError); });
        if (window.CCG && window.CCG.onPresenceChange) window.CCG.onPresenceChange(function () { renderMembers(); });
        load().then(subscribe).catch(statusError);
    }
    window.initCommunity = init;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
