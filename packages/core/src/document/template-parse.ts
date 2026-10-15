import { parseExpr } from "./expr/parse.js";
import { FORMATTERS, type Formatter, type TemplatePart } from "./template.js";

/*
 * A TEMPLATE, READ: "{status} · {quote|money}" into its parts, each brace's
 * expression parsed and its formatter named. Apart from rendering
 * (template.ts), so a page handed a compiled app — its templates already
 * parsed on the server (FR-123) — carries no parser.
 */

/** Where the formatter begins: the last bar that is not inside quotes or brackets — `count(a | b)` joins two sets (FR-101) — and not half of `||`. */
export function filterBar(inner: string): number {
  let quote: string | undefined;
  let bar = -1;
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "|" && depth === 0) {
      if (inner[i + 1] === "|") i++;
      else bar = i;
    }
  }
  // `capital` may follow another formatter (`{n | words | capital}`): the formatters begin at the bar before it.
  if (bar > 0 && inner.slice(bar + 1).trim() === CAPITAL) {
    const before = filterBar(inner.slice(0, bar));
    if (before >= 0) return before;
  }
  return bar;
}

/** The one formatter that may follow another: the words said, their first letter upper-cased, as a sentence starts. */
const CAPITAL = "capital";

/** One quoted word, then a comma or the end. */
const QUOTED = /\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*(,|$)/y;

/**
 * The formatters after a brace's bar: one from the closed set, and `capital`
 * after it or alone — "{count(all('finding')) | words | capital} findings"
 * starts a headline "Fifty-seven findings".
 */
function readFormatters(text: string): { readonly format?: Formatter; readonly args: readonly string[]; readonly capital?: true } {
  const bar = filterBar(text);
  if (bar >= 0) {
    if (text.slice(bar + 1).trim() !== CAPITAL) throw new TemplateError(`only "capital" may follow another formatter, like {n | words | capital}`);
    const first = text.slice(0, bar);
    if (first.trim() === CAPITAL) throw new TemplateError(`"capital" is said once`);
    return { ...readFormatter(first), capital: true };
  }
  if (text.trim() === CAPITAL) return { args: [], capital: true };
  return readFormatter(text);
}

/** A formatter and what it is told: `money`, `plural: 'person', 'people'`. */
function readFormatter(text: string): { readonly format: Formatter; readonly args: readonly string[] } {
  const colon = text.indexOf(":");
  const name = (colon >= 0 ? text.slice(0, colon) : text).trim();
  if (!(FORMATTERS as readonly string[]).includes(name)) throw new TemplateError(`"${name}" is not a formatter; use one of ${[...FORMATTERS, CAPITAL].join(", ")}`);
  const args: string[] = [];
  if (colon >= 0 && name === "excerpt") {
    // How many characters at most: a whole number, `excerpt: 80`.
    const most = text.slice(colon + 1).trim();
    if (!/^\d+$/.test(most) || Number(most) < 20 || Number(most) > 1000) throw new TemplateError("excerpt is told at most how many characters, 20 to 1000: {summary | excerpt: 80}");
    args.push(most);
  } else if (colon >= 0) {
    const rest = text.slice(colon + 1);
    let at = 0;
    while (at < rest.length) {
      QUOTED.lastIndex = at;
      const m = QUOTED.exec(rest);
      if (!m) throw new TemplateError(`"${name}" is told quoted words, like ${name}: 'offer'`);
      args.push((m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1"));
      at = QUOTED.lastIndex;
      if (m[3] === "") break;
    }
  }
  if (name === "plural" && (args.length < 1 || args.length > 2)) {
    throw new TemplateError("plural is told its noun, like {count | plural: 'offer'}, and its plural where English does not make it: plural: 'person', 'people'");
  }
  if (name !== "plural" && name !== "excerpt" && args.length > 0) throw new TemplateError(`"${name}" takes nothing after it`);
  return { format: name as Formatter, args };
}

export class TemplateError extends Error {
  constructor(readonly sentence: string) {
    super(sentence);
  }
}

/**
 * The braces of a template, in order: each `{…}` as written, with where its
 * formatter begins inside it — so a rewrite can change an expression and
 * keep what was said after the bar, spaces and quoted words included.
 */
export function templateBraces(template: string): readonly { readonly inner: string; readonly bar: number }[] {
  const out: { inner: string; bar: number }[] = [];
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{", i);
    if (open < 0) break;
    const close = template.indexOf("}", open);
    if (close < 0) break;
    const inner = template.slice(open + 1, close);
    out.push({ inner, bar: filterBar(inner) });
    i = close + 1;
  }
  return out;
}

export function parseTemplate(template: string): readonly TemplatePart[] {
  const parts: TemplatePart[] = [];
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{", i);
    if (open < 0) {
      parts.push({ text: template.slice(i) });
      break;
    }
    if (open > i) parts.push({ text: template.slice(i, open) });
    const close = template.indexOf("}", open);
    if (close < 0) throw new TemplateError(`a "{" at character ${open + 1} is never closed`);
    const inner = template.slice(open + 1, close);
    const bar = filterBar(inner);
    const source = (bar >= 0 ? inner.slice(0, bar) : inner).trim();
    const formatter = bar >= 0 ? readFormatters(inner.slice(bar + 1)) : undefined;
    // Two formatters where the second is not `capital` (`{n | words | money}`) left the first in the expression, read as a join of sets.
    const before = filterBar(source);
    if (before >= 0 && (FORMATTERS as readonly string[]).includes(source.slice(before + 1).split(":")[0]!.trim())) {
      throw new TemplateError(`only "capital" may follow another formatter, like {n | words | capital}`);
    }
    parts.push({
      expr: parseExpr(source),
      source,
      ...(formatter?.format ? { format: formatter.format } : {}),
      ...(formatter && formatter.args.length > 0 ? { formatArgs: formatter.args } : {}),
      ...(formatter?.capital ? { capital: true as const } : {}),
    });
    i = close + 1;
  }
  return parts;
}

