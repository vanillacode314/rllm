import { MESSAGES } from '../must-use-name.ts';
import { mustUseNameAtSpan } from '../tsgo.ts';

export interface ExpressionStatementNode {
  expression: { operator?: string; range: [number, number]; type: string };
  type: 'ExpressionStatement';
}

export interface RuleContextLike {
  filename: string;
  options: readonly unknown[];
  report(descriptor: {
    data: { type: string };
    messageId: 'unusedMustUse';
    node: unknown;
    suggest: {
      data: { type: string };
      fix(fixer: { replaceText(node: unknown, text: string): unknown }): unknown;
      messageId: 'discardSuggestion';
    }[];
  }): void;
  sourceCode: { getText(node: unknown): string; text: string };
}

export const mustUseResult = {
  create(context: RuleContextLike) {
    return {
      ExpressionStatement(node: ExpressionStatementNode) {
        const expression = node.expression;

        // `void expr;` is the explicit discard: Oxc/ESTree spells it `UnaryExpression` with
        // operator `void`, so the check short-circuits before any type resolution. A yielded
        // value is consumed, not dropped (`tryBlock` returns the first yielded value,
        // `yield*` delegates to the type's iterator); an assignment binds the value, and
        // Rust's `x = v;` has type `()`, so nothing is dropped.
        if (
          expression.type === 'AssignmentExpression' ||
          expression.type === 'YieldExpression' ||
          (expression.type === 'UnaryExpression' && expression.operator === 'void')
        )
          return;

        const [start, end] = expression.range;
        const type = mustUseNameAtSpan(context.filename, context.sourceCode.text, start, end);

        if (type === null) return;

        context.report({
          data: { type },
          messageId: 'unusedMustUse',
          node: expression,
          suggest: [
            {
              data: { type },
              // `void` binds tighter than conditional, logical and sequence operators, so the
              // operand has to be parenthesized: `void cond && opt` would discard `cond` only.
              fix: (fixer) =>
                fixer.replaceText(expression, `void (${context.sourceCode.getText(expression)})`),
              messageId: 'discardSuggestion'
            }
          ]
        });
      }
    };
  },
  meta: {
    docs: {
      description:
        'Require Result, Option and AsyncResult values to be handled (Rust `#[must_use]`).',
      requiresTypeChecking: true
    },
    hasSuggestions: true,
    messages: MESSAGES,
    schema: [],
    type: 'problem'
  }
};
