/*
 * THE RULE LANGUAGE, PARSED.
 *
 * A document's rules, act guards and computed values are written in a small
 * expression language (docs/declaration-document.md#expression-language). It
 * is deliberately closed: no loops, no user functions, no regular
 * expressions, no way to name anything outside the graph it is judging. The
 * parser turns text into a tree; `evaluate.ts` walks the tree under a budget.
 */

export type Expr =
  | { readonly t: "lit"; readonly value: string | number | boolean | null; readonly at: number }
  | { readonly t: "ident"; readonly name: string; readonly at: number }
  | { readonly t: "list"; readonly items: readonly Expr[]; readonly at: number }
  | { readonly t: "member"; readonly object: Expr; readonly name: string; readonly at: number }
  | { readonly t: "unary"; readonly op: "!" | "-"; readonly operand: Expr; readonly at: number }
  | { readonly t: "binary"; readonly op: BinaryOp; readonly left: Expr; readonly right: Expr; readonly at: number }
  | { readonly t: "call"; readonly fn: string; readonly args: readonly Expr[]; readonly at: number }
  | { readonly t: "where"; readonly set: Expr; readonly filter: Expr; readonly at: number };

export type BinaryOp = "||" | "&&" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "+" | "-" | "*" | "/" | "%";

export class ExprSyntaxError extends Error {
  constructor(
    readonly sentence: string,
    readonly at: number,
    readonly source: string,
  ) {
    super(`${sentence} (at character ${at + 1} of "${source}")`);
  }
}

type Token =
  | { readonly k: "num"; readonly v: number; readonly at: number }
  | { readonly k: "str"; readonly v: string; readonly at: number }
  | { readonly k: "id"; readonly v: string; readonly at: number }
  | { readonly k: "op"; readonly v: string; readonly at: number }
  | { readonly k: "end"; readonly at: number };

const OPERATORS = ["||", "&&", "==", "!=", "<=", ">=", "<", ">", "!", "+", "-", "*", "/", "%", "(", ")", "[", "]", ",", "."];
const WORD_OPERATORS: Readonly<Record<string, string>> = { and: "&&", or: "||", not: "!" };
export const MAX_EXPRESSION_LENGTH = 2000;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      const start = i;
      while (i < source.length && /[0-9.]/.test(source[i]!)) i++;
      const text = source.slice(start, i);
      const v = Number(text);
      if (!Number.isFinite(v) || text.split(".").length > 2) throw new ExprSyntaxError(`"${text}" is not a number`, start, source);
      tokens.push({ k: "num", v, at: start });
      continue;
    }
    if (c === "'" || c === '"') {
      const start = i++;
      let v = "";
      while (i < source.length && source[i] !== c) {
        if (source[i] === "\\" && i + 1 < source.length) i++;
        v += source[i++];
      }
      if (i >= source.length) throw new ExprSyntaxError("a quoted word is never closed", start, source);
      i++;
      tokens.push({ k: "str", v, at: start });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i]!)) i++;
      const word = source.slice(start, i);
      // An OWN entry: "constructor" is a name, not an operator inherited from Object.
      const op = Object.prototype.hasOwnProperty.call(WORD_OPERATORS, word) ? WORD_OPERATORS[word] : undefined;
      tokens.push(op ? { k: "op", v: op, at: start } : { k: "id", v: word, at: start });
      continue;
    }
    const op = OPERATORS.find((o) => source.startsWith(o, i));
    if (!op) throw new ExprSyntaxError(`"${c}" is not part of the rule language`, i, source);
    tokens.push({ k: "op", v: op, at: i });
    i += op.length;
  }
  tokens.push({ k: "end", at: source.length });
  return tokens;
}

/** Parse an expression, or throw an `ExprSyntaxError` whose sentence a person can act on. */
export function parseExpr(source: string): Expr {
  if (source.length > MAX_EXPRESSION_LENGTH) {
    throw new ExprSyntaxError(`an expression may be at most ${MAX_EXPRESSION_LENGTH} characters`, 0, source.slice(0, 40));
  }
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos]!;
  const isOp = (v: string) => {
    const t = peek();
    return t.k === "op" && t.v === v;
  };
  const isWord = (v: string) => {
    const t = peek();
    return t.k === "id" && t.v === v;
  };
  const expect = (v: string, what: string) => {
    if (!isOp(v)) throw new ExprSyntaxError(`expected ${what}`, peek().at, source);
    pos++;
  };
  let depth = 0;
  const deeper = <T>(at: number, f: () => T): T => {
    if (++depth > 64) throw new ExprSyntaxError("the expression nests too deeply", at, source);
    try {
      return f();
    } finally {
      depth--;
    }
  };

  const binaryLevel = (ops: readonly BinaryOp[], next: () => Expr) => (): Expr => {
    let left = next();
    for (;;) {
      const t = peek();
      const op = t.k === "op" ? ops.find((o) => o === t.v) : t.k === "id" && t.v === "in" && ops.includes("in") ? "in" : undefined;
      if (!op) return left;
      pos++;
      left = { t: "binary", op, left, right: next(), at: t.at };
    }
  };

  const primary = (): Expr => {
    const t = peek();
    if (t.k === "num") {
      pos++;
      return { t: "lit", value: t.v, at: t.at };
    }
    if (t.k === "str") {
      pos++;
      return { t: "lit", value: t.v, at: t.at };
    }
    if (t.k === "id") {
      pos++;
      if (t.v === "true" || t.v === "false") return { t: "lit", value: t.v === "true", at: t.at };
      if (t.v === "null") return { t: "lit", value: null, at: t.at };
      if (isOp("(")) {
        pos++;
        const args: Expr[] = [];
        if (!isOp(")")) {
          for (;;) {
            args.push(expression());
            if (isOp(",")) {
              pos++;
              continue;
            }
            break;
          }
        }
        expect(")", `")" to close ${t.v}(…)`);
        return { t: "call", fn: t.v, args, at: t.at };
      }
      return { t: "ident", name: t.v, at: t.at };
    }
    if (t.k === "op" && t.v === "(") {
      pos++;
      const inner = deeper(t.at, expression);
      expect(")", 'a ")"');
      return inner;
    }
    if (t.k === "op" && t.v === "[") {
      pos++;
      const items: Expr[] = [];
      if (!isOp("]")) {
        for (;;) {
          items.push(expression());
          if (isOp(",")) {
            pos++;
            continue;
          }
          break;
        }
      }
      expect("]", 'a "]" to close the list');
      return { t: "list", items, at: t.at };
    }
    if (t.k === "end") throw new ExprSyntaxError("the expression ends too soon", t.at, source);
    throw new ExprSyntaxError(`"${t.k === "op" ? t.v : ""}" cannot start a value here`, t.at, source);
  };

  const postfix = (): Expr => {
    let e = primary();
    for (;;) {
      if (isOp(".")) {
        const dot = peek();
        pos++;
        const name = peek();
        if (name.k !== "id") throw new ExprSyntaxError('expected a field name after "."', name.at, source);
        pos++;
        e = { t: "member", object: e, name: name.v, at: dot.at };
        continue;
      }
      if (isWord("where")) {
        const at = peek().at;
        pos++;
        // `where` binds loosest: everything to its right, up to a closing bracket or comma, is the condition.
        e = { t: "where", set: e, filter: deeper(at, expression), at };
        continue;
      }
      return e;
    }
  };

  const unary = (): Expr => {
    const t = peek();
    if (t.k === "op" && (t.v === "!" || t.v === "-")) {
      pos++;
      return { t: "unary", op: t.v, operand: deeper(t.at, unary), at: t.at };
    }
    return postfix();
  };

  const product = binaryLevel(["*", "/", "%"], unary);
  const sum = binaryLevel(["+", "-"], product);
  const comparison = (): Expr => {
    const left = sum();
    const t = peek();
    const op =
      t.k === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(t.v) ? (t.v as BinaryOp) : t.k === "id" && t.v === "in" ? "in" : undefined;
    if (!op) return left;
    pos++;
    return { t: "binary", op, left, right: sum(), at: t.at };
  };
  const negation = (): Expr => {
    const t = peek();
    if (t.k === "op" && t.v === "!") {
      pos++;
      return { t: "unary", op: "!", operand: deeper(t.at, negation), at: t.at };
    }
    return comparison();
  };
  const conjunction = binaryLevel(["&&"], negation);
  const disjunction = binaryLevel(["||"], conjunction);
  function expression(): Expr {
    return disjunction();
  }

  const tree = expression();
  if (peek().k !== "end") throw new ExprSyntaxError("there is more after the end of the expression", peek().at, source);
  return tree;
}
