import {
  CSS_AT_RULES,
  CSS_FRAGMENT_PROPERTIES,
  CSS_FUNCTIONS,
  CSS_KEYWORD_PROPERTIES,
  CSS_PROPERTIES,
  CSS_REFUSED_SELECTORS,
  HTML_DRAWN_AS,
  OPEN_MAX_STYLESHEET,
} from "../open-kit.js";

/*
 * A VIEW'S CSS, READ AS A BROWSER READS IT (FR-90).
 *
 * A stylesheet a worker view writes is drawn in the host's own page, so
 * anything in it that could fetch — a `url()` in any of the dozen
 * properties that take one, `@import`, `@font-face`, `image-set()` — is a
 * request made from the app's origin. Matching text for `url(` misses
 * `u\72l(`, `url/**\/(`, a bad-url and an escaped at-keyword, so this is
 * the CSS Syntax Level 3 tokenizer, followed by its parser (rules, at-rules,
 * blocks, declarations, nesting), and the sanitiser works on what the
 * browser would see: escapes decoded, comments gone, every function by its
 * real name. Nothing the view wrote reaches the page as it was written —
 * the output is made from the tokens again, with a comment between any two
 * that would run together, so what the browser reads back is what was
 * judged here.
 *
 * What is kept is an allowlist (open-kit.ts): the at-rules `@media`,
 * `@supports`, `@container` and `@keyframes`; the properties on
 * `CSS_PROPERTIES` (and custom properties); the functions on
 * `CSS_FUNCTIONS`; `url(#id)` only on a paint; `position` only static,
 * relative or absolute. A selector that reaches out of the view's shadow
 * tree (`:host`, `::slotted`, `::part`) takes its rule with it. Everything
 * refused is written down, with why.
 *
 * No DOM, no imports beyond the kit: a host judges a view's CSS anywhere a
 * script runs, a headless check included.
 */

// ── tokens ───────────────────────────────────────────────────────────────────

export type Token =
  | { readonly type: "whitespace" }
  | { readonly type: "ident"; readonly value: string }
  | { readonly type: "function"; readonly value: string }
  | { readonly type: "at-keyword"; readonly value: string }
  | { readonly type: "hash"; readonly value: string; readonly id: boolean }
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "bad-string" }
  | { readonly type: "url"; readonly value: string }
  | { readonly type: "bad-url" }
  | { readonly type: "delim"; readonly value: string }
  | { readonly type: "number"; readonly repr: string }
  | { readonly type: "percentage"; readonly repr: string }
  | { readonly type: "dimension"; readonly repr: string; readonly unit: string }
  | { readonly type: "CDO" }
  | { readonly type: "CDC" }
  | { readonly type: ":" | ";" | "," | "[" | "]" | "(" | ")" | "{" | "}" };

const isDigit = (c: number) => c >= 0x30 && c <= 0x39;
const isHex = (c: number) => isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
const isLetter = (c: number) => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
const isNonAscii = (c: number) => c >= 0x80;
const isIdentStart = (c: number) => isLetter(c) || isNonAscii(c) || c === 0x5f;
const isIdent = (c: number) => isIdentStart(c) || isDigit(c) || c === 0x2d;
const isNewline = (c: number) => c === 0x0a;
const isWhitespace = (c: number) => c === 0x0a || c === 0x09 || c === 0x20;
const isNonPrintable = (c: number) => (c >= 0 && c <= 8) || c === 0x0b || (c >= 0x0e && c <= 0x1f) || c === 0x7f;
const EOF = -1;

/** CSS Syntax §3.3: newlines made one, NUL and surrogates made U+FFFD. */
function preprocess(input: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let c = input.codePointAt(i)!;
    if (c > 0xffff) i += 1;
    if (c === 0x0d) {
      if (input.charCodeAt(i + 1) === 0x0a) i += 1;
      c = 0x0a;
    } else if (c === 0x0c) c = 0x0a;
    else if (c === 0 || (c >= 0xd800 && c <= 0xdfff)) c = 0xfffd;
    out.push(c);
  }
  return out;
}

/** CSS Syntax §4: the tokens of a stylesheet, a declaration list or a value. Comments are consumed and dropped. */
export function tokenize(input: string): Token[] {
  const s = preprocess(input);
  let i = 0;
  const at = (n = 0) => (i + n < s.length ? s[i + n]! : EOF);
  const tokens: Token[] = [];

  const validEscape = (a: number, b: number) => a === 0x5c && b !== 0x0a && b !== EOF;
  const startsIdent = (a: number, b: number, c: number) => {
    if (a === 0x2d) return isIdentStart(b) || b === 0x2d || validEscape(b, c);
    if (isIdentStart(a)) return true;
    return validEscape(a, b);
  };
  const startsNumber = (a: number, b: number, c: number) => {
    if (a === 0x2b || a === 0x2d) return isDigit(b) || (b === 0x2e && isDigit(c));
    if (a === 0x2e) return isDigit(b);
    return isDigit(a);
  };
  /* §4.3.7: after the backslash. */
  const escape = (): number => {
    const c = at();
    i += 1;
    if (c === EOF) return 0xfffd;
    if (isHex(c)) {
      let hex = String.fromCodePoint(c);
      while (hex.length < 6 && isHex(at())) {
        hex += String.fromCodePoint(at());
        i += 1;
      }
      if (isWhitespace(at())) i += 1;
      const value = parseInt(hex, 16);
      return value === 0 || (value >= 0xd800 && value <= 0xdfff) || value > 0x10ffff ? 0xfffd : value;
    }
    return c;
  };
  const name = (): string => {
    let result = "";
    for (;;) {
      const c = at();
      if (isIdent(c)) {
        result += String.fromCodePoint(c);
        i += 1;
      } else if (validEscape(c, at(1))) {
        i += 1;
        result += String.fromCodePoint(escape());
      } else return result;
    }
  };
  const number = (): string => {
    let repr = "";
    if (at() === 0x2b || at() === 0x2d) repr += String.fromCodePoint(s[i++]!);
    while (isDigit(at())) repr += String.fromCodePoint(s[i++]!);
    if (at() === 0x2e && isDigit(at(1))) {
      repr += String.fromCodePoint(s[i++]!, s[i++]!);
      while (isDigit(at())) repr += String.fromCodePoint(s[i++]!);
    }
    if ((at() === 0x45 || at() === 0x65) && (isDigit(at(1)) || ((at(1) === 0x2b || at(1) === 0x2d) && isDigit(at(2))))) {
      repr += String.fromCodePoint(s[i++]!);
      if (!isDigit(at())) repr += String.fromCodePoint(s[i++]!);
      while (isDigit(at())) repr += String.fromCodePoint(s[i++]!);
    }
    return repr;
  };
  const numeric = (): Token => {
    const repr = number();
    if (startsIdent(at(), at(1), at(2))) return { type: "dimension", repr, unit: name() };
    if (at() === 0x25) {
      i += 1;
      return { type: "percentage", repr };
    }
    return { type: "number", repr };
  };
  const badUrlRemnants = () => {
    for (;;) {
      const c = at();
      i += 1;
      if (c === 0x29 || c === EOF) return;
      if (validEscape(c, at())) escape();
    }
  };
  const url = (): Token => {
    let value = "";
    while (isWhitespace(at())) i += 1;
    for (;;) {
      const c = at();
      i += 1;
      if (c === 0x29) return { type: "url", value };
      if (c === EOF) return { type: "url", value };
      if (isWhitespace(c)) {
        while (isWhitespace(at())) i += 1;
        if (at() === 0x29 || at() === EOF) {
          if (at() === 0x29) i += 1;
          return { type: "url", value };
        }
        badUrlRemnants();
        return { type: "bad-url" };
      }
      if (c === 0x22 || c === 0x27 || c === 0x28 || isNonPrintable(c)) {
        badUrlRemnants();
        return { type: "bad-url" };
      }
      if (c === 0x5c) {
        if (validEscape(c, at())) value += String.fromCodePoint(escape());
        else {
          badUrlRemnants();
          return { type: "bad-url" };
        }
        continue;
      }
      value += String.fromCodePoint(c);
    }
  };
  const identLike = (): Token => {
    const value = name();
    if (value.toLowerCase() === "url" && at() === 0x28) {
      i += 1;
      while (isWhitespace(at()) && isWhitespace(at(1))) i += 1;
      const next = isWhitespace(at()) ? at(1) : at();
      if (next === 0x22 || next === 0x27) return { type: "function", value };
      return url();
    }
    if (at() === 0x28) {
      i += 1;
      return { type: "function", value };
    }
    return { type: "ident", value };
  };
  const string = (quote: number): Token => {
    let value = "";
    for (;;) {
      const c = at();
      i += 1;
      if (c === quote || c === EOF) return { type: "string", value };
      if (isNewline(c)) {
        i -= 1;
        return { type: "bad-string" };
      }
      if (c === 0x5c) {
        if (at() === EOF) continue;
        if (isNewline(at())) {
          i += 1;
          continue;
        }
        value += String.fromCodePoint(escape());
        continue;
      }
      value += String.fromCodePoint(c);
    }
  };

  for (;;) {
    /* Comments, which a browser drops before it sees a token. */
    while (at() === 0x2f && at(1) === 0x2a) {
      i += 2;
      while (at() !== EOF && !(at() === 0x2a && at(1) === 0x2f)) i += 1;
      if (at() !== EOF) i += 2;
    }
    const c = at();
    if (c === EOF) return tokens;
    if (isWhitespace(c)) {
      while (isWhitespace(at())) i += 1;
      tokens.push({ type: "whitespace" });
      continue;
    }
    i += 1;
    switch (c) {
      case 0x22:
      case 0x27:
        tokens.push(string(c));
        continue;
      case 0x23:
        if (isIdent(at()) || validEscape(at(), at(1))) {
          const id = startsIdent(at(), at(1), at(2));
          tokens.push({ type: "hash", value: name(), id });
        } else tokens.push({ type: "delim", value: "#" });
        continue;
      case 0x28:
        tokens.push({ type: "(" });
        continue;
      case 0x29:
        tokens.push({ type: ")" });
        continue;
      case 0x2b:
      case 0x2e:
        if (startsNumber(c, at(), at(1))) {
          i -= 1;
          tokens.push(numeric());
        } else tokens.push({ type: "delim", value: String.fromCodePoint(c) });
        continue;
      case 0x2c:
        tokens.push({ type: "," });
        continue;
      case 0x2d:
        if (startsNumber(c, at(), at(1))) {
          i -= 1;
          tokens.push(numeric());
        } else if (at() === 0x2d && at(1) === 0x3e) {
          i += 2;
          tokens.push({ type: "CDC" });
        } else if (startsIdent(c, at(), at(1))) {
          i -= 1;
          tokens.push(identLike());
        } else tokens.push({ type: "delim", value: "-" });
        continue;
      case 0x3a:
        tokens.push({ type: ":" });
        continue;
      case 0x3b:
        tokens.push({ type: ";" });
        continue;
      case 0x3c:
        if (at() === 0x21 && at(1) === 0x2d && at(2) === 0x2d) {
          i += 3;
          tokens.push({ type: "CDO" });
        } else tokens.push({ type: "delim", value: "<" });
        continue;
      case 0x40:
        if (startsIdent(at(), at(1), at(2))) tokens.push({ type: "at-keyword", value: name() });
        else tokens.push({ type: "delim", value: "@" });
        continue;
      case 0x5b:
        tokens.push({ type: "[" });
        continue;
      case 0x5c:
        if (validEscape(c, at())) {
          i -= 1;
          tokens.push(identLike());
        } else tokens.push({ type: "delim", value: "\\" });
        continue;
      case 0x5d:
        tokens.push({ type: "]" });
        continue;
      case 0x7b:
        tokens.push({ type: "{" });
        continue;
      case 0x7d:
        tokens.push({ type: "}" });
        continue;
      default:
        if (isDigit(c)) {
          i -= 1;
          tokens.push(numeric());
        } else if (isIdentStart(c)) {
          i -= 1;
          tokens.push(identLike());
        } else tokens.push({ type: "delim", value: String.fromCodePoint(c) });
    }
  }
}

// ── component values and rules ──────────────────────────────────────────────

export type ComponentValue =
  | Token
  | { readonly type: "func"; readonly name: string; readonly value: ComponentValue[] }
  | { readonly type: "block"; readonly open: "{" | "[" | "("; readonly value: ComponentValue[] };

const CLOSE = { "{": "}", "[": "]", "(": ")" } as const;
/** How deep blocks and functions may nest before the rest is read as unreadable. */
const MAX_DEPTH = 32;

class Stream {
  i = 0;
  constructor(readonly tokens: readonly Token[]) {}
  peek(): Token | undefined {
    return this.tokens[this.i];
  }
  next(): Token | undefined {
    return this.tokens[this.i++];
  }
}

/** §5.4.7: one component value. Past MAX_DEPTH a block is read flat, and judged unreadable by its caller. */
function componentValue(stream: Stream, depth: number): ComponentValue {
  const token = stream.next()!;
  if (token.type === "{" || token.type === "[" || token.type === "(") return { type: "block", open: token.type, value: blockContents(stream, CLOSE[token.type], depth + 1) };
  if (token.type === "function") return { type: "func", name: token.value, value: blockContents(stream, ")", depth + 1) };
  return token;
}

function blockContents(stream: Stream, close: "}" | "]" | ")", depth: number): ComponentValue[] {
  const value: ComponentValue[] = [];
  for (;;) {
    const token = stream.peek();
    if (!token) return value;
    if (token.type === close) {
      stream.next();
      return value;
    }
    if (depth > MAX_DEPTH) {
      /* Too deep to judge: consumed and dropped as a bad token, so the rule it is in fails. */
      stream.next();
      value.push({ type: "bad-string" });
      continue;
    }
    value.push(componentValue(stream, depth));
  }
}

export type Rule =
  | { readonly type: "at-rule"; readonly name: string; readonly prelude: ComponentValue[]; readonly block?: ComponentValue[] }
  | { readonly type: "qualified"; readonly prelude: ComponentValue[]; readonly block: ComponentValue[] };

export interface Declaration {
  readonly type: "declaration";
  readonly name: string;
  readonly value: ComponentValue[];
  readonly important: boolean;
}

/** §5.4.2–5.4.3: the rules of a stylesheet (or of a block that holds rules). */
function rules(values: readonly ComponentValue[], topLevel: boolean): Rule[] {
  const out: Rule[] = [];
  let at = 0;
  while (at < values.length) {
    const value = values[at]!;
    if (value.type === "whitespace" || (topLevel && (value.type === "CDO" || value.type === "CDC"))) {
      at += 1;
      continue;
    }
    if (value.type === "at-keyword") {
      const prelude: ComponentValue[] = [];
      at += 1;
      let block: ComponentValue[] | undefined;
      while (at < values.length) {
        const part = values[at]!;
        at += 1;
        if (part.type === ";") break;
        if (part.type === "block" && part.open === "{") {
          block = part.value;
          break;
        }
        prelude.push(part);
      }
      out.push({ type: "at-rule", name: value.value, prelude, ...(block ? { block } : {}) });
      continue;
    }
    const prelude: ComponentValue[] = [];
    let block: ComponentValue[] | undefined;
    while (at < values.length) {
      const part = values[at]!;
      at += 1;
      if (part.type === "block" && part.open === "{") {
        block = part.value;
        break;
      }
      prelude.push(part);
    }
    if (block) out.push({ type: "qualified", prelude, block });
  }
  return out;
}

/** The parts of a block's contents (§5.4.5, with nesting): declarations, and rules nested among them. */
function blockItems(values: readonly ComponentValue[]): (Declaration | Rule)[] {
  const out: (Declaration | Rule)[] = [];
  let at = 0;
  while (at < values.length) {
    const value = values[at]!;
    if (value.type === "whitespace" || value.type === ";") {
      at += 1;
      continue;
    }
    if (value.type === "at-keyword") {
      const end = (() => {
        for (let j = at + 1; j < values.length; j += 1) {
          const part = values[j]!;
          if (part.type === ";") return j + 1;
          if (part.type === "block" && part.open === "{") return j + 1;
        }
        return values.length;
      })();
      out.push(...rules(values.slice(at, end), false));
      at = end;
      continue;
    }
    if (value.type === "ident") {
      /* A declaration: ident, colon, value, up to the next top-level ';'. */
      let j = at + 1;
      while (values[j]?.type === "whitespace") j += 1;
      if (values[j]?.type === ":") {
        let end = j + 1;
        while (end < values.length && values[end]!.type !== ";") end += 1;
        const declaration = toDeclaration(value.value, values.slice(j + 1, end));
        /* A '{' block in it means it was a nested rule after all (`a:hover { … }`). */
        if (declaration.value.some((part) => part.type === "block" && part.open === "{")) {
          const ends = values.findIndex((part, index) => index > at && part.type === "block" && part.open === "{");
          out.push(...rules(values.slice(at, ends + 1), false));
          at = ends + 1;
          continue;
        }
        out.push(declaration);
        at = end + 1;
        continue;
      }
    }
    /* A nested rule (`& .child { … }`, `.child { … }`), up to its block. */
    let end = at;
    while (end < values.length && !(values[end]!.type === "block" && (values[end] as { open: string }).open === "{")) {
      if (values[end]!.type === ";") break;
      end += 1;
    }
    if (end < values.length && values[end]!.type === "block") {
      out.push(...rules(values.slice(at, end + 1), false));
      at = end + 1;
    } else at = end + 1;
  }
  return out;
}

function toDeclaration(name: string, raw: readonly ComponentValue[]): Declaration {
  const value = [...raw];
  while (value[0]?.type === "whitespace") value.shift();
  while (value.at(-1)?.type === "whitespace") value.pop();
  let important = false;
  /* `! important`, with any whitespace and in any case, at the end. */
  const last = value.length - 1;
  let bang = last;
  if (value[bang]?.type === "ident" && (value[bang] as { value: string }).value.toLowerCase() === "important") {
    bang -= 1;
    while (value[bang]?.type === "whitespace") bang -= 1;
    const mark = value[bang];
    if (mark?.type === "delim" && mark.value === "!") {
      important = true;
      value.length = bang;
      while (value.at(-1)?.type === "whitespace") value.pop();
    }
  }
  return { type: "declaration", name, value, important };
}

function parse(css: string): ComponentValue[] {
  const stream = new Stream(tokenize(css));
  const out: ComponentValue[] = [];
  while (stream.peek()) out.push(componentValue(stream, 0));
  return out;
}

// ── serialisation ───────────────────────────────────────────────────────────

/** CSSOM's "serialize an identifier". */
export function serializeIdent(value: string): string {
  let out = "";
  const codes = [...value].map((one) => one.codePointAt(0)!);
  codes.forEach((c, index) => {
    if (c === 0) out += "�";
    else if ((c >= 1 && c <= 0x1f) || c === 0x7f || (index === 0 && isDigit(c)) || (index === 1 && isDigit(c) && codes[0] === 0x2d)) out += `\\${c.toString(16)} `;
    else if (index === 0 && c === 0x2d && codes.length === 1) out += "\\-";
    else if (isNonAscii(c) || c === 0x2d || c === 0x5f || isDigit(c) || isLetter(c)) out += String.fromCodePoint(c);
    else out += `\\${String.fromCodePoint(c)}`;
  });
  return out;
}

/** A name after `#` or in a unit: like an identifier, but it may start with a digit. */
function serializeName(value: string): string {
  let out = "";
  for (const one of value) {
    const c = one.codePointAt(0)!;
    if (isNonAscii(c) || c === 0x2d || c === 0x5f || isDigit(c) || isLetter(c)) out += one;
    else if ((c >= 1 && c <= 0x1f) || c === 0x7f) out += `\\${c.toString(16)} `;
    else out += `\\${one}`;
  }
  return out;
}

/** A string, quoted, with nothing in it that could end the quote, the line or a `<style>`. */
export function serializeString(value: string): string {
  let out = '"';
  for (const one of value) {
    const c = one.codePointAt(0)!;
    if (c === 0) out += "�";
    else if ((c >= 1 && c <= 0x1f) || c === 0x7f || c === 0x3c || c === 0x3e) out += `\\${c.toString(16)} `;
    else if (c === 0x22 || c === 0x5c) out += `\\${one}`;
    else out += one;
  }
  return `${out}"`;
}

/** A unit, written so it does not read back as an exponent (`1\65 3x` is not `1e3x`). */
function serializeUnit(unit: string): string {
  const named = serializeName(unit);
  return /^[eE]([0-9]|[+-][0-9])/.test(unit) ? `\\${unit.codePointAt(0)!.toString(16)} ${serializeName(unit.slice(1))}` : named;
}

type Kind = "ident" | "function" | "url" | "bad-url" | "number" | "percentage" | "dimension" | "CDC" | "(" | "hash" | "at-keyword" | `delim${string}` | "other";

const kindOf = (value: ComponentValue): Kind => {
  switch (value.type) {
    case "ident":
    case "url":
    case "bad-url":
    case "number":
    case "percentage":
    case "dimension":
    case "CDC":
    case "hash":
    case "at-keyword":
      return value.type;
    case "func":
    case "function":
      return "function";
    case "block":
      return value.open === "(" ? "(" : "other";
    case "(":
      return "(";
    case "delim":
      return `delim${value.value}`;
    default:
      return "other";
  }
};

/** CSS Syntax §9: the pairs that would run together, which get a comment between them. */
function needsComment(a: Kind, b: Kind): boolean {
  const identish: Kind[] = ["ident", "function", "url", "bad-url", "delim-", "number", "percentage", "dimension", "CDC"];
  if (a === "ident") return [...identish, "("].includes(b);
  if (a === "at-keyword" || a === "hash" || a === "dimension") return identish.includes(b);
  if (a === "delim#" || a === "delim-") return identish.includes(b);
  if (a === "number") return ["ident", "function", "url", "bad-url", "number", "percentage", "dimension", "delim%"].includes(b);
  if (a === "delim@") return ["ident", "function", "url", "bad-url", "delim-", "CDC"].includes(b);
  if (a === "delim." || a === "delim+") return ["number", "percentage", "dimension"].includes(b);
  if (a === "delim/") return b === "delim*";
  return false;
}

function serializeOne(value: ComponentValue): string {
  switch (value.type) {
    case "whitespace":
      return " ";
    case "ident":
      return serializeIdent(value.value);
    case "at-keyword":
      return `@${serializeIdent(value.value)}`;
    case "hash":
      return `#${serializeName(value.value)}`;
    case "string":
      return serializeString(value.value);
    case "url":
      return `url(${serializeString(value.value)})`;
    case "delim":
      return value.value === "\\" ? "\\\n" : value.value;
    /* Written back as they were: dropped, `:-->host` would read back as `:host`. */
    case "CDO":
      return "<!--";
    case "CDC":
      return "-->";
    case "number":
      return value.repr;
    case "percentage":
      return `${value.repr}%`;
    case "dimension":
      return `${value.repr}${serializeUnit(value.unit)}`;
    case "func":
      return `${serializeIdent(value.name)}(${serializeValues(value.value)})`;
    case "block":
      return `${value.open}${serializeValues(value.value)}${CLOSE[value.open]}`;
    case ":":
    case ";":
    case ",":
    case "[":
    case "]":
    case "(":
    case ")":
    case "{":
    case "}":
      return value.type;
    default:
      return "";
  }
}

/** Component values as text, with whitespace runs made one space and a comment wherever two tokens would run together. */
export function serializeValues(values: readonly ComponentValue[]): string {
  let out = "";
  let previous: ComponentValue | undefined;
  for (const value of values) {
    if (value.type === "whitespace" && previous?.type === "whitespace") continue;
    if (previous && needsComment(kindOf(previous), kindOf(value))) out += "/**/";
    out += serializeOne(value);
    previous = value;
  }
  return out;
}

// ── the sanitiser ───────────────────────────────────────────────────────────

/** Why part of a view's CSS was not kept. */
export type CssRefusalReason =
  /** An at-rule outside `CSS_AT_RULES` (`@import`, `@font-face`, `@namespace`, …). */
  | "at-rule"
  /** A property outside `CSS_PROPERTIES`. */
  | "property"
  /** A `url()` that is not `url(#id)` on a paint. */
  | "url"
  /** A function outside `CSS_FUNCTIONS` (`image-set()`, `attr()`, `expression()`, …). */
  | "function"
  /** A value a property held to keywords may not take (`position: fixed`). */
  | "value"
  /** A selector that reaches past the view's own tree (`:host`, `::slotted`). */
  | "selector"
  /** Something the parser could not read: a bad string or url, a rule with no block, nesting past its depth. */
  | "unreadable"
  /** More CSS than a view may give. */
  | "size";

export interface CssRefusal {
  readonly reason: CssRefusalReason;
  /** The at-rule, property, function or selector refused. */
  readonly name?: string;
}

const PROPERTIES = new Set(CSS_PROPERTIES);
const FUNCTIONS = new Set(CSS_FUNCTIONS);
const FRAGMENTS = new Set(CSS_FRAGMENT_PROPERTIES);
const AT_RULES = new Set(CSS_AT_RULES);
const REFUSED_SELECTORS = new Set(CSS_REFUSED_SELECTORS);
const FRAGMENT = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;
const lower = (value: string) => value.replace(/[A-Z]/g, (c) => c.toLowerCase());
/** A vendor prefix said in another case, or a property spelled with an escape, is the same property (`POSITION`, `po\73 ition`). */
const propertyName = (name: string) => lower(name);

/**
 * A value as it may be drawn for `property`, or the reason it may not:
 * every function on the allowlist, every `url()` a fragment on a paint,
 * nothing unreadable. `var()` is wrapped in whitespace, so no browser that
 * substitutes by text can glue it to its neighbour.
 */
function judgeValue(property: string | undefined, values: readonly ComponentValue[], refuse: (refusal: CssRefusal) => void): ComponentValue[] | undefined {
  const out: ComponentValue[] = [];
  for (const value of values) {
    if (value.type === "bad-url" || value.type === "bad-string") {
      refuse({ reason: "unreadable", ...(property ? { name: property } : {}) });
      return undefined;
    }
    if (value.type === "url") {
      if (property && FRAGMENTS.has(property) && FRAGMENT.test(value.value)) {
        out.push({ type: "func", name: "url", value: [{ type: "string", value: value.value }] });
        continue;
      }
      refuse({ reason: "url", ...(property ? { name: property } : {}) });
      return undefined;
    }
    if (value.type === "func") {
      const name = lower(value.name);
      if (name === "url" || name === "src") {
        const inner = value.value.filter((part) => part.type !== "whitespace");
        const only = inner[0];
        if (name === "url" && inner.length === 1 && only?.type === "string" && property && FRAGMENTS.has(property) && FRAGMENT.test(only.value)) {
          out.push({ type: "func", name: "url", value: [{ type: "string", value: only.value }] });
          continue;
        }
        refuse({ reason: "url", ...(property ? { name: property } : {}) });
        return undefined;
      }
      if (!FUNCTIONS.has(name)) {
        refuse({ reason: "function", name });
        return undefined;
      }
      const inner = judgeValue(property, value.value, refuse);
      if (!inner) return undefined;
      if (name === "var") out.push({ type: "whitespace" }, { type: "func", name, value: inner }, { type: "whitespace" });
      else out.push({ type: "func", name, value: inner });
      continue;
    }
    if (value.type === "block") {
      /* A name and a bracket with something between them (`url/**\/(…)`) is a function nobody can call: not drawn, rather than judged harmless. */
      if (value.open === "{" || (value.open === "(" && out.at(-1)?.type === "ident")) {
        refuse({ reason: "unreadable", ...(property ? { name: property } : {}) });
        return undefined;
      }
      const inner = judgeValue(property, value.value, refuse);
      if (!inner) return undefined;
      out.push({ type: "block", open: value.open, value: inner });
      continue;
    }
    if (value.type === "at-keyword" || value.type === "CDO" || value.type === "CDC" || value.type === "{" || value.type === "}" || value.type === ";" || (value.type === "delim" && value.value === "\\")) {
      refuse({ reason: "unreadable", ...(property ? { name: property } : {}) });
      return undefined;
    }
    out.push(value);
  }
  return out;
}

/** One declaration, judged: kept as text, or refused. */
function judgeDeclaration(declaration: Declaration, refuse: (refusal: CssRefusal) => void): string | undefined {
  const custom = declaration.name.startsWith("--");
  const name = custom ? declaration.name : propertyName(declaration.name);
  if (!custom && !PROPERTIES.has(name)) {
    refuse({ reason: "property", name });
    return undefined;
  }
  const keywords = CSS_KEYWORD_PROPERTIES[name];
  if (keywords) {
    /* Held to keywords: exactly one ident from the list, never var(), never an escape that reads as one. */
    const parts = declaration.value.filter((part) => part.type !== "whitespace");
    const only = parts[0];
    const word = parts.length === 1 && only?.type === "ident" ? lower(only.value) : undefined;
    if (!word || ![...keywords, "inherit", "initial", "unset", "revert"].includes(word)) {
      refuse({ reason: "value", name });
      return undefined;
    }
    return `${name}: ${word}${declaration.important ? " !important" : ""}`;
  }
  const value = judgeValue(custom ? undefined : name, declaration.value, refuse);
  if (!value) return undefined;
  const said = serializeValues(value).trim();
  return `${custom ? `--${serializeName(declaration.name.slice(2))}` : name}: ${said}${declaration.important ? " !important" : ""}`;
}

/** Whether a selector stays in the view's own tree: nothing on `CSS_REFUSED_SELECTORS`, nothing unreadable. */
function judgeSelector(prelude: readonly ComponentValue[], refuse: (refusal: CssRefusal) => void): boolean {
  const walk = (values: readonly ComponentValue[]): boolean => {
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index]!;
      const colon = index > 0 && values[index - 1]!.type === ":";
      if (colon && (value.type === "ident" || value.type === "func")) {
        const name = lower(value.type === "ident" ? value.value : value.name);
        if (REFUSED_SELECTORS.has(name) || name.startsWith("-webkit-") || name.startsWith("-moz-")) {
          refuse({ reason: "selector", name });
          return false;
        }
      }
      /* `<!--` and `-->` mean nothing in a selector, and stand between a colon and the name it is judged by (`:-->host`). */
      if (value.type === "url" || value.type === "bad-url" || value.type === "bad-string" || value.type === "at-keyword" || value.type === "CDO" || value.type === "CDC" || (value.type === "block" && value.open === "{")) {
        refuse({ reason: "unreadable", name: "selector" });
        return false;
      }
      if (value.type === "func" && !walk(value.value)) return false;
      if (value.type === "block" && !walk(value.value)) return false;
    }
    return true;
  };
  return walk(prelude);
}

/** The contents of a style rule's block: declarations and nested rules. */
function judgeBlock(values: readonly ComponentValue[], refuse: (refusal: CssRefusal) => void, depth: number): string {
  const kept: string[] = [];
  for (const item of blockItems(values)) {
    if (item.type === "declaration") {
      const said = judgeDeclaration(item, refuse);
      if (said) kept.push(`${said};`);
    } else {
      const said = judgeRule(item, refuse, depth + 1, "style");
      if (said) kept.push(said);
    }
  }
  return kept.join(" ");
}

/** A prelude of `@media`, `@supports` or `@container`: conditions, which fetch nothing, written with no url and no function outside the allowlist (but `selector()` in `@supports`). */
function judgeCondition(prelude: readonly ComponentValue[], at: string, refuse: (refusal: CssRefusal) => void): string | undefined {
  const walk = (values: readonly ComponentValue[]): boolean =>
    values.every((value) => {
      if (value.type === "url" || value.type === "bad-url" || value.type === "bad-string" || (value.type === "block" && value.open === "{")) {
        refuse({ reason: value.type === "url" ? "url" : "unreadable", name: `@${at}` });
        return false;
      }
      if (value.type === "func") {
        const name = lower(value.name);
        if (at === "supports" && name === "selector") return judgeSelector(value.value, refuse);
        if (!FUNCTIONS.has(name)) {
          refuse({ reason: "function", name });
          return false;
        }
        return walk(value.value);
      }
      if (value.type === "block") {
        /* `(display: grid)` in @supports is a declaration: judged as one. */
        if (at === "supports") {
          const items = blockItems(value.value);
          if (items.length === 1 && items[0]!.type === "declaration") return judgeDeclaration(items[0] as Declaration, refuse) !== undefined;
        }
        return walk(value.value);
      }
      return true;
    });
  return walk(prelude) ? serializeValues(prelude).trim() : undefined;
}

/**
 * A selector with its type selectors for the elements the host draws as
 * another (`HTML_DRAWN_AS`: `nav`, `header`, `output`, …) read as the
 * attribute the host gives them: `.package header` is
 * `.package [data-graview-as="header"]`, so a view styles them as it wrote.
 * A type selector is an ident that no `:`, `.` or `|` stands before, outside
 * an attribute's brackets.
 */
function asDrawn(values: readonly ComponentValue[]): ComponentValue[] {
  return values.map((value, index) => {
    const before = values[index - 1];
    const named = before?.type === ":" || (before?.type === "delim" && (before.value === "." || before.value === "|"));
    if (value.type === "ident" && !named && Object.prototype.hasOwnProperty.call(HTML_DRAWN_AS, lower(value.value))) {
      return { type: "block", open: "[", value: [{ type: "ident", value: "data-graview-as" }, { type: "delim", value: "=" }, { type: "string", value: lower(value.value) }] };
    }
    if (value.type === "func") return { type: "func", name: value.name, value: asDrawn(value.value) };
    if (value.type === "block" && value.open === "(") return { type: "block", open: "(", value: asDrawn(value.value) };
    return value;
  });
}

function judgeRule(rule: Rule, refuse: (refusal: CssRefusal) => void, depth: number, within: "sheet" | "style" | "keyframes"): string | undefined {
  if (depth > MAX_DEPTH) {
    refuse({ reason: "unreadable", name: "nesting" });
    return undefined;
  }
  if (rule.type === "qualified") {
    if (within === "keyframes") {
      /* A keyframe's prelude is `from`, `to` or percentages. */
      const ok = rule.prelude.every((part) => part.type === "whitespace" || part.type === "," || part.type === "percentage" || (part.type === "ident" && ["from", "to"].includes(lower(part.value))));
      if (!ok) {
        refuse({ reason: "unreadable", name: "keyframe" });
        return undefined;
      }
      return `${serializeValues(rule.prelude).trim()} { ${judgeBlock(rule.block, refuse, depth)} }`;
    }
    if (!judgeSelector(rule.prelude, refuse)) return undefined;
    const selector = serializeValues(asDrawn(rule.prelude)).trim();
    if (selector === "") {
      refuse({ reason: "unreadable", name: "selector" });
      return undefined;
    }
    return `${selector} { ${judgeBlock(rule.block, refuse, depth)} }`;
  }
  const name = lower(rule.name);
  const canonical = name === "-webkit-keyframes" ? "keyframes" : name;
  if (!AT_RULES.has(canonical) || within === "keyframes") {
    refuse({ reason: "at-rule", name: `@${name}` });
    return undefined;
  }
  if (!rule.block) {
    refuse({ reason: "unreadable", name: `@${name}` });
    return undefined;
  }
  if (canonical === "keyframes") {
    if (within !== "sheet") {
      refuse({ reason: "at-rule", name: "@keyframes" });
      return undefined;
    }
    const parts = rule.prelude.filter((part) => part.type !== "whitespace");
    const only = parts[0];
    if (parts.length !== 1 || !only || (only.type !== "ident" && only.type !== "string")) {
      refuse({ reason: "unreadable", name: "@keyframes" });
      return undefined;
    }
    const frames = rules(rule.block, false)
      .map((frame) => judgeRule(frame, refuse, depth + 1, "keyframes"))
      .filter((one): one is string => one !== undefined);
    const named = only.type === "ident" ? serializeIdent(only.value) : serializeString(only.value);
    return `@keyframes ${named} { ${frames.join(" ")} }`;
  }
  const condition = judgeCondition(rule.prelude, canonical, refuse);
  if (condition === undefined) return undefined;
  /* Inside a style rule a conditional rule holds declarations (nesting); at the top it holds rules. */
  const body =
    within === "style"
      ? judgeBlock(rule.block, refuse, depth)
      : rules(rule.block, false)
          .map((inner) => judgeRule(inner, refuse, depth + 1, "sheet"))
          .filter((one): one is string => one !== undefined)
          .join(" ");
  return `@${canonical} ${condition} { ${body} }`;
}

export interface SanitizedCss {
  /** What may be drawn, written afresh from what was judged. */
  readonly css: string;
  /** What was not kept, in the order it was met. */
  readonly refused: readonly CssRefusal[];
}

/** A VIEW'S STYLESHEET, judged: what may be drawn of it, and what was refused. */
export function sanitizeStylesheet(css: string, maxLength = OPEN_MAX_STYLESHEET): SanitizedCss {
  const refused: CssRefusal[] = [];
  if (css.length > maxLength) return { css: "", refused: [{ reason: "size" }] };
  const refuse = (refusal: CssRefusal) => void refused.push(refusal);
  const kept = rules(parse(css), true)
    .map((rule) => judgeRule(rule, refuse, 0, "sheet"))
    .filter((one): one is string => one !== undefined);
  return { css: kept.join("\n"), refused };
}

/** A `style` attribute, judged: declarations only. */
export function sanitizeDeclarations(css: string, maxLength = OPEN_MAX_STYLESHEET): SanitizedCss {
  const refused: CssRefusal[] = [];
  if (css.length > maxLength) return { css: "", refused: [{ reason: "size" }] };
  const refuse = (refusal: CssRefusal) => void refused.push(refusal);
  const kept: string[] = [];
  for (const item of blockItems(parse(css))) {
    if (item.type !== "declaration") {
      refuse({ reason: "unreadable", name: "a rule in a style attribute" });
      continue;
    }
    const said = judgeDeclaration(item, refuse);
    if (said) kept.push(said);
  }
  return { css: kept.join("; "), refused };
}

/** One value for one property (an SVG presentation attribute), judged. */
export function sanitizeValue(property: string, value: string): { readonly value: string } | { readonly refused: CssRefusal } {
  let refusal: CssRefusal | undefined;
  const said = judgeDeclaration(toDeclaration(property, parse(value)), (one) => (refusal ??= one));
  if (said === undefined || refusal) return { refused: refusal ?? { reason: "unreadable", name: property } };
  return { value: said.slice(said.indexOf(":") + 1).trim() };
}
