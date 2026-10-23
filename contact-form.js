/* contact-form.js
   Sends the contact form to Formspree (free tier, no backend needed).
   Setup:
   1. Go to formspree.io, create a form, and set the notification email to
      christianchurchghana@gmail.com.
   2. Paste your form's endpoint below (looks like https://formspree.io/f/abcdwxyz).
   3. Load this file at the bottom of contact.html, after the form:
         <script src="contact-form.js"></script>
   Expects these element ids (same as your existing script):
   contact-form, c-name, c-email, c-message,
   c-name-error, c-email-error, c-message-error, contact-status
*/
(function () {
    'use strict';

    var ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';   /* <-- change this */

    var form = document.getElementById('contact-form');
    if (!form) { return; }

    var nameEl = document.getElementById('c-name');
    var emailEl = document.getElementById('c-email');
    var messageEl = document.getElementById('c-message');
    var statusEl = document.getElementById('contact-status');
    var btn = form.querySelector('.form-button') || form.querySelector('button[type="submit"]');
    var emailRe = /^\S+@\S+\.\S+$/;

    /* Honeypot: bots fill hidden fields, people don't. */
    var trap = document.createElement('input');
    trap.type = 'text';
    trap.name = '_gotcha';
    trap.tabIndex = -1;
    trap.autocomplete = 'off';
    trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
    form.appendChild(trap);

    function setError(input, errId, text) {
        var out = document.getElementById(errId);
        if (out) { out.textContent = text; }
        input.classList.toggle('has-error', !!text);
        if (text) { input.setAttribute('aria-invalid', 'true'); }
        else { input.removeAttribute('aria-invalid'); }
    }

    function setLoading(on) {
        if (!btn) { return; }
        btn.classList.toggle('is-loading', on);
        btn.disabled = on;
    }

    function showStatus(kind, text) {
        if (!statusEl) { return; }
        statusEl.hidden = false;
        statusEl.className = 'alert alert-' + kind;
        statusEl.style.marginTop = '1rem';
        statusEl.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        statusEl.textContent = text;
    }

    function validate() {
        var ok = true;

        if (!nameEl.value.trim()) {
            setError(nameEl, 'c-name-error', 'Please enter your name.');
            ok = false;
        } else { setError(nameEl, 'c-name-error', ''); }

        if (!emailRe.test(emailEl.value.trim())) {
            setError(emailEl, 'c-email-error', 'Enter a valid email address.');
            ok = false;
        } else { setError(emailEl, 'c-email-error', ''); }

        if (messageEl.value.trim().length < 10) {
            setError(messageEl, 'c-message-error', 'Please write a little more (at least 10 characters).');
            ok = false;
        } else { setError(messageEl, 'c-message-error', ''); }

        return ok;
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (statusEl) { statusEl.hidden = true; }
        if (!validate()) { return; }

        /* Spam bot filled the hidden field: pretend success and stop. */
        if (trap.value) {
            showStatus('success', 'Thank you! Your message has been sent.');
            form.reset();
            return;
        }

        if (ENDPOINT.indexOf('YOUR_FORM_ID') !== -1) {
            showStatus('error', 'The contact form is not set up yet. Please email us at christianchurchghana@gmail.com.');
            return;
        }

        setLoading(true);

        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                name: nameEl.value.trim(),
                email: emailEl.value.trim(),
                message: messageEl.value.trim(),
                _subject: 'New message from the church website'
            })
        })
        .then(function (res) {
            if (!res.ok) { throw new Error('Request failed: ' + res.status); }
            showStatus('success', 'Thank you! Your message has been sent. We will get back to you soon.');
            form.reset();
        })
        .catch(function () {
            showStatus('error', 'Sorry, your message could not be sent. Please check your connection and try again, or email us at christianchurchghana@gmail.com.');
        })
        .then(function () { setLoading(false); });
    });
})();