<!-- GHL Auto-Open Phone Keypad v13 by Eric Langley - UpLevelPro.com -->
<script>
(function() {
  'use strict';

  // Guard against double-injection (GHL can re-inject Whitelabel Custom JS on
  // navigation; stacking observers/handlers is what made v12 misbehave).
  if (window.__ghlAutoOpenKeypadLoaded) return;
  window.__ghlAutoOpenKeypadLoaded = true;

  var SCRIPT_VERSION = 'v13.0';
  console.log('[AutoOpen Keypad] Version ' + SCRIPT_VERSION + ' loaded');

  // ---------------------------------------------------------------------------
  // CONFIG — selectors verified against GHL's Vue 3 DOM (2026-07-16)
  // ---------------------------------------------------------------------------
  //
  // The Vue 3 migration restructured the dialer. Verified facts:
  //  - The collapsed call bar is `.call-box`, and it ONLY exists during a live
  //    call. Inside it lives `.call-actions` with two `.cursor-pointer` icons:
  //      1) the red hang-up   (svg.text-error-500)
  //      2) the expand chevron (the other cursor-pointer)
  //  - `#template-power-dialer` is now just the persistent "Voice Calling"
  //    LAUNCHER icon in the header. Clicking it OPENS/STARTS a call. v12 clicked
  //    it as a fallback when the old chevron selector missed — that is what
  //    popped spurious "Call Results" windows. v13 never touches the launcher.
  //  - The `phoneCall` / `manualCallStatus` StoreEvents never fire for call
  //    activity in this build, so v12's store subscription was dead weight and
  //    has been removed. Detection is pure DOM.
  //
  var CONFIG = {
    CALL_BOX:         '.call-box',                         // collapsed call bar (live call only)
    CALL_ACTIONS:     '.call-actions',                     // action-icon row inside .call-box
    HANGUP_SVG:       '.call-actions svg.text-error-500',  // red hang-up = proof of a genuine call
    ACTIVE_END_CALL:  '.dialer .hr-button--error-type',    // End Call button in the expanded panel
    END_CALL_CONTAINER: '.end-call-container',             // disposition / "Call Results" panel
    DONE_BUTTON:      'button.end-call-btn',               // the "Done" button on that panel
    // Disposition-enforcement (secondary feature) — verify if GHL changes the panel:
    REQUIRE_DISPO_KEY:  'ghl-require-disposition',
    DISPO_SELECTED_CLASS: 'bg-primary-50',
    DISPO_PILL_SELECTOR:  'div.cursor-pointer.rounded-md.border',
    MORE_DISPO_SELECTOR:  '.more-dispositions .hr-select',
    RESET_CONFIRM_MS: 1500,
    DEBUG: true
  };

  function log() {
    if (CONFIG.DEBUG) console.log.apply(console, ['[AutoOpen Keypad]'].concat([].slice.call(arguments)));
  }

  // ---------------------------------------------------------------------------
  // Detection helpers
  // ---------------------------------------------------------------------------

  // Returns the collapsed call bar ONLY when it represents a genuine live call
  // (i.e. it contains the red hang-up icon). This is the guard that prevents us
  // from ever acting on the idle launcher or a stale/phantom element.
  function getLiveCallBar() {
    var box = document.querySelector(CONFIG.CALL_BOX);
    if (!box) return null;
    if (!box.querySelector(CONFIG.HANGUP_SVG)) return null;
    return box;
  }

  // The expand chevron is the .cursor-pointer inside .call-actions that is NOT
  // the red hang-up. Returns null if not found — in which case we do NOTHING
  // (no dangerous fallback).
  function getExpandChevron(box) {
    var actions = box.querySelector(CONFIG.CALL_ACTIONS);
    if (!actions) return null;
    var items = actions.querySelectorAll(':scope > div.cursor-pointer');
    for (var i = 0; i < items.length; i++) {
      if (!items[i].querySelector('svg.text-error-500')) return items[i];
    }
    return null;
  }

  // Is a call currently in progress in ANY form (collapsed bar, expanded panel,
  // or the post-call disposition panel)? Used to know when to reset.
  function isCallInProgress() {
    return !!getLiveCallBar()
        || !!document.querySelector(CONFIG.ACTIVE_END_CALL)
        || !!document.querySelector(CONFIG.END_CALL_CONTAINER);
  }

  function clickEl(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  // ---------------------------------------------------------------------------
  // Core: auto-expand the collapsed keypad exactly once per call
  // ---------------------------------------------------------------------------

  var expandedThisCall = false;
  var resetTimer = null;

  function evaluate() {
    var bar = getLiveCallBar();

    // 1) Fresh live call, collapsed, not yet expanded -> expand via the chevron.
    if (bar && !expandedThisCall) {
      var chevron = getExpandChevron(bar);
      if (chevron) {
        expandedThisCall = true;               // set BEFORE click so re-fires don't double-click
        log('Live call bar detected — expanding via chevron');
        clickEl(chevron);
      } else {
        log('Live call bar detected but no chevron found — leaving as-is (no fallback)');
      }
      return;
    }

    // 2) User expanded manually (bar gone, End Call visible in the panel).
    //    Mark as handled so we honor a later manual minimize without re-opening.
    if (!bar && !expandedThisCall && document.querySelector(CONFIG.ACTIVE_END_CALL)) {
      expandedThisCall = true;
      return;
    }

    // 3) Reset only when the call is FULLY over (bar + panel + disposition all
    //    gone) for RESET_CONFIRM_MS. This preserves v1.2 behavior: minimizing
    //    the keypad mid-call must NOT trigger a re-open.
    if (expandedThisCall) {
      if (!isCallInProgress()) {
        if (!resetTimer) {
          resetTimer = setTimeout(function () {
            resetTimer = null;
            if (!isCallInProgress()) {
              expandedThisCall = false;
              log('Call ended — reset for next call');
            }
          }, CONFIG.RESET_CONFIRM_MS);
        }
      } else if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Disposition requirement (optional): block "Done" until a disposition is set
  // ---------------------------------------------------------------------------

  function isDispoRequired() {
    return localStorage.getItem(CONFIG.REQUIRE_DISPO_KEY) === 'true';
  }
  function setDispoRequired(val) {
    localStorage.setItem(CONFIG.REQUIRE_DISPO_KEY, val ? 'true' : 'false');
  }
  function isDispositionSelected() {
    var container = document.querySelector(CONFIG.END_CALL_CONTAINER);
    if (!container) return false;
    var pills = container.querySelectorAll(CONFIG.DISPO_PILL_SELECTOR);
    for (var i = 0; i < pills.length; i++) {
      if (pills[i].classList.contains(CONFIG.DISPO_SELECTED_CLASS)) return true;
    }
    var dropdown = container.querySelector(CONFIG.MORE_DISPO_SELECTOR);
    if (dropdown) {
      var selected = dropdown.querySelector('.hr-base-selection');
      if (selected && selected.textContent.trim() !== 'More Dispositions') return true;
    }
    return false;
  }
  function updateDoneButtonState() {
    var btn = document.querySelector(CONFIG.DONE_BUTTON);
    if (!btn) return;
    if (isDispoRequired() && !isDispositionSelected()) {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
      btn.title = 'Select a disposition before clicking Done';
    } else {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
      btn.title = '';
    }
  }
  function injectVersionBadge(container) {
    if (!container || container.querySelector('#ghl-autoopen-version')) return;
    var badge = document.createElement('div');
    badge.id = 'ghl-autoopen-version';
    badge.textContent = 'AutoOpen ' + SCRIPT_VERSION;
    badge.style.cssText = 'position:absolute;top:4px;right:8px;font-size:10px;' +
      'color:#9ca3af;font-family:monospace;pointer-events:none;z-index:1;';
    container.style.position = container.style.position || 'relative';
    container.appendChild(badge);
  }
  function injectDispoCheckbox(container) {
    if (!container || container.querySelector('#ghl-require-dispo-toggle')) return;
    var doneBtn = container.querySelector(CONFIG.DONE_BUTTON);
    if (!doneBtn) return;
    var btnWrapper = doneBtn.closest('.call-btn-container');
    if (!btnWrapper) return;

    injectVersionBadge(container);

    var wrapper = document.createElement('label');
    wrapper.id = 'ghl-require-dispo-toggle';
    wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;' +
      'font-size:13px;color:#475467;padding:0 16px;margin-bottom:4px;user-select:none;';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isDispoRequired();
    cb.style.cssText = 'cursor:pointer;width:15px;height:15px;accent-color:#4f46e5;';
    cb.addEventListener('change', function () {
      setDispoRequired(cb.checked);
      updateDoneButtonState();
      log('Require disposition toggled:', cb.checked);
    });
    wrapper.appendChild(cb);
    wrapper.appendChild(document.createTextNode('Require disposition before Done'));
    btnWrapper.parentNode.insertBefore(wrapper, btnWrapper);
    log('Disposition checkbox injected');
    updateDoneButtonState();
  }

  // ---------------------------------------------------------------------------
  // Click-outside guard: keep GHL from closing the dialer when the rep clicks
  // elsewhere DURING an active call. Strictly gated on a genuine active call.
  // ---------------------------------------------------------------------------

  function hasActiveCallPanel() {
    return !!document.querySelector(CONFIG.ACTIVE_END_CALL);
  }
  function isInsideDialer(target) {
    var panel = document.querySelector('.dialer');
    var box = document.querySelector(CONFIG.CALL_BOX);
    return (panel && panel.contains(target)) || (box && box.contains(target));
  }
  function setupClickOutsideBlocker() {
    var skipNext = false;
    ['pointerdown', 'focusin'].forEach(function (evtType) {
      window.addEventListener(evtType, function (e) {
        if (skipNext) { skipNext = false; return; }
        if (!hasActiveCallPanel()) return;
        if (isInsideDialer(e.target)) return;
        e.stopImmediatePropagation();
        if (evtType === 'pointerdown') {
          var target = e.target;
          setTimeout(function () { skipNext = true; target.click(); }, 10);
        }
      }, true);
    });
    log('Click-outside blocker installed');
  }

  // ---------------------------------------------------------------------------
  // Observation: one debounced MutationObserver on <body> + a light periodic
  // sweep for the disposition panel. Cheap handlers (a few querySelectors).
  // ---------------------------------------------------------------------------

  function startObserver() {
    var debounce = null;
    var observer = new MutationObserver(function () {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(evaluate, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    log('Observer started on <body>');
  }

  function startDispoEnforcement() {
    setInterval(function () {
      var container = document.querySelector(CONFIG.END_CALL_CONTAINER);
      if (container) {
        injectDispoCheckbox(container);
        updateDoneButtonState();
      }
    }, 300);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    log('Loaded — Vue 3 auto-expand + click-outside protection + disposition enforcement');
    setupClickOutsideBlocker();
    startObserver();
    startDispoEnforcement();
    evaluate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
</script>
<!-- End - GHL Auto-Open Phone Keypad v13 by Eric Langley - UpLevelPro.com -->
