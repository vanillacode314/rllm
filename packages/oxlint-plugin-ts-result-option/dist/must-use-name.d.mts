//#region src/must-use-name.d.ts
/** Class names that must be handled when they appear in statement position. */
export declare const MUST_USE_SYMBOL_NAMES: Record<string, true>;
/**
 * Directory segment of the package: `/…/ts-result-option/…` and pnpm's
 * `ts-result-option@1.2.3/…`. A consumer's own `class Result` lives in their own
 * file, which is what keeps it unflagged.
 */
export declare const PACKAGE_DIR: RegExp;
export declare const MESSAGES: {
  readonly discardSuggestion: 'Discard this {{type}} explicitly with `void`.';
  readonly unusedMustUse: 'Unused {{type}} value. Handle it (e.g. `match`, `unwrap`, `map`) or discard it explicitly with `void`.';
};
/** Whether `fileName` belongs to the `ts-result-option` package itself. */
export declare function isInPackageFile(fileName: string): boolean;
//#endregion
//# sourceMappingURL=must-use-name.d.mts.map