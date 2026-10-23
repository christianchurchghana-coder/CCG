/* Public church content. Add approved sermons/events here for the home page. */
(function () {
    'use strict';
    var sermons = [];
    var events = [
        {
            id: 'christmas-gathering-2026',
            title: 'Christmas Church Gathering & Prayer',
            date: '2026-12-25',
            dateLabel: 'December 25, 2026',
            bio: 'A special Christmas Day gathering for the Christian Church of Ghana family. We will come together in fellowship, give thanks, pray as one church, and celebrate the hope of Christ. Every member is warmly invited. The church will share the venue and start time soon.',
            location: 'Venue and time to be announced',
            image: 'images/victoria-christmas-gathering-2026-4k.jpg',
            imageAlt: 'Photograph provided for the church Christmas gathering'
        }
    ];
    window.getSermons = function () { return sermons.slice(); };
    window.getEvents = function () { return events.slice(); };
})();
