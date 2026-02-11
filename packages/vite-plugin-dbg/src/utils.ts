import _generate from "@babel/generator";
import * as t from "@babel/types";
const generate = _generate.default;
import { NodePath } from "@babel/traverse";
import _traverse, { type Visitor } from "@babel/traverse";
const traverse = _traverse.default;
import * as parser from "@babel/parser";

/* -------------------------------------------------------------------------
 *  Helper – does any node in the tree contain an AwaitExpression?
 * ----------------------------------------------------------------------- */
function containsAwait(node: t.Node): boolean {
  if (t.isAwaitExpression(node)) return true;

  const stack: t.Node[] = [node];
  while (stack.length) {
    const cur = stack.pop()!;
    if (t.isAwaitExpression(cur)) return true;

    for (const key of Object.keys(cur) as (keyof typeof cur)[]) {
      const child = cur[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof (c as any).type === "string") stack.push(c as t.Node);
        }
      } else if (child && typeof (child as any).type === "string") {
        stack.push(child as t.Node);
      }
    }
  }
  return false;
}

/**
 * Build an IIFE that logs the source/value and returns the evaluated value.
 *
 * Returns both the IIFE call‑expression and a flag telling whether the IIFE is
 * `async`. The caller can decide to prepend an `await` when the flag is true.
 */
export function buildDbgIife(
  path: NodePath<t.CallExpression>,
  filePath: string,
): { expr: t.CallExpression; async: boolean } {
  const { node } = path;

  // -----------------------------------------------------------------
  // 1️⃣  Raw source for each argument
  // -----------------------------------------------------------------
  const argSources = node.arguments.map(
    (arg) => generate(arg, { comments: false }).code,
  );

  // -----------------------------------------------------------------
  // 2️⃣  Temporary identifier for the evaluated value(s)
  // -----------------------------------------------------------------
  const tmpId = path.scope.generateUidIdentifier("dbgVal");

  // -----------------------------------------------------------------
  // 3️⃣  console.error('[file:line] <source> =', <tmp>)
  // -----------------------------------------------------------------
  const line = node.loc?.start.line ?? 0;
  const location = `${filePath}:${line}`;
  const sourceText = argSources.join(", ");

  const consoleCall = t.expressionStatement(
    t.callExpression(
      t.memberExpression(t.identifier("console"), t.identifier("error")),
      [
        t.stringLiteral(`[${location}] ${sourceText} =`),
        t.identifier(tmpId.name),
      ],
    ),
  );

  // -----------------------------------------------------------------
  // 4️⃣  Body of the arrow function
  // -----------------------------------------------------------------
  const body: t.Statement[] = [];

  if (node.arguments.length === 1) {
    body.push(
      t.variableDeclaration("const", [
        t.variableDeclarator(tmpId, node.arguments[0] as t.Expression),
      ]),
    );
  } else {
    body.push(
      t.variableDeclaration("const", [
        t.variableDeclarator(
          tmpId,
          t.arrayExpression(node.arguments as t.Expression[]),
        ),
      ]),
    );
  }

  body.push(consoleCall);
  body.push(t.returnStatement(tmpId));

  // -----------------------------------------------------------------
  // 5️⃣  Does the IIFE need to be async?
  // -----------------------------------------------------------------
  const needsAsync = node.arguments.some(containsAwait);

  // -----------------------------------------------------------------
  // 6️⃣  IIFE (async when required)
  // -----------------------------------------------------------------
  const iife = t.callExpression(
    t.parenthesizedExpression(
      t.arrowFunctionExpression([], t.blockStatement(body), needsAsync),
    ),
    [],
  );

  return { expr: iife, async: needsAsync };
}

/**
 * Parse, transform, and generate a new source string + source map.
 *
 * @param code      Original source code.
 * @param id        File path (used for the log prefix).
 * @param enabled   If false, the source is returned unchanged.
 */
export function transformSource(
  code: string,
  id: string,
  enabled = true,
): { code: string; map: any } {
  if (!enabled) {
    return { code, map: null };
  }

  // ---------------------------------------------------------
  // 1️⃣ Parse with Babel (TS, JSX, class fields, …)
  // ---------------------------------------------------------
  const ast = parser.parse(code, {
    plugins: [
      "typescript",
      "jsx",
      "classProperties",
      "decorators-legacy",
      "dynamicImport",
      "optionalChaining",
      "nullishCoalescingOperator",
    ],
    sourceType: "module",
  });

  // ---------------------------------------------------------
  // 2️⃣ Replace every `dbg$(…)` call
  // ---------------------------------------------------------
  const visitor: Visitor = {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: "dbg$" })) {
        const { expr: iife, async: iifeIsAsync } = buildDbgIife(
          path as any,
          id,
        );

        // If the generated IIFE is async we must await it so that the surrounding
        // expression receives the *value* and not a Promise.
        const replacement = iifeIsAsync ? t.awaitExpression(iife) : iife;

        path.replaceWith(replacement);
      }
    },
  };
  traverse(ast, visitor);

  // ---------------------------------------------------------
  // 3️⃣ Generate code + source‑map (retain original line numbers)
  // ---------------------------------------------------------
  const output = generate(
    ast,
    {
      comments: true,
      retainLines: true,
      sourceFileName: id,
      sourceMaps: true,
    },
    code,
  );

  return { code: output.code, map: output.map };
}
