(function () {
    'use strict';

    var ADMIN_EMAIL = 'christianchurchghana@gmail.com';
    var form = document.getElementById('prayer-admin-form');
    var dialog = document.getElementById('prayer-dialog');
    var summary = document.getElementById('prayer-schedule-summary');
    var scheduleClock = document.getElementById('prayer-schedule-clock');
    var clockLabel = document.getElementById('prayer-schedule-clock-label');
    var clockValue = document.getElementById('prayer-schedule-countdown');
    var joinButton = document.getElementById('prayer-join');
    var adminStatus = document.getElementById('prayer-admin-status');
    var adminOccasion = document.getElementById('prayer-admin-occasion');
    var adminOtherWrap = document.getElementById('prayer-admin-other-wrap');
    var adminOther = document.getElementById('prayer-admin-other');
    var adminStart = document.getElementById('prayer-admin-start');
    var adminDuration = document.getElementById('prayer-admin-duration');
    var runningView = document.getElementById('prayer-running-view');
    var finishedView = document.getElementById('prayer-finished-view');
    var runningOccasion = document.getElementById('prayer-running-occasion');
    var countdown = document.getElementById('prayer-countdown');
    var timerStatus = document.getElementById('prayer-status');
    var finishedTitle = document.getElementById('prayer-finished-title');
    var finishedCopy = document.getElementById('prayer-finished-copy');
    var client = window.CCG && window.CCG.supabase;
    var schedule = null;
    var scheduleError = null;
    var adminFormDirty = false;
    var activeOccasion = '';
    var endAt = 0;
    var running = false;
    var wakeLock = null;
    var prayerTickHandle = 0;
    var scheduleTickHandle = 0;
    var refreshHandle = 0;

    if (!summary || !joinButton || !dialog || typeof dialog.showModal !== 'function') return;

    function formatClock(totalSeconds) {
        var seconds = Math.max(0, Math.ceil(totalSeconds));
        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var remainder = seconds % 60;
        return hours > 0
            ? String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0')
            : String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
    }

    function labelFor(value) {
        if (value === 'crossover') return '31st Night Crossover';
        if (value === 'Christmas') return 'Christmas';
        if (value === 'Easter') return 'Easter';
        return value || 'Church event';
    }

    function formatDate(value) {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
    }

    function toLocalInput(value) {
        var date = new Date(value);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function scheduleBounds() {
        if (!schedule) return null;
        var start = new Date(schedule.starts_at).getTime();
        var end = start + Number(schedule.duration_minutes) * 60000;
        return Number.isFinite(start) && Number.isFinite(end) ? { start: start, end: end } : null;
    }

    function updateScheduleDisplay() {
        if (!schedule) {
            scheduleClock.hidden = true;
            joinButton.hidden = true;
            summary.textContent = scheduleError
                ? 'The church prayer schedule is unavailable right now.'
                : 'The church has not scheduled a prayer session yet.';
            return;
        }

        var bounds = scheduleBounds();
        if (!bounds) {
            scheduleClock.hidden = true;
            joinButton.hidden = true;
            summary.textContent = 'The church prayer schedule could not be read.';
            return;
        }

        var now = Date.now();
        var occasion = labelFor(schedule.occasion);
        if (now < bounds.start) {
            summary.textContent = occasion + ' prayer begins ' + formatDate(schedule.starts_at) + '.';
            clockLabel.textContent = 'Starts in';
            clockValue.textContent = formatClock((bounds.start - now) / 1000);
            scheduleClock.hidden = false;
            joinButton.hidden = true;
        } else if (now < bounds.end) {
            summary.textContent = occasion + ' prayer is live now.';
            clockLabel.textContent = 'Prayer time remaining';
            clockValue.textContent = formatClock((bounds.end - now) / 1000);
            scheduleClock.hidden = false;
            joinButton.hidden = false;
        } else {
            summary.textContent = 'The ' + occasion + ' prayer session has ended. Check back for the next church prayer time.';
            scheduleClock.hidden = true;
            joinButton.hidden = true;
        }
    }

    function showSetupError(error) {
        scheduleError = error || new Error('Schedule unavailable');
        updateScheduleDisplay();
        if (!adminStatus || !form || form.hidden) return;
        var code = scheduleError.code || '';
        var message = String(scheduleError.message || '');
        if (code === '42P01' || code === 'PGRST205' || /prayer_schedule.*(not found|does not exist)/i.test(message)) {
            adminStatus.textContent = 'One-time setup needed: run prayer-schedule.sql in the Supabase SQL Editor.';
        } else {
            adminStatus.textContent = 'Could not load the schedule. Check your connection and church admin sign-in.';
        }
    }

    async function loadSchedule() {
        if (!client) {
            schedule = null;
            showSetupError(new Error('Supabase is not configured'));
            return;
        }
        try {
            var result = await client.from('prayer_schedule')
                .select('occasion,starts_at,duration_minutes')
                .eq('id', true)
                .maybeSingle();
            if (result.error) throw result.error;
            scheduleError = null;
            schedule = result.data;
            if (adminStatus && form && !adminFormDirty) adminStatus.textContent = '';
            if (schedule && form && !form.hidden && !adminFormDirty) {
                var knownOccasion = ['Christmas', 'Easter', 'crossover'].indexOf(schedule.occasion) >= 0;
                adminOccasion.value = knownOccasion ? schedule.occasion : 'other';
                adminOtherWrap.hidden = knownOccasion;
                adminOther.required = !knownOccasion;
                adminOther.value = knownOccasion ? '' : schedule.occasion;
                adminStart.value = toLocalInput(schedule.starts_at);
                adminDuration.value = String(schedule.duration_minutes);
            }
            updateScheduleDisplay();
        } catch (error) {
            showSetupError(error);
        }
    }

    async function showAdminControls() {
        if (!client || !form) return;
        try {
            var result = await client.auth.getUser();
            var user = result.data && result.data.user;
            if (user && String(user.email || '').toLowerCase() === ADMIN_EMAIL) {
                form.hidden = false;
                await loadSchedule();
            }
        } catch (_) {
            /* Visitors can still read the public schedule if auth is unavailable. */
        }
    }

    function releaseWakeLock() {
        if (!wakeLock) return;
        var lock = wakeLock;
        wakeLock = null;
        try { lock.release(); } catch (_) { /* Already released or unsupported. */ }
    }

    function requestWakeLock() {
        if (!running || document.visibilityState !== 'visible' || !navigator.wakeLock || !navigator.wakeLock.request) return;
        navigator.wakeLock.request('screen').then(function (lock) {
            if (!running) { lock.release(); return; }
            wakeLock = lock;
            lock.addEventListener('release', function () { if (wakeLock === lock) wakeLock = null; });
        }).catch(function () {
            timerStatus.textContent = 'Timer running. Keep your screen awake if you would like.';
        });
    }

    function stopTimer() {
        running = false;
        window.clearInterval(prayerTickHandle);
        prayerTickHandle = 0;
        releaseWakeLock();
    }

    function closeDialog() {
        stopTimer();
        if (dialog.open) dialog.close();
    }

    function completePrayer() {
        stopTimer();
        countdown.textContent = '00:00';
        runningView.hidden = true;
        finishedView.hidden = false;
        if (activeOccasion === 'crossover') {
            finishedTitle.textContent = 'Happy New Year!';
            finishedCopy.textContent = 'May God bless you and your family in the year ahead.';
        } else if (activeOccasion === 'Christmas') {
            finishedTitle.textContent = 'Merry Christmas!';
            finishedCopy.textContent = 'May the hope and peace of Christ be with you.';
        } else if (activeOccasion === 'Easter') {
            finishedTitle.textContent = 'Happy Easter!';
            finishedCopy.textContent = 'Celebrate the hope and joy of the risen Christ.';
        } else {
            finishedTitle.textContent = 'Prayer time complete';
            finishedCopy.textContent = 'Thank you for praying for ' + activeOccasion + '. God bless you.';
        }
        document.getElementById('prayer-finish-close').focus();
        updateScheduleDisplay();
    }

    function updatePrayerCountdown() {
        var secondsLeft = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        countdown.textContent = formatClock(secondsLeft);
        if (secondsLeft === 0) completePrayer();
    }

    function joinPrayer() {
        var bounds = scheduleBounds();
        if (!bounds || Date.now() < bounds.start || Date.now() >= bounds.end) {
            updateScheduleDisplay();
            return;
        }
        activeOccasion = schedule.occasion;
        runningOccasion.textContent = labelFor(activeOccasion);
        timerStatus.textContent = 'Pray together until the church prayer time ends.';
        runningView.hidden = false;
        finishedView.hidden = true;
        endAt = bounds.end;
        running = true;
        dialog.showModal();
        updatePrayerCountdown();
        prayerTickHandle = window.setInterval(updatePrayerCountdown, 500);
        requestWakeLock();
        document.getElementById('prayer-end').focus();
    }

    if (adminOccasion) {
        adminOccasion.addEventListener('change', function () {
            adminFormDirty = true;
            var isOther = adminOccasion.value === 'other';
            adminOtherWrap.hidden = !isOther;
            adminOther.required = isOther;
        });
    }

    if (form) {
        form.addEventListener('input', function () { adminFormDirty = true; });
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            if (!client) { adminStatus.textContent = 'The church schedule service is unavailable.'; return; }
            var occasion = adminOccasion.value === 'other' ? adminOther.value.trim() : adminOccasion.value;
            var startsAt = new Date(adminStart.value);
            var duration = Number(adminDuration.value);
            if (!occasion || !adminStart.value || !Number.isFinite(startsAt.getTime()) || !Number.isInteger(duration) || duration < 1 || duration > 1440) {
                adminStatus.textContent = 'Enter an event name, start time, and prayer length of 1 to 1,440 minutes.';
                return;
            }
            adminStatus.textContent = 'Publishing the shared prayer time…';
            try {
                var result = await client.from('prayer_schedule').upsert({
                    id: true,
                    occasion: occasion,
                    starts_at: startsAt.toISOString(),
                    duration_minutes: duration,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });
                if (result.error) throw result.error;
                adminFormDirty = false;
                await loadSchedule();
                adminStatus.textContent = 'Prayer time published for everyone.';
            } catch (error) {
                var message = String(error.message || '');
                var code = error.code || '';
                if (code === '42P01' || code === 'PGRST205' || /prayer_schedule.*(not found|does not exist)/i.test(message)) {
                    adminStatus.textContent = 'One-time setup needed: run prayer-schedule.sql in the Supabase SQL Editor, then publish again.';
                } else if (code === '42501' || /row-level security|permission denied/i.test(message)) {
                    adminStatus.textContent = 'Sign in with ' + ADMIN_EMAIL + ' to publish the church prayer time.';
                } else {
                    adminStatus.textContent = 'Could not publish. Check your internet connection and try again.';
                }
            }
        });
    }

    joinButton.addEventListener('click', joinPrayer);
    document.getElementById('prayer-end').addEventListener('click', closeDialog);
    document.getElementById('prayer-close').addEventListener('click', closeDialog);
    document.getElementById('prayer-finish-close').addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', function () { stopTimer(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(); });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            if (running) { requestWakeLock(); updatePrayerCountdown(); }
            loadSchedule();
        }
    });

    loadSchedule();
    showAdminControls();
    updateScheduleDisplay();
    scheduleTickHandle = window.setInterval(updateScheduleDisplay, 500);
    refreshHandle = window.setInterval(loadSchedule, 30000);
    window.addEventListener('beforeunload', function () {
        window.clearInterval(prayerTickHandle);
        window.clearInterval(scheduleTickHandle);
        window.clearInterval(refreshHandle);
        releaseWakeLock();
    });
})();
