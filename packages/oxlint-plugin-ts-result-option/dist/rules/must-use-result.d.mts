//#region src/rules/must-use-result.d.ts
export interface ExpressionStatementNode {
  expression: {
    operator?: string;
    range: [number, number];
    type: string;
  };
  type: 'ExpressionStatement';
}
export interface RuleContextLike {
  filename: string;
  options: readonly unknown[];
  report(descriptor: {
    data: {
      type: string;
    };
    messageId: 'unusedMustUse';
    node: unknown;
    suggest: {
      data: {
        type: string;
      };
      fix(fixer: {
        replaceText(node: unknown, text: string): unknown;
      }): unknown;
      messageId: 'discardSuggestion';
    }[];
  }): void;
  sourceCode: {
    getText(node: unknown): string;
    text: string;
  };
}
export declare const mustUseResult: {
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
//#endregion
//# sourceMappingURL=must-use-result.d.mts.map