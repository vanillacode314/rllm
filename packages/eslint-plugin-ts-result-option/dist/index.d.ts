import { ExampleTypedLintingRuleDocs } from "./utils.js";
import * as _typescript_eslint_utils_dist_ts_eslint0 from "@typescript-eslint/utils/dist/ts-eslint";

//#region src/index.d.ts
declare const namespace: string;
declare const plugin: {
  meta: {
    name: string;
    version: string;
    namespace: string;
  };
  configs: {
    readonly recommended: {
      plugins: {
        [namespace]: /*elided*/any;
      };
      rules: {
        'ts-result-option/must-use-result': string;
      };
    };
  };
  rules: {
    'must-use-result': _typescript_eslint_utils_dist_ts_eslint0.RuleModule<"mustUseResult", [], ExampleTypedLintingRuleDocs, _typescript_eslint_utils_dist_ts_eslint0.RuleListener>;
  };
};
//#endregion
export { plugin as default };
//# sourceMappingURL=index.d.ts.map