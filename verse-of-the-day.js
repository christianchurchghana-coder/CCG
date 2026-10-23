/* verse-of-the-day.js
   A new verse from anywhere in the Bible every day, switching at midnight Ghana time.

   How it works:
   - Today's date (UTC, which equals Accra time all year) seeds a random pick of one chapter
     out of all 1,189 chapters, then one verse inside it. Everyone sees the same verse that day.
   - The chapter text comes from bible-api.com (King James Version, public domain).
   - The result is cached in the visitor's browser, so it loads once per day.
   - If the service can't be reached, a built-in list of 31 verses is used instead.
   - If the page stays open past midnight, the verse refreshes by itself.

   Setup: add this just before </body> in index.html:
       <script src="verse-of-the-day.js"></script>
   It fills the existing .verse-text and .verse-ref elements inside .verse-hero.
*/
(function () {
    'use strict';

    var CACHE_KEY = 'ccg_verse_of_day_v1';
    var MIN_LEN = 40;    /* skip very short fragments */
    var MAX_LEN = 300;   /* skip very long verses */
    var MAX_TRIES = 5;   /* chapters to try before falling back */

    /* [book name, number of chapters] for all 66 books = 1,189 chapters */
    var BOOKS = [
        ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34],
        ['Joshua', 24], ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24],
        ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10],
        ['Nehemiah', 13], ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31],
        ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52], ['Lamentations', 5],
        ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9],
        ['Obadiah', 1], ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3],
        ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
        ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28],
        ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6],
        ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3],
        ['1 Timothy', 6], ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13],
        ['James', 5], ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1],
        ['3 John', 1], ['Jude', 1], ['Revelation', 22]
    ];

    var TOTAL_CHAPTERS = BOOKS.reduce(function (sum, b) { return sum + b[1]; }, 0);

    /* Backup list, used only when the online source is unreachable. */
    var FALLBACK = [
        { ref: 'Jeremiah 29:11', text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' },
        { ref: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.' },
        { ref: 'Proverbs 3:5-6', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.' },
        { ref: 'Philippians 4:13', text: 'I can do all things through Christ which strengtheneth me.' },
        { ref: 'Isaiah 41:10', text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.' },
        { ref: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
        { ref: 'Joshua 1:9', text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.' },
        { ref: 'Matthew 11:28', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },
        { ref: 'John 3:16', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
        { ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' },
        { ref: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
        { ref: 'Psalm 121:1-2', text: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.' },
        { ref: 'Philippians 4:6', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
        { ref: '1 Corinthians 13:13', text: 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.' },
        { ref: 'Psalm 27:1', text: 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?' },
        { ref: 'Matthew 6:33', text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
        { ref: '2 Timothy 1:7', text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.' },
        { ref: 'Psalm 118:24', text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.' },
        { ref: 'John 14:6', text: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.' },
        { ref: 'Hebrews 11:1', text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
        { ref: 'Lamentations 3:22-23', text: 'It is of the LORD\'s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.' },
        { ref: 'Psalm 37:4', text: 'Delight thyself also in the LORD; and he shall give thee the desires of thine heart.' },
        { ref: 'Proverbs 18:10', text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.' },
        { ref: '1 John 4:19', text: 'We love him, because he first loved us.' },
        { ref: 'Micah 6:8', text: 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?' },
        { ref: 'Psalm 119:105', text: 'Thy word is a lamp unto my feet, and a light unto my path.' },
        { ref: 'John 14:27', text: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.' },
        { ref: 'Romans 15:13', text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.' },
        { ref: 'Deuteronomy 31:6', text: 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.' },
        { ref: 'Psalm 34:8', text: 'O taste and see that the LORD is good: blessed is the man that trusteth in him.' },
        { ref: 'Colossians 3:23', text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.' }
    ];

    /* ---------- Date and seeded randomness ---------- */

    /* UTC date as a number like 20261012. Ghana is on GMT all year, so this
       flips at exactly 00:00 Accra time. */
    function dateKey() {
        var d = new Date();
        return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    }

    /* Small seeded random number generator: same seed gives the same sequence. */
    function mulberry32(seed) {
        var a = seed;
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* Pick one chapter out of all 1,189, so long books are picked more often. */
    function pickChapter(rand) {
        var n = Math.floor(rand() * TOTAL_CHAPTERS);
        for (var i = 0; i < BOOKS.length; i++) {
            if (n < BOOKS[i][1]) { return { book: BOOKS[i][0], chapter: n + 1 }; }
            n -= BOOKS[i][1];
        }
        return { book: 'Psalms', chapter: 23 };
    }

    /* ---------- Fetching ---------- */

    function clean(text) {
        return String(text || '').replace(/\u00B6/g, '').replace(/\s+/g, ' ').trim();
    }

    function fetchChapter(book, chapter) {
        var url = 'https://bible-api.com/' + encodeURIComponent(book + ' ' + chapter) + '?translation=kjv';
        return fetch(url).then(function (res) {
            if (!res.ok) { throw new Error('Bible API error ' + res.status); }
            return res.json();
        });
    }

    function pickVerse(data, rand) {
        var list = (data && data.verses ? data.verses : []).filter(function (v) {
            var len = clean(v.text).length;
            return len >= MIN_LEN && len <= MAX_LEN;
        });
        if (list.length === 0) { return null; }
        var v = list[Math.floor(rand() * list.length)];
        return {
            ref: v.book_name + ' ' + v.chapter + ':' + v.verse,
            text: clean(v.text)
        };
    }

    function loadOnline(key) {
        var rand = mulberry32(key);
        var attempt = 0;

        function tryNext() {
            if (attempt >= MAX_TRIES) { return Promise.reject(new Error('No suitable verse found')); }
            attempt++;
            var pick = pickChapter(rand);
            return fetchChapter(pick.book, pick.chapter).then(function (data) {
                var verse = pickVerse(data, rand);
                return verse || tryNext();
            });
        }
        return tryNext();
    }

    /* ---------- Cache ---------- */

    function readCache(key) {
        try {
            var saved = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (saved && saved.key === key && saved.ref && saved.text) { return saved; }
        } catch (e) { /* storage unavailable */ }
        return null;
    }

    function writeCache(key, verse) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ key: key, ref: verse.ref, text: verse.text }));
        } catch (e) { /* ignore */ }
    }

    /* ---------- Rendering ---------- */

    function render(verse) {
        var card = document.querySelector('.verse-hero');
        if (!card) { return; }
        var textEl = card.querySelector('.verse-text');
        var refEl = card.querySelector('.verse-ref');
        if (!textEl || !refEl) { return; }
        textEl.textContent = '\u201C' + verse.text + '\u201D';
        refEl.textContent = verse.ref + ' (KJV)';
    }

    function update() {
        var key = dateKey();

        /* Show a date-specific verse immediately, including offline, while the online KJV source loads. */
        render(FALLBACK[key % FALLBACK.length]);
        var cached = readCache(key);
        if (cached) { render(cached); return; }

        loadOnline(key)
            .then(function (verse) {
                writeCache(key, verse);
                render(verse);
            })
            .catch(function () {
                /* Offline or service down: use the backup list (not cached, so it retries next visit). */
                render(FALLBACK[key % FALLBACK.length]);
            });
    }

    /* Refresh automatically at the next midnight (00:00 UTC / Accra) if the page stays open. */
    function scheduleMidnightRefresh() {
        var now = new Date();
        var next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 1);
        setTimeout(function () {
            update();
            scheduleMidnightRefresh();
        }, next - now.getTime());
    }

    function init() {
        update();
        scheduleMidnightRefresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
