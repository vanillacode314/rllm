# What's New

## v0.0.42 — August 17, 2026

### 🐛 Bug Fixes
- **Syncing between devices is more reliable** — If one of your devices goes offline, your other devices now notice right away and stop waiting for it, so sync no longer gets stuck trying to reach a disconnected device.
- **Stale errors no longer linger after a refresh** — If a refresh failed, the app could keep showing an old error and ignore newer results. Refreshing now works correctly every time.
