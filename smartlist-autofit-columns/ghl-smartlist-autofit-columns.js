<!-- GHL Smart List Column Auto-Fit by Eric Langley - UpLevelPro.com -->
<script>
(function() {
  'use strict';

  const CONFIG = {
    SMART_LIST_PATTERN: /\/v2\/location\/[^/]+\/contacts\/smart_list\//,
    POLL_INTERVAL: 300,
    POLL_TIMEOUT: 8000,
    MIN_WIDTH: 100,
    MAX_WIDTH: 400,
    HEADER_PADDING: 60,  // extra px for sort icon + breathing room
    CELL_PADDING: 30,
    SAMPLE_ROWS: 15,
    DEBOUNCE_MS: 300,    // debounce for MutationObserver (was 100)
    RETRY_DELAY: 250,    // ms between retry checks after applying widths
    MAX_RETRIES: 3,      // max times to re-apply if Tabulator overwrites
    STABILITY_CHECKS: 2, // consecutive polls with same row count before table is "ready"
    DEBUG: true
  };

  let lastProcessedUrl = null;
  let columnWidths = {};       // field -> width in px (persists across re-renders)
  let columnFingerprint = '';  // ordered field list to detect column structure changes
  let tableObserver = null;    // MutationObserver for row/column changes
  let storeSubscriptionId = null; // StoreEvents subscription ID

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[SmartList AutoFit]', ...args);
  }

  // ---------------------------------------------------------------------------
  // URL helpers
  // ---------------------------------------------------------------------------

  function isSmartListPage(url) {
    return CONFIG.SMART_LIST_PATTERN.test(url || window.location.pathname);
  }

  // ---------------------------------------------------------------------------
  // Text measurement
  // ---------------------------------------------------------------------------

  function measureText(text, font) {
    var span = document.createElement('span');
    span.style.cssText = 'visibility:hidden;position:absolute;white-space:nowrap;';
    span.style.font = font;
    span.textContent = text;
    document.body.appendChild(span);
    var w = span.offsetWidth;
    document.body.removeChild(span);
    return w;
  }

  // ---------------------------------------------------------------------------
  // Core: auto-fit all columns
  // ---------------------------------------------------------------------------

  function autoFitColumns() {
    var headers = document.querySelectorAll('.tabulator-col[tabulator-field]');
    if (!headers.length) return false;

    var count = 0;

    headers.forEach(function(col) {
      var field = col.getAttribute('tabulator-field');
      var titleEl = col.querySelector('.tabulator-col-title');
      if (!titleEl) return;

      var headerText = titleEl.textContent.trim();
      var headerFont = window.getComputedStyle(titleEl).font;
      var headerWidth = measureText(headerText, headerFont) + CONFIG.HEADER_PADDING;

      // Measure widest visible cell content
      var cells = document.querySelectorAll('.tabulator-cell[tabulator-field="' + field + '"]');
      var maxCellWidth = 0;
      var cellFont = cells.length ? window.getComputedStyle(cells[0]).font : headerFont;

      for (var i = 0; i < Math.min(cells.length, CONFIG.SAMPLE_ROWS); i++) {
        var text = cells[i].textContent.trim();
        if (text) {
          var w = measureText(text, cellFont) + CONFIG.CELL_PADDING;
          if (w > maxCellWidth) maxCellWidth = w;
        }
      }

      var newWidth = Math.min(CONFIG.MAX_WIDTH, Math.max(CONFIG.MIN_WIDTH, headerWidth, maxCellWidth));
      var widthPx = newWidth + 'px';

      columnWidths[field] = newWidth;
      col.style.width = widthPx;
      cells.forEach(function(c) { c.style.width = widthPx; });
      count++;
    });

    columnFingerprint = getCurrentFingerprint();
    log('Auto-fit applied to', count, 'columns');
    startTableObserver();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Column fingerprint: detect when columns are added, removed, or reordered
  // ---------------------------------------------------------------------------

  function getCurrentFingerprint() {
    var fields = [];
    document.querySelectorAll('.tabulator-col[tabulator-field]').forEach(function(col) {
      fields.push(col.getAttribute('tabulator-field'));
    });
    return fields.join(',');
  }

  // ---------------------------------------------------------------------------
  // Re-apply stored widths to new cells (after sort/filter/paginate)
  // ---------------------------------------------------------------------------

  function applyStoredWidths() {
    var applied = 0;
    Object.keys(columnWidths).forEach(function(field) {
      var widthPx = columnWidths[field] + 'px';
      var header = document.querySelector('.tabulator-col[tabulator-field="' + field + '"]');
      if (header && header.style.width !== widthPx) {
        header.style.width = widthPx;
        applied++;
      }
      var cells = document.querySelectorAll('.tabulator-cell[tabulator-field="' + field + '"]');
      cells.forEach(function(c) {
        if (c.style.width !== widthPx) {
          c.style.width = widthPx;
          applied++;
        }
      });
    });
    if (applied > 0) log('Re-applied widths to', applied, 'elements');
    return applied;
  }

  // ---------------------------------------------------------------------------
  // Check if Tabulator has overwritten our stored widths
  // ---------------------------------------------------------------------------

  function widthsWereOverwritten() {
    var fields = Object.keys(columnWidths);
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var widthPx = columnWidths[field] + 'px';
      var header = document.querySelector('.tabulator-col[tabulator-field="' + field + '"]');
      if (header && header.style.width !== widthPx) return true;
      var cell = document.querySelector('.tabulator-cell[tabulator-field="' + field + '"]');
      if (cell && cell.style.width !== widthPx) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Apply widths with RAF + retry to survive Tabulator's async re-render
  // ---------------------------------------------------------------------------

  function applyWidthsWithRetry(retriesLeft) {
    if (typeof retriesLeft === 'undefined') retriesLeft = CONFIG.MAX_RETRIES;

    requestAnimationFrame(function() {
      applyStoredWidths();

      if (retriesLeft > 0) {
        setTimeout(function() {
          if (widthsWereOverwritten()) {
            log('Widths were overwritten, retrying... (' + retriesLeft + ' left)');
            applyWidthsWithRetry(retriesLeft - 1);
          }
        }, CONFIG.RETRY_DELAY);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Auto-fit with RAF + retry (for full re-measure after structure changes)
  // ---------------------------------------------------------------------------

  function autoFitWithRetry(retriesLeft) {
    if (typeof retriesLeft === 'undefined') retriesLeft = CONFIG.MAX_RETRIES;

    requestAnimationFrame(function() {
      autoFitColumns();

      if (retriesLeft > 0) {
        setTimeout(function() {
          if (widthsWereOverwritten()) {
            log('Widths overwritten after auto-fit, retrying... (' + retriesLeft + ' left)');
            autoFitWithRetry(retriesLeft - 1);
          }
        }, CONFIG.RETRY_DELAY);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // MutationObserver: watch #table-container for ANY table changes
  // ---------------------------------------------------------------------------

  function startTableObserver() {
    if (tableObserver) return; // already watching

    var container = document.getElementById('table-container');
    if (!container) return;

    var debounceTimer = null;
    tableObserver = new MutationObserver(function() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        // Ensure table still exists (may be mid-rebuild)
        var headers = document.querySelectorAll('.tabulator-col[tabulator-field]');
        var rows = document.querySelectorAll('.tabulator-row');
        if (!headers.length || !rows.length) return;

        var currentFP = getCurrentFingerprint();
        if (currentFP !== columnFingerprint) {
          log('Column structure changed, re-fitting...');
          columnWidths = {};
          autoFitWithRetry();
        } else {
          applyWidthsWithRetry();
        }
      }, CONFIG.DEBOUNCE_MS);
    });

    tableObserver.observe(container, { childList: true, subtree: true });
    log('Table observer started on #table-container');
  }

  function stopTableObserver() {
    if (tableObserver) {
      tableObserver.disconnect();
      tableObserver = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Poll until table renders with stability check, then auto-fit
  // ---------------------------------------------------------------------------

  function waitAndAutoFit() {
    var elapsed = 0;
    var stableCount = 0;
    var lastRowCount = -1;

    var timer = setInterval(function() {
      elapsed += CONFIG.POLL_INTERVAL;

      var headers = document.querySelectorAll('.tabulator-col[tabulator-field]');
      var rows = document.querySelectorAll('.tabulator-row');

      if (headers.length > 0 && rows.length > 0) {
        // Check that at least some cells have actual content (not just placeholders)
        var cells = document.querySelectorAll('.tabulator-cell');
        var hasContent = false;
        for (var i = 0; i < Math.min(cells.length, 10); i++) {
          if (cells[i].textContent.trim()) { hasContent = true; break; }
        }

        if (hasContent) {
          // Stability check: row count must match across consecutive polls
          if (rows.length === lastRowCount) {
            stableCount++;
          } else {
            stableCount = 1;
            lastRowCount = rows.length;
          }

          if (stableCount >= CONFIG.STABILITY_CHECKS) {
            clearInterval(timer);
            log('Table stable (' + headers.length + ' cols, ' + rows.length + ' rows) after ' + elapsed + 'ms');
            autoFitWithRetry();
            return;
          }
        }
      }

      if (elapsed >= CONFIG.POLL_TIMEOUT) {
        clearInterval(timer);
        // Last-ditch attempt: if table exists but stability wasn't reached, try anyway
        if (headers && headers.length > 0 && rows && rows.length > 0) {
          log('Stability timeout, attempting auto-fit anyway...');
          autoFitWithRetry();
        } else {
          log('Timeout waiting for table to render');
        }
      }
    }, CONFIG.POLL_INTERVAL);
  }

  // ---------------------------------------------------------------------------
  // Entry point: check URL and run if on a Smart List page
  // ---------------------------------------------------------------------------

  function onNavigate() {
    var url = window.location.href;

    if (!isSmartListPage()) {
      return;
    }

    if (url === lastProcessedUrl) {
      return;
    }

    lastProcessedUrl = url;
    columnWidths = {};
    stopTableObserver();
    log('Smart List detected, waiting for table...');
    waitAndAutoFit();
  }

  // ---------------------------------------------------------------------------
  // SPA navigation hooks (primary: GHL events, fallback: history monkey-patch)
  // ---------------------------------------------------------------------------

  function setupNavigationWatcher() {
    // Primary: GHL Custom JS route events (available in whitelabel & marketplace)
    try {
      window.addEventListener('routeLoaded', function() {
        log('routeLoaded event fired');
        setTimeout(onNavigate, 150);
      });
      window.addEventListener('routeChangeEvent', function() {
        log('routeChangeEvent fired');
        setTimeout(onNavigate, 150);
      });
      log('GHL route event listeners registered');
    } catch (e) {
      log('GHL route events not available:', e.message);
    }

    // Fallback: pushState / replaceState monkey-patch
    var origPush = history.pushState;
    history.pushState = function() {
      origPush.apply(this, arguments);
      setTimeout(onNavigate, 150);
    };

    var origReplace = history.replaceState;
    history.replaceState = function() {
      origReplace.apply(this, arguments);
      setTimeout(onNavigate, 150);
    };

    // Fallback: back/forward
    window.addEventListener('popstate', function() {
      setTimeout(onNavigate, 150);
    });
  }

  // ---------------------------------------------------------------------------
  // Progressive enhancement: Vue3 Store Events (if AppUtils is available)
  // ---------------------------------------------------------------------------

  function tryRegisterStoreEvents() {
    try {
      if (!window.AppUtils || !window.AppUtils.StoreEvents || !window.AppUtils.StoreEvents.register) {
        log('AppUtils.StoreEvents not available (expected in whitelabel context)');
        return;
      }

      // Subscribe to store modules that may trigger Smart List re-renders
      storeSubscriptionId = window.AppUtils.StoreEvents.register(
        ['customObjectsStore', 'locationCustomFields'],
        function(payload) {
          if (!isSmartListPage()) return;
          if (!Object.keys(columnWidths).length) return; // not yet initialized

          log('Store mutation detected:', payload.module, payload.mutation && payload.mutation.type);
          applyWidthsWithRetry();
        }
      );
      log('StoreEvents subscription registered (id: ' + storeSubscriptionId + ')');
    } catch (e) {
      log('StoreEvents registration failed (non-critical):', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    log('Script loaded (v2.0)');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setupNavigationWatcher();
        tryRegisterStoreEvents();
        onNavigate();
      });
    } else {
      setupNavigationWatcher();
      tryRegisterStoreEvents();
      onNavigate();
    }
  }

  bootstrap();

})();
</script>
<!-- End - GHL Smart List Column Auto-Fit by Eric Langley - UpLevelPro.com -->
