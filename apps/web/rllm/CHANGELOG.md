# What's New

## v0.0.64 — September 11, 2026

### 🎨 Improvements

- **Opens faster** — the app now shows your content right away and finishes setting up its
  database in the background instead of holding up the first screen.
- **Snappier, more reliable offline** — pages you've already visited load instantly from a
  local copy, and more of the app keeps working offline.

### 🐛 Bug Fixes

- **Connection proxy** — the app now routes through your proxy only while it's actually
  working, and clearly reports it as unconfigured instead of silently sending requests to a
  broken address.
- **MCP servers** — MCP servers now pick up their updated address when your proxy status
  changes, instead of keeping a stale one.
