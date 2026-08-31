# GHL Custom Menu Links — API Reference & Gotchas

Practical reference for managing GoHighLevel **Custom Menu Links** — the items that appear in the left sidebar of agency and subaccount views. Covers the GHL Custom Menus API, the agency authentication patterns needed to call it, and (§ 7) the Custom JS techniques for working inside GHL’s Vue 3 app shell — sidebar reorder, landing-page redirect, and intercepting GHL’s own buttons.

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

## 7. Custom JS in GHL's Vue 3 Shell

Unrelated to the API but in the same problem space: what holds and what breaks when you inject Custom JS (Settings → Whitelabel → Custom Code → Custom JS) into GHL's Vue 3 app shell.

### The one fact everything else follows from

**Agency Custom JS runs BEFORE the Vue app boots.** Every gotcha below is a consequence. At the moment your script evaluates there is no router, no store, no sidebar, and no `window.AppUtils`.

### Vue 3 surfaces

Vue 3 removed the direct store access the old Vue 2 tricks relied on. `__vue__` and `window.$store` are gone. The documented replacement is:

```js
window.AppUtils.StoreEvents   // Vue 3 event surface
```

⚠️ **Probe it as a function, never as a constant.**

```js
// WRONG — evaluated at script-eval time, when AppUtils cannot exist yet.
const VUE3_READY = !!(window.AppUtils && window.AppUtils.StoreEvents); // false forever

// RIGHT
function vue3ShellReady() {
  return !!(window.AppUtils && window.AppUtils.StoreEvents);
}
```

A capability probe that runs before the capability can exist answers "no" forever, and answers it *silently* — the script keeps working via whatever fallback path you wrote, so the regression is invisible.

### One helper per KIND of wait

Two different questions, two different mechanisms. Don't use one for the other.

| Question | Mechanism |
|----------|-----------|
| Has the route changed? | `document.addEventListener('routeChangeEvent', fn)` (also `routeLoaded`; `history.pushState`/`replaceState` hooks as a fallback) |
| Has this element rendered? | `MutationObserver` on `document.documentElement`, `{ childList: true, subtree: true }` |

Route events fire when the URL changes; sidebar anchors and toolbar buttons render from state that loads *after* the route settles, so a route event is not a signal that your element exists.

**Run both the event and a poll.** Deciding between them requires knowing whether the shell dispatches the event, and at subscribe time that is not knowable. A listener for an event nobody sends costs nothing, so always attach it, and let a poll run alongside until you unsubscribe. Make the callback idempotent (guard with a `ran`/`done` flag): being told twice is harmless, being told zero times is not.

⚠️ **Never put a deadline on the post-login wait.** After login the pathname is `/`, so there is no location to resolve until GHL SPA-transitions into one — and that countdown runs while a human types a password and clears 2FA. Blow the budget and your watcher is dead before the app arrives: nothing runs, and there is no error. Back *off* instead of giving up (e.g. 300ms while a navigation is plausibly imminent, widening to 5s for an idle session). Late is recoverable; stopped is not.

### CSS hides, events act

Split the two mechanisms deliberately:

- **Anything that makes chrome disappear** ships as a rule in an injected `<style>`, never `el.style.display`. Vue owns those nodes and re-creates them across navigation, so an imperative mutation gets undone — and a one-shot pass misses anything arriving after first paint (GHL's promo banner does exactly that). A rule matches whatever appears, whenever it appears: no poll, no re-run, no observer.
- **Anything that DOES something** needs a real element in hand, and therefore has to wait for one.

These compose only because `display: none` leaves the node in the document — a synthetic click dispatch does not require its target to be visible. Removing the node instead would break the dispatch.

### Intercepting a GHL button

To make a GHL control do something else, delegate from `document` in the **capture** phase:

```js
document.addEventListener('click', function (e) {
  var target = e.target;
  if (!target || typeof target.closest !== 'function') return;
  if (!target.closest('#add-contact-btn')) return;

  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();

  window.open(MY_URL, '_blank', 'noopener');
}, true); // <- capture
```

Why each piece:

1. **Capture phase is load-bearing.** Your script runs before the button exists, but a capture listener on `document` is upstream of every handler Vue later binds *on the element*, whenever it binds them. **Vue 3 binds click handlers directly on the element** — it does not delegate from an app root — so a bubble-phase listener runs *after* GHL's handler and the drawer/modal opens anyway.
2. **Delegation removes the wait entirely.** The listener never holds a reference to the button, so there is nothing to go stale when Vue re-creates it. No polling, no MutationObserver.
3. **`closest()` from `e.target`, not equality.** A real click lands on the `<svg>` or `<path>` inside the button, so `e.target === button` is false.
4. **All three cancels.** `preventDefault()` alone still lets GHL's handler run; `stopPropagation()` alone still lets a handler bound on the button itself run. `stopImmediatePropagation()` covers that last case — which, per (1), is the normal case in Vue 3.
5. **`window.open` from inside the handler** counts as a user gesture, so it is not popup-blocked. `noopener` stops the opened tab from holding a `window.opener` handle back into the logged-in GHL session.

Verify an interception by proving the negative control: with the handler installed the click should do nothing GHL-ish; with it removed, the same click should open GHL's own UI. "No modal appeared" means nothing until you have seen a modal appear.

### Reorder the sidebar via CSS flexbox

```css
.hl_nav-header > nav { display: flex; flex-flow: row wrap; }
.hl_nav-header > nav > a { order: 1; }
#sidebar-v2 .hl_nav-header > nav > a[meta="<menu-uuid>"] { order: -100; }
```

Lower `order` = higher in sidebar.

### Redirect / SPA navigation gotchas

1. **Pathname is `/` after login**, not `/dashboard`. GHL's login flow does `replaceState` AFTER Custom JS runs, so a one-time pathname check misses it. **Fix:** watch for `/v2/location/{id}(/(dashboard)?)?$` via route events + poll (see above).

2. **`link.click()` is a no-op** on GHL sidebar links — they are `href="javascript:void(0)"` and Vue handles the click itself. **Fix:** dispatch a real bubbling MouseEvent:
   ```js
   link.dispatchEvent(new MouseEvent('click', {
     bubbles: true, cancelable: true, composed: true, view: window,
   }));
   ```
   Allow a short settle delay before dispatching: the anchor can be in the document while the router that handles the click is still initialising, and there is no event for "the router is ready".

3. **`window.location.replace()` after login disrupts auth state** — Vue Router bounces back to `/dashboard`. **Fix:** use the `dispatchEvent` SPA click instead.

### Selectors: what holds and what doesn't

**Stable handles** — real ids and semantic attributes:

| Handle | What it is |
|--------|-----------|
| `#sidebar-v2` | The whole left rail |
| `#sb_dashboard`, `#sb_conversations`, … | Default sidebar items |
| `a[meta="<uuid>"]` | A custom menu link |
| `#notification_banner-top_bar` | The rotating promo banner |
| `#add-contact-btn`, `#import-contact-btn` | Contacts Smart List toolbar buttons |
| `.sidebar-v2-location` + `<locationId>` | The shell root carries the current location id as a **class** |

**Not handles:**

- **`hr-*` classes** (`hr-button hr-button--secondary hr-button--2xs`) are highrise utility soup and will not survive a restyle.
- **Generic aria-labels.** The Add Contact button's is literally `"Icon only button"`.
- **Structural guesses.** Picking a scroll container by `scrollHeight > clientHeight` found the right node on one screen and the wrong one on the next, with no error anywhere.

⚠️ **Never resolve `button[aria-label="Voice Calling"]` by clicking it to check.** The dialer launcher **starts a call**.

Write every rule to **fail open**: a stale selector should leave too much on screen, never blank the page or strip navigation. And enumerate what you hide rather than hiding everything and restoring exceptions — an overreaching subtractive rule can remove the avatar menu, which is where Signout lives.

### What Custom JS cannot reach

- **Cross-origin iframes.** Calendar settings render from `calendar-app.leadconnectorhq.com`; touching `contentDocument` throws `SecurityError`. You cannot read or restyle one control inside them. Narrate *alongside* such a panel, not into it.
- **Query params on internal navigations.** GHL drops unknown params on its own client-side navigations, so a flag read only from `location.search` holds for one screen and silently reverts on the next. **Fix:** read from the URL once, then persist to `sessionStorage` and read from there — the URL wins when it speaks, but an absent param must not clear a stored value.

### Run-once semantics

Custom JS fires on full page loads only, not on SPA navigations. That is exactly why `document`-level delegation and stylesheet rules are preferred over per-element binding: both survive every re-render without a re-run.

### None of this is an access control

Hiding is a stylesheet and redirecting is a click handler; anyone with DevTools defeats both, and blocking your config fetch defeats them wholesale. Entitlement belongs server-side. Never put anything behind these techniques that a user seeing their full sidebar would compromise.

---

## 8. Related Tools in this Repo

- [`set-default-home-page/`](../set-default-home-page/) — standalone Custom JS that overrides the default Dashboard landing page on a per-location basis. Implements the redirect technique from § 7.