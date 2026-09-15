# What's New

## v0.0.72 — September 15, 2026

### ✨ What's New

- **Keep several CORS proxies, with automatic fallback** — you can now save a whole list of proxy servers instead of just one. The app quietly switches to the first one that answers, so a single dead proxy no longer takes down every request.

### 🐛 Bug Fixes

- **Requests to other AI providers no longer fail over an OpenCode-only header** — an OpenCode session header was being attached to every OpenAI-compatible provider, which caused some providers and proxies to reject the request. It's now sent only to OpenCode.
