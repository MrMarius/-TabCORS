# Per-Tab CORS

A Chrome/Brave extension that lets you toggle CORS bypass on individual tabs. Enable it on your dev server tab without breaking Google, Slack, or anything else.

## Why?

Existing CORS extensions apply globally — flip the switch and every tab gets CORS headers overridden. This breaks authenticated sites and is way too blunt for development work.

Per-Tab CORS gives you **per-origin control**. `http://localhost:3000` and `http://localhost:4000` are toggled independently. Only the tabs you choose are affected.

## Install

1. Clone or download this repo
2. Open `chrome://extensions` (or `brave://extensions`)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the repo directory

The extension icon appears in your toolbar.

## Usage

1. Navigate to the page where you need CORS bypass (e.g. `http://localhost:3000`)
2. Click the extension icon
3. Flip the toggle **ON**

That's it. The icon shows a green **ON** badge on tabs where CORS bypass is active. All other tabs are untouched.

### What happens under the hood

- Response headers (`Access-Control-Allow-Origin`, `Allow-Methods`, `Allow-Headers`, `Allow-Credentials`, etc.) are injected on all responses for enabled tabs
- `Access-Control-Allow-Origin` is set to the tab's actual origin (not `*`), so credentialed requests with cookies work correctly
- `Access-Control-Max-Age` is set to `0` so toggling takes effect immediately — no stale preflight cache
- Rules are scoped to individual tab IDs using Chrome's `declarativeNetRequest` API

### Managing origins

- The popup shows all currently enabled origins with a **x** button to remove each one
- New tabs opened at an already-enabled origin automatically get CORS bypass applied
- Navigating away from an enabled origin clears the rule on that tab
- Enabled origins persist across browser restarts

## Limitations

- **Cannot modify the outgoing `Origin` request header.** Chrome protects this in Manifest V3. The response-side CORS headers cover the vast majority of CORS errors encountered during development.
- **Overwrites existing CORS headers.** If the server already sends `Access-Control-Allow-Origin`, the extension replaces it. This is intentional for a dev tool.
- **Non-HTTP pages** (`chrome://`, `brave://`, `about:`, `file://`) cannot be toggled — the popup will show a disabled state.

## Permissions

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Inject CORS response headers |
| `storage` | Persist enabled origins across sessions |
| `tabs` | Read tab URLs to match against enabled origins |
| `activeTab` | Access the current tab when the popup opens |
| `<all_urls>` | Apply header modifications to responses from any URL |

## License

MIT
=======
# -TabCors
Bypass CORS restrictions during development without disabling browser security globally. Enable it per origin with a single toggle — all tabs from that site are instantly unblocked. Turn it    off when you're done. Everything else stays untouched. Settings persist across restarts.
