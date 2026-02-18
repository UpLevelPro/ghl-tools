<!-- GHL Custom Payments Sidebar by Eric Langley - UpLevelPro.com -->
<script>
(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const CONFIG = {
    // Sections to hide from the Payments sidebar (by exact header text).
    // Common values: 'Subscriptions', 'Estimates', 'Invoices', 'Transactions'
    // Set to [] to hide nothing.
    HIDDEN_SECTIONS: ['Subscriptions', 'Estimates'],

    // Desired order of visible sections (by exact header text).
    // The injected "Recurring Invoices" link always appears first.
    // Sections listed here are reordered after it; unlisted sections keep
    // their native position.
    SECTION_ORDER: ['Invoices', 'Transactions'],

    // Show the "Recurring Invoices" link section at the top of the sidebar.
    // The link opens the Recurring Templates page filtered by the contact's
    // last name. Set to false to disable (useful if you only want to hide/
    // reorder native sections).
    SHOW_RECURRING_LINK: true,

    // Allowed Location IDs. Script only runs for these sub-accounts.
    // Set to [] to allow ALL locations in the agency.
    // Quotes are required around each ID, e.g. ['abc123', 'def456']
    ALLOWED_LOCATION_IDS: [],

    DEBUG: true
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let searchFillAttempts = 0;
  const MAX_SEARCH_FILL_ATTEMPTS = 20; // 20 x 250ms = 5 seconds

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[Custom Payments Sidebar]', ...args);
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

  function isContactDetailPage() {
    return window.location.href.indexOf('/contacts/detail/') !== -1;
  }

  function isRecurringTemplatesPage() {
    return window.location.href.indexOf('/payments/recurring-templates') !== -1;
  }

  // ---------------------------------------------------------------------------
  // Contact detail page: read contact last name
  // ---------------------------------------------------------------------------

  function getContactLastName() {
    var labels = document.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      var spans = labels[i].querySelectorAll('div, span');
      for (var j = 0; j < spans.length; j++) {
        if (spans[j].textContent.trim() === 'Last Name') {
          var form = labels[i].closest('form');
          var input = form ? form.querySelector('input') : null;
          if (input && input.value && input.value !== '--') {
            return input.value.trim();
          }
          return null;
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Contact detail page: CSS injection
  // ---------------------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById('ghl-cps-styles')) return;

    var style = document.createElement('style');
    style.id = 'ghl-cps-styles';
    style.textContent = [
      '.mt-3[data-cps-hidden="true"] { display: none !important; }',
      '#ghl-cps-recurring-section .ghl-cps-link {',
      '  display: flex; align-items: center; justify-content: center; gap: 6px;',
      '  padding: 10px 12px; color: #155EEF; font-size: 13px; font-weight: 500;',
      '  text-decoration: none; cursor: pointer; border-radius: 4px;',
      '  transition: background-color 0.15s;',
      '}',
      '#ghl-cps-recurring-section .ghl-cps-link:hover {',
      '  background-color: rgba(21, 94, 239, 0.06);',
      '}'
    ].join('\n');
    document.head.appendChild(style);
    log('Styles injected');
  }

  // ---------------------------------------------------------------------------
  // Contact detail page: find a sidebar section by header text
  // ---------------------------------------------------------------------------

  function findSectionByName(name) {
    var titles = document.querySelectorAll('p.text-black.hl-text-sm-medium');
    for (var i = 0; i < titles.length; i++) {
      if (titles[i].textContent.trim() === name) {
        return titles[i].closest('.mt-3') || titles[i].closest('.mt-3.mb-3');
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Contact detail page: hide configured sections
  // ---------------------------------------------------------------------------

  function hideUnusedSections() {
    if (!CONFIG.HIDDEN_SECTIONS.length) return;

    var titles = document.querySelectorAll('p.text-black.hl-text-sm-medium');
    for (var i = 0; i < titles.length; i++) {
      var text = titles[i].textContent.trim();
      if (CONFIG.HIDDEN_SECTIONS.indexOf(text) !== -1) {
        var section = titles[i].closest('.mt-3') || titles[i].closest('.mt-3.mb-3');
        if (section && !section.dataset.cpsHidden) {
          section.style.display = 'none';
          section.dataset.cpsHidden = 'true';
          log(text + ' section hidden');
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Contact detail page: reorder visible sections
  // ---------------------------------------------------------------------------

  function reorderSections() {
    var transactionsSection = findSectionByName('Transactions');
    if (!transactionsSection) return;
    var parent = transactionsSection.parentElement;
    if (!parent) return;

    var statsRow = parent.querySelector('.grid.grid-cols-2');
    if (!statsRow) return;

    // Our injected section goes right after the stats row
    var recurringSection = document.getElementById('ghl-cps-recurring-section');
    if (recurringSection) {
      parent.insertBefore(recurringSection, statsRow.nextElementSibling);
    }

    // Then reorder native sections per SECTION_ORDER
    var insertAfter = recurringSection || statsRow;
    for (var i = 0; i < CONFIG.SECTION_ORDER.length; i++) {
      var section = findSectionByName(CONFIG.SECTION_ORDER[i]);
      if (section && !section.dataset.cpsHidden) {
        parent.insertBefore(section, insertAfter.nextElementSibling);
        insertAfter = section;
      }
    }

    log('Sections reordered');
  }

  // ---------------------------------------------------------------------------
  // Contact detail page: create recurring invoices section
  // ---------------------------------------------------------------------------

  var EXTERNAL_LINK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true" class="h-4 w-4 text-gray-900"><path stroke-linecap="round" stroke-linejoin="round" d="M21 9V3m0 0h-6m6 0l-9 9m-2-9H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 00-1.311 1.311C3 5.28 3 6.12 3 7.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 001.311 1.311C5.28 21 6.12 21 7.8 21h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 001.311-1.311C21 18.72 21 17.88 21 16.2V14"></path></svg>';

  var LINK_ARROW_SVG = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>';

  function createRecurringSection() {
    var locationId = getLocationIdFromUrl();
    var lastName = getContactLastName();

    var linkHref = '/v2/location/' + locationId + '/payments/recurring-templates';
    if (lastName) {
      linkHref += '#search=' + encodeURIComponent(lastName);
    }

    var section = document.createElement('div');
    section.className = 'mt-3';
    section.id = 'ghl-cps-recurring-section';

    section.innerHTML =
      '<div class="table-container hide-border hide-cell-border hide-header-border hide-footer">' +
        '<div class="ghl-table-custom-header">' +
          '<div class="filter-bar">' +
            '<div class="filter-bar--left">' +
              '<p class="text-black hl-text-sm-medium">Recurring Invoices</p>' +
            '</div>' +
            '<div class="filter-bar--right">' +
              '<a class="cursor-pointer" href="' + linkHref + '" target="_blank" rel="noopener">' +
                EXTERNAL_LINK_SVG +
              '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<a class="ghl-cps-link" href="' + linkHref + '" target="_blank" rel="noopener">' +
          LINK_ARROW_SVG +
          ' View Recurring Invoices' +
        '</a>' +
      '</div>';

    return section;
  }

  function removeRecurringSection() {
    var existing = document.getElementById('ghl-cps-recurring-section');
    if (existing) existing.remove();
  }

  function insertRecurringSection(sectionElement) {
    var transactionsSection = findSectionByName('Transactions');
    if (!transactionsSection) {
      log('Transactions section not found yet');
      return false;
    }
    var parent = transactionsSection.parentElement;
    parent.insertBefore(sectionElement, transactionsSection);
    log('Recurring Invoices section inserted');
    return true;
  }

  // ---------------------------------------------------------------------------
  // Contact detail page: main apply function
  // ---------------------------------------------------------------------------

  function applyContactPage() {
    if (!isContactDetailPage()) {
      removeRecurringSection();
      return;
    }

    // Always re-apply hiding (GHL may re-render the sidebar)
    hideUnusedSections();

    if (CONFIG.SHOW_RECURRING_LINK && !document.getElementById('ghl-cps-recurring-section')) {
      // Wait for sidebar to render
      if (!findSectionByName('Transactions')) {
        log('Payments sidebar not ready yet');
        return;
      }

      injectStyles();

      var section = createRecurringSection();
      if (!insertRecurringSection(section)) return;

      log('Recurring Invoices link added to sidebar');
    }

    reorderSections();
  }

  // ---------------------------------------------------------------------------
  // Recurring templates page: auto-fill search from URL hash
  // ---------------------------------------------------------------------------

  function getSearchFromHash() {
    var hash = window.location.hash;
    if (!hash) return null;
    var match = hash.match(/[#&]search=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function fillSearchBox(value) {
    var searchInput = document.querySelector('input.n-input__input-el[placeholder="Search"]');
    if (!searchInput) {
      log('Search input not found yet');
      return false;
    }

    // Use native setter to bypass Vue's reactivity wrapper
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(searchInput, value);

    // Dispatch events to trigger Vue/Naive UI reactivity
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('compositionend', { bubbles: true }));

    log('Search box filled with:', value);

    // Clean up the hash so it doesn't persist on reload
    if (window.history.replaceState) {
      var cleanUrl = window.location.href.split('#')[0];
      window.history.replaceState(null, '', cleanUrl);
    }

    return true;
  }

  function applyRecurringTemplatesPage() {
    if (!isRecurringTemplatesPage()) return;

    var searchTerm = getSearchFromHash();
    if (!searchTerm) return;

    log('Detected search hash:', searchTerm);

    function tryFill() {
      if (fillSearchBox(searchTerm)) return;

      searchFillAttempts++;
      if (searchFillAttempts < MAX_SEARCH_FILL_ATTEMPTS) {
        setTimeout(tryFill, 250);
      } else {
        log('Could not find search input after', MAX_SEARCH_FILL_ATTEMPTS, 'attempts');
      }
    }

    tryFill();
  }

  // ---------------------------------------------------------------------------
  // MutationObserver (contact detail page)
  // ---------------------------------------------------------------------------

  function setupObserver() {
    var debounceTimer = null;

    var observer = new MutationObserver(function() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        if (isContactDetailPage()) {
          hideUnusedSections();
          if (!document.getElementById('ghl-cps-recurring-section')) {
            applyContactPage();
          } else {
            reorderSections();
          }
        }
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    log('MutationObserver started');
  }

  // ---------------------------------------------------------------------------
  // URL watcher (SPA navigation)
  // ---------------------------------------------------------------------------

  function setupUrlWatcher() {
    var lastUrl = window.location.href;

    setInterval(function() {
      var currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        log('URL changed:', currentUrl);

        if (isContactDetailPage()) {
          removeRecurringSection();
          setTimeout(applyContactPage, 500);
        } else if (isRecurringTemplatesPage()) {
          searchFillAttempts = 0;
          applyRecurringTemplatesPage();
        }
      }
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    log('Script loaded');

    if (!isLocationAllowed()) {
      log('Location not in allowed list, script inactive');
      return;
    }

    if (isContactDetailPage()) {
      setTimeout(applyContactPage, 1500);
      setupObserver();
    } else if (isRecurringTemplatesPage()) {
      applyRecurringTemplatesPage();
    }

    setupUrlWatcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    setTimeout(bootstrap, 1000);
  }

  window.addEventListener('load', function() {
    setTimeout(bootstrap, 1500);
  });

})();
</script>
<!-- End - GHL Custom Payments Sidebar by Eric Langley - UpLevelPro.com -->
