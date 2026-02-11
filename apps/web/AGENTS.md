# AGENTS.md - RLLM Web App

This is a SolidJS web application using TanStack Router for file-based routing.

## Build Commands

```bash
# Development
bun run dev          # Start dev server on port 3000
bun run start        # Alias for dev

# Production
bun run build        # Build for production
bun run serve        # Preview production build

# Testing
bun run test         # Run all tests (vitest run)
bun run test <path>  # Run single test file

# Linting & Formatting
bun run lint         # ESLint with auto-fix on src/
bun run format       # Prettier write on src/

# Database
bun run db:migrate   # Generate and run Drizzle migrations


## Code Style Guidelines

### TypeScript
- **Target**: ESNext with strict mode enabled
- **JSX**: Preserve with `solid-js` as JSX import source
- **Module**: ES modules with bundler resolution
- **Unused variables**: Prefix with `_` to ignore (enforced by ESLint)
- **Prefer const**: Always use `const` for destructuring

### Imports
- Use `~/*` alias for all src imports (e.g., `~/components/Button`)
- ESLint enforces alias usage over relative imports
- Group imports: external deps → internal types → internal modules
- Use `import type` for type-only imports

### Formatting (Prettier)
- **Indent**: Tabs (not spaces)
- **Quotes**: Single quotes
- **Trailing commas**: None
- **Print width**: 100 characters
- **Experimental ternaries**: Enabled

### Naming Conventions
- **Components**: PascalCase (e.g., `ChatMessage.tsx`)
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Types/Interfaces**: PascalCase with `T` prefix (e.g., `TMessage`, `TChat`)
- **Files**: CamelCase for utilities, PascalCase for components

### Styling
- **Tailwind CSS v4** with `@tailwindcss/vite`
- **UnoCSS** for web fonts and utilities
- Use `class-variance-authority` for component variants
- Prefer `clsx` + `tailwind-merge` for class composition

### Error Handling
- Use `ts-result-option` library for Result/Option types
- Prefer `tryBlock` for async operations that may fail
- Handle errors with `.match()`, `.unwrapOr()`, `.inspectErr()`
- Never throw errors without handling in mutations

### SolidJS Patterns
- **Reactivity**: Follow Solid's fine-grained reactivity model
- **Stores**: Use `createStore` for complex state, `createSignal` for simple state
- **Memoization**: Use `createMemo` for derived values
- **Effects**: Use `createComputed` for reactive computations
- **Disable**: `solid/reactivity` ESLint rule is OFF (manual management)

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

### Database
- Use Drizzle ORM with SQLite
- Schema in `src/db/schema.ts`
- Run `bunx --bun run db:migrate` after schema changes

### Routing
- File-based routing with TanStack Router
- Routes in `src/routes/`
- Use `createFileRoute` for route definitions
- Route parameters use `$` prefix (e.g., `$.tsx` for catch-all)

## Workspace Dependencies

This project uses workspace dependencies from the parent monorepo:
- `event-logger` - Event logging system
- `hlc` - Hybrid logical clock
- `proto` - Protocol buffer definitions
- `ts-result-option` - Result/Option types
- `eslint-plugin-ts-result-option` - ESLint rules for Result types

Always ensure workspace packages are properly linked before running commands.
