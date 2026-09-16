//#region src/must-use-name.ts
/** Class names that must be handled when they appear in statement position. */
const MUST_USE_SYMBOL_NAMES = {
	AsyncResult: true,
	Option: true,
	Result: true
};
/**
* Directory segment of the package: `/…/ts-result-option/…` and pnpm's
* `ts-result-option@1.2.3/…`. A consumer's own `class Result` lives in their own
* file, which is what keeps it unflagged.
*/
const PACKAGE_DIR = /(?:^|[/\\])ts-result-option(?:@[^/\\]+)?[/\\]/;
const MESSAGES = {
	discardSuggestion: "Discard this {{type}} explicitly with `void`.",
	unusedMustUse: "Unused {{type}} value. Handle it (e.g. `match`, `unwrap`, `map`) or discard it explicitly with `void`."
};
/** Whether `fileName` belongs to the `ts-result-option` package itself. */
function isInPackageFile(fileName) {
	return PACKAGE_DIR.test(fileName.replaceAll("\\", "/"));
}
//#endregion
export { MESSAGES, MUST_USE_SYMBOL_NAMES, PACKAGE_DIR, isInPackageFile };

//# sourceMappingURL=must-use-name.mjs.map