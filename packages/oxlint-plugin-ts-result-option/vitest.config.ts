import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // No `testTimeout`/`hookTimeout` here: both suites drive synchronous, event-loop-blocking
    // work (spawnSync, the tsgo sync API), so timers in this thread can never fire. The
    // oxlint child is bounded where it is spawned instead.
    include: ['tests/**/*.test.ts']
  }
});
