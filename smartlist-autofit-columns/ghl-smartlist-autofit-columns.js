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
    DEBUG: true
  };

  let lastProcessedUrl = null;
  let columnWidths = {};       // field -> width in px (persists across re-renders)
  let columnFingerprint = '';  // ordered field list to detect column structure changes
  let tableObserver = null;    // MutationObserver for row/column changes

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
          autoFitColumns();
        } else {
          applyStoredWidths();
        }
      }, 100);
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
  // Poll until table renders, then auto-fit
  // ---------------------------------------------------------------------------

  function waitAndAutoFit() {
    var elapsed = 0;

    var timer = setInterval(function() {
      elapsed += CONFIG.POLL_INTERVAL;

      var headers = document.querySelectorAll('.tabulator-col[tabulator-field]');
      var rows = document.querySelectorAll('.tabulator-row');

      if (headers.length > 0 && rows.length > 0) {
        clearInterval(timer);
        log('Table detected (' + headers.length + ' cols, ' + rows.length + ' rows) after ' + elapsed + 'ms');
        autoFitColumns();
        return;
      }

      if (elapsed >= CONFIG.POLL_TIMEOUT) {
        clearInterval(timer);
        log('Timeout waiting for table to render');
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
  // SPA navigation hooks
  // ---------------------------------------------------------------------------

  function setupNavigationWatcher() {
    // pushState
    var origPush = history.pushState;
    history.pushState = function() {
      origPush.apply(this, arguments);
      setTimeout(onNavigate, 150);
    };

    // replaceState
    var origReplace = history.replaceState;
    history.replaceState = function() {
      origReplace.apply(this, arguments);
      setTimeout(onNavigate, 150);
    };

    // back/forward
    window.addEventListener('popstate', function() {
      setTimeout(onNavigate, 150);
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    log('Script loaded');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setupNavigationWatcher();
        onNavigate();
      });
    } else {
      setupNavigationWatcher();
      onNavigate();
    }
  }

  bootstrap();

})();
</script>
<!-- End - GHL Smart List Column Auto-Fit by Eric Langley - UpLevelPro.com -->