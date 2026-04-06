<!-- GHL Set Default Home Page v1 by Eric Langley - UpLevelPro.com -->
<!--
  Sets a custom default home page for GHL subaccounts.
  Installed in: Agency Settings > Company > Custom JS

  How it works:
    - Custom JS runs before Vue Router initializes
    - When the pathname is just /v2/location/{id} (the base URL), the script
      redirects to the configured default page before Dashboard ever renders
    - SPA navigation (sidebar clicks) is unaffected since Custom JS only runs
      on full page loads

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

  @version 1.0.0
  @date 2026-04-06
-->

<!-- [GHL_SET_DEFAULT_HOME_PAGE] -->
<script>
(function () {
  // --- CONFIG: locationId → default page path ---
  var LOCATIONS = {
    '38Kk1ddkT2p2k0NfKkuS': '/custom-menu-link/04d855d6-0ead-4963-a8a7-6f84dddbc4be',
    // Add more locations here:
    // 'locationId': '/conversations',
    // 'locationId': '/opportunities',
  };

  // Detect current location from URL: /v2/location/{locationId}/...
  var match = window.location.pathname.match(/\/v2\/location\/([^/]+)/);
  var locationId = match ? match[1] : null;
  if (!locationId || !LOCATIONS[locationId]) return;

  // Redirect base URL → configured default page
  // Custom JS runs before Vue Router, so pathname is still the raw base URL
  if (/\/v2\/location\/[^/]+\/?$/.test(window.location.pathname)) {
    window.location.replace(
      '/v2/location/' + locationId + LOCATIONS[locationId]
    );
  }
})();
</script>
<!-- [/GHL_SET_DEFAULT_HOME_PAGE] -->
