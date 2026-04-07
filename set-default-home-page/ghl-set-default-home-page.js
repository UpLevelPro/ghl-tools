<!-- GHL Set Default Home Page v1.2 by Eric Langley - UpLevelPro.com -->
<!--
  Sets a custom default home page for GHL subaccounts.
  Installed in: Agency Settings > Company > Custom JS

  How it works:
    - Custom JS only runs on full page loads (not SPA sidebar clicks)
    - Polls for the pathname to resolve (after login, page starts at / then
      Vue Router transitions to /dashboard via SPA navigation)
    - Once on dashboard, polls for the sidebar link to appear in the DOM
    - Dispatches a MouseEvent to trigger Vue's event delegation (native
      .click() doesn't work on GHL sidebar links)
    - SPA navigation (sidebar clicks) is unaffected

  Configuration:
    - LOCATIONS: Map of locationId → page path (see PAGE_CODES below)
    - To add a location, add an entry: 'locationId': '/page-path'
    - To use a Custom Menu Link, use: '/custom-menu-link/{uuid}'

  To find this script in the Custom JS window, search for: GHL_SET_DEFAULT_HOME_PAGE

  Standard Page Codes:
    /dashboard                    - Dashboard (default)
    /conversations                - Conversations
    /contacts                     - Contacts
    /opportunities                - Opportunities (pipeline view)
    /payments                     - Payments
    /calendars                    - Calendars
    /email-marketing              - Marketing (Email)
    /automation                   - Automation (Workflows)
    /sites                        - Sites (Funnels/Websites)
    /memberships                  - Memberships
    /app-media                    - Media Storage
    /reputation                   - Reputation Management
    /reporting                    - Reporting
    /settings                     - Settings
    /custom-menu-link/{uuid}      - Custom Menu Link (use the menu item's meta UUID)

  @version 1.2.0
  @date 2026-04-07
-->

<!-- [GHL_SET_DEFAULT_HOME_PAGE] -->
<script>
(function () {
  // --- CONFIG: locationId → default page path ---
  var LOCATIONS = {
    'YOUR_LOCATION_ID': '/custom-menu-link/your-custom-menu-uuid',
    // Add more locations here:
    // 'locationId': '/conversations',
    // 'locationId': '/opportunities',
  };
  var DASH_REGEX = /\/v2\/location\/([^/]+)(\/(dashboard)?)?$/;

  // Dispatch a real MouseEvent that bubbles through Vue's event delegation
  // (native .click() doesn't work — GHL sidebar links use href="javascript:void(0)")
  function spaClick(el) {
    setTimeout(function () {
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, composed: true, view: window
      }));
    }, 1000);
  }

  // Poll for pathname to resolve and sidebar link to appear
  // After login, page loads at / then Vue Router transitions to /dashboard
  var started = Date.now();
  function check() {
    var match = window.location.pathname.match(DASH_REGEX);
    if (!match) {
      if (Date.now() - started < 30000) setTimeout(check, 300);
      return;
    }
    var locationId = match[1];
    if (!LOCATIONS[locationId]) return;

    var defaultPath = LOCATIONS[locationId];
    var menuMatch = defaultPath.match(/^\/custom-menu-link\/(.+)$/);
    var selector = menuMatch
      ? 'a[meta="' + menuMatch[1] + '"]'
      : '#sidebar-v2 a[href*="' + defaultPath + '"]';

    var link = document.querySelector(selector);
    if (link) {
      spaClick(link);
    } else if (Date.now() - started < 30000) {
      setTimeout(check, 300);
    }
  }
  check();
})();
</script>
<!-- [/GHL_SET_DEFAULT_HOME_PAGE] -->
