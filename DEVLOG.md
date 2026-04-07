# Dev Log

## 2026-04-07

### Auto-Open Phone Keypad v12.7
- **Fix: Dialer not opening reliably** — GHL updated their UI. The old `.click()` method no longer reliably triggers Vue event handlers. Replaced with `dispatchEvent(new MouseEvent('click', { bubbles: true }))`.
- **Fix: Dialer not opening on subsequent calls** — `isCallActive()` checked `container.children.length > 0` which was always true (wrapper divs persist). Now checks for `.call-box` and the End Call button (`.hr-button--error-type`) inside the `.dialer` panel as actual call indicators.
- **Fix: Double-fire on expand** — Added `expandPending` guard to prevent multiple `expandCallBox` calls from queuing when rapid mutations arrive before the delay timer.
- **Fix: Reset between calls** — Added periodic reset check (300ms interval) that detects when a call has ended by verifying no `.call-box`, no End Call button, and no disposition screen. The MutationObserver alone couldn't detect this because the expanded `.dialer` panel lives outside `#template-power-dialer`.
- **New: Fallback for new GHL UI** — `expandCallBox()` tries the old chevron first, then falls back to `button[aria-label="Voice Calling"]` for GHL's newer UI variant.
- **New: Click-outside protection** — GHL added click-outside-to-close behavior to the dialer. Intercepts `pointerdown` and `focusin` events at the window capture phase when an active call panel is showing. Only blocks while the End Call button is visible, so normal page interaction resumes immediately after the call ends. Deferred `.click()` ensures blocked clicks still reach their targets. Drag handle works because it's inside the `.dialer` container.
- Key files: `auto-open-phone-keypad/ghl-auto-open-phone-keypad.js`
