# Dev Log

## 2026-09-02

### Rep Call Diagnostic — console tool for capturing dialer failures in the field

**Why:** Murphy OS reps reported two issues — (1) incoming calls could not be answered, the Answer button appearing to do nothing, and (2) a call disposition could not be set afterwards. Neither reproduced across ~10 instrumented test calls on our own machines. Interviews then surfaced the likely reason: **two different incoming-call UIs are appearing, varying by user** (the alternate one described as "blue and white with blue buttons"), which is the signature of a GHL A/B test or staged rollout rather than a settings difference. One rep sees the variant constantly and *can* answer; a second sees it occasionally and *cannot*; a third has never seen it.

`auto-open-phone-keypad/rep-call-diagnostic.js` is a read-only, paste-into-DevTools diagnostic for capturing the failure on the affected rep's own machine, since we cannot reproduce it on ours. After reproducing, the rep runs `murphyReport()`, which prints a report and copies it to the clipboard.

Captures: microphone permission state and audio-device counts, `getUserMedia` outcomes, WebRTC connection-state transitions, whether auto-expand fired per call, whether the disposition panel opened **and whether `.dialer` was actually visible when it did**, Done-button disabled state, pointer events swallowed by the injected click-outside blocker, and synthetic clicks. It observes only — it never clicks and never mutates GHL state.

**v13 behaviour verified live during the investigation:**

- **Auto-expand works and is load-bearing.** `.call-box` appears and is expanded by the script within ~85ms (synthetic click on the non-red `.cursor-pointer`, stack `clickEl <= evaluate`). With the script removed from Custom JS, the same collapsed bar persists ~13.8s with `.dialer` hidden until clicked manually.
- **Inbound calls never involve `.call-box`.** They render `.incoming-call-info-section` and `.incoming-call-bt-ctrl` inside `.dialer > .dialer-body`, and both action buttons carry `hr-button--primary`. The script's outbound-oriented detection is inert during an inbound ring.
- **Disposition detection is correct on both paths** — pill selection (`.bg-primary-50`) and the More Dispositions dropdown (`.hr-base-selection` text change) — verified against the real DOM, not a mock.
- **Server-side disposition pipeline is healthy:** 244 webhooks over 30 days, zero validation failures. GHL has not changed the `phoneCall.*` customData contract.

**Known defect, not yet fixed (for a future v14):** `setupClickOutsideBlocker()` calls `stopImmediatePropagation()` and then attempts to replay the click via a deferred `target.click()`. That replay is broken two ways — `SVGElement.prototype.click` is `undefined`, so it throws whenever the target is an icon `<svg>`/`<path>`; and `HTMLElement.click()` fires only `click`, never `pointerdown`/`mousedown`. A third issue: `skipNext` is a single closure variable shared by both the `pointerdown` and `focusin` listeners, and the replayed click never emits a `pointerdown` to consume it, so the flag leaks to the next event. The blocker does arm on every live call, so these are reachable.

**Measurement lesson worth recording:** two conclusions during this investigation were confidently wrong because the sampler was slower than the state being measured. `.call-box` lives ~85ms and the disposition checkbox injects on a 300ms interval, while sampling ran at 100–150ms — and in one case a single snapshot. Absence of observation got written up as observation of absence, with the script under test being the thing deleting the state. Background tabs compound it: Chrome throttles timers to ~1/sec. Hence this tool polls at 50ms and warns explicitly to keep the tab in the foreground. Establish a positive control — reproduce with the script removed to confirm the state exists and how long it lives — before trusting any negative result.

- Key files: `auto-open-phone-keypad/rep-call-diagnostic.js`

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

Sourced from what our internal plan-driven Custom JS learned across its v2.3–v2.8
releases, plus a live verification pass on the Contacts smart list (2026-08-31)
that established the capture-phase interception and the `#add-contact-btn`
handle.

- Key files: `docs/custom-menus.md`

## 2026-07-16

### Auto-Open Phone Keypad v13.0 — Vue 3 rewrite (fixes spurious "Call Results" windows)

**Problem:** After GHL's Vue 3 migration, spurious "Call Results" / dialer windows popped up when no call had been made (reported: user switched browser tabs and it appeared). Root cause traced live in the agency (co-driven Chrome, DOM + store instrumentation):

- The v12 chevron selector `.call-actions > div:last-child` matched nothing at the moment `expandCallBox()` ran, so it fell through to its fallback and **programmatically clicked `#template-power-dialer button[aria-label="Voice Calling"]`** — which in Vue 3 is the persistent header LAUNCHER that *opens/starts* a call. Captured the offending synthetic click (`isTrusted:false` on "Voice Calling"). The opened panel was then re-detected and re-clicked → spurious-window loop.
- The `phoneCall` / `manualCallStatus` `StoreEvents` subscriptions **never fired** for call activity in this build — dead weight, and a latent re-trigger risk.

**Verified Vue 3 DOM reality:** `.call-box` (collapsed bar) exists only during a live call and contains `.call-actions` with two `.cursor-pointer` icons — the red hang-up (`svg.text-error-500`) and the expand chevron. Live-clicked the chevron via automation and confirmed it expands the panel (`.call-box` transitions away). Confirmed v13's predicates are fully **inert at idle**.

**v13 changes:**
- **Detect genuine calls only** via `.call-box .call-actions svg.text-error-500` (real hang-up present) — never the idle launcher.
- **Expand by clicking the chevron** (the `.call-actions > .cursor-pointer` without the red svg). **Removed the "Voice Calling" launcher fallback entirely** — if no chevron, do nothing (fail-safe).
- **Removed the dead `phoneCall`/`manualCallStatus` StoreEvents subscription.**
- **Added a double-injection guard** (`window.__ghlAutoOpenKeypadLoaded`) so re-injection can't stack observers/handlers.
- Preserved the disposition-enforcement toggle, version badge, and click-outside protection — all re-gated on the verified active-call signal. (Disposition-pill selectors carried over from v12 and flagged for re-verification against the live panel.)
- Reset only when call is fully over (no bar/panel/disposition) for 1.5s — preserves the v1.2 "don't re-open on manual minimize" behavior.

- Key files: `auto-open-phone-keypad/ghl-auto-open-phone-keypad.js`

## 2026-04-07

### Auto-Open Phone Keypad v12.7
- **Fix: Dialer not opening reliably** — GHL updated their UI. The old `.click()` method no longer reliably triggers Vue event handlers. Replaced with `dispatchEvent(new MouseEvent('click', { bubbles: true }))`.
- **Fix: Dialer not opening on subsequent calls** — `isCallActive()` checked `container.children.length > 0` which was always true (wrapper divs persist). Now checks for `.call-box` and the End Call button (`.hr-button--error-type`) inside the `.dialer` panel as actual call indicators.
- **Fix: Double-fire on expand** — Added `expandPending` guard to prevent multiple `expandCallBox` calls from queuing when rapid mutations arrive before the delay timer.
- **Fix: Reset between calls** — Added periodic reset check (300ms interval) that detects when a call has ended by verifying no `.call-box`, no End Call button, and no disposition screen. The MutationObserver alone couldn't detect this because the expanded `.dialer` panel lives outside `#template-power-dialer`.
- **New: Fallback for new GHL UI** — `expandCallBox()` tries the old chevron first, then falls back to `button[aria-label="Voice Calling"]` for GHL's newer UI variant.
- **New: Click-outside protection** — GHL added click-outside-to-close behavior to the dialer. Intercepts `pointerdown` and `focusin` events at the window capture phase when an active call panel is showing. Only blocks while the End Call button is visible, so normal page interaction resumes immediately after the call ends. Deferred `.click()` ensures blocked clicks still reach their targets. Drag handle works because it's inside the `.dialer` container.
- Key files: `auto-open-phone-keypad/ghl-auto-open-phone-keypad.js`
