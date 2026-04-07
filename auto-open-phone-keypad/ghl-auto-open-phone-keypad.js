<!-- GHL Auto-Open Phone Keypad v12 by Eric Langley - UpLevelPro.com -->
<script>
(function() {
  'use strict';

  var SCRIPT_VERSION = 'v12.7';
  console.log('[AutoOpen Keypad] Version ' + SCRIPT_VERSION + ' loaded');

  const CONFIG = {
    CALL_BOX_SELECTOR: '.call-box',
    VOICE_CALLING_SELECTOR: '#template-power-dialer button[aria-label="Voice Calling"]',
    CHEVRON_SELECTOR: '.call-actions > div:last-child',
    OBSERVER_TARGET: '#template-power-dialer',
    CLICK_DELAY: 300,
    DEBUG: true,
    REQUIRE_DISPO_KEY: 'ghl-require-disposition',
    DONE_BUTTON_SELECTOR: 'button.end-call-btn',
    END_CALL_CONTAINER: '.end-call-container',
    DISPO_SELECTED_CLASS: 'bg-primary-50',
    DISPO_PILL_SELECTOR: 'div.cursor-pointer.rounded-md.border',
    MORE_DISPO_SELECTOR: '.more-dispositions .hr-select'
  };

  let hasExpanded = false;
  let expandPending = false;
  let observer = null;
  let callEndTimer = null;

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[AutoOpen Keypad]', ...args);
  }

  // ---------------------------------------------------------------------------
  // Core: find the chevron on the collapsed call bar and click it
  // ---------------------------------------------------------------------------

  function clickElement(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function expandCallBox() {
    expandPending = false;

    // Try old-style chevron first
    var chevron = document.querySelector(CONFIG.CHEVRON_SELECTOR);
    if (chevron) {
      log('Expanding via chevron...');
      hasExpanded = true;
      clickElement(chevron);
      log('Chevron clicked — dialer panel should be open');
      return;
    }

    // Fallback: new-style Voice Calling button
    var voiceBtn = document.querySelector(CONFIG.VOICE_CALLING_SELECTOR);
    if (voiceBtn) {
      log('Expanding via Voice Calling button...');
      hasExpanded = true;
      clickElement(voiceBtn);
      log('Voice Calling button clicked — dialer panel should be open');
      return;
    }

    log('No chevron or Voice Calling button found');
  }

  // ---------------------------------------------------------------------------
  // Detection
  // ---------------------------------------------------------------------------

  function isCallActive() {
    // Collapsed: .call-box visible
    if (document.querySelector(CONFIG.CALL_BOX_SELECTOR)) return true;
    // Expanded: End Call button visible means call is in progress
    var dialer = document.querySelector('.dialer');
    if (dialer && dialer.querySelector('.hr-button--error-type')) return true;
    return false;
  }

  function handleMutation() {
    var callDetected = !!document.querySelector(CONFIG.CALL_BOX_SELECTOR);

    if (callDetected && !hasExpanded && !expandPending) {
      if (callEndTimer) { clearTimeout(callEndTimer); callEndTimer = null; }
      expandPending = true;
      log('Call detected, expanding after ' + CONFIG.CLICK_DELAY + 'ms');
      setTimeout(expandCallBox, CONFIG.CLICK_DELAY);
      return;
    }

    if (hasExpanded) {
      if (!isCallActive() && !document.querySelector(CONFIG.END_CALL_CONTAINER)) {
        if (!callEndTimer) {
          log('Power dialer empty — confirming call ended...');
          callEndTimer = setTimeout(function() {
            callEndTimer = null;
            if (!isCallActive() && !document.querySelector(CONFIG.END_CALL_CONTAINER)) {
              log('Call confirmed ended — resetting for next call');
              hasExpanded = false;
            }
          }, 2000);
        }
      } else if (callEndTimer) {
        clearTimeout(callEndTimer);
        callEndTimer = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // MutationObserver — watches #template-power-dialer for call-box appearance
  // ---------------------------------------------------------------------------

  function startObserver() {
    const target = document.querySelector(CONFIG.OBSERVER_TARGET);
    if (!target) {
      log('Observer target not found, retrying in 2s');
      setTimeout(startObserver, 2000);
      return;
    }
    if (observer) return;

    let debounceTimer = null;
    observer = new MutationObserver(function() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(handleMutation, 50);
    });
    observer.observe(target, { childList: true, subtree: true });
    log('Observer started on ' + CONFIG.OBSERVER_TARGET);
  }

  // ---------------------------------------------------------------------------
  // Store events
  // ---------------------------------------------------------------------------

  function setupStoreEvents() {
    if (typeof AppUtils === 'undefined' || !AppUtils.StoreEvents) {
      log('AppUtils.StoreEvents not available, using observer only');
      return;
    }
    try {
      AppUtils.StoreEvents.register(['phoneCall'], function(event) {
        log('phoneCall store event:', event);
        setTimeout(handleMutation, CONFIG.CLICK_DELAY);
      });
      log('Registered phoneCall store events');
    } catch (e) {
      log('Failed to register store events:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Disposition Requirement
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
    var btn = document.querySelector(CONFIG.DONE_BUTTON_SELECTOR);
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
    var doneBtn = container.querySelector('button.end-call-btn');
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
    cb.addEventListener('change', function() {
      setDispoRequired(cb.checked);
      updateDoneButtonState();
      log('Require disposition toggled:', cb.checked);
    });
    var label = document.createTextNode('Require disposition before Done');
    wrapper.appendChild(cb);
    wrapper.appendChild(label);
    btnWrapper.parentNode.insertBefore(wrapper, btnWrapper);
    log('Disposition checkbox injected');
    updateDoneButtonState();
  }

  // ---------------------------------------------------------------------------
  // Periodic: inject checkbox + enforce Done button state
  // ---------------------------------------------------------------------------

  function startDispoEnforcement() {
    setInterval(function() {
      var container = document.querySelector(CONFIG.END_CALL_CONTAINER);
      if (container) {
        injectDispoCheckbox(container);
        updateDoneButtonState();
      }
      // Periodic reset check: if hasExpanded but no call indicators remain, reset
      if (hasExpanded && !isCallActive() && !document.querySelector(CONFIG.END_CALL_CONTAINER)) {
        log('Call ended (periodic check) — resetting for next call');
        hasExpanded = false;
        expandPending = false;
      }
    }, 300);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Click-outside prevention: block GHL's click-outside-to-close on the dialer
  // ---------------------------------------------------------------------------

  function hasActiveCallPanel() {
    // Only true when the .dialer panel is showing an active call (End Call button visible)
    var dialer = document.querySelector('.dialer');
    return !!dialer && !!dialer.querySelector('.hr-button--error-type');
  }

  function isInsideDialer(target) {
    var observer = document.querySelector(CONFIG.OBSERVER_TARGET);
    var panel = document.querySelector('.dialer');
    return (observer && observer.contains(target)) || (panel && panel.contains(target));
  }

  function setupClickOutsideBlocker() {
    var __skipNext = false;

    ['pointerdown', 'focusin'].forEach(function(evtType) {
      window.addEventListener(evtType, function(e) {
        if (__skipNext) { __skipNext = false; return; }
        if (!hasActiveCallPanel()) return;
        if (isInsideDialer(e.target)) return;

        e.stopImmediatePropagation();

        // Let the click still reach the target element via a deferred .click()
        if (evtType === 'pointerdown') {
          var target = e.target;
          setTimeout(function() {
            __skipNext = true;
            target.click();
          }, 10);
        }
      }, true);
    });
    log('Click-outside blocker installed');
  }

  function bootstrap() {
    log('Loaded — auto-expand + click-outside protection + disposition enforcement');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setupClickOutsideBlocker();
        setupStoreEvents();
        startObserver();
        startDispoEnforcement();
      });
    } else {
      setupClickOutsideBlocker();
      setupStoreEvents();
      startObserver();
      startDispoEnforcement();
    }
  }

  bootstrap();

})();
</script>
<!-- End - GHL Auto-Open Phone Keypad v12 by Eric Langley - UpLevelPro.com -->
