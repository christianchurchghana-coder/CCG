(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  function utcDate(date) { return date.toISOString().slice(0, 10); }
  function yesterday(date) { return utcDate(new Date(Date.parse(utcDate(date) + 'T00:00:00Z') - 86400000)); }
  function localStreak(account) {
    try { return JSON.parse(localStorage.getItem('ccg_bible_streak_' + account) || 'null'); }
    catch (_) { return null; }
  }
  function verseReference() {
    var ref = document.querySelector('.verse-hero .verse-ref');
    return ref ? ref.textContent.replace(/\s*\(KJV\)\s*$/i, '').trim() : '';
  }
  function showReminder(streak, account, today) {
    var reminder = byId('streak-reminder');
    if (!reminder || streak && streak.last_read_on === today) return;
    var dismissKey = 'ccg-verse-reminder-dismissed-' + account + '-' + today;
    try { if (localStorage.getItem(dismissKey) === '1') return; } catch (_) { /* show reminder if storage is unavailable */ }
    var consecutive = streak && streak.last_read_on === yesterday(new Date());
    var count = Number(streak && streak.current_days) || 0;
    byId('streak-reminder-title').textContent = consecutive && count
      ? 'Your ' + count + '-day reading streak is at risk today'
      : 'Your daily verse is ready';
    byId('streak-reminder-copy').textContent = consecutive && count
      ? 'Read today’s verse and open a Bible chapter before the day ends, or your streak will reset.'
      : streak && streak.last_read_on
        ? 'Read today’s verse and open a Bible chapter today to start a new streak.'
        : 'Read today’s verse and open a Bible chapter today. Once you start a streak, missing a day will reset it.';
    var link = byId('streak-reminder-link');
    link.addEventListener('click', function () {
      try { localStorage.setItem(dismissKey, '1'); } catch (_) { /* ignore */ }
      var ref = verseReference();
      link.href = ref ? 'bible.html?ref=' + encodeURIComponent(ref) : 'bible.html';
    });
    byId('streak-reminder-dismiss').addEventListener('click', function () {
      try { localStorage.setItem(dismissKey, '1'); } catch (_) { /* ignore */ }
      reminder.hidden = true;
    });
    reminder.hidden = false;
  }
  async function init() {
    var reminder = byId('streak-reminder');
    if (!reminder) return;
    var now = new Date(), today = utcDate(now), ccg = window.CCG || {}, streak = null, account = 'guest';
    try {
      var auth = ccg.supabase ? await ccg.supabase.auth.getUser() : null;
      var user = auth && auth.data && auth.data.user;
      account = user && user.id || 'guest';
      if (user) {
        var result = await ccg.supabase.from('bible_reading_streaks').select('current_days,best_days,last_read_on').eq('user_id', user.id).maybeSingle();
        if (!result.error) streak = result.data;
        else streak = localStreak(account);
      } else streak = localStreak('guest');
    } catch (_) { streak = localStreak(account); }
    showReminder(streak, account, today);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
