/* Live account presence shared across church pages via authenticated Supabase Realtime. */
(function () {
    'use strict';
    var ccg = window.CCG || {};
    var sb = ccg.supabase;
    var channel = null;
    var activeId = null;
    var revision = 0;
    var listeners = [];
    var online = Object.create(null);

    function publish() {
        listeners.slice().forEach(function (listener) {
            try { listener(online); } catch (error) { console.error('Presence listener failed:', error); }
        });
    }
    function readPresence() {
        var next = Object.create(null);
        if (channel && typeof channel.presenceState === 'function') {
            var state = channel.presenceState();
            Object.keys(state || {}).forEach(function (key) {
                (state[key] || []).forEach(function (item) {
                    if (item && item.user_id) next[item.user_id] = item.display_name || 'Church member';
                });
            });
        }
        online = next;
        publish();
    }
    async function connect(user) {
        var myRevision = ++revision;
        if (channel) { var old = channel; channel = null; await sb.removeChannel(old); }
        activeId = user && user.id || null;
        online = Object.create(null);
        publish();
        if (!user || !sb || myRevision !== revision) return;
        var name = user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name || user.user_metadata.name) || user.email || 'Church member';
        try {
            var profile = await ccg.getProfile(user);
            if (profile && profile.display_name) name = profile.display_name;
        } catch (_) { /* Auth metadata still provides a readable fallback name. */ }
        if (myRevision !== revision) return;
        var room = sb.channel('ccg-online-members', { config: { private: true, presence: { key: user.id } } });
        channel = room;
        room.on('presence', { event: 'sync' }, readPresence);
        room.on('presence', { event: 'join' }, readPresence);
        room.on('presence', { event: 'leave' }, readPresence);
        room.subscribe(async function (status) {
            if (status !== 'SUBSCRIBED' || myRevision !== revision || channel !== room) return;
            var result = await room.track({ user_id: user.id, display_name: name, online_at: new Date().toISOString() });
            if (result && result !== 'ok') console.warn('Could not publish online presence:', result);
            readPresence();
        });
    }
    ccg.isOnline = function (userId) { return !!(userId && online[userId]); };
    ccg.onPresenceChange = function (listener) {
        if (typeof listener !== 'function') return function () {};
        listeners.push(listener);
        listener(online);
        return function () { listeners = listeners.filter(function (item) { return item !== listener; }); };
    };
    window.CCG = ccg;
    if (!sb) return;
    sb.auth.getUser().then(function (result) { return connect(result.data && result.data.user); }).catch(function () {});
    sb.auth.onAuthStateChange(function (_event, session) {
        var user = session && session.user;
        if ((user && user.id || null) !== activeId) connect(user).catch(function (error) { console.warn('Presence unavailable:', error); });
    });
    window.addEventListener('beforeunload', function () {
        if (channel) { try { sb.removeChannel(channel); } catch (_) { /* Socket closes with the page. */ } }
    });
})();
