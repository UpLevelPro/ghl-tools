# Dev Log

## 2026-04-07

### Auto-Open Phone Keypad v12
- **Fix: Dialer not opening reliably** — GHL updated their UI. The old `.click()` method no longer reliably triggers Vue event handlers. Replaced with `dispatchEvent(new MouseEvent('click', { bubbles: true }))`.
- **Fix: Dialer not opening on subsequent calls** — `isCallActive()` checked `container.children.length > 0` which was always true (wrapper divs persist). Now checks for `.call-box` or `button[aria-label="Voice Calling"]` as actual call indicators, so `hasExpanded` properly resets between calls.
- **Fix: Double-fire on expand** — Added `expandPending` guard to prevent multiple `expandCallBox` calls from queuing when rapid mutations arrive before the delay timer.
- **New: Fallback for new GHL UI** — Added detection for `button[aria-label="Voice Calling"]` as an alternative to the old `.call-box` / `.call-actions` chevron pattern.
- **New: Click-outside protection** — GHL added click-outside-to-close behavior to the dialer. Tracks whether the last click was inside or outside the dialer; if the dialer collapses from a click-outside during an active call, it automatically re-opens. User can still minimize via the phone icon.
- Key files: `auto-open-phone-keypad/ghl-auto-open-phone-keypad.js`
