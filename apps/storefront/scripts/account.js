/* apps/storefront/scripts/account.js - the customer account (decision 0101). ASCII only, no framework.

   - Session: Supabase Auth over plain fetch (no supabase-js): email -> 6-digit code (POST /auth/v1/otp, then
     /auth/v1/verify type=email). The session (access + refresh token) lives in localStorage ('zanza-session') and is
     refreshed when it is about to expire. A sign-in link in the email also works: it lands on /account/ with the
     tokens in the URL fragment.
   - The code request answers the same whether or not the email has orders: the Auth hook (migration 0022) refuses an
     email with no orders, and the page never says so, so nobody can test which emails bought here.
   - Orders: public.customer_orders() (migration 0022), matched by the confirmed email. The rows and lines are cloned
     from the <template>s of pages/account.js (packages/ui OrderRow, OrderItem, PlayerButton).
   - Pages: /account/ (orders), /account/order/?id=<order id>, /account/details/ (email, sign out, download my data,
     delete account). On every page the menu's Account detail shows the signed-in email.
   scripts/site.js calls ZanzaAccount.init() on load and after each soft navigation. */
(function () {
  'use strict';
  var KEY = 'zanza-session';
  var RESEND_AFTER = 60;   // seconds (Figma note: new code after 60 s; Supabase's own limit is the same)
  var STATUS = { paid: 'Paid, packing', shipped: 'Shipped', refunded: 'Refunded', cancelled: 'Cancelled' };
  var PACKING = 'I pack every record by hand and post orders at least once a week, usually on Wednesday. You get the tracking number by email when it ships.';   // = /checkout/thanks/
  var WRONG_CODE = 'This code is wrong or has expired. Try again or send a new one.';

  function config() {
    var u = document.querySelector('meta[name="zz-supabase-url"]');
    var k = document.querySelector('meta[name="zz-supabase-key"]');
    return u && k ? { url: u.content, key: k.content } : null;
  }
  function readSession() {
    try { var s = JSON.parse(window.localStorage.getItem(KEY) || 'null'); return s && s.access_token ? s : null; } catch (e) { return null; }
  }
  function writeSession(s) {
    try {
      if (s) window.localStorage.setItem(KEY, JSON.stringify(s)); else window.localStorage.removeItem(KEY);
    } catch (e) { /* private mode: signed in for this page only */ }
  }
  function sessionFrom(body) {
    var exp = body.expires_at || (Math.floor(Date.now() / 1000) + (body.expires_in || 3600));
    return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: exp,
      email: (body.user && body.user.email) || body.email || '' };
  }
  function call(path, opts) {
    var cfg = config();
    var headers = { apikey: cfg.key, 'Content-Type': 'application/json', Accept: 'application/json' };
    if (opts && opts.token) headers.Authorization = 'Bearer ' + opts.token;
    return fetch(cfg.url + path, { method: (opts && opts.method) || 'POST', headers: headers,
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (res) {
        return res.text().then(function (t) { var b = null; try { b = t ? JSON.parse(t) : null; } catch (e) { b = null; } return { status: res.status, ok: res.ok, body: b }; });
      });
  }
  // a valid session or null; refreshes a token that expires within a minute
  function getSession() {
    var s = readSession();
    if (!s) return Promise.resolve(null);
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s);
    return call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } }).then(function (r) {
      if (!r.ok || !r.body || !r.body.access_token) { writeSession(null); return null; }
      var n = sessionFrom(r.body); if (!n.email) n.email = s.email; writeSession(n); return n;
    }, function () { return s; });   // offline: keep it, the next call will tell
  }

  // ---------------------------------------------------------------- formatting (as pages/shell.js)
  function price(cents) { return (cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)) + '€'; }
  var dateFmt = null;
  function date(iso) {
    try { dateFmt = dateFmt || new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); return dateFmt.format(new Date(iso)); }
    catch (e) { return String(iso).slice(0, 10); }
  }
  var regionNames = null;
  function country(code) {
    try { regionNames = regionNames || new Intl.DisplayNames(['en'], { type: 'region' }); return regionNames.of(code) || code; } catch (e) { return code; }
  }
  function records(n) { return n + (n === 1 ? ' record' : ' records'); }
  function releaseInfo(s) {
    return [s.label, s.label && s.pre_release ? 'Pre' : null, s.format, s.country ? '(' + s.country + ')' : null].filter(Boolean).join(' ');
  }
  function grading(s) {
    var note = (s.condition_notes || '').trim(); note = note ? '(' + note + ')' : '';
    var record = 'Record: ' + [s.condition_media, s.condition_media_b].filter(Boolean).join(' / ');
    var cover = s.condition_sleeve && s.sleeve_type !== 'none' ? 'Cover: ' + s.condition_sleeve : null;
    if (!note) return [record, cover, null];
    if (!cover) return [record + ' ' + note, null, null];
    return [record, cover, note];
  }
  function addressLines(o) {
    var a = o.shipping_address || {};
    return [a.name || o.customer_name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.state,
      a.country ? country(a.country) : (o.shipping_country ? country(o.shipping_country) : null)].filter(Boolean);
  }

  // ---------------------------------------------------------------- page
  var page = null;
  function q(sel) { return page.root.querySelector(sel); }
  function setText(sel, text) { var el = q(sel); if (el) el.textContent = text; }
  function base() { return page.root.getAttribute('data-base-path') || ''; }
  function media(key) { var b = page.root.getAttribute('data-media-base') || ''; return key ? (/^https?:\/\//.test(key) ? key : b + '/' + key) : ''; }
  function message(text) {
    var m = q('[data-account-message]');
    if (!m) return;
    m.textContent = text || '';
    m.hidden = !text;
  }
  function clone(attr) { var t = q('template[' + attr + ']'); return t ? t.content.firstElementChild.cloneNode(true) : null; }

  function fieldError(input, text) {
    var field = input.closest('.zz-input') || input.parentNode;
    var id = input.id + '-support';
    var support = document.getElementById(id);
    if (text) {
      if (!support) {
        support = document.createElement('p');
        support.id = id; support.className = 'zz-input__support body-small';
        field.appendChild(support);
      }
      support.textContent = text;
      field.setAttribute('data-invalid', 'true');
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id);
    } else {
      if (support) support.parentNode.removeChild(support);
      field.removeAttribute('data-invalid');
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function showSignIn() {
    setText('[data-account-title]', 'Sign in');
    message('');
    q('[data-account-main]').hidden = true;
    var box = q('[data-account-signin]');
    box.hidden = false;
    var emailForm = q('[data-account-email-form]'), codeForm = q('[data-account-code-form]');
    var emailInput = q('[data-account-email-input]'), codeInput = q('[data-account-code-input]');
    var sentAt = 0, busy = false;
    function showStep(step) {
      emailForm.hidden = step !== 'email'; codeForm.hidden = step !== 'code';
      (step === 'email' ? emailInput : codeInput).focus();
    }
    function send(email) {
      busy = true;
      // redirect_to: the link in the email lands back on /account/ (without it Auth uses the Site URL = the admin)
      var back = location.origin + base() + '/account/';
      return call('/auth/v1/otp?redirect_to=' + encodeURIComponent(back), { body: { email: email, create_user: true } }).then(function (r) {
        busy = false;
        // 403 = the Auth hook: no orders for this email. Same answer as a sent code (see the header comment)
        if (r.status === 429) return 'Too many codes asked. Wait a minute and try again.';
        if (!r.ok && r.status !== 403 && r.status !== 422) return 'The code could not be sent. Try again in a moment.';
        sentAt = Date.now();
        return null;
      }, function () { busy = false; return 'No connection. Check it and try again.'; });
    }
    emailForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var email = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError(emailInput, 'Enter your email address, like you@example.com.'); emailInput.focus(); return; }
      fieldError(emailInput, null);
      send(email).then(function (err) {
        if (err) { fieldError(emailInput, err); emailInput.focus(); return; }
        setText('[data-account-sent-to]', email);
        codeInput.value = '';
        fieldError(codeInput, null);
        showStep('code');
      });
    });
    codeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var code = codeInput.value.replace(/\D/g, '');
      if (code.length !== 6) { fieldError(codeInput, 'Enter the 6 digits from the email.'); codeInput.focus(); return; }
      busy = true;
      call('/auth/v1/verify', { body: { type: 'email', email: emailInput.value.trim(), token: code } }).then(function (r) {
        busy = false;
        if (!r.ok || !r.body || !r.body.access_token) { fieldError(codeInput, WRONG_CODE); codeInput.focus(); return; }
        var s = sessionFrom(r.body); writeSession(s);
        box.hidden = true;
        renderMenu(s);
        showMain(s);
      }, function () { busy = false; fieldError(codeInput, 'No connection. Check it and try again.'); });
    });
    q('[data-account-resend]').addEventListener('click', function () {
      if (busy) return;
      var wait = Math.ceil(RESEND_AFTER - (Date.now() - sentAt) / 1000);
      if (wait > 0) { fieldError(codeInput, 'You can ask for a new code in ' + wait + ' seconds.'); codeInput.focus(); return; }
      send(emailInput.value.trim()).then(function (err) {
        fieldError(codeInput, err);
        if (!err && window.ZanzaToast) window.ZanzaToast.show({ message: 'New code sent.' });
        codeInput.focus();
      });
    });
    q('[data-account-change-email]').addEventListener('click', function () { showStep('email'); });
  }

  function showMain(s) {
    message('Loading your orders…');
    call('/rest/v1/rpc/customer_orders', { token: s.access_token, body: {} }).then(function (r) {
      if (r.status === 401 || (r.ok && !r.body)) { writeSession(null); renderMenu(null); showSignIn(); return; }
      if (!r.ok) { message('Your orders could not be loaded. Try again in a moment.'); return; }
      message('');
      setText('[data-account-title]', 'Account');
      q('[data-account-main]').hidden = false;
      var view = page.view;
      if (view === 'orders') renderOrders(r.body);
      else if (view === 'order') renderOrder(r.body);
      else renderDetails(r.body, s);
    }, function () { message('No connection. Check it and try again.'); });
  }

  function cover(o) { var first = (o.items || [])[0]; return first && first.snapshot ? media(first.snapshot.cover_key) : ''; }
  function fillImage(holder, src) {
    var img = holder && holder.querySelector('img');
    if (!img) return;
    if (src) img.src = src; else img.parentNode.removeChild(img);
  }

  function renderOrders(data) {
    var list = q('[data-account-orders]');
    list.textContent = '';
    var orders = data.orders || [];
    q('[data-account-empty]').hidden = orders.length > 0;
    page.root.querySelectorAll('[data-account-email-text]').forEach(function (el) { el.textContent = data.email; });
    orders.forEach(function (o) {
      var li = clone('data-account-row-template');
      var a = li.querySelector('.zz-order-row');
      var n = (o.items || []).length;
      var status = STATUS[o.status] || o.status;
      a.href = base() + '/account/order/?id=' + encodeURIComponent(o.id);
      a.setAttribute('aria-label', 'Order ' + o.ref + ', ' + date(o.created_at) + ', ' + status.toLowerCase() + ', ' + price(o.total_cents));
      fillImage(a, cover(o));
      a.querySelector('.zz-order-row__title').textContent = 'Order ' + o.ref;
      a.querySelector('.zz-order-row__date').textContent = date(o.created_at);
      a.querySelector('.zz-order-row__count').textContent = records(n);
      a.querySelector('.zz-order-row__status').textContent = 'Status: ' + status;
      a.querySelector('.zz-order-row__total').textContent = price(o.total_cents);
      list.appendChild(li);
    });
  }

  function itemElement(it) {
    var s = it.snapshot || {};
    var li = clone('data-account-item-template');
    var art = li.querySelector('.zz-bag-item');
    var href = s.slug ? base() + '/products/' + s.slug + '/' : '';
    var name = s.name || 'Record';
    fillImage(art, media(s.cover_key));
    var heading = art.querySelector('.zz-bag-item__name');
    if (href) { var a = document.createElement('a'); a.className = 'zz-bag-item__link'; a.href = href; a.textContent = name; heading.textContent = ''; heading.appendChild(a); }
    else heading.textContent = name;
    var info = releaseInfo(s), rel = art.querySelector('.zz-bag-item__release');
    if (info) rel.textContent = info; else rel.parentNode.removeChild(rel);
    var g = grading(s);
    var lines = art.querySelectorAll('.zz-bag-item__description > p');
    for (var i = 0; i < lines.length; i++) { if (g[i]) lines[i].textContent = g[i]; else lines[i].parentNode.removeChild(lines[i]); }
    art.querySelector('.zz-bag-item__price').textContent = price(it.price_cents);
    var samples = art.querySelector('.zz-bag-item__samples');
    samples.textContent = '';
    (s.samples || []).forEach(function (smp, k) {
      var t = q('template[data-account-sample-template]');
      var btn = t.content.firstElementChild.cloneNode(true);
      var src = media(smp.audio_key);
      var label = btn.querySelector('.zz-player-button__label') || btn.lastChild;
      if (label) label.textContent = String(k + 1);
      btn.setAttribute('aria-label', name + ', sample ' + (k + 1) + ': ' + (smp.title || ''));
      if (src) btn.setAttribute('data-sample-src', src); else btn.disabled = true;
      btn.setAttribute('data-sample-title', smp.title || '');
      btn.setAttribute('data-product-name', name);
      if (s.cover_key) btn.setAttribute('data-product-image', media(s.cover_key));
      if (href) btn.setAttribute('data-product-href', href);
      btn.setAttribute('data-listing-id', it.listing_id);
      btn.setAttribute('data-listing-section', s.section || 'sale');
      btn.setAttribute('data-listing-status', 'sold');   // a bought copy: the player offers no Add to bag
      samples.appendChild(btn);
    });
    if (!samples.children.length) samples.parentNode.removeChild(samples);
    return li;
  }

  function renderOrder(data) {
    var id = new URLSearchParams(location.search).get('id');
    var o = (data.orders || []).filter(function (x) { return x.id === id; })[0];
    if (!o) {
      Array.prototype.forEach.call(q('[data-account-main]').children, function (el) { if (!el.classList.contains('account-nav')) el.hidden = true; });
      message('This order is not in your account. Your orders are listed under Orders.');
      return;
    }
    setText('[data-account-order-title]', 'Order ' + o.ref);
    setText('[data-account-order-date]', 'Placed on ' + date(o.created_at));
    var list = q('[data-account-items]');
    list.textContent = '';
    (o.items || []).forEach(function (it) { list.appendChild(itemElement(it)); });
    var status = STATUS[o.status] || o.status;
    setText('[data-account-status]', 'Status: ' + status);
    var detail = o.status === 'paid' ? PACKING
      : o.status === 'shipped' ? ['Sent' + (o.shipped_at ? ' on ' + date(o.shipped_at) : '') + '.', o.tracking_number ? 'Tracking number ' + o.tracking_number + '.' : null].filter(Boolean).join(' ')
      : o.status === 'refunded' ? 'This order was refunded to your payment method.'
      : o.status === 'cancelled' ? 'This order was cancelled.' : '';
    setText('[data-account-status-detail]', detail);
    var n = (o.items || []).length;
    var subtotal = o.subtotal_cents != null ? o.subtotal_cents : (o.items || []).reduce(function (t, it) { return t + it.price_cents; }, 0);
    setText('[data-account-label="subtotal"]', 'Subtotal (' + records(n) + ')');
    setText('[data-account-value="subtotal"]', price(subtotal));
    setText('[data-account-label="shipping"]', 'Shipping' + (o.shipping_country ? ' (' + country(o.shipping_country) + ')' : ''));
    setText('[data-account-value="shipping"]', price(o.shipping_cents));
    setText('[data-account-value="total"]', price(o.total_cents));
    var addr = q('[data-account-address]');
    addr.textContent = '';
    addressLines(o).forEach(function (line, i) { if (i) addr.appendChild(document.createElement('br')); addr.appendChild(document.createTextNode(line)); });
    document.title = 'Order ' + o.ref + document.title.replace(/^[^·]*/, ' ');
  }

  function renderDetails(data, s) {
    page.root.querySelectorAll('[data-account-email-text]').forEach(function (el) { el.textContent = data.email; });
    q('[data-account-sign-out]').addEventListener('click', function () {
      call('/auth/v1/logout?scope=local', { token: s.access_token }).catch(function () {});
      writeSession(null); renderMenu(null);
      if (window.ZanzaToast) window.ZanzaToast.show({ message: 'Signed out.' });
      showSignIn();
    });
    q('[data-account-download]').addEventListener('click', function () {
      var json = JSON.stringify({ email: data.email, exported_at: new Date().toISOString(), orders: data.orders }, null, 2);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = (page.root.getAttribute('data-shop-name') || 'shop') + '-my-data.json';
      document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    var dialog = document.querySelector('[data-account-delete-dialog]');
    var opener = q('[data-account-delete]');
    if (!dialog || !dialog.showModal) { opener.hidden = true; return; }
    var confirm = dialog.querySelector('.zz-dialog__actions .zz-button:not([data-dialog-cancel])');
    var cancel = dialog.querySelector('[data-dialog-cancel]');
    var deleting = false;
    function close() { if (dialog.open) dialog.close(); opener.focus(); }
    opener.addEventListener('click', function () { dialog.showModal(); cancel.focus(); });
    cancel.addEventListener('click', close);
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); if (!deleting) close(); });
    confirm.addEventListener('click', function () {
      if (deleting) return;
      deleting = true; confirm.setAttribute('aria-busy', 'true');
      getSession().then(function (cur) {
        return call('/rest/v1/rpc/delete_my_account', { token: (cur || s).access_token, body: {} });
      }).then(function (r) {
        deleting = false; confirm.removeAttribute('aria-busy');
        if (!r.ok) { dialog.close(); message('Your account could not be deleted. Write to us and we will do it.'); return; }
        dialog.close();
        writeSession(null); renderMenu(null);
        if (window.ZanzaToast) window.ZanzaToast.show({ message: 'Account deleted.' });
        showSignIn();
      }, function () { deleting = false; confirm.removeAttribute('aria-busy'); dialog.close(); message('No connection. Check it and try again.'); });
    });
  }

  // the menu's Account detail: the signed-in email, or the invitation to sign in
  function renderMenu(s) {
    document.querySelectorAll('[data-account-email]').forEach(function (el) {
      if (!el.hasAttribute('data-signed-out')) el.setAttribute('data-signed-out', el.textContent);
      el.textContent = s && s.email ? s.email : el.getAttribute('data-signed-out');
    });
  }

  // a sign-in link from the email: /account/#access_token=...&refresh_token=...&expires_in=...
  function sessionFromLink() {
    if (!/access_token=/.test(location.hash)) return null;
    var p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(history.state, '', location.pathname + location.search);
    if (!p.get('access_token')) return null;
    var payload = {};
    try { payload = JSON.parse(atob(p.get('access_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { payload = {}; }
    var s = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'),
      expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600), email: payload.email || '' };
    writeSession(s);
    return s;
  }

  function init() {
    var root = document.querySelector('[data-account-page]');
    page = root ? { root: root, view: root.getAttribute('data-account-page') } : null;
    if (!config()) {
      renderMenu(null);
      if (page) message('Accounts are not switched on in this copy of the shop.');
      return;
    }
    if (page) sessionFromLink();
    getSession().then(function (s) {
      renderMenu(s);
      if (!page) return;
      if (s) showMain(s); else showSignIn();
    });
  }

  window.ZanzaAccount = { init: init };
})();
