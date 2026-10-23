(function () {
    'use strict';
    function start() {
        if (window.initializeAuthAndNav) window.initializeAuthAndNav();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
