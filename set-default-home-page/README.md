# Set Default Home Page

Override the default Dashboard landing page for specific GHL subaccounts. When a user navigates to a subaccount (or opens it fresh), they'll land on the page you configure instead of Dashboard.

If you found this helpful, let me know at eric@uplevelpro.com

You must be an agency owner to use this script, not a subaccount in an agency.

If you don't have a GHL agency account yet, click here to get a free trial: https://www.gohighlevel.com/?fp_ref=uplevelpro32

## Installation

1. In your GHL agency, go to **Settings > Company > Custom JS**
2. Copy the entire contents of [`ghl-set-default-home-page.js`](./ghl-set-default-home-page.js)
3. Paste it into the Custom JS field
4. Click **Save**

That's it. The redirect applies automatically to the configured sub-accounts.

## What It Does

- Detects when a user lands on a subaccount's base URL (before Dashboard loads)
- Redirects to the configured default page (Conversations, Opportunities, a Custom Menu Link, etc.)
- Only affects full page loads — sidebar navigation within the app is unaffected
- Only activates for location IDs listed in the config — all other subaccounts behave normally

## Configuration

Edit the `LOCATIONS` map at the top of the script. Each entry is a `locationId` → `page path` pair:

```js
var LOCATIONS = {
  'abc123': '/conversations',        // Default to Conversations
  'def456': '/opportunities',        // Default to Opportunities
  'ghi789': '/custom-menu-link/uuid-here',  // Default to a Custom Menu Link
};
```

### Standard Page Codes

| Page | Path |
|------|------|
| Dashboard | `/dashboard` |
| Conversations | `/conversations` |
| Contacts | `/contacts` |
| Opportunities | `/opportunities` |
| Payments | `/payments` |
| Calendars | `/calendars` |
| Marketing | `/email-marketing` |
| Automation | `/automation` |
| Sites | `/sites` |
| Memberships | `/memberships` |
| Media Storage | `/app-media` |
| Reputation | `/reputation` |
| Reporting | `/reporting` |
| Settings | `/settings` |
| Custom Menu Link | `/custom-menu-link/{uuid}` |

### Finding a Custom Menu Link UUID

1. Open any subaccount that has the Custom Menu Link installed
2. Click the menu item in the left sidebar
3. Look at the URL in your browser's address bar — it will look like:
   ```
   https://app.gohighlevel.com/v2/location/abc123/custom-menu-link/04d855d6-0ead-4963-a8a7-6f84dddbc4be
   ```
4. The UUID is the last segment after `/custom-menu-link/` — copy that value

Use it in the config as `/custom-menu-link/{uuid}`.

## How It Works

1. **Runs before Vue Router** — GHL's Custom JS executes before the Vue SPA router initializes. At that moment, the browser pathname is still the raw base URL (`/v2/location/{id}`) with no route suffix
2. **Regex match** — The script checks if the pathname matches `/v2/location/{id}` with no trailing path (just an optional `/`). This means it only fires on initial page loads, not SPA navigation
3. **Instant redirect** — `window.location.replace()` fires synchronously, sending the browser to the configured page before Dashboard ever renders. Using `replace` (not `assign`) keeps the browser history clean — hitting Back won't loop through Dashboard

## Compatibility

- Designed for GHL's agency-level Custom JS injection
- Works on all subaccount pages (the redirect only fires on the base URL)
- No external dependencies — pure vanilla JavaScript
- No CSS required

## Changelog

### v1.0 — 2026-04-06
- Initial release — configurable per-location default home page redirect

## Author

**Eric Langley** | [UpLevelPro.com](https://www.uplevelpro.com)

## License

[MIT](../LICENSE)
