import { ExpressionStatementNode, RuleContextLike } from "./rules/must-use-result.mjs";
//#region src/index.d.ts
declare const _default: {
  meta: {
    name: string;
    version: string;
  };
  rules: {
    'must-use-result': {
      create(context: RuleContextLike): {
        ExpressionStatement(node: ExpressionStatementNode): void;
      };
      meta: {
        docs: {
          description: string;
          requiresTypeChecking: boolean;
        };
        hasSuggestions: boolean;
        messages: {
          readonly discardSuggestion: 'Discard this {{type}} explicitly with `void`.';
          readonly unusedMustUse: 'Unused {{type}} value. Handle it (e.g. `match`, `unwrap`, `map`) or discard it explicitly with `void`.';
        };
        schema: never[];
        type: string;
      };
    };
  };
};
//#endregion
export { _default as default };
//# sourceMappingURL=index.d.mts.map