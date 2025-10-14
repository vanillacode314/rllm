import { ESLintUtils } from '@typescript-eslint/utils'
import { createRule } from '../utils'
import ts from 'typescript'

const VALID_USAGE_METHODS = new Set([
  'unwrap',
  'match',
  'unwrapErr',
  'expect',
  'expectErr',
  'isOk',
  'isErr',
])

export const rule = createRule({
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    const resultVariables = new Map<
      string,
      { node: any; used: boolean; returned: boolean; yielded: boolean }
    >()

    const tryBlockGenerators = new WeakSet<any>() // Track generator functions in tryBlock

    function isValidUsage(node: any): boolean {
      return (
        node.property.type === 'Identifier' &&
        VALID_USAGE_METHODS.has(node.property.name)
      )
    }

    // Helper function to find Result variables in any expression
    function findResultVariablesInExpression(expression: any): string[] {
      const resultVars: string[] = []

      function traverse(node: any): void {
        if (node.type === 'Identifier') {
          const varName = node.name
          const variableInfo = resultVariables.get(varName)
          if (variableInfo) {
            resultVars.push(varName)
          }
        }

        // Traverse child nodes
        for (const key in node) {
          if (key === 'parent' || key === 'comments') continue
          const value = node[key]
          if (value && typeof value === 'object') {
            traverse(value)
          } else if (Array.isArray(value)) {
            value.forEach(traverse)
          }
        }
      }

      traverse(expression)
      return resultVars
    }

    return {
      CallExpression(node) {
        // Detect tryBlock(async function*() { ... })
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'tryBlock' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'FunctionExpression' &&
          node.arguments[0].generator
        ) {
          tryBlockGenerators.add(node.arguments[0])
        }
      },

      YieldExpression(node) {
        if (!node.argument) return

        // Find all Result variables in the yield expression
        const resultVars = findResultVariablesInExpression(node.argument)

        // Mark all found Result variables as yielded
        for (const varName of resultVars) {
          const variableInfo = resultVariables.get(varName)
          if (variableInfo) {
            resultVariables.set(varName, { ...variableInfo, yielded: true })
          }
        }
      },

      ExpressionStatement(node) {
        const expression = node.expression

        if (
          expression.type === 'CallExpression' &&
          expression.callee.type === 'MemberExpression' &&
          isValidUsage(expression.callee)
        ) {
          return
        }

        const tsNode = services.esTreeNodeToTSNodeMap.get(expression)
        const type = checker.getTypeAtLocation(tsNode)

        if (isResultType(type, checker)) {
          context.report({
            node,
            messageId: 'mustUseResult',
          })
        }
      },

      VariableDeclarator(node) {
        if (!node.init) return

        const tsNode = services.esTreeNodeToTSNodeMap.get(node.init)
        const type = checker.getTypeAtLocation(tsNode)

        if (isResultType(type, checker) && node.id.type === 'Identifier') {
          resultVariables.set(node.id.name, {
            node: node.id,
            used: false,
            returned: false,
            yielded: false,
          })
        }
      },

      MemberExpression(node) {
        if (isValidUsage(node)) {
          if (node.object.type === 'Identifier') {
            const varName = node.object.name
            const variableInfo = resultVariables.get(varName)
            if (variableInfo) {
              resultVariables.set(varName, { ...variableInfo, used: true })
            }
          }
        }
      },

      ReturnStatement(node) {
        if (node.argument) {
          // Find Result variables in the return expression
          const resultVars = findResultVariablesInExpression(node.argument)
          for (const varName of resultVars) {
            const variableInfo = resultVariables.get(varName)
            if (variableInfo) {
              resultVariables.set(varName, { ...variableInfo, returned: true })
            }
          }
        }
      },

      'FunctionExpression:exit'(node) {
        if (tryBlockGenerators.has(node)) {
          // We are exiting a generator inside tryBlock, nothing more to do here
          return
        }
      },

      'Program:exit'() {
        for (const [
          varName,
          { node, used, returned, yielded },
        ] of resultVariables.entries()) {
          if (!used && !returned && !yielded) {
            context.report({
              node,
              messageId: 'mustUseResult',
            })
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Must use result by calling .unwrap() or .match() on it, unless returned, yielded, or used in tryBlock with yield*.',
      recommended: true,
      requiresTypeChecking: true,
    },
    messages: {
      mustUseResult:
        'Must use result by calling .unwrap() or .match() on it, unless returned, yielded, or yield* in tryBlock.',
    },
    type: 'problem',
    schema: [],
  },
  name: 'must-use-result',
  defaultOptions: [],
})

function isResultType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const hasValidMethod = VALID_USAGE_METHODS.values().some((method) =>
    type.getProperty(method),
  )

  if (!hasValidMethod) {
    return false
  }

  const symbol = type.getSymbol()
  if (symbol && symbol.getName().includes('Result')) {
    return true
  }

  if (type.isUnionOrIntersection()) {
    return type.types.some((t) => isResultType(t, checker))
  }

  return false
}
