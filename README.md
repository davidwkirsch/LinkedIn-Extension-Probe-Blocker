# Extension Probe Blocker

Chrome extension that blocks `chrome-extension://` resource probes commonly used to fingerprint installed extensions on `www.linkedin.com`.

## Features

- Intercepts extension probes made with `fetch`.
- Intercepts extension probes made with `XMLHttpRequest`.
- Intercepts extension probes made by assigning an extension URL to an `Image`.
- Returns a clean `404 Not Found` response or image error so probe scripts treat the extension as unavailable.
- Shows the current state in the toolbar badge.
- Lets you enable or disable blocking by clicking the extension icon.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder, the folder containing `manifest.json`.

Blocking is enabled by default after installation. Click the toolbar icon to toggle it. Reload open pages after installing the extension so the content script is injected into them.

## Repository layout

```text
blocker/
├── images/       Extension icons and screenshots
├── src/          Background service worker and content script
├── manifest.json Chrome extension manifest
└── README.md     Project documentation
```

## Permissions

- `storage`: stores the enabled or disabled state.
- `scripting`: applies state changes to already-open tabs.
- `tabs`: finds open tabs when the state is toggled.
- `https://www.linkedin.com/*`: runs the probe-blocking content script on LinkedIn.

## Notes

This extension is intended for Chrome and Chromium-based browsers that support Manifest V3. It only runs on `https://www.linkedin.com/*`; browser-internal pages, extension pages, PDFs, and other restricted documents are not injectable.