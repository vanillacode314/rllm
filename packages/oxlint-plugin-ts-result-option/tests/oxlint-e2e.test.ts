import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { mustUseResult } from '../src/rules/must-use-result.ts';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = join(pkgRoot, 'tests/fixtures/oxlint-project');
const oxlintBin = join(
  dirname(createRequire(import.meta.url).resolve('oxlint/package.json')),
  'bin/oxlint'
);
const badFile = join(fixtureDir, 'bad.ts');
const goodFile = join(fixtureDir, 'good.ts');

interface Diagnostic {
  code: string;
  filename: string;
  labels: { span: { length: number; offset: number } }[];
  message: string;
}

interface RuleReport {
  data: { type: string };
  suggest: { fix(fixer: { replaceText(node: unknown, replacement: string): unknown }): unknown }[];
}

const fixer = { replaceText: (node: unknown, replacement: string) => ({ node, replacement }) };

function oxlintDiagnostics(): Diagnostic[] {
  // The test body blocks the event loop, so the child has to carry its own timeout.
  const result = spawnSync(
    process.execPath,
    [oxlintBin, '-c', join(fixtureDir, 'oxlint.config.mjs'), '--format', 'json', fixtureDir],
    { cwd: pkgRoot, encoding: 'utf8', timeout: 60_000 }
  );

  expect(result.error).toBeUndefined();
  expect(result.stderr).not.toContain('Failed to load JS plugin');
  expect(result.stderr).not.toContain('[ts-result-option]');
  expect(result.status).toBe(1);

  const parsed = JSON.parse(result.stdout) as { diagnostics: Diagnostic[] };

  return parsed.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'ts-result-option(must-use-result)'
  );
}

/**
 * Drives the real rule over one statement of `file`. oxlint drops JS-plugin suggestions from
 * every output format, so the suggestion and the statement-shape exemptions are observed here.
 */
function ruleReports(
  file: string,
  statement: string,
  expressionType: string,
  operator?: string
): RuleReport[] {
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf(statement);

  expect(start, `statement not found: ${statement}`).toBeGreaterThanOrEqual(0);

  const reports: RuleReport[] = [];
  const visitors = mustUseResult.create({
    filename: file,
    options: [],
    report: (descriptor: RuleReport) => reports.push(descriptor),
    sourceCode: { getText: (node: { range: [number, number] }) => text.slice(...node.range), text }
  }) as { ExpressionStatement(node: unknown): void };

  visitors.ExpressionStatement({
    expression: { operator, range: [start, start + statement.length], type: expressionType },
    type: 'ExpressionStatement'
  });

  return reports;
}

describe('oxlint e2e', () => {
  it('reports only the dropped values, with their statement spans', () => {
    const messages = [
      'Unused Result value. Handle it (e.g. `match`, `unwrap`, `map`) or discard it explicitly with `void`.',
      'Unused Option value. Handle it (e.g. `match`, `unwrap`, `map`) or discard it explicitly with `void`.'
    ];

    expect(
      oxlintDiagnostics().map((diagnostic) => [
        relative(pkgRoot, diagnostic.filename),
        diagnostic.message,
        diagnostic.labels[0]?.span.length
      ])
    ).toEqual([
      ['tests/fixtures/oxlint-project/bad.ts', messages[0], 'Result.Ok(1)'.length],
      [
        'tests/fixtures/oxlint-project/bad.ts',
        messages[1],
        'Option.Some(2).map((v) => v + 1)'.length
      ],
      ['tests/fixtures/oxlint-project/bad.ts', messages[0], 'flag && Result.Ok(3)'.length]
    ]);
  });

  it('suggests discarding the statement with `void`', () => {
    const statement = 'Result.Ok(1)';
    const reports = ruleReports(badFile, statement, 'CallExpression');
    const start = readFileSync(badFile, 'utf8').indexOf(statement);

    expect(reports).toHaveLength(1);
    expect(reports[0]?.suggest[0]?.fix(fixer)).toEqual({
      node: { range: [start, start + statement.length], type: 'CallExpression' },
      replacement: 'void (Result.Ok(1))'
    });
  });

  it('parenthesizes the discard so precedence is preserved', () => {
    const statement = 'flag && Result.Ok(3)';
    const reports = ruleReports(badFile, statement, 'LogicalExpression');
    const start = readFileSync(badFile, 'utf8').indexOf(statement);

    expect(reports).toHaveLength(1);
    expect(reports[0]?.suggest[0]?.fix(fixer)).toEqual({
      node: { range: [start, start + statement.length], type: 'LogicalExpression' },
      replacement: 'void (flag && Result.Ok(3))'
    });
  });

  it('ignores an explicit `void` discard', () => {
    // The node oxlint hands over for `void expr;`, over a span that does type as must-use:
    // the exemption, not type resolution, has to be what keeps this quiet.
    expect(ruleReports(badFile, 'Result.Ok(1)', 'UnaryExpression', 'void')).toEqual([]);
  });

  it('ignores an assignment that binds the value', () => {
    expect(ruleReports(goodFile, 'bound = Option.Some(3)', 'AssignmentExpression')).toEqual([]);
  });
});
