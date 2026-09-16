import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  getTokenAtPosition,
  isCallExpression,
  isPropertyAccessExpression
} from 'typescript/unstable/ast';
import type { Node, SourceFile } from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';
import type {
  Checker,
  Project,
  Snapshot,
  Symbol as TsSymbol,
  Type
} from 'typescript/unstable/sync';

import { isInPackageFile, MUST_USE_SYMBOL_NAMES } from './must-use-name.ts';

let api: API | undefined;
let snapshot: Snapshot | undefined;
const openProjects = new Set<string>();
const warned = new Set<string>();

/**
 * `mustUseNameAtSpan` runs for every expression statement, so the filesystem walk that
 * resolves the tsconfig is memoized per directory (`null`: resolved, none found) and the
 * program lookup, with its buffer comparison, per file.
 */
const tsconfigsByDir = new Map<string, null | string>();
const validatedFiles = new Map<string, { fileText: string; sourceFile: SourceFile }>();

/**
 * The tsgo client spawns the compiler over Node pipe internals (`stdout._handle.fd`).
 * Under Bun that throws and leaves the compiler child keeping the process alive, so
 * never spawn anything there.
 */
const BUN = process.versions.bun !== undefined;

/**
 * `Option::inspect` carries no `#[must_use]` in Rust (std documents the bare statement form)
 * and returns its receiver, so dropping the call loses nothing. `inspectErr` is not listed:
 * `Result` is `#[must_use]` as a type, so a dropped `Result` warns in every position.
 */
const PASS_THROUGH_METHOD_NAMES: Record<string, true> = { inspect: true };

/** Test-only introspection of the module-level caches. */
export function __stateForTests(): { hasApi: boolean; openProjects: string[] } {
  return { hasApi: api !== undefined, openProjects: [...openProjects] };
}

/**
 * Type name at the exact span `[start, end)` of `filePath`, or `null`. Never throws.
 *
 * Returns `null` for every call when the compiler is unavailable; `startApi` has already
 * warned in that case.
 */
export function mustUseNameAtSpan(
  filePath: string,
  fileText: string,
  start: number,
  end: number
): null | string {
  try {
    if (api === undefined) return null;

    const tsconfig = findTsconfig(filePath);

    if (tsconfig === undefined) {
      warnOnce(`no-tsconfig:${filePath}`, `no tsconfig.json found for ${filePath}; skipped`);

      return null;
    }

    const project = getProject(tsconfig);

    if (project === undefined) {
      warnOnce(`no-project:${tsconfig}`, `could not open project ${tsconfig}; skipped`);

      return null;
    }

    const sourceFile = sourceFileIn(project, filePath, fileText, tsconfig);

    if (sourceFile === undefined) return null;

    const node = nodeAtSpan(sourceFile, start, end);

    if (node === undefined) {
      warnOnce(`no-node:${filePath}`, `could not map an expression in ${filePath}; skipped`);

      return null;
    }

    const type = project.checker.getTypeAtLocation(node);
    const name = type === undefined ? null : mustUseNameOfType(type);

    // Rust marks `Option` must-use per method, not as a type, so a value that merely flows
    // out of some callee (a setter returning the previous value, a getter) is not a dropped
    // computation. `Result` and `AsyncResult` are must-use as types.
    return name === 'Option' && !buildsOrTransformsMustUse(node, sourceFile, project.checker)
      ? null
      : name;
  } catch (error) {
    warnOnce(
      `error:${filePath}`,
      `could not resolve the type of a statement in ${filePath} (${error instanceof Error ? error.message : String(error)}); skipped`
    );

    return null;
  }
}

/** `console.warn` once per key per process, prefixed `[ts-result-option] `. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;

  warned.add(key);
  console.warn(`[ts-result-option] ${message}`);
}

/**
 * The compiler child is spawned by the first request, and `spawn` fails with ENOMEM once
 * oxlint has started its worker-thread pool (the parent's committed memory is large by
 * then). Warm the compiler up while the plugin module loads, before linting starts.
 */
function startApi(): void {
  if (BUN) {
    warnApiUnavailable('Bun is not supported');

    return;
  }

  try {
    const instance = new API({ cwd: process.cwd() });

    // Graceful shutdown from `beforeExit`: closing during `exit` cancels the in-flight
    // close handshake, and makes tsgo log `context canceled` to stderr. Register the hook
    // before the first request: `updateSnapshot` is what spawns the compiler child, so a
    // throw below would otherwise leave a child behind keeping the process alive.
    process.once('beforeExit', () => instance.close());
    snapshot = instance.updateSnapshot();
    api = instance;
  } catch (error) {
    warnApiUnavailable(error);
  }
}

/** Warns once that no type information is available for this run. */
function warnApiUnavailable(error: unknown): void {
  warnOnce(
    'api',
    `cannot start the TypeScript native API (${error instanceof Error ? error.message : String(error)}); rule disabled for this run (run oxlint with Node)`
  );
}

startApi();

function buildsOrTransformsMustUse(node: Node, sourceFile: SourceFile, checker: Checker): boolean {
  if (!isCallExpression(node) || !isPropertyAccessExpression(node.expression)) return false;

  const callee = node.expression;
  const method = sourceFile.text.slice(callee.name.getStart(sourceFile), callee.name.getEnd());

  if (PASS_THROUGH_METHOD_NAMES[method] === true) return false;

  const receiver = checker.getTypeAtLocation(callee.expression);

  return receiver !== undefined && mustUseNameOfType(receiver) !== null;
}

function declaredInMustUsePackage(symbol: TsSymbol): boolean {
  if (MUST_USE_SYMBOL_NAMES[symbol.name] !== true) return false;

  const declaration = symbol.declarations?.[0] ?? symbol.valueDeclaration;

  return declaration !== undefined && isInPackageFile(declaration.path);
}

/** Nearest `tsconfig.json` at or above `filePath`, memoized per directory. */
function findTsconfig(filePath: string): string | undefined {
  const start = dirname(filePath);
  const cached = tsconfigsByDir.get(start);

  if (cached !== undefined) return cached ?? undefined;

  // Every directory the walk visits resolves to the same nearest tsconfig, because each
  // of them was searched upward to the same stopping point.
  const visited: string[] = [];
  let dir = start;
  let found: null | string = null;

  for (;;) {
    const hit = tsconfigsByDir.get(dir);

    if (hit !== undefined) {
      found = hit;

      break;
    }

    visited.push(dir);

    const candidate = join(dir, 'tsconfig.json');

    if (existsSync(candidate)) {
      found = candidate;

      break;
    }

    const parent = dirname(dir);

    if (parent === dir) break;

    dir = parent;
  }

  for (const visitedDir of visited) tsconfigsByDir.set(visitedDir, found);

  return found ?? undefined;
}

function getProject(tsconfig: string): Project | undefined {
  if (api === undefined) return;

  if (!openProjects.has(tsconfig)) {
    // Opens are ref-counted on the API instance, so earlier projects stay in later snapshots.
    snapshot = api.updateSnapshot({ openProjects: [tsconfig] });
    openProjects.add(tsconfig);
  }

  return snapshot?.getProject(tsconfig);
}

function mustUseNameOfType(type: Type): null | string {
  const symbol = type.getSymbol();

  if (symbol !== undefined && declaredInMustUsePackage(symbol)) return symbol.name;

  const alias = type.getAliasSymbol();

  if (alias !== undefined && declaredInMustUsePackage(alias)) return alias.name;

  if (type.isUnionType() || type.isIntersectionType()) {
    for (const member of type.getTypes()) {
      const name = mustUseNameOfType(member);

      if (name !== null) return name;
    }
  }

  return null;
}

/**
 * Node whose span is exactly `[start, end)`, preferring the innermost match and
 * falling back to the largest node starting at `start` that stays inside `end`
 * (hosts whose ranges include parentheses).
 */
function nodeAtSpan(sourceFile: SourceFile, start: number, end: number): Node | undefined {
  let node = getTokenAtPosition(sourceFile, start);
  let fallback: Node | undefined;

  for (;;) {
    if (node.getStart(sourceFile) !== start) return fallback;

    if (node.getEnd() === end) return node;

    if (node.getEnd() <= end) fallback = node;

    const parent: Node = node.parent;

    if (parent === undefined || parent === node) return fallback;

    node = parent;
  }
}

/**
 * `filePath`'s source file in `project`, or `undefined` when the project does not include it
 * or the buffer differs from the file on disk (both warned once).
 */
function sourceFileIn(
  project: Project,
  filePath: string,
  fileText: string,
  tsconfig: string
): SourceFile | undefined {
  const cached = validatedFiles.get(filePath);
  let sourceFile: SourceFile | undefined;

  if (cached !== undefined && cached.fileText === fileText) {
    sourceFile = cached.sourceFile;
  } else {
    sourceFile = project.program.getSourceFile(filePath);

    if (sourceFile !== undefined && sourceFile.text === fileText) {
      validatedFiles.set(filePath, { fileText, sourceFile });
    }
  }

  if (sourceFile === undefined) {
    warnOnce(`no-file:${filePath}`, `no project includes ${filePath} (tsconfig: ${tsconfig})`);

    return;
  }

  if (sourceFile.text !== fileText) {
    warnOnce(
      `stale:${filePath}`,
      `${filePath} on disk differs from the linted buffer; skipped (save and re-run)`
    );

    return;
  }

  return sourceFile;
}
