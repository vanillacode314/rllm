# What's New

## v0.0.39 — August 16, 2026

### 🐛 Bug Fixes

- **Copy button copies exactly what you see** — When a code block was still being generated, clicking Copy could grab old or incomplete text. It now always matches what's shown on screen.
- **Streaming replies stay accurate** — Fixed a race condition that could let older response content overwrite newer content while a reply was still being written out.
- **Deleting data syncs more cleanly** — Fixed an issue where deleting chats or other data could leave stale sync records behind, sometimes causing deleted items to come back or sync inconsistently between devices.

### 🎨 Improvements

- **Faster, more reliable device sync** — Devices now compare and exchange changes more efficiently, so syncing your chats between devices is quicker and less error-prone.
