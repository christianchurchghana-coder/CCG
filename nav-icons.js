/* Turns the primary navigation into compact icon tabs while keeping labels accessible. */
(function () {
    'use strict';
    var icons = {
        'home': ['M3 10.8 12 3l9 7.8v9.1a1.1 1.1 0 0 1-1.1 1.1h-5.2v-6.4h-3.4V22H4.1A1.1 1.1 0 0 1 3 20.9z'],
        'others': ['M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z'],
        'follow us': ['M18 8a3 3 0 1 0-2.83-4M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12-12a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.6 15.5l6.8-7M8.6 20.5l6.8-3.5'],
        'about us': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 11v5', 'M12 7h.01'],
        'sermons': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'm10 8 6 4-6 4z'],
        'live prayer': ['M12 21s-8.2-4.8-8.2-11.2A4.5 4.5 0 0 1 12 7.1a4.5 4.5 0 0 1 8.2 2.7C20.2 16.2 12 21 12 21z', 'M12 7v8', 'M8.5 11 12 14.5 15.5 11'],
        'bible': ['M3 5.5A2.5 2.5 0 0 1 5.5 3H11v17H5.5A2.5 2.5 0 0 0 3 22.5z', 'M21 5.5A2.5 2.5 0 0 0 18.5 3H13v17h5.5a2.5 2.5 0 0 1 2.5 2.5z'],
        'events': ['M4 5h16v16H4z', 'M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01'],
        'community': ['M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2', 'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M17 3.2a4 4 0 0 1 0 7.6', 'M21 21v-2a4 4 0 0 0-3-3.9'],
        'login / register': ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
        'give': ['M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7z', 'M12 6v8', 'M8.5 10h7'],
        'contact': ['M3 5h18v14H3z', 'm3 7 9 7 9-7']
    };
    function findLabel(link) {
        var label = (link.textContent || '').replace(/\s+/g, ' ').trim();
        if (!label) label = link.getAttribute('aria-label') || link.getAttribute('title') || '';
        return label;
    }
    function addIcon(link) {
        if (link.classList.contains('nav-icon-tab') || link.classList.contains('nav-user-info')) return;
        var label = findLabel(link), key = label.toLowerCase(), paths = icons[key];
        if (!paths) return;
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'nav-tab-icon');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        paths.forEach(function (d) {
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            svg.appendChild(path);
        });
        var text = document.createElement('span');
        text.className = 'nav-label';
        text.textContent = label;
        link.replaceChildren(svg, text);
        link.classList.add('nav-icon-tab');
        link.setAttribute('aria-label', label);
        link.setAttribute('data-nav-label', label);
    }
    function refresh() {
        var nav = document.querySelector('.main-nav');
        if (!nav) return;
        nav.querySelectorAll('a').forEach(addIcon);
    }
    refresh();
    var nav = document.querySelector('.main-nav');
    if (nav && window.MutationObserver) new MutationObserver(refresh).observe(nav, { childList: true, subtree: true });
})();
