# AGENTS.md — RLLM Web App (default)

A local-first LLM chat UI with end-to-end encrypted syncing between devices. Built with SolidJS, TanStack Router, Tailwind CSS v4, and SQLite.

## Build Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run start` | Alias for `dev` |
| `bun run build` | Build for production |
| `bun run serve` | Preview production build |
| `bun run test` | Run all tests (vitest run) |
| `bun run test <path>` | Run single test file |
| `bun run lint` | ESLint with auto-fix on `src/` |
| `bun run format` | Prettier write on `src/` |
| `bun run typecheck` | TypeScript type checking (`tsc`) |
| `bun run db:migrate` | Generate and run Drizzle migrations |

## Tech Stack

- **Framework**: SolidJS 1.9+, Vite 7, TypeScript 5.9 (strict)
- **Routing**: TanStack Router (file-based, auto code-splitting)
- **Data Fetching**: TanStack Solid Query
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), UnoCSS (web fonts), Kobalte UI primitives
- **Database**: SQLite via sqlocal (OPFS), Drizzle ORM
- **PWA**: Serwist (service worker), workbox build
- **Workers**: Comlink for web worker RPC (encryption, markdown, syntax highlighting, RAG)
- **Encryption/Sync**: ethers for E2EE, Protobuf (bufbuild) for wire format
- **Error Handling**: `ts-result-option` (Result/Option types throughout)

## Code Style Guidelines

### TypeScript

- **Target**: ESNext with strict mode enabled
- **JSX**: Preserve with `solid-js` as JSX import source
- **Module**: ES modules with bundler resolution, `verbatimModuleSyntax`
- **Unused variables**: Prefix with `_` to ignore (enforced by ESLint)
- **Prefer const**: Always use `const` for destructuring

### Imports

- Use `~/*` alias for all src imports (e.g., `~/components/Button`)
- ESLint enforces alias usage over relative imports (`@dword-design/import-alias`)
- Group imports: external deps → internal types → internal modules
- Use `import type` for type-only imports
- Import sorting enforced by `perfectionist` plugin (object sort is OFF)

### Formatting (Prettier)

- **Indent**: Spaces (not tabs)
- **Quotes**: Single quotes
- **Trailing commas**: None
- **Print width**: 100 characters
- **Experimental ternaries**: Enabled

### Naming Conventions

- **Components**: PascalCase (e.g., `ChatMessage.tsx`)
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants (preferred convention)
- **Types/Interfaces**: PascalCase with `T` prefix (e.g., `TMessage`, `TChat`)
- **Files**: camelCase for utilities, PascalCase for components
- **DB tables**: camelCase
- **Route files**: kebab-case, `$` prefix for dynamic params

### Styling

- **Tailwind CSS v4** with `@tailwindcss/vite`
- **UnoCSS** for web fonts and utilities only
- Use `class-variance-authority` for component variants
- Prefer `clsx` + `tailwind-merge` for class composition

### Error Handling

- Use `ts-result-option` library for `Option`, `Result`, `AsyncResult` types
- Use `tryBlock` with generator syntax (`async function*`) for async fallible operations
- Handle errors with `.match()`, `.unwrapOr()`, `.inspectErr()` — never throw
- Use `safeParseJson` with Zod validation for runtime JSON parsing
- `eslint-plugin-ts-result-option` enforces proper usage patterns

### SolidJS Patterns

- **Reactivity**: Follow Solid's fine-grained reactivity model
- **Stores**: Use `createStore` for complex state, `createSignal` for simple state
- **Memoization**: Use `createMemo` for derived values
- **Effects**: Use `createComputed` for reactive computations
- **Disable**: `solid/reactivity` ESLint rule is OFF (manual management)
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

Only `./src/utils/debug.ts` is auto-imported (via `unplugin-auto-import`). No other auto-imports are configured.

### PWA

- Service worker managed by Serwist, entry at `src/sw.ts`
- PWA assets generated via `bun run generate-pwa-assets`
- Brotli compression for production builds (config, JSON, JS, CSS, fonts, images)

## Project Architecture

### Directory Layout

```
src/
├── components/       # Reusable UI components
│   ├── ui/           # Kobalte-based primitives (button, dialog, switch, etc.)
│   ├── modals/       # Modal dialogs (feedback, preset edit, etc.)
│   ├── ChatList/     # Chat list panel components
│   ├── Chat.tsx      # Main chat view
│   ├── ChatSettingsControls.tsx
│   ├── TheChatSettingsDrawer.tsx
│   ├── TheCommandPrompt.tsx
│   └── ThePromptBox.tsx
├── constants/        # App-wide constants
├── context/          # SolidJS context providers
├── db/               # Database layer
│   ├── schema.ts     # Combined tables export
│   ├── app-schema.ts # App tables (mcps, chats, providers, userMetadata, chatPresets)
│   ├── events-schema.ts # Event log tables (metadata, events)
│   └── client.ts     # Database client + logger setup
├── directives/       # SolidJS custom directives
├── lib/              # Core business logic
│   ├── chat/         # Chat settings, generation, presets, utils
│   ├── adapters/     # LLM provider adapters (OpenAI)
│   ├── mcp/          # MCP client + manager
│   ├── providers/    # Provider configuration utilities
│   ├── rag/          # RAG for PDF/EPUB with embeddings
│   ├── proxy/        # CORS proxy support
│   └── background-task-manager/ # Background task orchestration
├── queries/          # Data fetching layer (`fetchers` object)
├── routes/           # TanStack Router file-based routes
│   ├── __root.tsx    # Root layout
│   ├── index.tsx     # Home
│   ├── $.tsx         # Catch-all
│   ├── chat/         # Chat routes
│   │   ├── $.tsx     # Individual chat (with -state.ts, -utils.ts, -ChatAppDrawer.tsx)
│   │   └── -state.ts # Chat-level signal state
│   ├── settings/     # Settings sub-routes
│   └── presets.tsx   # Presets management
├── signals/          # Global signal definitions
├── sockets/          # WebSocket/sync communication
├── styles/           # Additional styles (starry-night themes)
├── types/            # Zod-based type definitions (chat, utils)
├── utils/            # Utility functions (crypto, markdown, tree, form, etc.)
└── workers/          # Web workers (comlink RPC)
    ├── encryption/   # E2EE encryption worker
    ├── lowlight/     # Syntax highlighting (lowlight)
    ├── markdown/     # Markdown parsing
    ├── rag/          # RAG embedding + cosine similarity
    └── starry-night/ # Syntax highlighting (starry-night)
```

### Key Modules

| Module | Role |
|--------|------|
| `lib/chat/generation.ts` | `ChatGenerationManager` — orchestrates full LLM completion lifecycle with tool execution, RAG, handoff, and feedback |
| `lib/chat/index.ts` | `handleCompletion` — low-level streaming loop with tool call execution |
| `lib/chat/utils.ts` | `generateTitleAndTags`, `summarizeChat`, `makeTool` — utility completions |
| `lib/chat/settings.ts` | Chat settings schema (Zod) + init/update logic |
| `lib/adapters/openai/` | OpenAI-compatible API adapter |
| `lib/mcp/manager.ts` | MCPManager — tool registration and discovery |
| `lib/rag/` | PDF/EPUB text extraction + embedding-based retrieval |
| `db/client.ts` | Database client with event-sourcing logger |

## Database & Sync

- **Engine**: SQLite via `sqlocal` (in-browser OPFS)
- **ORM**: Drizzle ORM with schemas split into `app-schema.ts` (domain tables) and `events-schema.ts` (event log)
- **Pattern**: Event-sourcing — all DB mutations go through `logger.dispatch(event)` which writes events and applies changes
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
User action → Component → logger.dispatch(event) → Event log → DB update
                                              ↓
Data re-fetch ← fetchers.byId() ← Query cache ← Solid Query
```

The `fetchers` object in `src/queries/` provides the data access layer. Components call fetchers and receive reactive data through TanStack Solid Query.

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
   Call `logger.dispatch({ type: 'myNewEvent', data: { id, ...fields } })`. The event flows through `processMessage` → DB update → query cache invalidation → WebSocket sync. No additional sync wiring is needed.

6. **Add queries/fetchers (optional)** — `src/queries/index.ts`
   If the new table needs client-facing reads, add `fetchers` and `queries` objects matching the invalidation keys from step 3.

**Constraints**: Use this system only for state that must survive page reload and sync between devices. Local UI ephemera (scroll position, collapse state, etc.) should use SolidJS signals or local storage. Never remove or rename an event `type` — adding is safe and backward-compatible. Protobuf oneof field numbers must never be reused. All event data must be JSON-serializable.

## Routing

- File-based routing with TanStack Router (`@tanstack/router-plugin/vite`)
- Routes defined as files in `src/routes/`
- Use `createFileRoute` for route definitions
- Dynamic route parameters use `$` prefix (e.g., `$.tsx` for catch-all, `chat/$.tsx` for individual chats)
- Route-level state and utilities are colocated using `-` prefix files (e.g., `chat/-state.ts`, `chat/-utils.ts`)
- Auto code-splitting enabled

## Web Workers

All workers use Comlink (`vite-plugin-comlink`) for RPC communication:

| Worker | Purpose |
|--------|---------|
| `encryption/` | End-to-end encryption/decryption |
| `lowlight/` | Syntax highlighting via lowlight |
| `markdown/` | Markdown to HTML conversion |
| `rag/` | Text embedding + cosine similarity for RAG |
| `starry-night/` | Syntax highlighting via starry-night |

## Workspace Dependencies

This project uses workspace packages from the parent monorepo (`/home/projects/rllm/default/packages/`):

- `event-logger` — Event sourcing log for DB operations
- `hlc` — Hybrid logical clock for ordering
- `proto` — Protocol buffer definitions
- `ts-result-option` — Result/Option types (core error handling)
- `eslint-plugin-ts-result-option` — ESLint rules for Result types
- `object-pool` — Object pooling utility
- `merkle-tree` — Merkle tree implementation
- `rehype-shiki` — Shiki syntax highlighting for rehype
- `vite-plugin-dbg` — Vite plugin for development debugging (`process.env.NODE_ENV === 'development'`)

Always ensure workspace packages are properly linked before running commands.
