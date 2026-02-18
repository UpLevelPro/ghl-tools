# Changelog

All notable changes to Smart List Column Auto-Fit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2025-02-18

### Fixed
- Race condition where column widths were lost after sorting — Tabulator's async re-render would overwrite applied widths before they could take effect
- Initial page load sometimes missed auto-fit when table rows were still rendering

### Added
- Retry mechanism (`MAX_RETRIES`, `RETRY_DELAY`) — after applying widths, verifies they weren't overwritten and re-applies if needed
- `requestAnimationFrame` wrapping for all width application to run after browser layout pass
- Table stability check (`STABILITY_CHECKS`) — requires consistent row count across consecutive polls before auto-fitting
- GHL `routeChangeEvent` and `routeLoaded` event listeners as primary SPA navigation detection
- Progressive `AppUtils.StoreEvents` integration for marketplace app contexts

### Changed
- MutationObserver debounce increased from 100ms to 300ms (`DEBOUNCE_MS`) to allow Tabulator to finish DOM rebuilds
- Timeout fallback now attempts auto-fit if table exists rather than silently giving up

## [1.0.0] - 2025-02-17

### Added
- Initial release
- Auto-fit columns based on header text and cell content width
- SPA navigation detection via `history.pushState`/`replaceState`/`popstate`
- MutationObserver for sort, filter, pagination, and Manage Fields changes
- Configurable `MIN_WIDTH`, `MAX_WIDTH`, `HEADER_PADDING`, `CELL_PADDING`, `SAMPLE_ROWS`
