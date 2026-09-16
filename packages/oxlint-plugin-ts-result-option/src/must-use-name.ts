/** Class names that must be handled when they appear in statement position. */
export const MUST_USE_SYMBOL_NAMES: Record<string, true> = {
  AsyncResult: true,
  Option: true,
  Result: true
};

/**
 * Directory segment of the package: `/…/ts-result-option/…` and pnpm's
 * `ts-result-option@1.2.3/…`. A consumer's own `class Result` lives in their own
 * file, which is what keeps it unflagged.
 */
export const PACKAGE_DIR = /(?:^|[/\\])ts-result-option(?:@[^/\\]+)?[/\\]/;

export const MESSAGES = {
  discardSuggestion: 'Discard this {{type}} explicitly with `void`.',
  unusedMustUse:
    'Unused {{type}} value. Handle it (e.g. `match`, `unwrap`, `map`) or discard it explicitly with `void`.'
} as const;

/** Whether `fileName` belongs to the `ts-result-option` package itself. */
export function isInPackageFile(fileName: string): boolean {
  return PACKAGE_DIR.test(fileName.replaceAll('\\', '/'));
}
