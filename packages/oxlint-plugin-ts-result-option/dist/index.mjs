import { mustUseResult } from "./rules/must-use-result.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
//#region src/index.ts
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8"));
var src_default = {
	meta: {
		name: pkg.name,
		version: pkg.version
	},
	rules: { "must-use-result": mustUseResult }
};
//#endregion
export { src_default as default };

//# sourceMappingURL=index.mjs.map