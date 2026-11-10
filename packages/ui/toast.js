/* packages/ui/toast.js - behaviour of the toast (decision 0049). No framework: the same file runs in the shop
   (static pages) and in the admin (React app). The markup comes from components.js (ToastRegion renders the live
   region, an empty slot and a <template> of the Toast), so this file only clones, fills and removes. ASCII only.

   ZanzaToast.show({ message, actionLabel, onAction, actionElsewhere, returnFocus }) -> { dismiss }
     - one toast at a time: a new one replaces the current one (no queue)
     - the message is announced by the live region (role=status, polite); focus never moves to the toast (0043)
     - without an action: gone after 6 s, paused while the pointer is over it, focus is inside it, or the tab is
       hidden. With an action only the toast offers (Undo): no timeout (WCAG 2.2.1); it stays until dismissed,
       replaced or acted on. `actionElsewhere: true` (the same action is on the page, e.g. View bag): 6 s as above
     - the action runs onAction and closes the toast; the caller usually shows "Undone." next
     - Esc (focus inside) and the dismiss button close it; if focus was inside, it goes back to `returnFocus` when
       that element is still on the page
   ZanzaToast.dismiss() closes the current one. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZanzaToast = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TIMEOUT = 6000;   // decision 0049 (no motion / duration tokens yet)
  var current = null;

  function region() { return document.querySelector('[data-toast-region]'); }

  function announce(r, text) {
    var live = r.querySelector('[data-toast-announcer]');
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 50);   // a changed text is read again
  }

  function blueprint(r) {
    var tpl = r.querySelector('[data-toast-template]');
    if (!tpl) return null;
    // static HTML: the toast is in template.content; rendered on the client by React it is a plain child
    var src = (tpl.content && tpl.content.firstElementChild) || tpl.firstElementChild;
    return src ? src.cloneNode(true) : null;
  }

  function close(t, restoreFocus) {
    if (!t || t.closed) return;
    t.closed = true;
    window.clearTimeout(t.timer);
    document.removeEventListener('visibilitychange', t.onVisibility);
    var hadFocus = t.node.contains(document.activeElement);
    if (t.node.parentNode) t.node.parentNode.removeChild(t.node);
    if (current === t) current = null;
    if (hadFocus && restoreFocus !== false && t.returnFocus && document.contains(t.returnFocus)) t.returnFocus.focus();
  }

  function show(opts) {
    opts = opts || {};
    var r = region();
    if (!r) return { dismiss: function () {} };
    var node = blueprint(r);
    var slot = r.querySelector('[data-toast-slot]') || r;
    if (!node) return { dismiss: function () {} };

    var focusWasInside = current && current.node.contains(document.activeElement);
    if (current) close(current, false);

    var t = { node: node, closed: false, timer: 0, left: TIMEOUT, started: 0, hover: false, focus: false,
              returnFocus: opts.returnFocus || null };
    current = t;

    node.querySelector('[data-toast-message]').textContent = opts.message || '';
    var action = node.querySelector('[data-toast-action]');
    var hasAction = !!opts.actionLabel;
    // an action that also exists on the page (View bag = the header Bag) loses nothing when the toast goes: it times
    // out like a text-only toast. An action only the toast offers (Undo) keeps it open (WCAG 2.2.1, decision 0050)
    var keep = hasAction && !opts.actionElsewhere;
    if (action) {
      if (!hasAction) action.parentNode.removeChild(action);
      else {
        var label = action.querySelector('.zz-button__label') || action;
        label.textContent = opts.actionLabel;
        action.addEventListener('click', function () {
          close(t, false);
          if (opts.onAction) opts.onAction();
          // the button is gone: keep focus in the toast area (the "Undone." toast) or send it back
          if (document.activeElement && document.activeElement !== document.body) return;
          var next = current && current.node.querySelector('[data-toast-action], [data-toast-dismiss]');
          if (next) next.focus();
          else if (t.returnFocus && document.contains(t.returnFocus)) t.returnFocus.focus();
        });
      }
    }
    var dismiss = node.querySelector('[data-toast-dismiss]');
    if (dismiss) dismiss.addEventListener('click', function () { close(t); });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(t); }
    });

    // timeout only without an action; paused by hover, focus inside, hidden tab
    function run() {
      if (keep || t.closed || t.hover || t.focus || document.hidden) return;
      t.started = Date.now();
      t.timer = window.setTimeout(function () { close(t); }, t.left);
    }
    function pause() {
      if (keep || !t.started) return;
      window.clearTimeout(t.timer);
      t.left = Math.max(1000, t.left - (Date.now() - t.started));
      t.started = 0;
    }
    node.addEventListener('mouseenter', function () { pause(); t.hover = true; });
    node.addEventListener('mouseleave', function () { t.hover = false; run(); });
    node.addEventListener('focusin', function () { pause(); t.focus = true; });
    node.addEventListener('focusout', function (e) {
      if (node.contains(e.relatedTarget)) return;
      t.focus = false; run();
    });
    t.onVisibility = function () { if (document.hidden) pause(); else run(); };
    document.addEventListener('visibilitychange', t.onVisibility);

    slot.appendChild(node);
    announce(r, opts.message || '');
    // focus was on the replaced toast: keep it in the toast area instead of dropping it to the page
    if (focusWasInside) {
      var target = node.querySelector('[data-toast-action]') || dismiss;
      if (target) target.focus();
    }
    run();
    return { dismiss: function () { close(t); } };
  }

  return {
    show: show,
    dismiss: function () { if (current) close(current); }
  };
}));
