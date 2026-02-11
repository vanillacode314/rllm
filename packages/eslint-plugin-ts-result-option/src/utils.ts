import { ESLintUtils } from '@typescript-eslint/utils'

export interface ExampleTypedLintingRuleDocs {
  description: string
  recommended?: boolean
  requiresTypeChecking?: boolean
}

export const createRule = ESLintUtils.RuleCreator<ExampleTypedLintingRuleDocs>(
  (name) => `hi`,
)
