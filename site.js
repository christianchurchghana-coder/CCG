(function () {
    'use strict';
    var toggle = document.querySelector('.mobile-nav-toggle');
    var nav = document.getElementById('main-nav');
    if (toggle && nav) {
        toggle.setAttribute('aria-controls', 'main-nav');
        toggle.addEventListener('click', function () {
            var open = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(open));
            toggle.classList.toggle('is-open', open);
            nav.classList.toggle('is-open', open);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                toggle.setAttribute('aria-expanded', 'false');
                toggle.classList.remove('is-open');
                nav.classList.remove('is-open');
            }
        });
    }
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
    var preloader = document.getElementById('preloader');
    if (preloader) {
        var preloaderStartedAt = Date.now();
        var hideScheduled = false;
        function hide() {
            if (hideScheduled) return;
            hideScheduled = true;
            var minimumVisibleMs = Number(preloader.getAttribute('data-min-show')) || 0;
            setTimeout(function () { preloader.classList.add('hidden'); }, Math.max(0, minimumVisibleMs - (Date.now() - preloaderStartedAt)));
        }
        if (document.readyState === 'complete') hide();
        else window.addEventListener('load', hide, { once: true });
        setTimeout(hide, 3200);
    }
})();
