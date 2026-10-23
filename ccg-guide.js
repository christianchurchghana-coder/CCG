(function () {
  'use strict';
  var hour = new Date().getHours();
  var activities = [
    { title: 'Read a chapter', description: 'Open the Bible, choose a book and chapter, and keep a private reading streak.', href: 'bible.html', keywords: ['bible', 'scripture', 'read', 'verse', 'reading', 'chapter'] },
    { title: 'Take a quiet prayer moment', description: 'Visit Live Prayer for devotion, prayer, or fasting sessions.', href: 'prayer.html', keywords: ['pray', 'prayer', 'quiet', 'worship', 'fasting', 'devotion', 'lock-in'] },
    { title: 'Watch a sermon', description: 'Explore sermons and teaching from the church.', href: 'index.html#sermons', keywords: ['sermon', 'watch', 'teaching', 'message'] },
    { title: 'Connect with the community', description: 'Find member updates, friends, and chat. Community features require sign-in.', href: 'social.html', keywords: ['community', 'friend', 'connect', 'people', 'social', 'chat', 'message'] },
    { title: 'See what is happening', description: 'Browse church events, RSVP, and see celebrations.', href: 'index.html#events', keywords: ['event', 'events', 'celebration', 'happening', 'rsvp', 'birthday', 'easter', 'new year'] },
    { title: 'Explore CCG', description: 'Discover the church, its mission, and the app features.', href: 'others.html', keywords: ['explore', 'church', 'about', 'feature', 'app'] },
    { title: 'Watch the CCG app introduction', description: 'Play a short video showing what you can do in CCG.', href: 'ccg-explainer.html', keywords: ['intro', 'introduction', 'how to use', 'explain', 'explainer', 'video'] },
    { title: 'See your profile', description: 'Sign in to manage your profile and account settings.', href: 'index.html#profile', keywords: ['profile', 'account', 'sign in', 'login', 'badge', 'password', 'age', 'youth', 'adult'] },
    { title: 'Learn how to support the church', description: 'See the current giving information and contact the church office.', href: 'give.html', keywords: ['give', 'giving', 'donate', 'offering'] }
  ];
  function currentActivity() {
    if (hour >= 5 && hour < 12) return activities[0];
    if (hour >= 12 && hour < 17) return activities[2];
    if (hour >= 17 && hour < 21) return activities[1];
    return activities[3];
  }
  var logo = 'images/ccg-icon-192.png';
  var person = '<span class="ccg-guide-person" aria-hidden="true"><span class="ccg-guide-head"><img src="' + logo + '" alt=""></span><span class="ccg-guide-neck"></span><span class="ccg-guide-suit"><i></i><b></b></span></span>';
  var root = document.createElement('div');
  root.className = 'ccg-guide';
  root.innerHTML = '<button type="button" class="ccg-guide-trigger" aria-expanded="false" aria-controls="ccg-guide-panel">' + person + '<span>CCG Guide</span></button><section class="ccg-guide-panel" id="ccg-guide-panel" role="dialog" aria-modal="false" aria-labelledby="ccg-guide-title" hidden><header><div class="ccg-guide-heading">' + person + '<div><p>YOUR CHURCH COMPANION</p><h2 id="ccg-guide-title">What would you like to do?</h2></div></div><button type="button" class="ccg-guide-close" aria-label="Close CCG Guide">×</button></header><div class="ccg-guide-body"><p class="ccg-guide-intro">Need an idea? I can help you find something uplifting in CCG.</p><div class="ccg-guide-recommendation" aria-live="polite"></div><form class="ccg-guide-form"><label class="visually-hidden" for="ccg-guide-question">Ask about CCG</label><input id="ccg-guide-question" type="text" maxlength="160" placeholder="Ask about Bible, prayer, events…" autocomplete="off"><button type="submit">Ask</button></form><p class="ccg-guide-footnote">I use CCG’s feature guide to point you around the app.</p></div></section>';
  document.body.appendChild(root);
  var panel = root.querySelector('.ccg-guide-panel');
  var trigger = root.querySelector('.ccg-guide-trigger');
  var recommendation = root.querySelector('.ccg-guide-recommendation');
  function showActivity(activity, lead) {
    recommendation.innerHTML = '<p>' + lead + '</p><article><strong>' + activity.title + '</strong><span>' + activity.description + '</span><a href="' + activity.href + '">Go to this feature <span aria-hidden="true">→</span></a></article><button type="button" class="ccg-guide-surprise">Suggest something else</button>';
    recommendation.querySelector('.ccg-guide-surprise').addEventListener('click', function () {
      var options = activities.filter(function (item) { return item.title !== activity.title; });
      showActivity(options[Math.floor(Math.random() * options.length)], 'Here’s another idea:');
    });
  }
  function openGuide() {
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (!recommendation.childElementCount) showActivity(currentActivity(), 'A good place to start right now:');
    root.querySelector('#ccg-guide-question').focus();
  }
  function closeGuide() { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }
  trigger.addEventListener('click', function () { if (panel.hidden) openGuide(); else closeGuide(); });
  root.querySelector('.ccg-guide-close').addEventListener('click', closeGuide);
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !panel.hidden) closeGuide(); });
  root.querySelector('.ccg-guide-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var input = root.querySelector('#ccg-guide-question');
    var question = input.value.trim().toLowerCase();
    if (!question) return;
    recommendation.innerHTML = '<div class="ccg-guide-thinking" role="status"><span class="ccg-thinking-dots"><i></i><i></i><i></i></span><span>Thinking of a helpful next step…</span></div>';
    root.classList.add('is-thinking');
    window.setTimeout(function () {
      var wantsIdea = /bored|board|surprise|idea|something to do|what should i do/.test(question);
      if (wantsIdea) {
        var suggestion = /surprise/.test(question) ? activities[Math.floor(Math.random() * activities.length)] : currentActivity();
        showActivity(suggestion, 'Here’s a good next step for your local time:');
      } else {
        var match = activities.find(function (item) { return item.keywords.some(function (keyword) { return question.includes(keyword); }); });
        showActivity(match || currentActivity(), match ? 'Here’s a helpful place to go:' : 'I can guide you to Bible reading, prayer, sermons, events, community, and church information. Here’s one place to start:');
      }
      root.classList.remove('is-thinking');
      input.value = '';
    }, 850);
  });

  // A first-run welcome wizard that remembers guest choices locally and member choices in account metadata.
  var welcomeKey = 'ccg-welcome-v1';
  function readWelcome() { try { return JSON.parse(localStorage.getItem(welcomeKey) || 'null'); } catch (_) { return null; } }
  function saveGuestWelcome(data) { try { localStorage.setItem(welcomeKey, JSON.stringify(data)); } catch (_) {} }
  function startWelcome() {
    if (document.querySelector('.ccg-welcome-dialog')) return;
    var dialog = document.createElement('dialog');
    dialog.className = 'ccg-welcome-dialog';
    dialog.setAttribute('aria-labelledby', 'ccg-welcome-title');
    dialog.innerHTML = '<div class="ccg-welcome-mark"><img src="' + logo + '" alt="Christian Church of Ghana logo"></div><p class="auth-eyebrow">WELCOME TO CCG</p><h2 id="ccg-welcome-title">A place to grow in faith</h2><p class="ccg-welcome-copy">Find Scripture, prayer, sermons, church events, and a community that helps you stay connected.</p><div class="ccg-welcome-progress" aria-hidden="true"><span></span><span></span></div><div class="ccg-welcome-steps"></div><p class="ccg-welcome-error" role="alert"></p>';
    document.body.appendChild(dialog);
    var steps = dialog.querySelector('.ccg-welcome-steps');
    var error = dialog.querySelector('.ccg-welcome-error');
    var progress = dialog.querySelectorAll('.ccg-welcome-progress span');
    var state = { church_status: '', age_group: initialAgeGroup, youth_interest: null };
    function draw(kind) {
      error.textContent = '';
      progress.forEach(function (el, index) { el.classList.toggle('active', index <= (kind === 'status' ? 0 : 1)); });
      if (kind === 'age' && state.age_group) {
        if (state.church_status === 'member' && state.age_group === 'youth') draw('interest');
        else finish();
        return;
      }
      if (kind === 'status') {
        steps.innerHTML = '<h3>Are you new to the church or already a member?</h3><div class="ccg-welcome-choices"><button type="button" data-status="new">I’m new here</button><button type="button" data-status="member">I’m already a member</button></div>';
        steps.querySelectorAll('[data-status]').forEach(function (button) { button.addEventListener('click', function () { state.church_status = button.dataset.status; draw('age'); }); });
      } else {
        steps.innerHTML = '<h3>Which age group are you in?</h3><p class="ccg-welcome-copy">Youth fellowship is for ages 13 to 26. You can skip this if you prefer.</p><div class="ccg-welcome-choices ccg-welcome-age"><button type="button" data-age="youth">13–26 · Youth</button><button type="button" data-age="adult">27+ · Adult</button><button type="button" data-age="under13">Under 13</button><button type="button" data-age="unspecified">Skip for now</button></div><button type="button" class="ccg-welcome-back">Back</button>';
        steps.querySelectorAll('[data-age]').forEach(function (button) { button.addEventListener('click', function () { state.age_group = button.dataset.age === 'unspecified' ? '' : button.dataset.age; if (state.church_status === 'member' && state.age_group === 'youth') draw('interest'); else finish(); }); });
        steps.querySelector('.ccg-welcome-back').addEventListener('click', function () { draw('status'); });
      }
      if (kind === 'interest') {
        steps.innerHTML = '<h3>Would you like to join the church youth?</h3><p class="ccg-welcome-copy">Youth fellowship is for church members aged 13 to 26.</p><div class="ccg-welcome-choices"><button type="button" data-interest="yes">Yes, I’m interested</button><button type="button" data-interest="no">Not right now</button></div><button type="button" class="ccg-welcome-back">Back</button>';
        steps.querySelectorAll('[data-interest]').forEach(function (button) { button.addEventListener('click', function () { state.youth_interest = button.dataset.interest === 'yes'; finish(); }); });
        steps.querySelector('.ccg-welcome-back').addEventListener('click', function () { state.age_group = ''; draw('age'); });
      }
    }
    async function finish() {
      var user = window.CCG && window.CCG.currentUser;
      try {
        var client = window.CCG && window.CCG.supabase;
        if (client) {
          var session = await client.auth.getSession();
          user = session.data && session.data.session && session.data.session.user || user;
          if (user) {
            var meta = { welcome_completed: true, church_status: state.church_status, youth_interest: state.youth_interest };
            if (state.age_group) meta.age_group = state.age_group;
            var result = await client.auth.updateUser({ data: meta });
            if (result.error) throw result.error;
          } else saveGuestWelcome({ completed: true, church_status: state.church_status, age_group: state.age_group, youth_interest: state.youth_interest });
        } else saveGuestWelcome({ completed: true, church_status: state.church_status, age_group: state.age_group, youth_interest: state.youth_interest });
        dialog.close(); dialog.remove();
        if (state.youth_interest) {
          window.setTimeout(function () { var note = document.createElement('div'); note.className = 'ccg-youth-welcome-note'; note.innerHTML = '<strong>Youth fellowship</strong><span>Thanks for your interest. Ask the church team how to take the next step.</span><button type="button" aria-label="Close">×</button>'; note.querySelector('button').addEventListener('click', function () { note.remove(); }); document.body.appendChild(note); }, 300);
        }
      } catch (e) { error.textContent = 'Could not save your choices. Please check your connection and try again.'; }
    }
    draw('status');
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); });
    dialog.showModal();
  }
  async function maybeWelcome() {
    if (new URLSearchParams(location.search).get('ccg-launch-preview') === '1') return;
    if (new URLSearchParams(location.search).get('ccg-welcome-preview') === '1') { startWelcome(); return; }
    if (readWelcome() && readWelcome().completed) return;
    var client = window.CCG && window.CCG.supabase;
    if (!client) { startWelcome(); return; }
    try {
      var result = await client.auth.getSession();
      var user = result.data && result.data.session && result.data.session.user;
      if (user && user.user_metadata && user.user_metadata.welcome_completed) return;
      if (user && window.CCG.ensureAgeGroup) {
        user = await window.CCG.ensureAgeGroup(user);
        stateSetAge(user);
      }
      startWelcome();
    } catch (_) { startWelcome(); }
  }
  function stateSetAge(user) { if (user && user.user_metadata && user.user_metadata.age_group) initialAgeGroup = user.user_metadata.age_group; }
  var initialAgeGroup = '';
  // Let authenticated registrations reuse the age choice already collected during sign-up.
  if (window.initializeAuthAndNav && !document.querySelector('script[src$="users.js"]')) window.initializeAuthAndNav();
  var isInstalledLaunch = new URLSearchParams(location.search).get('source') === 'app' || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  window.setTimeout(maybeWelcome, isInstalledLaunch ? 4100 : 450);
})();
