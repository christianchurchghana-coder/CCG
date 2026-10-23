(function () {
    'use strict';
    var cfg = window.CCG_SUPABASE_CONFIG || {};
    var ready = !!(window.supabase && cfg.url && cfg.anonKey &&
        cfg.url.indexOf('YOUR_PROJECT_REF') === -1 && cfg.anonKey.indexOf('YOUR_') === -1);
    var client = ready ? window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    }) : null;
    window.CCG = window.CCG || {};
    window.CCG.supabase = client;
    window.CCG.isConfigured = ready;
    window.CCG.requireClient = function () {
        if (!client) throw new Error('Supabase is not configured. Add your project URL and anon key in supabase-config.js.');
        return client;
    };
    window.CCG.getProfile = async function (user) {
        if (!client || !user) return null;
        var result = await client.from('profiles').select('id,display_name,nickname,interests,bio,created_at').eq('id', user.id).maybeSingle();
        if (result.error) throw result.error;
        return result.data;
    };
    var ageGroupPrompt = null;
    window.CCG.ensureAgeGroup = function (user) {
        var currentGroup = user && user.user_metadata && user.user_metadata.age_group;
        if (!user || currentGroup === 'youth' || currentGroup === 'adult' || currentGroup === 'under13') return Promise.resolve(user);
        if (ageGroupPrompt) return ageGroupPrompt;
        ageGroupPrompt = new Promise(function (resolve) {
            var dialog = document.createElement('dialog');
            dialog.className = 'ccg-age-dialog';
            dialog.setAttribute('aria-labelledby', 'ccg-age-title');
            dialog.innerHTML = '<form class="ccg-age-form"><p class="auth-eyebrow">Finish setting up your account</p><h2 id="ccg-age-title">Choose your age group</h2><p class="age-note">This is self-declared for your profile badge. It does not verify your age, and CCG does not store your birth date.</p><label for="ccg-age-choice">Age group</label><select id="ccg-age-choice" class="form-input" required><option value="">Choose your age group</option><option value="youth">Youth (13–26)</option><option value="adult">Adult (27+)</option><option value="under13">Under 13</option></select><p class="ccg-age-error" role="alert"></p><button class="form-button" type="submit">Continue</button></form>';
            document.body.appendChild(dialog);
            var form = dialog.querySelector('form');
            form.addEventListener('submit', async function (event) {
                event.preventDefault();
                var choice = dialog.querySelector('#ccg-age-choice').value;
                if (!['youth', 'adult', 'under13'].includes(choice)) {
                    dialog.querySelector('.ccg-age-error').textContent = 'Choose an age group to continue.';
                    return;
                }
                var button = form.querySelector('button');
                button.disabled = true;
                button.textContent = 'Saving…';
                try {
                    var result = await client.auth.updateUser({ data: { age_group: choice } });
                    if (result.error) throw result.error;
                    dialog.close();
                    dialog.remove();
                    ageGroupPrompt = null;
                    resolve(result.data.user || user);
                } catch (error) {
                    dialog.querySelector('.ccg-age-error').textContent = 'Could not save your choice. Check your connection and try again.';
                    button.disabled = false;
                    button.textContent = 'Continue';
                }
            });
            dialog.addEventListener('cancel', function (event) { event.preventDefault(); });
            dialog.showModal();
        });
        return ageGroupPrompt;
    };
    window.getCurrentUser = function () {
        return window.CCG.currentUser || null;
    };
    window.initializeAuthAndNav = async function () {
        var slot = document.getElementById('auth-link-container');
        if (!slot) return;
        if (!client) {
            slot.innerHTML = '<a href="login.html" id="nav-login-link">Login / Register</a>';
            return;
        }
        try {
            var res = await client.auth.getUser();
            var user = res.data && res.data.user;
            if (!user) {
                window.CCG.currentUser = null;
                slot.innerHTML = '<a href="login.html" id="nav-login-link">Login / Register</a>';
                return;
            }
            user = await window.CCG.ensureAgeGroup(user);
            var profile = await window.CCG.getProfile(user);
            var ageGroup = user.user_metadata && user.user_metadata.age_group;
            window.CCG.currentUser = {
                id: user.id,
                email: user.email || '',
                name: profile && (profile.nickname || profile.display_name) || user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name || user.user_metadata.name) || user.email || 'Member',
                interests: profile && profile.interests || '',
                ageGroup: ageGroup || ''
            };
            var badge = ageGroup === 'youth' ? '<span class="ccg-age-badge ccg-age-youth" title="Self-declared age group; not verified">Youth</span>' : ageGroup === 'adult' ? '<span class="ccg-age-badge ccg-age-adult" title="Self-declared age group; not verified">Adult</span>' : '';
            var brandLink = document.querySelector('.logo a');
            if (brandLink) {
                var oldBadge = brandLink.querySelector('.ccg-age-badge');
                if (oldBadge) oldBadge.remove();
                if (ageGroup === 'youth' || ageGroup === 'adult') {
                    var brandBadge = document.createElement('span');
                    brandBadge.className = 'ccg-age-badge ccg-age-' + ageGroup;
                    brandBadge.title = 'Self-declared age group; not verified';
                    brandBadge.textContent = ageGroup === 'youth' ? 'Youth' : 'Adult';
                    brandLink.appendChild(brandBadge);
                }
            }
            slot.innerHTML = '<a class="nav-user-info" href="index.html#profile" aria-label="Open your profile">' + escapeText(window.CCG.currentUser.name) + '</a> ' + badge + ' <button type="button" class="btn-sm" id="ccg-signout">Sign out</button>';
            var out = document.getElementById('ccg-signout');
            if (out) out.addEventListener('click', async function () {
                await client.auth.signOut();
                window.CCG.currentUser = null;
                location.href = 'index.html';
            });
        } catch (e) {
            console.error('Could not load account navigation:', e);
        }
    };
    function escapeText(value) {
        var node = document.createElement('span');
        node.textContent = value == null ? '' : String(value);
        return node.innerHTML;
    }
})();
