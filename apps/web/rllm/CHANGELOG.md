# What's New

## v0.0.11 — August 1, 2026

### 🎨 Improvements

- **Faster data saving** — background bookkeeping was optimized, so the app spends less time saving data in the background.

### 🐛 Bug Fixes

- **Dollar amounts no longer get mangled in messages** — text like `$50` or `$1,000` was previously mistaken for math and rendered incorrectly, which was especially annoying for financial figures. Math now only renders when you or the LLM deliberately use `$$ ... $$`, so amounts and formulas both look correct.
