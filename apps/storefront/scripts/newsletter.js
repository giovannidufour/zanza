/* apps/storefront/scripts/newsletter.js — newsletter signup with our own double opt-in (decision 0103), the same file
   on the shop and on the coming-soon page. No framework, no dependencies.
   1. Signup: any FooterNewsletter form with data-newsletter-endpoint is posted as JSON to the Supabase function
      `newsletter` and answers in place ("check your inbox"), so the visitor stays on the page. If the function can't be
      reached or isn't set up, the form is sent to its own action (Buttondown's form, its old flow): nobody is lost.
      Delegated on document, so it keeps working after the shop's soft navigation swaps the page.
   2. Confirm: /newsletter/confirm/#<token> (the link in the email) posts the token to the same function. With
      data-auto="true" it confirms as the page opens (one click in total); otherwise it shows a Confirm button. */
(function () {
  'use strict';

  function show(el, text) { if (!el) return; el.textContent = text; el.hidden = false; }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('form[data-newsletter-endpoint]')) return;
    if (form.hasAttribute('data-newsletter-native')) return;   // the fallback: let the browser send it to Buttondown
    e.preventDefault();
    var email = form.querySelector('input[type="email"]');
    var trap = form.querySelector('input[name="website"]');
    var status = form.querySelector('[data-newsletter-status]');
    var row = form.querySelector('.hm-footer-newsletter__row');
    var button = form.querySelector('button[type="submit"]');
    if (!email || !email.value.trim() || !email.checkValidity()) {
      show(status, 'Enter a valid email address.');
      if (email) email.focus();
      return;
    }
    if (button) button.disabled = true;
    function native() {   // function missing or down: Buttondown's own form, as before
      if (trap) trap.value = '';
      form.setAttribute('data-newsletter-native', '');
      if (button) button.disabled = false;
      HTMLFormElement.prototype.submit.call(form);
    }
    fetch(form.getAttribute('data-newsletter-endpoint'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'subscribe', email: email.value.trim(), website: trap ? trap.value : '', source: location.pathname })
    }).then(function (res) {
      if (res.status === 422) {
        if (button) button.disabled = false;
        show(status, 'Enter a valid email address.');
        email.focus();
        return;
      }
      if (!res.ok) { native(); return; }
      // analytics (decision 0131): only where the shop loads it (not the coming-soon page); never the address
      if (window.HighmuzikAnalytics) window.HighmuzikAnalytics.track('newsletter_signup', { source: location.pathname });
      if (row) row.hidden = true;
      show(status, 'Almost done: we sent a link to ' + email.value.trim() + '. Click it to confirm.');
      status.focus();   // the button is gone: keep focus where the answer is
    }).catch(native);
  });

  function initConfirm() {
    var root = document.querySelector('[data-newsletter-confirm]');
    if (!root) return;
    var endpoint = root.getAttribute('data-endpoint');
    var token = location.hash.slice(1);
    var title = document.querySelector('[data-newsletter-title]');
    var button = root.querySelector('[data-newsletter-confirm-button]');
    function state(name, heading) {
      root.querySelectorAll('[data-state]').forEach(function (el) { el.hidden = el.getAttribute('data-state') !== name; });
      if (heading && title) { title.textContent = heading; title.setAttribute('tabindex', '-1'); title.focus(); }
    }
    if (!token || !endpoint) { state('expired', 'Link not valid'); return; }
    // the token is not needed in the address any more (and should not end up in bookmarks or shared screenshots)
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* old browser: keep it */ }
    function confirm() {
      state('pending');
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', token: token }) })
        .then(function (res) {
          if (res.ok) state('done', 'You’re subscribed');
          else if (res.status === 410) state('expired', 'Link expired');
          else state('error', 'Something went wrong');
        })
        .catch(function () { state('error', 'Something went wrong'); });
    }
    if (root.getAttribute('data-auto') === 'true') { confirm(); return; }
    state('ask');
    if (button) button.addEventListener('click', confirm);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initConfirm);
  else initConfirm();
})();
