(function () {
  'use strict';
  var appBase = new URL('.', location.href);
  var launchQuery = new URLSearchParams(location.search);
  var launchPreview = launchQuery.get('ccg-launch-preview') === '1';
  var appLaunch = launchQuery.get('source') === 'app' || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var launchSeenAt = Number(sessionStorage.getItem('ccg-launch-seen-at') || 0);
  function paintLaunchFrame(canvas, phase, time) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, p = Math.max(0, Math.min(1, time / 3.35));
    var palettes = {
      morning: ['#23456f','#e69b72','#f8db9c','#537868','#25483f'],
      daylight: ['#3981b2','#b9dbe1','#fff0bd','#6b9c72','#315c4b'],
      afternoon: ['#356d9b','#e4ad78','#ffd390','#8c855d','#485441'],
      evening: ['#332c69','#d27876','#ffbb7c','#625372','#293c4e'],
      night: ['#111a3a','#344870','#d7d9e7','#344f62','#192d3b']
    };
    var c = palettes[phase] || palettes.daylight;
    ctx.clearRect(0, 0, w, h);
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, c[0]); sky.addColorStop(.57, c[1]); sky.addColorStop(1, c[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    var cx = w * .5, cy = h * (.3 - .07 * p), radius = 31 + p * 11;
    var glow = ctx.createRadialGradient(cx, cy, 3, cx, cy, radius * 3.1);
    glow.addColorStop(0, phase === 'night' ? '#eff4ffcc' : '#fff1c8dd'); glow.addColorStop(1, '#ffe5a000');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius * 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = phase === 'night' ? '#eef0e0' : '#fff2c6'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    for (var i = 0; i < 5; i++) {
      var drift = (time * (5 + i * 2) + i * 197) % (w + 240) - 120;
      var y = 66 + i * 36;
      ctx.globalAlpha = phase === 'night' ? .12 : .14 + i % 2 * .06;
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.ellipse(drift, y, 58, 10, 0, 0, Math.PI * 2); ctx.ellipse(drift - 20, y - 6, 24, 14, 0, 0, Math.PI * 2); ctx.ellipse(drift + 13, y - 9, 29, 18, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    function hill(base, amp, color, phaseOffset, shift) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
      for (var x = 0; x <= w; x += 12) {
        var xx = x + shift;
        var yy = base + Math.sin((xx / w * 2.3) + phaseOffset) * amp + Math.sin((xx / w * 5.2) - phaseOffset) * amp * .28;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    }
    hill(h * .62, 25, c[3], .4, -time * 4);
    hill(h * .69, 31, c[4], 1.8, time * 10);
    // A central church built from shaded planes gives the camera a strong 3D focal point.
    var zoom = .88 + p * .22, churchY = h * (.49 + .025 * p);
    ctx.save(); ctx.translate(cx, churchY); ctx.scale(zoom, zoom);
    var wall = ctx.createLinearGradient(-78, 0, 112, 50); wall.addColorStop(0, '#f6e9cf'); wall.addColorStop(1, '#c4ad8d');
    ctx.fillStyle = '#a88e71'; ctx.beginPath(); ctx.moveTo(78, -39); ctx.lineTo(119, -20); ctx.lineTo(119, 74); ctx.lineTo(78, 88); ctx.closePath(); ctx.fill();
    ctx.fillStyle = wall; ctx.fillRect(-78, -39, 156, 127);
    ctx.fillStyle = '#986f55'; ctx.beginPath(); ctx.moveTo(-93, -38); ctx.lineTo(0, -105); ctx.lineTo(94, -38); ctx.lineTo(78, -28); ctx.lineTo(0, -83); ctx.lineTo(-78, -28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d1b996'; ctx.beginPath(); ctx.moveTo(0, -105); ctx.lineTo(94, -38); ctx.lineTo(119, -20); ctx.lineTo(25, -89); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8f1df'; ctx.fillRect(-13, -82, 26, 43);
    ctx.fillStyle = '#734b39'; ctx.fillRect(-13, 25, 27, 63);
    ctx.fillStyle = '#e5c886'; ctx.fillRect(-9, 31, 9, 51); ctx.fillRect(5, 31, 7, 51);
    ctx.fillStyle = '#40627a'; ctx.fillRect(-65, -9, 25, 33); ctx.fillRect(39, -9, 25, 33);
    ctx.fillStyle = '#d8c9ad'; ctx.fillRect(-67, -12, 3, 39); ctx.fillRect(-42, -12, 3, 39); ctx.fillRect(37, -12, 3, 39); ctx.fillRect(62, -12, 3, 39);
    ctx.strokeStyle = '#f9f1df'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -112); ctx.lineTo(0, -149); ctx.moveTo(-12, -137); ctx.lineTo(12, -137); ctx.stroke();
    ctx.restore();
    // A perspective path rushes gently toward the church as the launch camera moves in.
    var pathGlow = ctx.createLinearGradient(0, h * .58, 0, h); pathGlow.addColorStop(0, '#e9cf9a99'); pathGlow.addColorStop(1, '#d5bd8a00');
    ctx.fillStyle = pathGlow; ctx.beginPath(); ctx.moveTo(cx - 10, h * .58); ctx.lineTo(cx + 10, h * .58); ctx.lineTo(cx + w * (.36 + p * .03), h); ctx.lineTo(cx - w * (.36 + p * .03), h); ctx.closePath(); ctx.fill();
    // Close foreground leaves slide past the camera for clear depth and motion.
    for (var j = 0; j < 18; j++) {
      var side = j % 2 ? 1 : -1, gx = side < 0 ? (j * 29) % 250 : w - (j * 31) % 250;
      var gy = h - 4 - ((j * 37 + time * (24 + j % 5 * 8)) % 150);
      ctx.globalAlpha = .3 + (gy / h) * .45; ctx.fillStyle = j % 3 ? '#294b3d' : '#50724d';
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(side * (.22 + j % 4 * .12)); ctx.beginPath(); ctx.ellipse(0, 0, 7 + gy / 55, 21 + gy / 32, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    var shade = ctx.createLinearGradient(0, 0, 0, h); shade.addColorStop(0, '#07142b1a'); shade.addColorStop(1, '#07142b70'); ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  }
  function startLaunchFilm(splash, phase) {
    var canvas = splash.querySelector('.ccg-launch-film-canvas'), video = splash.querySelector('.ccg-launch-film-video');
    if (!canvas || !video || !canvas.getContext) return;
    canvas.width = 960; canvas.height = 540;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var startAt = performance.now(), raf = 0, recorder = null, chunks = [], storeName = 'ccg-launch-film-v1';
    function draw(now) { var elapsed = Math.min(3.35, Math.max(0, (now - startAt) / 1000)); paintLaunchFrame(canvas, phase, reduceMotion ? 2.1 : elapsed); if (!reduceMotion && elapsed < 3.35) raf = requestAnimationFrame(draw); }
    function openStore() {
      return new Promise(function (resolve) {
        if (!window.indexedDB) { resolve(null); return; }
        var request = indexedDB.open(storeName, 1);
        request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains('clips')) request.result.createObjectStore('clips'); };
        request.onsuccess = function () { resolve(request.result); }; request.onerror = function () { resolve(null); };
      });
    }
    function getClip(db) { return new Promise(function (resolve) { try { var request = db.transaction('clips', 'readonly').objectStore('clips').get(phase); request.onsuccess = function () { resolve(request.result || null); }; request.onerror = function () { resolve(null); }; } catch (_) { resolve(null); } }); }
    function saveClip(db, blob) { try { var transaction = db.transaction('clips', 'readwrite'); transaction.objectStore('clips').put(blob, phase); } catch (_) {} }
    paintLaunchFrame(canvas, phase, 0);
    function recordScene(db) {
      if (reduceMotion || !canvas.captureStream || !window.MediaRecorder) return;
      var stream = canvas.captureStream(24);
      video.srcObject = stream; video.play().then(function () { if (video.parentNode) video.parentNode.classList.add('has-film-video'); }).catch(function () {});
      var mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
        recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onstop = function () {
          var blob = new Blob(chunks, { type: mime });
          video.srcObject = null;
          if (db && blob.size > 10000) saveClip(db, blob);
          var blobUrl = URL.createObjectURL(blob); video.src = blobUrl; video.loop = true; video.play().then(function () { if (video.parentNode) video.parentNode.classList.add('has-film-video'); }).catch(function () {});
          stream.getTracks().forEach(function (track) { track.stop(); });
        };
        recorder.start(250);
        setTimeout(function () { if (recorder && recorder.state !== 'inactive') recorder.stop(); }, 3400);
      } catch (_) { video.srcObject = null; stream.getTracks().forEach(function (track) { track.stop(); }); }
    }
    openStore().then(function (db) {
      if (!db) { recordScene(null); return; }
      getClip(db).then(function (blob) {
        if (blob) {
          var blobUrl = URL.createObjectURL(blob); video.src = blobUrl; video.loop = true; video.play().then(function () { if (video.parentNode) video.parentNode.classList.add('has-film-video'); }).catch(function () {});
        } else recordScene(db);
      });
    });
    if (!reduceMotion) raf = requestAnimationFrame(draw);
    splash._ccgLaunchCleanup = function () { cancelAnimationFrame(raf); };
  }
  if (appLaunch && (launchPreview || Date.now() - launchSeenAt > 30 * 60 * 1000)) {
    var launchSplash = document.getElementById('preloader');
    if (!launchSplash) { launchSplash = document.createElement('div'); launchSplash.id = 'preloader'; document.body.insertBefore(launchSplash, document.body.firstChild); }
    var localHour = new Date().getHours();
    var dayPhase = localHour >= 5 && localHour < 10 ? 'morning' : localHour >= 10 && localHour < 15 ? 'daylight' : localHour >= 15 && localHour < 18 ? 'afternoon' : localHour >= 18 && localHour < 21 ? 'evening' : 'night';
    var phaseGreeting = { morning:'A new morning, a fresh beginning', daylight:'A bright day with CCG', afternoon:'Take a peaceful afternoon pause', evening:'Ease into a peaceful evening', night:'A quiet moment before you begin' };
    launchSplash.className = 'ccg-launch-screen ccg-launch-' + dayPhase;
    launchSplash.setAttribute('data-min-show', launchPreview ? '9000' : '3500');
    launchSplash.setAttribute('role', 'status');
    launchSplash.setAttribute('aria-label', 'Launching CCG');
    launchSplash.innerHTML = '<div class="ccg-launch-sky" aria-hidden="true"><canvas class="ccg-launch-film-canvas"></canvas><video class="ccg-launch-film-video" muted autoplay playsinline aria-hidden="true"></video><span class="ccg-launch-film-vignette"></span><span class="ccg-launch-film-glow"></span></div><div class="ccg-launch-brand"><img src="' + new URL('images/ccg-icon-192.png', appBase).href + '" alt="CCG logo"><p class="ccg-launch-wordmark">CCG</p><p class="ccg-launch-greeting">' + phaseGreeting[dayPhase] + '</p><span class="ccg-launch-progress" aria-hidden="true"></span></div>';
    startLaunchFilm(launchSplash, dayPhase);
    sessionStorage.setItem('ccg-launch-seen-at', String(Date.now()));
    setTimeout(function () { launchSplash.classList.add('hidden'); if (launchSplash._ccgLaunchCleanup) launchSplash._ccgLaunchCleanup(); }, launchPreview ? 9500 : 3700);
  }
  var icons = {
    home: '<path d="m3 10.8 9-7.8 9 7.8v9.1a1.1 1.1 0 0 1-1.1 1.1h-5.2v-6.4h-5.4V21H4.1A1.1 1.1 0 0 1 3 19.9z"/>',
    bible: '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v18H5.5A2.5 2.5 0 0 0 3 23zM21 5.5A2.5 2.5 0 0 0 18.5 3H13v18h5.5A2.5 2.5 0 0 1 21 23z"/>',
    prayer: '<path d="M12 21s-8.2-4.8-8.2-11.2A4.5 4.5 0 0 1 12 7.1a4.5 4.5 0 0 1 8.2 2.7C20.2 16.2 12 21 12 21z"/>',
    community: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 3.2a4 4 0 0 1 0 7.6M21 21v-2a4 4 0 0 0-3-3.9"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  var docks = [
    { label:'Home', href:'index.html#home', icon:'home' },
    { label:'Bible', href:'bible.html', icon:'bible' },
    { label:'Pray', href:'prayer.html', icon:'prayer' },
    { label:'Community', href:'index.html#community', icon:'community' },
    { label:'More', href:'others.html', icon:'more' }
  ];
  var path = location.pathname.split('/').pop() || 'index.html';
  var dock = document.createElement('nav'); dock.className='app-dock';dock.setAttribute('aria-label','App navigation');
  docks.forEach(function(item) {
    var a=document.createElement('a');a.href=new URL(item.href,appBase).href;
    var target=item.href.split('#')[0] || 'index.html';
    var current=(path===target && (target!=='index.html' || (!item.href.includes('#community') && location.hash!=='#community')));
    if (target==='index.html' && path==='index.html' && item.href.includes('#home')) current=true;
    if ((path==='index.html' && item.href.includes('#community') && location.hash==='#community') || (path==='social.html' && item.icon==='community')) current=true;
    if (current) a.setAttribute('aria-current','page');
    a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[item.icon]+'</svg><span>'+item.label+'</span>';
    dock.appendChild(a);
  });
  document.body.appendChild(dock);

  var installButton=document.createElement('button');installButton.type='button';installButton.className='app-install-trigger';installButton.setAttribute('aria-haspopup','dialog');
  installButton.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 7v7m-3-3 3 3 3-3M9 18h.01M12 18h.01M15 18h.01"/></svg><span>Get the app</span>';
  var host=document.querySelector('.header-inner');
  if(host) host.insertBefore(installButton,host.querySelector('.mobile-nav-toggle'));
  var dialog=document.createElement('dialog');dialog.className='app-install-dialog';dialog.setAttribute('aria-labelledby','app-dialog-title');
  dialog.innerHTML='<div class="app-dialog-head"><button class="app-close" type="button" aria-label="Close app guide">×</button><div class="app-brand-row"><img src="'+new URL('images/ccg-icon-192.png',appBase).href+'" alt="CCG logo"><div><h2 id="app-dialog-title">Take CCG with you</h2><p>Install the CCG app</p></div></div></div><div class="app-dialog-body"><div class="app-platform-tabs" role="tablist" aria-label="Choose your phone"><button type="button" role="tab" id="app-tab-iphone" aria-controls="app-guide-iphone" aria-selected="true">iPhone</button><button type="button" role="tab" id="app-tab-android" aria-controls="app-guide-android" aria-selected="false">Android</button></div><section class="app-guide" id="app-guide-iphone" role="tabpanel" aria-labelledby="app-tab-iphone"><div class="app-step"><span class="app-step-number">1</span><div><strong>Open this site in Safari</strong><p>On iPhone or iPad, use Safari. The Add to Home Screen option is not offered by every in-app browser.</p></div></div><div class="app-step"><span class="app-step-number">2</span><div><strong>Tap Share</strong><p>Tap the square-with-arrow Share button at the bottom of Safari (or at the top on some iPad layouts).</p></div></div><div class="app-step"><span class="app-step-number">3</span><div><strong>Choose Add to Home Screen</strong><p>Scroll the share sheet if needed. If the option is missing, tap Edit Actions, then add it.</p></div></div><div class="app-step"><span class="app-step-number">4</span><div><strong>Keep the app name and tap Add</strong><p>CCG will open from your Home Screen in its own app window. Sign in once to use member features.</p></div></div><p class="app-dialog-note">The iPhone version is tuned for Safari safe areas, the Home Screen launch flow, a persistent five-tab dock, and reduced-motion settings.</p></section><section class="app-guide" id="app-guide-android" role="tabpanel" aria-labelledby="app-tab-android" hidden><div class="app-step"><span class="app-step-number">1</span><div><strong>Open in Chrome</strong><p>Visit the church website in Chrome on your Android phone.</p></div></div><div class="app-step"><span class="app-step-number">2</span><div><strong>Tap Install app</strong><p>Use the install prompt when it appears, or open Chrome’s ⋮ menu and choose Install app or Add to Home screen.</p></div></div><div class="app-step"><span class="app-step-number">3</span><div><strong>Confirm installation</strong><p>Android adds CCG to your launcher. Open it to reach worship, Scripture, prayer, and community.</p></div></div><p class="app-dialog-note">The Android install prompt appears when the browser and site meet install requirements. A secure HTTPS connection is required.</p></section></div>';
  document.body.appendChild(dialog);
  var tabs=dialog.querySelectorAll('[role="tab"]');
  tabs.forEach(function(tab){tab.addEventListener('click',function(){tabs.forEach(function(t){t.setAttribute('aria-selected',String(t===tab));});dialog.querySelectorAll('[role="tabpanel"]').forEach(function(p){p.hidden=p.id!==tab.getAttribute('aria-controls');});});});
  dialog.querySelector('.app-close').addEventListener('click',function(){dialog.close();});
  dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close();});
  var deferredPrompt=null, ua=navigator.userAgent||'', isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1), isAndroid=/Android/i.test(ua);
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;});
  installButton.addEventListener('click',async function(){
    if(isAndroid&&deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;return;}
    if(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone){installButton.querySelector('span').textContent='App installed';setTimeout(function(){installButton.querySelector('span').textContent='Get the app';},2200);return;}
    if(isIOS){dialog.querySelector('#app-tab-iphone').click();}
    else if(isAndroid){dialog.querySelector('#app-tab-android').click();}
    dialog.showModal();
  });
  var updateVersion='ccg-update-notice-v9';
  if(!sessionStorage.getItem(updateVersion)){
    var updateNotice=document.createElement('aside');
    updateNotice.className='app-update-notice';
    updateNotice.setAttribute('role','status');
    updateNotice.innerHTML='<span>A new version of the church app is available. Update now to get the latest version.</span><button type="button" class="app-update-now">Update now</button><button type="button" class="app-update-dismiss" aria-label="Dismiss update notice">×</button>';
    document.body.appendChild(updateNotice);
    updateNotice.querySelector('.app-update-dismiss').addEventListener('click',function(){sessionStorage.setItem(updateVersion,'dismissed');updateNotice.remove();});
    updateNotice.querySelector('.app-update-now').addEventListener('click',function(){
      var button=this;button.disabled=true;button.textContent='Updating…';
      var reloaded=false;
      function reload(){if(reloaded)return;reloaded=true;location.reload();}
      if('serviceWorker' in navigator){
        navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
        navigator.serviceWorker.getRegistration(new URL('.',appBase).href).then(function(registration){
          return registration ? registration.update().catch(function(){}) : null;
        }).finally(function(){setTimeout(reload,1800);});
      }else{location.reload();}
    });
  }
  if('serviceWorker' in navigator && location.protocol==='https:') window.addEventListener('load',function(){navigator.serviceWorker.register(new URL('service-worker.js',appBase).href).catch(function(){});});
})();

