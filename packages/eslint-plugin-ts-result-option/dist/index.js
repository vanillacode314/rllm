import { rule } from "./rules/must-use-result.js";
import fs from "node:fs";
import path from "node:path";

//#region src/index.ts
const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../package.json"), "utf8"));
const namespace = pkg.name.replace(/^eslint-plugin-/, "");
const plugin = {
	meta: {
		name: pkg.name,
		version: pkg.version,
		namespace
	},
	configs: { get recommended() {
		return recommended;
	} },
	rules: { "must-use-result": rule }
};
const recommended = {
	plugins: { [namespace]: plugin },
	rules: { "ts-result-option/must-use-result": "error" }
};
var src_default = plugin;

//#endregion
export { src_default as default };
//# sourceMappingURL=index.js.map