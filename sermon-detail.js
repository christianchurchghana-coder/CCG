(function () {
    'use strict';
    function safeUrl(value) {
        var url = String(value || '').trim();
        return /^(https?:\/\/|\/|[\w.-]+\/|[\w.-]+\.(mp3|m4a|ogg|wav|pdf|docx?)(\?.*)?$)/i.test(url) && !/^javascript:/i.test(url) ? url : '';
    }
    function text(node, value) { node.textContent = value == null ? '' : String(value); }
    var id = new URLSearchParams(location.search).get('id');
    var sermons = typeof getSermons === 'function' ? getSermons() : [];
    if (!Array.isArray(sermons)) sermons = Object.keys(sermons || {}).map(function (key) { return Object.assign({ id: key }, sermons[key]); });
    var sermon = sermons.find(function (item) { return String(item.id) === id; });
    if (!sermon) {
        text(document.getElementById('sermon-title'), 'Sermon not found');
        text(document.getElementById('sermon-empty'), 'This sermon is not in the site content yet. Please return to the sermons page.');
        document.getElementById('sermon-empty').hidden = false;
        return;
    }
    text(document.getElementById('sermon-title'), sermon.title || 'Sermon');
    text(document.getElementById('sermon-meta'), [sermon.speaker, sermon.date].filter(Boolean).join(' · '));
    text(document.getElementById('sermon-description'), sermon.description || '');
    var media = document.getElementById('sermon-media');
    var audio = safeUrl(sermon.audio || sermon.audioUrl);
    var notes = safeUrl(sermon.notes || sermon.notesUrl);
    if (audio) {
        var player = document.createElement('audio'); player.controls = true; player.preload = 'none'; player.src = audio;
        player.setAttribute('aria-label', 'Listen to ' + (sermon.title || 'sermon')); media.appendChild(player);
        var download = document.createElement('a'); download.href = audio; download.download = ''; download.textContent = 'Download audio'; media.appendChild(download);
    }
    if (notes) {
        var handout = document.createElement('a'); handout.href = notes; handout.download = ''; handout.textContent = 'Download sermon notes'; media.appendChild(handout);
    }
})();
