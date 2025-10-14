import { createRule } from "../utils.js";
import { ESLintUtils } from "@typescript-eslint/utils";
import "typescript";

//#region src/rules/must-use-result.ts
const VALID_USAGE_METHODS = new Set(["unwrap", "match"]);
const rule = createRule({
	create(context) {
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const resultVariables = /* @__PURE__ */ new Map();
		const tryBlockGenerators = /* @__PURE__ */ new WeakSet();
		function isValidUsage(node) {
			return node.property.type === "Identifier" && VALID_USAGE_METHODS.has(node.property.name);
		}
		function findResultVariablesInExpression(expression) {
			const resultVars = [];
			function traverse(node) {
				if (node.type === "Identifier") {
					const varName = node.name;
					if (resultVariables.get(varName)) resultVars.push(varName);
				}
				for (const key in node) {
					if (key === "parent" || key === "comments") continue;
					const value = node[key];
					if (value && typeof value === "object") traverse(value);
					else if (Array.isArray(value)) value.forEach(traverse);
				}
			}
			traverse(expression);
			return resultVars;
		}
		return {
			CallExpression(node) {
				if (node.callee.type === "Identifier" && node.callee.name === "tryBlock" && node.arguments.length > 0 && node.arguments[0].type === "FunctionExpression" && node.arguments[0].generator) tryBlockGenerators.add(node.arguments[0]);
			},
			YieldExpression(node) {
				if (!node.argument) return;
				const resultVars = findResultVariablesInExpression(node.argument);
				for (const varName of resultVars) {
					const variableInfo = resultVariables.get(varName);
					if (variableInfo) resultVariables.set(varName, {
						...variableInfo,
						yielded: true
					});
				}
			},
			ExpressionStatement(node) {
				const expression = node.expression;
				if (expression.type === "CallExpression" && expression.callee.type === "MemberExpression" && isValidUsage(expression.callee)) return;
				const tsNode = services.esTreeNodeToTSNodeMap.get(expression);
				if (isResultType(checker.getTypeAtLocation(tsNode), checker)) context.report({
					node,
					messageId: "mustUseResult"
				});
			},
			VariableDeclarator(node) {
				if (!node.init) return;
				const tsNode = services.esTreeNodeToTSNodeMap.get(node.init);
				if (isResultType(checker.getTypeAtLocation(tsNode), checker) && node.id.type === "Identifier") resultVariables.set(node.id.name, {
					node: node.id,
					used: false,
					returned: false,
					yielded: false
				});
			},
			MemberExpression(node) {
				if (isValidUsage(node)) {
					if (node.object.type === "Identifier") {
						const varName = node.object.name;
						const variableInfo = resultVariables.get(varName);
						if (variableInfo) resultVariables.set(varName, {
							...variableInfo,
							used: true
						});
					}
				}
			},
			ReturnStatement(node) {
				if (node.argument) {
					const resultVars = findResultVariablesInExpression(node.argument);
					for (const varName of resultVars) {
						const variableInfo = resultVariables.get(varName);
						if (variableInfo) resultVariables.set(varName, {
							...variableInfo,
							returned: true
						});
					}
				}
			},
			"FunctionExpression:exit"(node) {
				if (tryBlockGenerators.has(node)) return;
			},
			"Program:exit"() {
				for (const [varName, { node, used, returned, yielded }] of resultVariables.entries()) if (!used && !returned && !yielded) context.report({
					node,
					messageId: "mustUseResult"
				});
			}
		};
	},
	meta: {
		docs: {
			description: "Must use result by calling .unwrap() or .match() on it, unless returned, yielded, or used in tryBlock with yield*.",
			recommended: true,
			requiresTypeChecking: true
		},
		messages: { mustUseResult: "Must use result by calling .unwrap() or .match() on it, unless returned, yielded, or yield* in tryBlock." },
		type: "problem",
		schema: []
	},
	name: "must-use-result",
	defaultOptions: []
});
function isResultType(type, checker) {
	if (!VALID_USAGE_METHODS.values().some((method) => type.getProperty(method))) return false;
	const symbol = type.getSymbol();
	if (symbol && symbol.getName().includes("Result")) return true;
	if (type.isUnionOrIntersection()) return type.types.some((t) => isResultType(t, checker));
	return false;
}

//#endregion
export { rule };
//# sourceMappingURL=must-use-result.js.map