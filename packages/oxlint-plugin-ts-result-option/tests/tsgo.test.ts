import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { __stateForTests, mustUseNameAtSpan } from '../src/tsgo.ts';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const projectDir = join(pkgRoot, 'tests/fixtures/project');
const tsconfig = join(projectDir, 'tsconfig.json');

/** Span of the expression of the statement `line`, i.e. without its trailing semicolon. */
function spanOf(text: string, line: string): [number, number] {
  const index = text.indexOf(`\n${line}\n`);

  expect(index, `line not found: ${line}`).toBeGreaterThanOrEqual(0);

  const expression = line.endsWith(';') ? line.slice(0, -1) : line;

  return [index + 1, index + 1 + expression.length];
}

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  warn.mockClear();
});

const caseFile = join(projectDir, 'case.ts');
const caseText = readFileSync(caseFile, 'utf8');

describe('mustUseNameAtSpan', () => {
  it.each<[string, null | string]>([
    ['Result.Ok(1);', 'Result'],
    ['Option.Some(1);', 'Option'],
    ['Result.Ok(1).map((v) => v + 1);', 'Result'],
    ['Result.Ok(1).unwrap();', null],
    ['Option.Some(1).inspect((v) => console.log(v));', null],
    ['Result.Ok(1).inspectErr((e) => console.log(e));', 'Result'],
    ["void Result.Err(new Error('x'));", null],
    ['u;', 'Result']
  ])('maps `%s` to %s', (line, expected) => {
    const [start, end] = spanOf(caseText, line);

    expect(mustUseNameAtSpan(caseFile, caseText, start, end)).toBe(expected);
  });

  it('ignores a consumer class that shadows the library name', () => {
    const shadowFile = join(projectDir, 'shadow.ts');
    const shadowText = readFileSync(shadowFile, 'utf8');
    const [start, end] = spanOf(shadowText, 'local;');

    expect(mustUseNameAtSpan(shadowFile, shadowText, start, end)).toBeNull();
  });

  it('skips a buffer that is not on disk, warning once', () => {
    const [start, end] = spanOf(caseText, 'Result.Ok(1);');

    for (const _ of [0, 1]) {
      expect(mustUseNameAtSpan(caseFile, `${caseText} `, start, end)).toBeNull();
    }

    expect(
      warn.mock.calls.filter((call) => String(call[0]).includes('differs from the linted buffer'))
    ).toHaveLength(1);
  });

  it('skips a file with no tsconfig above it, warning once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tsgo-'));
    const file = join(dir, 'x.ts');
    const text = 'declare const value: unknown;\nvalue;\n';

    writeFileSync(file, text);

    for (const _ of [0, 1]) {
      expect(
        mustUseNameAtSpan(
          file,
          text,
          text.indexOf('value;'),
          'value;'.length + text.indexOf('value;')
        )
      ).toBeNull();
    }

    expect(
      warn.mock.calls.filter((call) => String(call[0]).includes('no tsconfig.json found'))
    ).toHaveLength(1);
  });

  it('opens one project per tsconfig and reuses it', () => {
    const shadowFile = join(projectDir, 'shadow.ts');
    const shadowText = readFileSync(shadowFile, 'utf8');

    mustUseNameAtSpan(shadowFile, shadowText, ...spanOf(shadowText, 'local;'));
    mustUseNameAtSpan(caseFile, caseText, ...spanOf(caseText, 'Result.Ok(1);'));
    mustUseNameAtSpan(caseFile, caseText, ...spanOf(caseText, 'Option.Some(1);'));

    expect(__stateForTests()).toEqual({ hasApi: true, openProjects: [tsconfig] });
  });
});
