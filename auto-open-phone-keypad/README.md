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

## How It Works

1. **Store Event Listener** — Registers for `phoneCall` state changes via `AppUtils.StoreEvents` (GHL's built-in Custom JS API). When the phone call state changes, it checks if the collapsed call bar has appeared
2. **DOM Observer (Fallback)** — A MutationObserver watches `#template-power-dialer` for child element changes. When `.call-box` (the collapsed call bar) is inserted, it triggers the auto-expand
3. **Auto-Click** — After a short delay (configurable), the script finds the dropdown chevron inside `.call-actions` and programmatically clicks it, expanding the full dialer panel
4. **Guard Flag** — A flag prevents the script from re-clicking if the panel is already expanded. The flag resets when `.call-box` is removed from the DOM (call ended or panel already open), so the next call is handled fresh

## Compatibility

- Designed for GHL's agency-level Custom JS injection
- Works on any page where outbound calls can be initiated (Contact Detail, Conversations, etc.)
- No external dependencies — pure vanilla JavaScript
- No CSS required

## Author

**Eric Langley** | [UpLevelPro.com](https://www.uplevelpro.com)

## License

[MIT](../LICENSE)
