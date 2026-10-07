import type { BinaryOp, Expr } from "./parse.js";

/*
 * THE RULE LANGUAGE, PRINTED BACK.
 *
 * printExpr(parseExpr(s)) parses to the same tree as s. It is how a rename
 * rewrites a rule precisely: parse, rename the names in the tree, print it —
 * never a regular expression over the text, which cannot tell the field
 * `quote` from the word 'quote' in a string or from a relation's `quote`.
 *
 * Parenthesizes only where the grammar needs it. `and`, `or` and `not` are
 * printed as words, the way the authoring guide writes them.
 */

const LEVEL: Readonly<Record<BinaryOp, number>> = {
  "||": 1,
  "&&": 2,
  "==": 4,
  "!=": 4,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  in: 4,
  "|": 4.4,
  "&": 4.6,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};
const WORD: Partial<Record<BinaryOp, string>> = { "||": "or", "&&": "and" };

/** How tightly an expression binds: 0 for `where` (it takes everything to its right), 9 for a value. */
function level(e: Expr): number {
  switch (e.t) {
    case "where":
      return 0;
    case "binary":
      return LEVEL[e.op];
    case "unary":
      return e.op === "!" ? 3 : 7;
    case "member":
      return 8;
    default:
      return 9;
  }
}

const quote = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** An expression as rule-language text that parses back to the same tree. */
export function printExpr(e: Expr): string {
  return print(e, 0);
}

function print(e: Expr, atLeast: number): string {
  const text = bare(e);
  return level(e) < atLeast ? `(${text})` : text;
}

function bare(e: Expr): string {
  switch (e.t) {
    case "lit":
      return e.value === null ? "null" : typeof e.value === "string" ? quote(e.value) : String(e.value);
    case "ident":
      return e.name;
    case "list":
      return `[${e.items.map((x) => print(x, 0)).join(", ")}]`;
    case "member":
      return `${print(e.object, 8)}.${e.name}`;
    case "unary":
      // `not` is a word; `-` must not run into a following `-` (`- -x`).
      return e.op === "!" ? `not ${print(e.operand, 3)}` : `-${print(e.operand, 7).startsWith("-") ? ` ${print(e.operand, 7)}` : print(e.operand, 7)}`;
    case "binary": {
      const l = LEVEL[e.op];
      const op = WORD[e.op] ?? e.op;
      // Comparisons do not chain; the arithmetic and logic operators lean left.
      const left = l === 4 ? print(e.left, 4.4) : print(e.left, l);
      const right = l === 4 ? print(e.right, 4.4) : print(e.right, l === 4.4 ? 4.6 : l === 4.6 ? 5 : l + 1);
      return `${left} ${op} ${right}`;
    }
    case "call":
      return `${e.fn}(${e.args.map((x) => print(x, 0)).join(", ")})`;
    case "where":
      // The set is a postfix chain; the condition runs to the end, so it needs no brackets of its own.
      return `${print(e.set, 8)} where ${print(e.filter, 0)}`;
  }
}
