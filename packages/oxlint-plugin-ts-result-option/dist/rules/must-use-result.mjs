import { MESSAGES } from "../must-use-name.mjs";
import { n as mustUseNameAtSpan } from "../tsgo-DvQVnWZx.mjs";
//#region src/rules/must-use-result.ts
const mustUseResult = {
	create(context) {
		return { ExpressionStatement(node) {
			const expression = node.expression;
			if (expression.type === "AssignmentExpression" || expression.type === "YieldExpression" || expression.type === "UnaryExpression" && expression.operator === "void") return;
			const [start, end] = expression.range;
			const type = mustUseNameAtSpan(context.filename, context.sourceCode.text, start, end);
			if (type === null) return;
			context.report({
				data: { type },
				messageId: "unusedMustUse",
				node: expression,
				suggest: [{
					data: { type },
					fix: (fixer) => fixer.replaceText(expression, `void (${context.sourceCode.getText(expression)})`),
					messageId: "discardSuggestion"
				}]
			});
		} };
	},
	meta: {
		docs: {
			description: "Require Result, Option and AsyncResult values to be handled (Rust `#[must_use]`).",
			requiresTypeChecking: true
		},
		hasSuggestions: true,
		messages: MESSAGES,
		schema: [],
		type: "problem"
	}
};
//#endregion
export { mustUseResult };

//# sourceMappingURL=must-use-result.mjs.map