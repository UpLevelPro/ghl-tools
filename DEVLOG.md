# Dev Log

## 2026-08-31

### docs/custom-menus.md § 7 rewritten for the Vue 3 shell

§ 7 was written before GHL's Vue 3 migration and had gone actively misleading in
one place that matters: it said sidebar clicks are handled by **Vue event
delegation**. In Vue 3 they are not — handlers are bound directly on the
element. Anyone following the old text would reach for a bubble-phase listener
to intercept a GHL control, and GHL's own handler would run first.

Retitled "Custom JS Sidebar Manipulation" → **"Custom JS in GHL's Vue 3
Shell"**, and rebuilt around the one fact everything follows from: **agency
Custom JS runs before the Vue app boots.**

Added:

- **Vue 3 surfaces** — `window.AppUtils.StoreEvents` replaced `__vue__` /
  `window.$store`, and must be probed as a **function**, never a constant
  evaluated at script-eval time. A capability probe that runs before the
  capability can exist answers "no" forever, and answers it silently.
- **One helper per KIND of wait** — `routeChangeEvent` for "route changed" vs
  `MutationObserver` for "element rendered"; run a poll alongside the event,
  because whether the shell dispatches it is not knowable at subscribe time.
- **Never deadline the post-login wait** — the pathname is `/` while a human
  types a password and clears 2FA.
- **CSS hides, events act** — Vue re-creates its nodes, so hiding belongs in an
  injected stylesheet; only things that DO something need an element in hand.
- **Intercepting a GHL button** — capture-phase delegation from `document`,
  `closest()` from `e.target` (a real click lands on the inner `<svg>`), all
  three cancels, and a user-gesture `window.open` with `noopener`. Includes the
  negative-control discipline: "no modal appeared" means nothing until you have
  seen a modal appear.
- **Selectors: what holds and what doesn't** — real ids and `a[meta="<uuid>"]`
  vs `hr-*` highrise soup, generic aria-labels, and structural guesses. Kept the
  standing warning never to resolve `button[aria-label="Voice Calling"]` by
  clicking it, since the launcher starts a call.
- **What Custom JS cannot reach** — the cross-origin calendar iframe, and GHL
  dropping unknown query params on its own client-side navigations.
- **None of this is an access control** — entitlement belongs server-side.

Kept the flexbox reorder recipe and the three redirect gotchas, with the
delegation claim in gotcha 2 corrected.

Sourced from what `uplevelpro-app/ghl-custom-scripts/location-config.js` learned
across v2.3–v2.8, plus a live verification pass on the Contacts smart list
(2026-08-31) that established the capture-phase interception and the
`#add-contact-btn` handle.

- Key files: `docs/custom-menus.md`

## 2026-04-07

### Auto-Open Phone Keypad v12.7
- **Fix: Dialer not opening reliably** — GHL updated their UI. The old `.click()` method no longer reliably triggers Vue event handlers. Replaced with `dispatchEvent(new MouseEvent('click', { bubbles: true }))`.
- **Fix: Dialer not opening on subsequent calls** — `isCallActive()` checked `container.children.length > 0` which was always true (wrapper divs persist). Now checks for `.call-box` and the End Call button (`.hr-button--error-type`) inside the `.dialer` panel as actual call indicators.
- **Fix: Double-fire on expand** — Added `expandPending` guard to prevent multiple `expandCallBox` calls from queuing when rapid mutations arrive before the delay timer.
- **Fix: Reset between calls** — Added periodic reset check (300ms interval) that detects when a call has ended by verifying no `.call-box`, no End Call button, and no disposition screen. The MutationObserver alone couldn't detect this because the expanded `.dialer` panel lives outside `#template-power-dialer`.
- **New: Fallback for new GHL UI** — `expandCallBox()` tries the old chevron first, then falls back to `button[aria-label="Voice Calling"]` for GHL's newer UI variant.
- **New: Click-outside protection** — GHL added click-outside-to-close behavior to the dialer. Intercepts `pointerdown` and `focusin` events at the window capture phase when an active call panel is showing. Only blocks while the End Call button is visible, so normal page interaction resumes immediately after the call ends. Deferred `.click()` ensures blocked clicks still reach their targets. Drag handle works because it's inside the `.dialer` container.
- Key files: `auto-open-phone-keypad/ghl-auto-open-phone-keypad.js`
