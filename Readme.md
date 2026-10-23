# Christian Church of Ghana website

The site uses Supabase Auth and Postgres for member accounts, profiles, backend-reviewed nickname requests, event RSVPs, friend requests, direct messages, community status posts, mutual daily friend streaks, and reports. The old standalone `server.js` community service is not used by the pages.

## Installable mobile app

The site is an installable PWA for Android and iPhone. Deploy it at its final HTTPS origin to enable installation and offline shell caching. Android users can install from Chrome (or use the in-app install prompt when the browser offers it). iPhone users open the site in Safari and choose **Share → Add to Home Screen**; the site includes a guided iPhone install sheet, an Apple touch icon, standalone display settings, safe-area spacing, and an animated five-tab mobile dock.

A Capacitor wrapper for store-buildable Android and iOS apps is in [`mobile-app/`](mobile-app/README.md). It copies the website into a native WebView bundle. Android builds require Android Studio and the Android SDK; iOS builds require macOS and Xcode. Store signing, final app identifiers, privacy disclosures, platform-specific screenshots, and Supabase's production HTTPS redirect URL must be completed before publishing. The service worker caches same-origin static pages and assets only; sign-in, prayer synchronization, and community actions still need a network connection.

## Connect Supabase

## Celebrations and birthdays

The home page includes live New Year and Easter countdowns, a church-themed celebration animation, and an optional final-ten-second chime. Birthday sharing is opt-in and stores only month/day (never birth year); signed-in members who opt in appear in the birthday list. Run [`birthday-celebrations.sql`](birthday-celebrations.sql) once in the Supabase SQL Editor to enable it. Browser reminders can appear while a member opens the site and has allowed notifications. Notifications when the app is closed require a separately configured web-push service and push credentials; they are not enabled by this static-site deployment.

1. Create a Supabase project.
2. Run [`supabase-schema.sql`](supabase-schema.sql) in the Supabase SQL Editor.
3. Copy the project URL and the browser-safe anon/publishable key from the project API settings into [`supabase-config.js`](supabase-config.js).
4. In Supabase Auth settings, set the site URL and add the deployed site URL plus `http://localhost:3000/login.html` to the allowed redirect URLs.
5. If using Google sign-in, enable Google in Supabase Auth and add the Google provider credentials in the Supabase dashboard. Do not put a Google client secret or Supabase service-role key in this site.
6. Serve the folder through a web server. For local development, run `python -m http.server 3000` in this folder and open `http://localhost:3000`. Auth redirects do not work from `file://` URLs.

If the original schema has already been run, run [`supabase-social-upgrade.sql`](supabase-social-upgrade.sql) in the Supabase SQL Editor. It adds the status feed, database-managed friend streaks, profile bio fields, and a nickname request queue. It is safe to rerun after the latest profile changes. A streak day counts after both accepted friends send each other at least one message on the same UTC calendar day. Signed-in members can read the community feed, post up to 280 characters, and delete their own statuses.

To enable the shared Prayer Lock-In schedule, run [`prayer-schedule.sql`](prayer-schedule.sql) once in the Supabase SQL Editor. Sign in to the website with `christianchurchghana@gmail.com`; the Prayer section will then show the church-only controls to choose the event, start time, and prayer length. Visitors see the same schedule and can join while it is active. Start times display in each visitor's local time zone.

To enable the **Live Prayer** tab, run [`prayer-live-schema.sql`](prayer-live-schema.sql) once in the Supabase SQL Editor. Sign in with `christianchurchghana@gmail.com` to schedule morning devotion, prayer, or fasting sessions, and optionally attach the church livestream link. Members sign in to join a shared room with a synchronized countdown and live attendee list. The same setup enables private Bible reading streaks and authenticated online/offline presence. Bible streaks count once per UTC day after a chapter loads; guests get a device-only streak until they sign in.

The signup form creates an Auth account. The database trigger creates its profile. Depending on the project's email-confirmation setting, the member either enters immediately or must confirm their email first. Password recovery sends a Supabase email link. The earlier demo accounts stored in browser `localStorage` are not imported; members will need to register with Supabase.

Members can open **My Profile** from their signed-in name in the navigation or from the home page. They can edit their full name, private phone metadata, bio, interests, account email, and password. Nicknames are stored as pending requests and do not appear publicly until the backend owner approves them. Browser users have no permission to approve requests or edit the published nickname. After submitting a request, members should contact `christianchurchghana@gmail.com` and include the request number. Example approval SQL is at the end of `supabase-social-upgrade.sql`.

## Site content and payments

The Supabase schema stores RSVP records, not the event catalogue. Add approved entries to the `sermons` and `events` arrays in [`data.js`](data.js); both arrays currently start empty. Event IDs become the RSVP keys. Until entries are added, the home page shows empty states and sermon detail links report that the requested sermon is unavailable.

Online payments are intentionally disabled until the church provides verified giving details and completes a payment provider setup with server-side transaction verification. The Give page asks visitors to contact the church office rather than showing sample account details. `contact-form.js` is an unused starter file and needs a real Formspree endpoint before a contact form can be published.

## Search Console and deployment readiness

The public pages have descriptive titles and summaries; account and giving pages are marked `noindex`. `robots.txt` allows search crawlers. Search Console cannot verify or crawl a local preview: first deploy the site on its final HTTPS domain. Then add the domain property in Search Console, verify it with the DNS TXT record Google supplies, create a sitemap using that exact public domain, and submit the sitemap. Do not publish a guessed canonical URL or sitemap host. Google may take time to crawl and does not guarantee that every URL will be indexed.

Before launch, replace the empty sermon/event arrays in `data.js` with approved current content, confirm the church's exact address and public social profiles, and provide real giving details if online donations are required. The site currently uses only the town-level location and church email/phone shown in its footer.

## Legacy server

`server.js` is the earlier file-based community API. It uses a separate browser token system and local JSON storage, and is disconnected from Supabase Auth. Do not run it as the production community backend. Back up any existing `data.json` before migrating old member or message data; this site does not import that file automatically.
