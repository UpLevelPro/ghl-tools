# GHL Custom Menu Links — API Reference & Gotchas

Practical reference for managing GoHighLevel **Custom Menu Links** — the items that appear in the left sidebar of agency and subaccount views. Covers the GHL Custom Menus API, the Custom JS that drives sidebar reorder/redirect behavior, and the agency authentication patterns needed to call the API.

The published GHL marketplace docs are SPA-rendered and incomplete on several points (response shapes, undocumented PUT field rejections, etc.) — the shapes and behaviors documented here are what the API actually returns from real exploration.

---

## 1. Endpoints

Base URL: `https://services.leadconnectorhq.com`
API version header: `Version: 2021-07-28`
Auth: agency-level — Agency PIT key (preferred) or OAuth Bearer token. See § 5.

| Method | Path | Purpose |
|---|---|---|
| GET    | `/custom-menus/?companyId={id}`         | List all custom menu links for a company |
| GET    | `/custom-menus/{menuId}?companyId={id}` | Get one custom menu link by UUID |
| POST   | `/custom-menus/`                        | Create a new custom menu link |
| PUT    | `/custom-menus/{menuId}?companyId={id}` | Update an existing custom menu link (full resource) |
| DELETE | `/custom-menus/{menuId}?companyId={id}` | Delete a custom menu link |

`companyId` is the agency ID. It's required as a query param on most calls.

---

## 2. Response Shape (verified)

`GET /custom-menus/{menuId}` returns the menu directly (NOT wrapped in `data` or `customMenu`):

```json
{
  "id": "<menu-uuid>",
  "icon": { "name": "play-circle", "fontFamily": "fas" },
  "title": "Get Started",
  "url": "https://example.com/page",
  "order": 1,
  "userRole": "admin",
  "showOnCompany": false,
  "showOnLocation": true,
  "showToAllLocations": false,
  "locations": [ "<location-id-1>", "<location-id-2>" ],
  "excludeLocations": [],
  "openMode": "iframe",
  "allowCamera": false,
  "allowMicrophone": false,
  "traceId": "<request-trace-uuid>"
}
```

`PUT /custom-menus/{menuId}` returns the updated menu wrapped:

```json
{
  "success": true,
  "customMenu": { /* same shape as above, minus traceId */ },
  "traceId": "..."
}
```

The wrapping inconsistency (GET unwrapped, PUT wrapped) is real. When traversing, fall through both:

```js
const data = current?.customMenu || current?.data || current;
```

---

## 3. Field Semantics

**Visibility scope (mutually exclusive in practice):**

| `showOnCompany` | `showOnLocation` | `showToAllLocations` | Behavior |
|---|---|---|---|
| true  | false | n/a   | Shows in agency-level sidebar only |
| false | true  | true  | Shows in EVERY subaccount, regardless of `locations` |
| false | true  | false | Shows ONLY in subaccounts listed in `locations` |

**`locations` and `excludeLocations`:**
- `locations` — allowlist of subaccount IDs. Only meaningful when `showOnLocation: true` AND `showToAllLocations: false`.
- `excludeLocations` — denylist. Only meaningful when `showToAllLocations: true`.

**`userRole`:** `"admin"` | `"user"` | `"all"` — controls per-user-role visibility within a subaccount.

**`openMode`:** `"iframe"` | `"newTab"` | `"currentTab"` — how the menu link's URL opens.

**`order`:** server-managed display order. Read-only on PUT (see § 4).

---

## 4. PUT Body Strip List (UNDOCUMENTED)

`PUT /custom-menus/{id}` returns 422 `Unprocessable Entity` if these fields are present in the body:

```js
const stripFields = ['_id', 'id', 'createdAt', 'updatedAt', '__v', 'order', 'traceId'];
```

The error looks like:
```json
{
  "message": ["property order should not exist", "property traceId should not exist"],
  "error": "Unprocessable Entity",
  "statusCode": 422
}
```

Pattern:
```js
const updated = { ...currentResource, locations: [...current.locations, newLocId] };
for (const f of stripFields) delete updated[f];
await fetch(url, { method: 'PUT', body: JSON.stringify(updated), ... });
```

---

## 5. Agency Authentication

Two options for the auth header on agency-level calls:

### Option A — Agency PIT key (preferred)
- Long-lived, no refresh dance
- Created in GHL Agency Settings → Private Integrations
- Needs the right scopes for the endpoints you'll hit
- Store securely (encrypted) on the server

```
Authorization: Bearer <pit-key>
```

### Option B — Agency OAuth (Company-level)
- Token rotates; requires refresh logic
- Refresh tokens become invalid if rotated out of sync (e.g., two services sharing the same refresh token will conflict — only the first refresh wins, the other gets `invalid_grant`)
- The `error: "invalid_grant"` / `"This refresh token is invalid"` response means re-authorization is required

**When to use which:** PIT keys are simpler for server-side automation. OAuth is required if you need user-attributed actions or scopes that PIT doesn't grant.

---

## 6. Common Workflow: Add a Subaccount to a Menu's Allowlist

When a menu has `showOnLocation: true, showToAllLocations: false`, new subaccounts won't see it until you add their location ID to `locations`. Pattern:

```js
const BASE = 'https://services.leadconnectorhq.com';
const HEADERS = {
  Authorization: `Bearer ${pitKey}`,
  Version: '2021-07-28',
  'Content-Type': 'application/json',
};

// 1. GET current
const current = await fetch(
  `${BASE}/custom-menus/${menuId}?companyId=${agencyId}`,
  { headers: HEADERS },
).then(r => r.json());

// 2. Idempotent append
if (current.locations.includes(newLocId)) return;
const updated = { ...current, locations: [...current.locations, newLocId] };
for (const f of ['_id', 'id', 'createdAt', 'updatedAt', '__v', 'order', 'traceId']) {
  delete updated[f];
}

// 3. PUT
await fetch(`${BASE}/custom-menus/${menuId}?companyId=${agencyId}`, {
  method: 'PUT',
  headers: HEADERS,
  body: JSON.stringify(updated),
});
```

---

## 7. Custom JS Sidebar Manipulation

Unrelated to the API but in the same problem space. When modifying the sidebar via Agency Custom JS (Settings → Company → Custom JS):

### Reorder via CSS flexbox
```css
.hl_nav-header > nav { display: flex; flex-flow: row wrap; }
.hl_nav-header > nav > a { order: 1; }
#sidebar-v2 .hl_nav-header > nav > a[meta="<menu-uuid>"] { order: -100; }
```
Lower `order` = higher in sidebar. Default GHL menu items have stable IDs like `#sb_dashboard`, `#sb_conversations`. Custom menu items are addressed by `a[meta="<uuid>"]`.

### Redirect / SPA navigation gotchas
Custom JS runs **before Vue Router** initializes. Three real bugs and their fixes:

1. **Pathname is `/` after login**, not `/dashboard`. GHL's login flow does `replaceState` to `/dashboard` AFTER Custom JS runs. So a one-time pathname check misses it. **Fix:** poll for `/v2/location/{id}(/(dashboard)?)?$` to resolve.

2. **`link.click()` is a no-op** on GHL sidebar links — they have `href="javascript:void(0)"` and Vue handles the click via event delegation, not a direct DOM handler. **Fix:** dispatch a real MouseEvent that bubbles:
   ```js
   link.dispatchEvent(new MouseEvent('click', {
     bubbles: true, cancelable: true, composed: true, view: window,
   }));
   ```

3. **`window.location.replace()` for redirect after login disrupts auth state** — Vue Router bounces back to `/dashboard`. **Fix:** use the `dispatchEvent` SPA click instead.

### Run-once semantics
Custom JS only fires on full page loads, not on SPA sidebar clicks. Safe to redirect from Dashboard without breaking sidebar Dashboard clicks.

---

## 8. Related Tools in this Repo

- [`set-default-home-page/`](../set-default-home-page/) — standalone Custom JS that overrides the default Dashboard landing page on a per-location basis. Implements the redirect technique from § 7.
