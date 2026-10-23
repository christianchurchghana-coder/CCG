'use strict';
var CACHE='ccg-shell-v10';
var CORE=['./','./index.html','./bible.html','./prayer.html','./social.html','./others.html','./give.html','./login.html','./ccg-explainer.html','./style.css','./app.css','./celebrations.css','./celebrations.js','./new-year-screen.css','./daily-reading-reminder.js','./verse-of-the-day.js','./site.js','./nav-icons.js','./app.js','./ccg-guide.js','./manifest.webmanifest','./images/ccg-icon-180.png','./images/ccg-icon-192.png','./images/ccg-icon-512.png','./images/ccg-icon-maskable-512.png','./sermon-detail.html'];
self.addEventListener('install',function(event){event.waitUntil(caches.open(CACHE).then(function(cache){return cache.addAll(CORE);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(event){event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(key){return key!==CACHE;}).map(function(key){return caches.delete(key);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(event){
 var request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/rest/v1/')||url.pathname.includes('/auth/v1/'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(function(response){if(response.ok){var copy=response.clone();caches.open(CACHE).then(function(cache){cache.put(request,copy);});}return response;}).catch(function(){return caches.match(request).then(function(hit){return hit||caches.match('./index.html');});}));
  return;
 }
 event.respondWith(caches.match(request).then(function(hit){var fresh=fetch(request).then(function(response){if(response.ok&&response.type==='basic'){var copy=response.clone();caches.open(CACHE).then(function(cache){cache.put(request,copy);});}return response;}).catch(function(){return hit;});return hit||fresh;}));
});
