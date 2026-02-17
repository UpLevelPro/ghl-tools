<!-- GHL Auto-Open Phone Keypad by Eric Langley - UpLevelPro.com -->
<script>
(function() {
  'use strict';

  const CONFIG = {
    CALL_BOX_SELECTOR: '.call-box',
    CHEVRON_SELECTOR: '.call-actions > div:last-child',
    OBSERVER_TARGET: '#template-power-dialer',
    CLICK_DELAY: 300,
    DEBUG: true
  };

  let hasExpanded = false;  // guard: true once we've auto-clicked for this call
  let observer = null;

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[AutoOpen Keypad]', ...args);
  }

  // ---------------------------------------------------------------------------
  // Core: find the chevron on the collapsed call bar and click it
  // ---------------------------------------------------------------------------

  function expandCallBox() {
    const callBox = document.querySelector(CONFIG.CALL_BOX_SELECTOR);
    if (!callBox) {
      log('No call box found');
      return;
    }

    const chevron = document.querySelector(CONFIG.CHEVRON_SELECTOR);
    if (!chevron) {
      log('No chevron found inside call-actions');
      return;
    }

    log('Expanding call box...');
    hasExpanded = true;
    chevron.click();
    log('Chevron clicked — dialer panel should be open');
  }

  // ---------------------------------------------------------------------------
  // Detection: watch for .call-box appearing in the DOM
  // ---------------------------------------------------------------------------

  function handleMutation() {
    const callBox = document.querySelector(CONFIG.CALL_BOX_SELECTOR);

    if (callBox && !hasExpanded) {
      log('Call box detected, expanding after ' + CONFIG.CLICK_DELAY + 'ms');
      setTimeout(expandCallBox, CONFIG.CLICK_DELAY);
    }

    if (!callBox && hasExpanded) {
      log('Call box removed — resetting for next call');
      hasExpanded = false;
    }
  }

  // ---------------------------------------------------------------------------
  // MutationObserver on the power dialer container
  // ---------------------------------------------------------------------------

  function startObserver() {
    const target = document.querySelector(CONFIG.OBSERVER_TARGET);
    if (!target) {
      log('Observer target not found: ' + CONFIG.OBSERVER_TARGET + ', retrying in 2s');
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
  // Store events: listen for phoneCall state changes (primary detection)
  // ---------------------------------------------------------------------------

  function setupStoreEvents() {
    if (typeof AppUtils === 'undefined' || !AppUtils.StoreEvents) {
      log('AppUtils.StoreEvents not available, using observer only');
      return;
    }

    try {
      AppUtils.StoreEvents.register(['phoneCall'], function(event) {
        log('phoneCall store event:', event);

        // When a call starts, the call-box will appear in the DOM
        // Give the DOM a moment to render, then check
        setTimeout(handleMutation, CONFIG.CLICK_DELAY);
      });
      log('Registered phoneCall store events');
    } catch (e) {
      log('Failed to register store events:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    log('Script loaded');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setupStoreEvents();
        startObserver();
      });
    } else {
      setupStoreEvents();
      startObserver();
    }
  }

  bootstrap();

})();
</script>
<!-- End - GHL Auto-Open Phone Keypad by Eric Langley - UpLevelPro.com -->
