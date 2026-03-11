<!-- GHL Invoice Product Dropdown Width Fix v1.0.0 by Eric Langley - UpLevelPro.com
     https://github.com/UpLevelPro/ghl-tools/tree/main/invoice-product-dropdown-width -->
<script>
(function() {
  'use strict';

  const VERSION = '1.0.0';

  const CONFIG = {
    // Minimum width (px) for the product dropdown menu.
    // Increase if your product names are very long.
    MIN_WIDTH: 450,

    // Maximum width (px) so the dropdown doesn't grow unbounded.
    MAX_WIDTH: 700,

    // Only run on these location IDs. Set to [] to allow ALL locations.
    ALLOWED_LOCATION_IDS: [],

    DEBUG: true
  };

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[Invoice Product Dropdown]', ...args);
  }

  // ---------------------------------------------------------------------------
  // Location detection
  // ---------------------------------------------------------------------------

  function getLocationIdFromUrl() {
    var match = window.location.href.match(/\/v2\/location\/([^\/]+)\//);
    return match ? match[1] : null;
  }

  function isLocationAllowed() {
    if (!CONFIG.ALLOWED_LOCATION_IDS || CONFIG.ALLOWED_LOCATION_IDS.length === 0) return true;
    var locationId = getLocationIdFromUrl();
    return locationId ? CONFIG.ALLOWED_LOCATION_IDS.indexOf(locationId) !== -1 : false;
  }

  // ---------------------------------------------------------------------------
  // Page detection
  // ---------------------------------------------------------------------------

  function isInvoicePage() {
    return window.location.pathname.indexOf('/payments/invoices') !== -1;
  }

  // ---------------------------------------------------------------------------
  // Core: widen a product dropdown menu
  // ---------------------------------------------------------------------------

  function isProductMenu(menuEl) {
    var header = menuEl.querySelector('.create-product-btn');
    return !!header;
  }

  function widenMenu(menuEl) {
    // Widen the positioned follower container (has inline width/min-width)
    var follower = menuEl.closest('.v-binder-follower-content');
    if (follower) {
      follower.style.setProperty('width', 'auto', 'important');
      follower.style.setProperty('min-width', CONFIG.MIN_WIDTH + 'px', 'important');
      follower.style.setProperty('max-width', CONFIG.MAX_WIDTH + 'px', 'important');
    }

    // Widen the menu itself
    menuEl.style.setProperty('min-width', CONFIG.MIN_WIDTH + 'px', 'important');
    menuEl.style.setProperty('max-width', CONFIG.MAX_WIDTH + 'px', 'important');
    menuEl.style.setProperty('width', 'max-content', 'important');

    // Fix truncated option text
    menuEl.querySelectorAll('.n-base-select-option__content').forEach(function(opt) {
      opt.style.setProperty('overflow', 'visible', 'important');
      opt.style.setProperty('text-overflow', 'unset', 'important');
      opt.style.setProperty('white-space', 'nowrap', 'important');
    });

    log('Product dropdown widened');
  }

  // ---------------------------------------------------------------------------
  // MutationObserver: detect dropdown menus appearing in the DOM
  // ---------------------------------------------------------------------------

  var observer = null;

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver(function(mutations) {
      if (!isInvoicePage()) return;

      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;
        for (var j = 0; j < addedNodes.length; j++) {
          var node = addedNodes[j];
          if (node.nodeType !== 1) continue;

          // The dropdown menu is inside a v-binder-follower-content div
          var menu = node.querySelector
            ? node.querySelector('.n-base-select-menu')
            : null;
          if (!menu && node.classList && node.classList.contains('n-base-select-menu')) {
            menu = node;
          }

          if (menu && isProductMenu(menu)) {
            // Use rAF to ensure the menu is fully rendered before measuring
            requestAnimationFrame(function() { widenMenu(menu); });
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    log('Observer started');
  }

  // ---------------------------------------------------------------------------
  // SPA navigation hooks
  // ---------------------------------------------------------------------------

  function setupNavigationWatcher() {
    try {
      window.addEventListener('routeLoaded', function() {
        log('routeLoaded');
        if (isInvoicePage()) startObserver();
      });
      window.addEventListener('routeChangeEvent', function() {
        log('routeChangeEvent');
        if (isInvoicePage()) startObserver();
      });
      log('GHL route event listeners registered');
    } catch (e) {
      log('GHL route events not available:', e.message);
    }

    // Fallback: history monkey-patch
    var origPush = history.pushState;
    history.pushState = function() {
      origPush.apply(this, arguments);
      if (isInvoicePage()) startObserver();
    };

    var origReplace = history.replaceState;
    history.replaceState = function() {
      origReplace.apply(this, arguments);
      if (isInvoicePage()) startObserver();
    };

    window.addEventListener('popstate', function() {
      if (isInvoicePage()) startObserver();
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    log('Script loaded (v' + VERSION + ')');

    if (!isLocationAllowed()) {
      log('Location not in allowed list, script inactive');
      return;
    }

    setupNavigationWatcher();

    // Start observing immediately if already on an invoice page
    if (isInvoicePage()) {
      startObserver();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
</script>
<!-- End - GHL Invoice Product Dropdown Width Fix v1.0.0 by Eric Langley - UpLevelPro.com -->
