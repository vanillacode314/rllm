//#region src/tsgo.d.ts
/** Test-only introspection of the module-level caches. */
export declare function __stateForTests(): {
  hasApi: boolean;
  openProjects: string[];
};
/**
 * Type name at the exact span `[start, end)` of `filePath`, or `null`. Never throws.
 *
 * Returns `null` for every call when the compiler is unavailable; `startApi` has already
 * warned in that case.
 */
export declare function mustUseNameAtSpan(filePath: string, fileText: string, start: number, end: number): null | string;
/** `console.warn` once per key per process, prefixed `[ts-result-option] `. */
export declare function warnOnce(key: string, message: string): void;
//#endregion
//# sourceMappingURL=tsgo.d.mts.map