(function () {
  'use strict';
  var el = function (id) { return document.getElementById(id); };
  var sb = window.CCG && window.CCG.supabase;
  var today = new Date();
  var currentYear = today.getFullYear();
  var lastSecond = -1;
  var soundOn = false;
  var audioContext = null;
  var newYearMode = 'hidden';
  var newYearReturned = false;

  function easterSunday(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    return new Date(year, month - 1, (h + l - 7 * m + 114) % 31 + 1);
  }
  function nextEaster(now) {
    var candidate = easterSunday(now.getFullYear());
    candidate.setHours(0, 0, 0, 0);
    return candidate.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      ? candidate : easterSunday(now.getFullYear() + 1);
  }
  function pad(value) { return String(value).padStart(2, '0'); }
  function updateCountdown(kind, now) {
    var target = kind === 'new-year'
      ? new Date(now.getFullYear() + 1, 0, 1)
      : nextEaster(now);
    var card = el(kind + '-card');
    var active = kind === 'new-year'
      ? now.getMonth() === 0 && now.getDate() === 1
      : now.getFullYear() === target.getFullYear() && now.getMonth() === target.getMonth() && now.getDate() === target.getDate();
    if (active) {
      var nextTarget = kind === 'new-year' ? new Date(now.getFullYear() + 1, 0, 1) : easterSunday(now.getFullYear() + 1);
      target = nextTarget;
      card.classList.add('is-today');
      el(kind + '-title').textContent = kind === 'new-year' ? 'Happy New Year!' : 'Happy Easter! He is risen!';
      el(kind + '-message').textContent = kind === 'new-year'
        ? 'May God bless you and your family in the year ahead.'
        : 'Rejoice in the resurrection and the hope of new life in Christ.';
      celebrateOnce(kind, now);
    } else {
      card.classList.remove('is-today');
      el(kind + '-title').textContent = kind === 'new-year' ? 'A new year is on the way' : 'Celebrate the hope of Easter';
    }
    var seconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
    var values = { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
    Object.keys(values).forEach(function (unit) { var node = card.querySelector('[data-unit="' + unit + '"]'); if (node) node.textContent = unit === 'days' ? String(values[unit]) : pad(values[unit]); });
    if (kind === 'new-year') { updateNewYearScreen(now, seconds); soundTick(seconds); }
  }
  function updateNewYearScreen(now, seconds) {
    var screen = el('new-year-takeover');
    if (!screen) return;
    var eve = now.getMonth() === 11 && now.getDate() === 31;
    var day = now.getMonth() === 0 && now.getDate() === 1;
    if (eve) {
      if (newYearMode !== 'countdown') {
        newYearMode = 'countdown'; newYearReturned = false;
        screen.hidden = false; document.body.classList.add('new-year-countdown-open');
        el('new-year-eyebrow').textContent = 'Christian Church of Ghana · New Year’s Eve · your local time';
        el('new-year-screen-title').textContent = 'We’re counting down together';
        el('new-year-screen-subtitle').textContent = 'A new year of hope, faith, and fresh beginnings is almost here.';
        el('new-year-enter').hidden = true;
      }
      var clockValues = { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
      Object.keys(clockValues).forEach(function (unit) { var node = screen.querySelector('[data-new-year-unit="' + unit + '"]'); if (node) node.textContent = unit === 'days' ? String(clockValues[unit]) : pad(clockValues[unit]); });
      return;
    }
    if (day) {
      var key = 'ccg-celebrated-new-year-' + now.getFullYear();
      var seen = false;
      try { seen = localStorage.getItem(key) === '1'; } catch (_) { /* no local storage */ }
      if (newYearMode === 'countdown' || (!seen && newYearMode !== 'greeting')) {
        var firstGreeting = newYearMode !== 'greeting';
        newYearMode = 'greeting';
        screen.hidden = false; document.body.classList.add('new-year-countdown-open');
        el('new-year-eyebrow').textContent = 'Christian Church of Ghana · January 1';
        el('new-year-screen-title').textContent = 'Happy New Year!';
        el('new-year-screen-subtitle').textContent = 'May God bless you and your family with peace, joy, and renewed hope.';
        el('new-year-big-clock').hidden = true;
        el('new-year-sound').hidden = true;
        el('new-year-enter').hidden = false;
        if (firstGreeting) { try { localStorage.setItem(key, '1'); } catch (_) { /* no local storage */ } makeConfetti(); }
      }
      return;
    }
    if (!screen.hidden && !newYearReturned) { screen.hidden = true; document.body.classList.remove('new-year-countdown-open'); }
    newYearMode = 'hidden';
  }
  function soundTick(seconds) {
    if (!soundOn || seconds > 10 || seconds < 1 || seconds === lastSecond) return;
    lastSecond = seconds;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = 'sine'; osc.frequency.value = seconds === 1 ? 880 : 540;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, audioContext.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .22);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .23);
    } catch (_) { /* audio is optional */ }
  }
  function celebrateOnce(kind, now) {
    if (kind === 'new-year') return;
    var key = 'ccg-celebrated-' + kind + '-' + now.getFullYear();
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (_) { /* session still gets the greeting */ }
    var old = el('celebration-toast'); if (old) old.remove();
    var overlay = document.createElement('div'); overlay.id = 'celebration-toast'; overlay.className = 'new-year-toast'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    var isNewYear = kind === 'new-year';
    overlay.innerHTML = '<p class="celebration-kicker">Christian Church of Ghana</p><h2>' + (isNewYear ? 'Happy New Year!' : 'Happy Easter!') + '</h2><p>' + (isNewYear ? 'May the Lord bless your year with peace, joy, and renewed hope.' : 'Christ is risen. May the hope of Easter fill your heart and home.') + '</p><button type="button" id="celebration-dismiss">Continue</button>';
    document.body.appendChild(overlay);
    el('celebration-dismiss').addEventListener('click', function () { overlay.remove(); });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) makeConfetti();
  }
  function makeConfetti() {
    var layer = document.createElement('div'); layer.className = 'new-year-burst'; layer.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 75; i++) { var bit = document.createElement('i'); bit.style.setProperty('--x', Math.random() * 100 + '%'); bit.style.setProperty('--y', -10 - Math.random() * 80 + '%'); bit.style.setProperty('--h', Math.floor(Math.random() * 360)); bit.style.setProperty('--d', 2.7 + Math.random() * 2.8 + 's'); bit.style.setProperty('--delay', Math.random() * .8 + 's'); layer.appendChild(bit); }
    document.body.appendChild(layer); window.setTimeout(function () { layer.remove(); }, 7000);
  }
  function setStatus(text, isError) { var node = el('birthday-status'); if (node) { node.textContent = text; node.style.color = isError ? '#a23c36' : ''; } }
  function dateParts(iso) { var parts = String(iso || '').split('-'); return { year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) }; }
  function announceBirthday(name, month, day) {
    var now = new Date();
    var todayKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    if (month !== now.getMonth() + 1 || day !== now.getDate()) return;
    var list = el('birthday-list');
    var item = document.createElement('li'); item.textContent = '🎂 Happy birthday, ' + name + '! Let’s celebrate ' + name + ' today.'; list.appendChild(item);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var seenKey = 'ccg-birthday-notified-' + todayKey + '-' + name;
    try { if (localStorage.getItem(seenKey)) return; localStorage.setItem(seenKey, '1'); } catch (_) { /* show at most on this visit */ }
    var options = { body: 'Wish ' + name + ' a joyful birthday today!', icon: 'images/ccg-icon-192.png', tag: 'ccg-birthday-' + todayKey + '-' + name };
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(function (registration) { registration.showNotification('A church family birthday today 🎉', options); }).catch(function () { new Notification('A church family birthday today 🎉', options); });
    else new Notification('A church family birthday today 🎉', options);
  }
  async function initBirthdays() {
    var form = el('birthday-form'), list = el('birthday-list');
    if (!form || !sb) return;
    try {
      var auth = await sb.auth.getUser(), user = auth.data && auth.data.user;
      if (!user) return;
      form.hidden = false; list.innerHTML = '<li class="birthday-empty">Loading birthday celebrations…</li>';
      var result = await sb.from('birthday_celebrations').select('user_id,display_name,birth_month,birth_day').order('birth_month').order('birth_day');
      if (result.error) throw result.error;
      var birthdays = result.data || [];
      list.innerHTML = '';
      var mine = birthdays.find(function (row) { return row.user_id === user.id; });
      var remove = el('birthday-remove'); remove.hidden = !mine;
      if (mine) {
        el('birthday-date').value = currentYear + '-' + pad(mine.birth_month) + '-' + pad(mine.birth_day);
        el('birthday-consent').checked = true;
      }
      var todayRows = birthdays.filter(function (row) { return row.birth_month === new Date().getMonth() + 1 && row.birth_day === new Date().getDate(); });
      if (!todayRows.length) { var empty = document.createElement('li'); empty.className = 'birthday-empty'; empty.textContent = 'No birthdays today. Add yours to let the church family celebrate you.'; list.appendChild(empty); }
      todayRows.forEach(function (row) { announceBirthday(row.display_name, row.birth_month, row.birth_day); });
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        var date = dateParts(el('birthday-date').value), name = user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name || user.user_metadata.name) || user.email && user.email.split('@')[0] || 'Church member';
        if (!el('birthday-consent').checked || date.month < 1 || date.month > 12 || date.day < 1 || date.day > 31) { setStatus('Choose a valid date and agree to share it with signed-in members.', true); return; }
        var save = await sb.from('birthday_celebrations').upsert({ user_id: user.id, display_name: name.slice(0, 40), birth_month: date.month, birth_day: date.day }, { onConflict: 'user_id' });
        if (save.error) { setStatus('Could not save your birthday. ' + save.error.message, true); return; }
        setStatus('Birthday saved. Signed-in members can now celebrate with you.'); location.reload();
      });
      remove.addEventListener('click', async function () {
        if (!window.confirm('Remove your birthday from the church celebration list?')) return;
        var deleted = await sb.from('birthday_celebrations').delete().eq('user_id', user.id);
        if (deleted.error) { setStatus('Could not remove your birthday. ' + deleted.error.message, true); return; }
        setStatus('Your birthday has been removed.'); location.reload();
      });
      el('birthday-reminders').addEventListener('click', async function () {
        if (!('Notification' in window)) { setStatus('This browser does not support notifications. Open the site in Safari or Chrome.', true); return; }
        var permission = await Notification.requestPermission();
        setStatus(permission === 'granted' ? 'Reminders enabled on this device. You will be notified when you open the site on a birthday.' : 'Notifications were not enabled. You can change this in your browser settings.', permission !== 'granted');
      });
    } catch (error) {
      list.innerHTML = '<li class="birthday-empty">Birthday sharing needs the database update installed by the site administrator. Your date has not been saved.</li>';
      setStatus(error && error.message || 'Could not load birthday celebrations.', true);
    }
  }
  var now = new Date(); updateCountdown('new-year', now); updateCountdown('easter', now);
  window.setInterval(function () { var current = new Date(); updateCountdown('new-year', current); updateCountdown('easter', current); }, 1000);
  var soundButton = el('new-year-sound');
  if (soundButton) soundButton.addEventListener('click', function () { soundOn = !soundOn; soundButton.textContent = soundOn ? '♪ Countdown sound is on · turn off' : '♪ Turn the final countdown sound on'; soundButton.setAttribute('aria-pressed', String(soundOn)); if (soundOn && (window.AudioContext || window.webkitAudioContext)) { audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); } });
  var enterButton = el('new-year-enter');
  if (enterButton) enterButton.addEventListener('click', function () { newYearReturned = true; el('new-year-takeover').hidden = true; document.body.classList.remove('new-year-countdown-open'); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBirthdays); else initBirthdays();
})();
