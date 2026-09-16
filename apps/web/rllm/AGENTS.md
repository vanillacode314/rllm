# AGENTS.md — RLLM Web App (default)

A local-first LLM chat UI with end-to-end encrypted syncing between devices. Built with SolidJS, TanStack Router, Tailwind CSS v4, and SQLite.

## Build Commands

| Command | Description |
|---|---|
| `bun run dev` / `bun run start` | Dev server on port 3000 (`vite --port 3000 --mode ${VITE_MODE:-web}`) |
| `bun run build` | Production build for `$VITE_MODE` (`vite build --mode $VITE_MODE`) |
| `bun run build:web` | Web production build |
| `bun run build:android` | Android build, then `cap-sync` + `gradlew assembleRelease` |
| `bun run dev:android` | `cap run android` with `ANDROID_DEBUG=1` |
| `bun run serve` | Preview the production build |
| `bun run test` | `vitest run` — there are currently **no test files** in the repo |
| `bun run lint` | `oxlint --fix` (whole project) |
| `bun run format` | `oxfmt --write src` |
| `bun run typecheck` | `tsc` (TypeScript 7, `strict`) |
| `bun run db:migrate` | `drizzle-kit generate` + `node scripts/generate-migrations.ts` |
| `bun run cap-sync` | Capacitor config/version sync (`scripts/`) |
| `bun run dependencies` | Copy the pdf.js worker into `public/` |
| `bun run generate-pwa-assets` | Regenerate PWA icons/splash |

`VITE_MODE` also picks platform implementations: with `VITE_MODE=android` Vite aliases `src/db/client.platform.android.ts`, `src/lib/vector-db/client.platform.android.ts` and `src/lib/vector-db/transient.platform.android.ts` in place of their `.web.ts` counterparts (see the `resolve.alias` block in `vite.config.ts`). Everything else is shared between web and Android.

## Tech Stack

- **Framework**: SolidJS 1.9+, Vite 8, TypeScript 7 (strict, pinned via the monorepo catalog)
- **Routing**: TanStack Router (file-based, auto code-splitting)
- **Data Fetching**: TanStack Solid Query
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), UnoCSS (web fonts), Kobalte UI primitives (workspace `ui` package)
- **Database**: SQLite via sqlocal (OPFS) + Capacitor SQLite on Android, Drizzle ORM
- **PWA**: Serwist (service worker), workbox build
- **Workers**: Comlink for web worker RPC (encryption, markdown, syntax highlighting, RAG)
- **Encryption/Sync**: ethers for E2EE, Protobuf (bufbuild) for wire format
- **Error Handling**: `ts-result-option` (Result/Option types throughout)
- **Lint / format**: oxlint + oxfmt (not ESLint/Prettier)

## Code Style Guidelines

### TypeScript

- **Target**: ESNext with strict mode enabled
- **JSX**: Preserve with `solid-js` as JSX import source
- **Module**: ES modules with bundler resolution, `verbatimModuleSyntax`
- **Unused variables**: Prefix with `_` to ignore (enforced by oxlint)
- **Prefer const**: Always use `const` for destructuring

### Imports

- Use `~/*` alias for all src imports (e.g., `~/components/Button`); relative imports only for siblings inside the same feature folder
- Import grouping/sorting is enforced by the shared oxlint config (perfectionist plugin)
- Use `import type` for type-only imports
- Prefer top-level `import type` declarations over inline `import('pkg').Type` annotations

### Formatting (oxfmt)

Configured in `/workspace/packages/config/oxfmt.config.ts`, extended by `oxfmt.config.ts` (which ignores `src/routeTree.gen.ts` and `src/db/migrations.json`):

- **Indent**: Spaces (not tabs)
- **Quotes**: Single quotes
- **Trailing commas**: None
- **Print width**: 100 characters
- **Imports**: Sorted (`sortImports: true`)
- **package.json**: Not sorted by the formatter (`sortPackageJson: false`)

### Linting (oxlint)

`oxlint.config.ts` extends `@rthings/config/solid/oxlint.config`, adds the `oxlint-plugin-ts-result-option` JS plugin, and overrides two rules:

- `no-await-in-loop: 'off'` — sequential awaits are deliberate here (event-log replay, transactions, socket/stream loops); do not re-add per-line disables for it
- `ts-result-option/must-use-result: 'error'` — every `Result`/`AsyncResult` value must be handled (`match`/`unwrap`/`map`) or explicitly discarded with `void`

`solid/reactivity` is **on** (via `eslint-plugin-solid` in the shared config). When a tracked read is intentionally outside a tracked scope, add a targeted `// oxlint-disable-next-line solid/reactivity` with a reason instead of relaxing the rule.

### Naming Conventions

- **Components**: PascalCase (e.g., `ChatMessage.tsx`)
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants (preferred convention)
- **Types/Interfaces**: PascalCase with `T` prefix (e.g., `TMessage`, `TChat`)
- **Files**: camelCase for utilities, PascalCase for components, `use-*` for directive factories
- **DB tables**: camelCase
- **Route files**: kebab-case, `$` prefix for dynamic params, `-` prefix for colocated non-route files

### Styling

- **Tailwind CSS v4** with `@tailwindcss/vite`
- **UnoCSS** for web fonts and utilities only
- Use `class-variance-authority` for component variants
- Prefer `clsx` + `tailwind-merge` for class composition

### Error Handling

- Use `ts-result-option` for `Option`, `Result`, `AsyncResult` — never throw
- Use `tryBlock` from `ts-result-option/utils` with generator syntax (`async function*`) for fallible flows; `yield* <result>` behaves like Rust's `?`
- Annotate a `tryBlock` generator with `AsyncGen<T, E>` / `SyncGen<T, E>` (also from `ts-result-option/utils`) when you want the compiler to check each `return`/`yield` against `T`/`E` — without the annotation a wrong payload is reported on the `tryBlock` call, with it the offending `return` is flagged directly
- Handle errors with `.match()`, `.unwrapOr()`, `.inspectErr()`; discard unhandled values with `void` (lint-enforced)
- Use `safeParseJson` with Zod validation for runtime JSON parsing

### SolidJS Patterns

- **Reactivity**: Follow Solid's fine-grained reactivity model
- **Stores**: Use `createStore` for complex state, `createSignal` for simple state
- **Memoization**: Use `createMemo` for derived values
- **Effects**: Use `createComputed` for reactive computations
- **Immutability**: Use `produce` from immer for immutable updates
- **Debouncing**: Use `debounce` from `@tanstack/solid-pacer` for streaming updates
- **Event bus**: Use `CustomEvent` for cross-component communication (e.g., `chat:updated:noscroll`, `chat:handoff`)

### Component Structure

```tsx
// 1. Imports grouped by type
import { createSignal } from 'solid-js';
import type { TMyType } from '~/types';
import { MyComponent } from '~/components/MyComponent';

// 2. Types
interface Props {
  data: TMyType;
}

// 3. Component
export function MyComponent(props: Props) {
  const [count, setCount] = createSignal(0);
  return <div>{count()}</div>;
}
```

### Auto-imports

Only `./src/utils/debug.ts` is auto-imported (via `unplugin-auto-import`, configured in `vite.config.ts`). No other auto-imports are configured.

### PWA

- Service worker managed by Serwist, entry at `src/sw.ts`
- PWA assets generated via `bun run generate-pwa-assets`
- Brotli compression for production builds (config, JSON, JS, CSS, fonts, images)

## Project Architecture

### Directory Layout

```
src/
├── components/       # Reusable UI components (Kobalte primitives come from the `ui` workspace package)
│   ├── ChatList/     # Chat list panel components
│   ├── form/         # Form controls
│   ├── markdown/     # Markdown renderer (Markdown.tsx, Renderer.tsx, types.ts) + CopyButton
│   ├── modals/       # Modal dialogs (feedback, preset edit, auto-import wrappers)
│   ├── transitions/  # Transition helpers (TransitionAppear, TransitionSlide)
│   ├── Chat.tsx      # Main chat view
│   └── The*.tsx      # Layout chrome: sidebar, drawers, prompt box, command prompt
├── constants/        # App-wide constants (settings sections, user-metadata keys)
├── context/          # SolidJS context providers (chat, notifications)
├── db/               # Database layer
│   ├── schema.ts     # Combined tables export
│   ├── app-schema.ts # App tables (mcps, chats, providers, userMetadata, chatPresets)
│   ├── events-schema.ts # Event log tables (metadata, events)
│   ├── client.ts     # Database client entry
│   ├── client.platform.{web,android}.ts / client.platform.common.ts # Platform DB adapters
│   ├── client.constants.ts / client.types.ts
│   ├── migrationHooks.ts / migrations.json
│   └── utils.ts      # createDbApi / createLoggerProxy / parseDbRowsInPlace
├── directives/       # SolidJS directive factories (use-auto-scroll, use-hover-state-change, …)
├── lib/              # Core business logic
│   ├── chat/         # Chat settings, presets, tasks, tools, utils + generation/
│   ├── adapters/     # LLM provider adapters (OpenAI)
│   ├── mcp/          # MCP client, manager, schemas, utils
│   ├── providers/    # Provider configuration utilities
│   ├── rag/          # RAG for PDF/EPUB with embeddings
│   ├── vector-db/    # Vector DB clients (platform variants like db/)
│   ├── background-task-manager/ # Background task orchestration
│   ├── proxy.ts      # CORS proxy support
│   └── query-cache.ts
├── primitives/       # Small reusable reactive primitives (use-fuse)
├── queries/          # TanStack Query options (`queries` object) + mutations/
├── routes/           # TanStack Router file-based routes
│   ├── __root.tsx    # Root layout
│   ├── index.tsx     # Home
│   ├── $.tsx         # Catch-all
│   ├── documents.tsx / presets.tsx / settings.tsx
│   ├── (chat)/       # Chat route group
│   │   ├── -layout.tsx / -state.ts / -utils.ts / -constants.ts / -ChatAppDrawer.tsx
│   │   ├── chat/$.tsx # Individual chat
│   │   └── scratchpad.tsx
│   └── settings/     # Settings sub-routes (account, appearance, data, general, mcp, models, providers, proxy)
├── signals/          # Global signal definitions (account, index)
├── sockets/          # WebSocket/sync communication (messages, transports/)
├── styles/           # Additional styles (starry-night themes)
├── types/            # Zod-based type definitions (chat/, utils)
├── utils/            # Utility functions (crypto, markdown, tree, form, storage, …)
└── workers/          # Web workers (comlink RPC)
    ├── encryption/   # E2EE encryption worker
    ├── lowlight/     # Syntax highlighting (lowlight)
    ├── markdown/     # Markdown parsing
    ├── rag/          # RAG embedding + cosine similarity
    └── starry-night/ # Syntax highlighting (starry-night)
```

`src/routeTree.gen.ts` is generated by `@tanstack/router-plugin` (regenerated on dev/build; excluded from formatting).

### Key Modules

| Module | Role |
|---|---|
| `lib/chat/generation/index.ts` | `ChatGenerationManager` — orchestrates full LLM completion lifecycle with tool execution, RAG, handoff, and feedback |
| `lib/chat/index.ts` | `handleCompletion` — low-level streaming loop with tool call execution |
| `lib/chat/utils.ts` | `generateTitleAndTags`, `summarizeChat`, `makeTool` — utility completions |
| `lib/chat/tasks.ts` / `lib/background-task-manager/` | Background task orchestration for titles/tags/summaries |
| `lib/chat/settings.ts` | Chat settings schema (Zod) + init/update logic |
| `lib/chat/presets.ts` | Chat preset handling |
| `lib/adapters/openai/` | OpenAI-compatible API adapter |
| `lib/mcp/{index,client,manager,utils}.ts` | MCP manager — tool registration, discovery, JSON-RPC/SSE transport |
| `lib/rag/` | PDF/EPUB text extraction + embedding-based retrieval |
| `lib/proxy.ts` | CORS proxy support (`ProxyManager`) |
| `db/client.ts` (+ `client.platform.*`) | Platform database client: SQLite adapter, event-sourcing logger, and the `db` API |
| `db/utils.ts` | `createDbApi(logger)` — the `db.<table>.<method>()` read/write API (including one typed accessor pair per `USER_METADATA_KEYS` entry from `constants/user-metadata.ts`), plus `createLoggerProxy` and `parseDbRowsInPlace` |

## Database & Sync

- **Engine**: SQLite via `sqlocal` (in-browser OPFS) on web, Capacitor SQLite on Android
- **ORM**: Drizzle ORM with schemas split into `app-schema.ts` (domain tables) and `events-schema.ts` (event log)
- **Pattern**: Event-sourcing — every DB mutation is an event. Call `db.<table>.create/update/upsert/delete(...)` (or a typed `db.userMetadata.set…` accessor); those wrap `logger.dispatch(event)`, which is called nowhere else. Reads are `db.<table>.get/all/…`
- **Tables**:
  - `mcps` — MCP server configurations
  - `chats` — Chat conversations (messages stored as JSON)
  - `providers` — LLM provider configurations
  - `userMetadata` — Key-value user settings
  - `chatPresets` — Saved preset configurations
  - `metadata` — Event log metadata
  - `events` — Append-only event log
- **Sync**: End-to-end encrypted syncing via ethers + protobuf

## Data Flow

```
User action → Component → db.<table>.create/update/upsert/delete() → logger.dispatch(event) → Event log → DB update
                                              ↓
Data re-fetch ← db.<table>.get() ← Query cache ← Solid Query
```

`db` (exported from `src/db/client`, built by `createDbApi` in `src/db/utils.ts`) is the data-access layer: `db.<table>.get(id)` / `all()` / `paginated(…)` for reads, `create` / `update` / `upsert` / `delete` for writes, plus per-key `db.userMetadata.<key>()` / `setX()` accessors that own each metadata value's encoding. `src/queries/index.ts` mirrors the same table and method names as TanStack Query options, and components normally consume those.

## Adding a new sync-able event

When adding a user-state mutation that should be synced across all clients, it must go through the event-sourcing system. Follow these steps in order:

1. **Define the Zod event schema** — `src/queries/mutations.ts`
   Add a new discriminated union variant to `validEventSchema` with a unique `type` literal and a `data` object with all fields. `TValidEvent` is inferred automatically. Follow existing patterns (`createChat`, `updateProvider`, `deletePreset`, etc.).

2. **Define the DB table (if new)** — `src/db/app-schema.ts`
   If the event operates on a new table, add a `sqliteTable` and export select schemas + inferred types. Skip if operating on an existing table.

3. **Map event to DB updates** — `src/queries/mutations.ts`
   - Add the event `type` to the `userIntentToTable` map.
   - Add a `case` in the `processMessage` switch returning `TUpdate[]` with the correct operation (`insert`, `update`, `upsert`, `delete`) and invalidation query keys. Invalidation keys must match the query keys in `src/queries/index.ts`.

4. **Add the Protobuf message** — `packages/proto/proto/events/v1/event.proto`
   - Define a new `message` type for the event's data fields.
   - Add a new field to the `EventData` oneof with the next available field number.
   - Run `buf generate` (or `bun run proto:generate`) in `packages/proto/` to regenerate TypeScript bindings.

5. **Wire the component** — wherever the user action originates
   Add a `db` method in `src/db/utils.ts` that dispatches the event (`db.<table>.<verb>(...)`) and call that. The event flows through `processMessage` → DB update → query cache invalidation → WebSocket sync. No additional sync wiring is needed.

6. **Add the db methods and queries (optional)** — `src/db/utils.ts`, `src/queries/index.ts`
   If the new table needs client-facing access, add the reads/writes to `db` in `src/db/utils.ts`, then mirror each read as a `queries` option under the same name, keyed by the invalidation keys from step 3.

**Constraints**: Use this system only for state that must survive page reload and sync between devices. Local UI ephemera (scroll position, collapse state, etc.) should use SolidJS signals or local storage. Never remove or rename an event `type` — adding is safe and backward-compatible. Protobuf oneof field numbers must never be reused. All event data must be JSON-serializable.

## Routing

- File-based routing with TanStack Router (`@tanstack/router-plugin/vite`)
- Routes defined as files in `src/routes/`; groups like `(chat)` don't appear in the URL
- Use `createFileRoute` for route definitions
- Dynamic route parameters use `$` prefix (e.g., `$.tsx` for catch-all, `(chat)/chat/$.tsx` for individual chats)
- Route-level state and utilities are colocated using `-` prefix files (e.g., `(chat)/-state.ts`, `(chat)/-utils.ts`), which the router ignores as routes
- Auto code-splitting enabled

## Web Workers

All workers use Comlink (`vite-plugin-comlink`) for RPC communication:

| Worker | Purpose |
|---|---|
| `encryption/` | End-to-end encryption/decryption |
| `lowlight/` | Syntax highlighting via lowlight |
| `markdown/` | Markdown to HTML conversion |
| `rag/` | Text embedding + cosine similarity for RAG |
| `starry-night/` | Syntax highlighting via starry-night |

## Workspace Dependencies

This project uses workspace packages from the parent monorepo (`/workspace/packages/`):

- `config` (`@rthings/config`) — shared oxlint/oxfmt/tsconfig presets
- `ui` — UI primitives (`ui/button`, `ui/card`, `ui/*`) plus `ui/styles.css`
- `ts-result-option` — Result/Option types and `tryBlock`/`AsyncGen`/`SyncGen` (core error handling)
- `oxlint-plugin-ts-result-option` — lint rules enforcing Result usage (`must-use-result`, file naming, …)
- `event-logger` — Event sourcing log for DB operations
- `hlc` — Hybrid logical clock for ordering
- `proto` — Protocol buffer definitions (regenerate with `bun run proto:generate`)
- `object-pool` — Object pooling utility
- `vector-db` — Vector storage used by RAG

Other packages exist in the monorepo (`merkle-tree`, `event-bus`, the Go ports) but are not consumed by this app.

Always ensure workspace packages are properly linked before running commands.
