(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var client = window.CCG && window.CCG.supabase;
    var views = { login: $('view-login'), register: $('view-register'), forgot: $('view-forgot'), success: $('view-success') };
    var recovery = false;
    var googleBusy = false;
    function show(name, updateHash) {
        Object.keys(views).forEach(function (key) { if (views[key]) views[key].hidden = key !== name; });
        if (views[name]) document.title = views[name].dataset.title + ' | Christian Church of Ghana';
        if (updateHash && name !== 'success') history.replaceState(null, '', '#' + name);
    }
    function message(id, text, success) {
        var node = $(id);
        if (!node) return;
        node.textContent = text || '';
        node.classList.toggle('success-text', !!success);
    }
    function loading(form, on) {
        var btn = form.querySelector('.form-button');
        if (btn) { btn.disabled = on; btn.classList.toggle('is-loading', on); }
    }
    function errorText(error) {
        var text = error && error.message || '';
        var code = error && error.code || '';
        if (/invalid login credentials/i.test(text)) return 'Incorrect email or password.';
        if (/email not confirmed/i.test(text)) return 'Please confirm your email address before signing in.';
        if (/already registered/i.test(text)) return 'An account with this email already exists. Sign in instead.';
        if (/provider.*(not enabled|disabled)|unsupported provider|provider_disabled/i.test(text + ' ' + code)) return 'Google sign-in has not been enabled for this church app yet. The administrator must enable Google and add its OAuth credentials in Supabase Authentication settings.';
        if (/redirect.*(not allowed|allow.?list)|url.*not allowed/i.test(text)) return 'This sign-in address is not allowed yet. The administrator must add this website to Supabase Authentication URL settings.';
        if (/network|failed to fetch|load failed|fetch failed/i.test(text)) return 'Could not reach the account service. Check your connection and try again.';
        if (/invalid.*(client|oauth)|unauthorized_client/i.test(text)) return 'Google sign-in needs valid OAuth credentials in the Supabase provider settings.';
        return text || 'Something went wrong. Please try again.';
    }
    document.addEventListener('click', function (event) {
        var target = event.target.closest('[data-go]');
        if (target) { event.preventDefault(); show(target.dataset.go); }
    });
    document.addEventListener('click', function (event) {
        var button = event.target.closest('.password-toggle');
        if (!button) return;
        var input = button.parentNode.querySelector('input');
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    $('login-form').addEventListener('submit', async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var email = $('l-email').value.trim().toLowerCase();
        var password = $('l-password').value;
        message('login-message', '');
        if (!client) { message('login-message', 'Sign-in is unavailable because the account service did not load. Refresh the page; if this continues, contact the church administrator.'); return; }
        loading(form, true);
        try {
            var result = await client.auth.signInWithPassword({ email: email, password: password });
            if (result.error) throw result.error;
            var next = new URLSearchParams(location.search).get('next');
            location.href = next && /^[a-z0-9_-]+\.html$/i.test(next) ? next : 'index.html';
        } catch (error) { message('login-message', errorText(error)); }
        finally { loading(form, false); }
    });
    $('register-form').addEventListener('submit', async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var name = $('r-name').value.trim();
        var email = $('r-email').value.trim().toLowerCase();
        var password = $('r-password').value;
        var ageGroup = $('r-age-group').value;
        if (name.length < 2 || !['youth', 'adult', 'under13'].includes(ageGroup) || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || password !== $('r-confirm').value || !$('r-terms').checked) {
            message('register-message', 'Check your name, age group, password, confirmation, and consent before continuing.'); return;
        }
        if (!client) { message('register-message', 'Sign-up is unavailable because the account service did not load. Refresh the page; if this continues, contact the church administrator.'); return; }
        loading(form, true);
        try {
            var result = await client.auth.signUp({
                email: email,
                password: password,
                options: { data: { display_name: name, phone: $('r-phone').value.trim(), age_group: ageGroup }, emailRedirectTo: new URL('index.html', location.href).href }
            });
            if (result.error) throw result.error;
            $('success-text').textContent = result.data.session
                ? 'Welcome, ' + name.split(/\s+/)[0] + '! Your account is ready.'
                : 'Check your email for a confirmation link to finish creating your account.';
            $('success-home').hidden = !result.data.session;
            $('success-login').textContent = result.data.session ? 'Continue' : 'Go to login';
            $('success-login').onclick = function () { if (result.data.session) location.href = 'index.html'; else show('login', true); };
            show('success');
        } catch (error) { message('register-message', errorText(error)); }
        finally { loading(form, false); }
    });
    $('forgot-form').addEventListener('submit', async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var email = $('f-email').value.trim().toLowerCase();
        if (!client) { message('forgot-message', 'Password recovery is unavailable because the account service did not load. Refresh the page; if this continues, contact the church administrator.'); return; }
        loading(form, true);
        try {
            var result = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#reset' });
            if (result.error) throw result.error;
            message('forgot-message', 'If an account exists for that address, a password reset link is on its way. Check your inbox.');
        } catch (error) { message('forgot-message', errorText(error)); }
        finally { loading(form, false); }
    });
    $('reset-form').addEventListener('submit', async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var password = $('n-password').value;
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || password !== $('n-confirm').value) {
            message('forgot-message', 'Use at least 8 characters with letters and numbers, and make both passwords match.'); return;
        }
        loading(form, true);
        try {
            var result = await client.auth.updateUser({ password: password });
            if (result.error) throw result.error;
            recovery = false;
            message('login-notice', 'Password updated. Sign in with your new password.', true);
            $('login-notice').hidden = false;
            show('login');
        } catch (error) { message('forgot-message', errorText(error)); }
        finally { loading(form, false); }
    });
    document.querySelectorAll('[data-google-slot]').forEach(function (slot) {
        slot.innerHTML = '<button type="button" class="google-fallback"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 17.9z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3C14.2 15.6 18.7 12 24 12z"/></svg><span>Continue with Google</span></button>';
    });
    document.addEventListener('click', async function (event) {
        var button = event.target.closest('.google-fallback, #google-login');
        if (!button) return;
        event.preventDefault();
        var notes = document.querySelectorAll('[data-google-note]');
        function googleNote(text) { notes.forEach(function (node) { node.textContent = text || ''; }); }
        if (googleBusy) return;
        if (!client) { googleNote('Google sign-in is unavailable because the account service did not load. Refresh the page; if this continues, contact the church administrator.'); return; }
        googleBusy = true;
        document.querySelectorAll('.google-fallback, #google-login').forEach(function (node) { node.disabled = true; });
        googleNote('Connecting to Google…');
        try {
            var result = await client.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: new URL('index.html', location.href).href }
            });
            if (result.error) throw result.error;
        } catch (error) {
            googleNote(errorText(error));
            document.querySelectorAll('.google-fallback, #google-login').forEach(function (node) { node.disabled = false; });
            googleBusy = false;
        }
    });
    if (!client) {
        ['login-form', 'register-form', 'forgot-form'].forEach(function (id) {
            var form = $(id); if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });
        });
    } else {
        client.auth.onAuthStateChange(function (event, session) {
            if (event === 'PASSWORD_RECOVERY') {
                recovery = true;
                $('forgot-form').hidden = true;
                $('reset-form').hidden = false;
                $('reset-email').textContent = session && session.user && session.user.email || 'your account';
                show('forgot');
            }
        });
    }
    var start = location.hash.slice(1);
    show(start === 'register' || start === 'forgot' ? start : 'login', false);
})();
