# Auto-Open Phone Keypad

I was frustrated that when you call a contact from GHL, the dialer opens in a tiny collapsed bar at the top of the screen. You have to click a dropdown arrow to see the full keypad with End Call, Hold, Mute, and other controls. If you miss that dropdown, you can't even hang up!

This script automatically opens the full phone keypad the moment a call starts.

If you found this helpful, let me know at eric@uplevelpro.com

You must be an agency owner to use this script, not a subaccount in an agency.

If you don't have a GHL agency account yet, click here to get a free trial: https://www.gohighlevel.com/?fp_ref=uplevelpro32

## Installation

1. In your GHL agency, go to **Settings > Whitelabel > Custom Code > Custom JS**
2. Copy the entire contents of [`ghl-auto-open-phone-keypad.js`](./ghl-auto-open-phone-keypad.js)
3. Paste it into the Custom JS field
4. Click **Save**

That's it. The script applies automatically to all sub-accounts across your agency.

## What It Does

- Detects when an outbound call starts (via GHL store events and DOM observation)
- Automatically clicks the dropdown chevron on the collapsed call bar
- Opens the full dialer panel with End Call, Hold, Mute, Dial, Transfer, and other controls
- Resets after each call so the next call is auto-expanded too
- No interference with normal call flow — just removes the extra click

## Configuration

The script includes a `CONFIG` object at the top that you can adjust:

| Option | Default | Description |
|--------|---------|-------------|
| `CALL_BOX_SELECTOR` | `.call-box` | CSS selector for the collapsed call bar element |
| `CHEVRON_SELECTOR` | `.call-actions > div:last-child` | CSS selector for the dropdown chevron button |
| `OBSERVER_TARGET` | `#template-power-dialer` | CSS selector for the container to observe for call bar changes |
| `CLICK_DELAY` | `300` | Milliseconds to wait after detecting a call before clicking the chevron (gives DOM time to settle) |
| `DEBUG` | `true` | Set to `false` to disable `[AutoOpen Keypad]` console logging |

## How It Works (v13, GHL Vue 3)

1. **DOM Observer** — A debounced MutationObserver watches `<body>`. On each change it re-evaluates the dialer state with cheap `querySelector` checks
2. **Genuine-call detection** — A call is only considered live when the collapsed call bar (`.call-box`) is present **and** contains the red hang-up icon (`.call-actions svg.text-error-500`). This is what keeps the script inert at idle and stops it from ever acting on GHL's persistent header launcher
3. **Auto-Click the chevron** — The expand control is the `.cursor-pointer` inside `.call-actions` that is *not* the red hang-up. The script clicks it (via `dispatchEvent(new MouseEvent('click', { bubbles: true }))`) to open the full keypad. If no chevron is found it does **nothing** — there is no launcher fallback (that fallback caused spurious call windows after GHL's Vue 3 migration)
4. **Guard Flag** — `expandedThisCall` prevents re-clicking and only resets when the call is fully over (no call bar, no End Call button, no disposition panel) for 1.5s — so minimizing the keypad mid-call never re-opens it
5. **Double-injection guard** — `window.__ghlAutoOpenKeypadLoaded` ensures re-injected Custom JS can't stack observers/handlers

> **Note:** GHL's `AppUtils.StoreEvents` (`phoneCall` / `manualCallStatus`) do **not** fire for call activity in the current Vue 3 build, so v13 uses pure DOM detection.

## Compatibility

- Designed for GHL's agency-level Custom JS injection
- Works on any page where outbound calls can be initiated (Contact Detail, Conversations, etc.)
- No external dependencies — pure vanilla JavaScript
- No CSS required

## Changelog

### v13.0 — 2026-07-16
- **Fix: spurious "Call Results" windows after GHL's Vue 3 migration.** v12 fell back to clicking the header "Voice Calling" launcher (which *starts* a call) whenever its chevron selector missed — popping dialer/Call Results windows with no call made. v13 detects a genuine call via the red hang-up icon, expands only via the in-bar chevron, and **removes the launcher fallback entirely** (fail-safe: no chevron → do nothing).
- **Removed** the dead `phoneCall`/`manualCallStatus` `StoreEvents` subscription (never fires in Vue 3).
- **Added** a double-injection guard so re-injected Custom JS can't stack observers.
- Re-gated click-outside protection and disposition enforcement on the verified active-call signal.
- Verified live against the agency's Vue 3 DOM (detection inert at idle; chevron-click expands the panel).
- _Note: changelog jumps from v1.2 to v13.0 — interim v2–v12 iterations were tracked in the repo `DEVLOG.md`, not here._

### v1.2 — 2026-03-02
- **Fix:** Keypad no longer re-opens when minimized via the Phone icon. The reset logic now checks whether the entire power dialer container is empty (call truly ended) rather than just whether `.call-box` is absent — since `.call-box` disappears normally when the keypad is expanded.

### v1.1 — 2026-03-02
- **Fix (superseded by v1.2):** Added delayed reset to avoid DOM flicker during minimize.

### v1.0
- Initial release — auto-opens the phone keypad when an outbound call starts.

## Author

**Eric Langley** | [UpLevelPro.com](https://www.uplevelpro.com)

## License

[MIT](../LICENSE)
