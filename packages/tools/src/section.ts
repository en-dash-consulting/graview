import type { HostAi, ThinkingProvider, ThinkingReply } from "./ai.js";
import { thinkingOf } from "./inline-ai.js";

/*
 * `@graview/tools/section` — MAKE THIS SECTION BETTER (Roadmap
 * f-make-this-section-better).
 *
 * A right-click on a section of a worker view ("This week") offers "Make
 * this better": just do it, describe the change, or highlight the part to
 * change. A model revises that section alone — its markup in the view's
 * script and the stylesheet rules that style it — and the view is composed
 * whole again, everything outside the section kept byte for byte, so the
 * section is all that can have changed. Before the person sees it, the
 * page judges the composed view (drawn as a draft, compared with what it
 * replaces); what fails is handed back to the model once with the
 * findings, and refused in plain words if it fails again.
 *
 * What is here is pure, but for the model it asks: the section found in
 * the script (`locateSection`), the view composed with its revision
 * (`composeSection`), what the model is told and how its answer is read,
 * and the asking, repairing and refusing (`reviseSection`), judged by
 * whatever the page hands it.
 */

/** A span of the script, by offsets: `[start, end)`. */
export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

/** One rule of the view's stylesheet, where it stands in the script. */
export interface SectionRule extends SourceSpan {
  readonly selector: string;
  readonly text: string;
  /** The stylesheet string it is in (its index among the script's `graview.style` strings). */
  readonly sheet: number;
}

/** A stylesheet string the script hands `graview.style`: where its text stands, and how it is quoted. */
export interface StyleString extends SourceSpan {
  readonly quote: "`" | '"' | "'";
}

/** A section found in a view's script. */
export interface LocatedSection {
  /** Its name, as found. */
  readonly name: string;
  /** Its markup, whole: from its opening tag to its closing one (or a heading to the next as high). */
  readonly markup: SourceSpan & { readonly text: string };
  /** The rules that style only it: replaced with what the model answers. */
  readonly rules: readonly SectionRule[];
  /** Rules that style it and something else too: told, never changed. */
  readonly shared: readonly SectionRule[];
  /** The classes and ids its markup draws (`.name`, `#name`). */
  readonly names: readonly string[];
  /** The script's stylesheet strings. */
  readonly sheets: readonly StyleString[];
}

/** The section revised, as the model answers it. */
export interface SectionRevised {
  readonly markup: string;
  readonly css: string;
  readonly said: string;
}

interface Tag {
  readonly start: number;
  readonly end: number;
  readonly name: string;
  readonly closing: boolean;
  readonly attrs: string;
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const LANDMARKS = new Set(["section", "article", "nav", "aside", "header", "footer", "main", "form", "search"]);
const HEADING = /^h([1-6])$/;
/* A tag: its name, and attributes that may hold quoted values and `${…}` interpolations. */
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|\$\{(?:[^{}]|\{[^{}]*\})*\}|[^>"'$]|\$(?!\{))*)>/g;

const said = (text: string) => text.replace(/\s+/g, " ").trim();
const plain = (markup: string) => said(markup.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, " ").replace(/<[^>]*>/g, " "));
const same = (a: string, b: string) => said(a).toLowerCase() === said(b).toLowerCase();

function tagsOf(source: string): Tag[] {
  const tags: Tag[] = [];
  for (const match of source.matchAll(TAG)) {
    const name = match[2]!.toLowerCase();
    const attrs = match[3] ?? "";
    tags.push({ start: match.index!, end: match.index! + match[0].length, name, closing: match[1] === "/", attrs: VOID.has(name) || attrs.trimEnd().endsWith("/") ? `${attrs}\u0000void` : attrs });
  }
  return tags;
}
const isVoid = (tag: Tag) => VOID.has(tag.name) || tag.attrs.endsWith("\u0000void");

/** An attribute's literal value in a tag, if it has one. */
function attrOf(tag: Tag, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag.attrs);
  const value = match ? (match[1] ?? match[2] ?? match[3]) : undefined;
  return value === undefined || value.includes("${") ? undefined : value;
}

/** The index of the tag that closes the one at `at`, or -1. */
function closeOf(tags: readonly Tag[], at: number): number {
  const open = tags[at]!;
  let depth = 0;
  for (let index = at + 1; index < tags.length; index++) {
    const tag = tags[index]!;
    if (tag.name !== open.name || isVoid(tag)) continue;
    if (!tag.closing) depth += 1;
    else if (depth === 0) return index;
    else depth -= 1;
  }
  return -1;
}

/** The words of the element whose `id` is this, in the script. */
function textOfId(source: string, tags: readonly Tag[], id: string): string | undefined {
  const at = tags.findIndex((tag) => !tag.closing && attrOf(tag, "id") === id);
  if (at < 0) return undefined;
  const close = closeOf(tags, at);
  return close < 0 ? undefined : plain(source.slice(tags[at]!.end, tags[close]!.start));
}

/** A landmark's name in the script, as `sectionUnder` names it on the page. */
function landmarkName(source: string, tags: readonly Tag[], at: number, close: number): string {
  const tag = tags[at]!;
  const marked = attrOf(tag, "data-section");
  if (marked) return said(marked);
  const label = attrOf(tag, "aria-label");
  if (label) return said(label);
  const by = attrOf(tag, "aria-labelledby");
  if (by) {
    const named = by
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => textOfId(source, tags, id) ?? "")
      .filter(Boolean)
      .join(" ");
    if (named) return named;
  }
  for (let index = at + 1; index < close; index++) {
    const inner = tags[index]!;
    if (inner.closing || !HEADING.test(inner.name)) continue;
    const end = closeOf(tags, index);
    if (end > 0) return plain(source.slice(inner.end, tags[end]!.start));
  }
  return "";
}

/** The `graview.style(…)` strings of a script: where each one's text stands, and its quote. */
export function styleStringsOf(source: string): StyleString[] {
  const sheets: StyleString[] = [];
  for (const match of source.matchAll(/graview\.style\(\s*([`"'])/g)) {
    const quote = match[1] as StyleString["quote"];
    const start = match.index! + match[0].length;
    let at = start;
    while (at < source.length && source[at] !== quote) at += source[at] === "\\" ? 2 : 1;
    if (at < source.length) sheets.push({ start, end: at, quote });
  }
  return sheets;
}

/** The rules of a stylesheet, at the top level: an at-rule's block is one rule, named by the selectors inside it. */
function rulesOf(css: string, offset: number, sheet: number): SectionRule[] {
  const rules: SectionRule[] = [];
  let at = 0;
  while (at < css.length) {
    const open = css.indexOf("{", at);
    if (open < 0) break;
    let depth = 0;
    let close = open;
    for (; close < css.length; close++) {
      if (css[close] === "{") depth += 1;
      else if (css[close] === "}" && --depth === 0) break;
    }
    if (close >= css.length) break;
    // The rule begins after whitespace and comments.
    let start = at;
    while (start < open && /\s/.test(css[start]!)) start += 1;
    while (css.startsWith("/*", start)) {
      const done = css.indexOf("*/", start);
      start = done < 0 ? open : done + 2;
      while (start < open && /\s/.test(css[start]!)) start += 1;
    }
    const head = css.slice(start, open).trim();
    const selector = head.startsWith("@") ? [...css.slice(open + 1, close).matchAll(/([^{}]+)\{/g)].map((inner) => inner[1]!.trim()).join(", ") : head;
    rules.push({ start: offset + start, end: offset + close + 1, selector, text: css.slice(start, close + 1), sheet });
    at = close + 1;
  }
  return rules;
}

/** The classes (`.name`) and ids (`#name`) a selector names. */
const namesIn = (selector: string): string[] => [...selector.replace(/\[[^\]]*\]|:[\w-]+\([^)]*\)/g, " ").matchAll(/([.#])(-?[_a-zA-Z][\w-]*)/g)].map((match) => `${match[1]}${match[2]}`);

/** The classes and ids markup draws, as written (interpolated ones left out). */
function namesDrawn(markup: string): Set<string> {
  const names = new Set<string>();
  for (const tag of tagsOf(markup)) {
    if (tag.closing) continue;
    const classes = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag.attrs);
    for (const one of (classes?.[1] ?? classes?.[2] ?? "").replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, " ").split(/\s+/)) if (one) names.add(`.${one}`);
    const id = attrOf(tag, "id");
    if (id) names.add(`#${id}`);
  }
  return names;
}

/**
 * THE SECTION, FOUND IN THE VIEW'S SCRIPT: the element named so — marked
 * `data-section`, a landmark by its label or its heading — innermost
 * first, else the block a heading of those words begins; and the rules
 * that style it. Undefined when the script draws no section of that name.
 */
export function locateSection(source: string, name: string): LocatedSection | undefined {
  const tags = tagsOf(source);
  let markup: (SourceSpan & { text: string }) | undefined;
  let best = Infinity;
  for (let at = 0; at < tags.length; at++) {
    const tag = tags[at]!;
    if (tag.closing || isVoid(tag)) continue;
    const candidate = LANDMARKS.has(tag.name) || attrOf(tag, "data-section") !== undefined || attrOf(tag, "role") === "region";
    if (!candidate) continue;
    const close = closeOf(tags, at);
    if (close < 0) continue;
    const end = tags[close]!.end;
    if (end - tag.start < best && same(landmarkName(source, tags, at, close), name)) {
      best = end - tag.start;
      markup = { start: tag.start, end, text: source.slice(tag.start, end) };
    }
  }
  /* A heading's block: the heading, and what follows it up to the next heading as high, or the end of what holds it. */
  if (!markup) {
    for (let at = 0; at < tags.length && !markup; at++) {
      const tag = tags[at]!;
      const level = HEADING.exec(tag.name);
      if (tag.closing || !level) continue;
      const close = closeOf(tags, at);
      if (close < 0 || !same(plain(source.slice(tag.end, tags[close]!.start)), name)) continue;
      let depth = 0;
      let end = tags[close]!.end;
      for (let index = close + 1; index < tags.length; index++) {
        const next = tags[index]!;
        if (isVoid(next)) continue;
        const higher = HEADING.exec(next.name);
        if (depth === 0 && !next.closing && higher && Number(higher[1]) <= Number(level[1])) break;
        if (next.closing && depth === 0) break;
        depth += next.closing ? -1 : 1;
        end = next.end;
      }
      markup = { start: tag.start, end, text: source.slice(tag.start, end) };
    }
  }
  if (!markup) return undefined;
  const names = namesDrawn(markup.text);
  const sheets = styleStringsOf(source);
  const rules: SectionRule[] = [];
  const shared: SectionRule[] = [];
  sheets.forEach((sheet, index) => {
    for (const rule of rulesOf(source.slice(sheet.start, sheet.end), sheet.start, index)) {
      const parts = rule.selector.split(",").map((part) => namesIn(part));
      const touches = parts.some((part) => part.some((one) => names.has(one)));
      if (!touches) continue;
      // Its own when every selector in it names the section's markup; otherwise it styles something else too.
      if (parts.every((part) => part.some((one) => names.has(one)))) rules.push(rule);
      else shared.push(rule);
    }
  });
  return { name, markup, rules, shared, names: [...names], sheets };
}

/** Text put inside a quoted string of the script, so it stays inside it. */
function quoted(text: string, quote: StyleString["quote"]): string {
  if (quote === "`") return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return text.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), `\\${quote}`).replace(/\n/g, "\\n");
}

/**
 * THE VIEW COMPOSED WHOLE WITH ITS SECTION REVISED: the section's markup
 * replaced, the rules that styled only it replaced by the revision's where
 * the first of them stood (else added to the script's first stylesheet, or
 * a stylesheet of its own at the top), and every other byte as it was.
 */
export function composeSection(source: string, located: LocatedSection, revised: Pick<SectionRevised, "markup" | "css">): string {
  const edits: { start: number; end: number; text: string }[] = [{ start: located.markup.start, end: located.markup.end, text: revised.markup }];
  const css = revised.css.trim();
  const [first, ...rest] = located.rules;
  if (first) {
    const sheet = located.sheets[first.sheet]!;
    edits.push({ start: first.start, end: first.end, text: quoted(css, sheet.quote) });
    for (const rule of rest) edits.push({ start: rule.start, end: rule.end, text: "" });
  } else if (css) {
    const sheet = located.sheets[0];
    if (sheet) edits.push({ start: sheet.end, end: sheet.end, text: quoted(`\n${css}\n`, sheet.quote) });
    else edits.push({ start: 0, end: 0, text: `graview.style(\`\n${quoted(css, "`")}\n\`);\n` });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const edit of edits) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

/** How a person asked: the model alone, in their words, or in their words about the part they pointed at. */
export type SectionMode = "just" | "describe" | "highlight";

export const SECTION_SYSTEM = [
  "You revise one section of a view in a Graview app.",
  "The view is a plain script: it draws HTML with graview.html`…` templates and styles it with graview.style(css).",
  "You are given the section's markup exactly as it stands in the script's template. It may hold ${…} interpolations: keep each one you keep exactly as written, and never name a variable that is not already in them.",
  "You are given the stylesheet rules that style only this section (you rewrite them), the rules it shares with the rest of the view (never restate or change those), the app's look (its scheme and the values of its --graview-* tokens), and the words the section shows now.",
  'Answer with one JSON object and nothing else: {"markup": "<the section\'s whole new markup>", "css": "<every rule that styles it now>", "said": "<one sentence to the person saying what you changed>"}.',
  "Keep the same outer element, and keep its name — its label or its heading's words — so it is still found. Show the same data. Style every class the markup uses, or stop using it. Use var(--graview-…) tokens for colors, type and corners, never colors of your own.",
  "Never use import, export, require, <script>, <style>, or on…= attributes.",
].join(" ");

/** What the model is asked, as one JSON prompt. */
export function sectionPrompt(ask: { readonly located: LocatedSection; readonly mode: SectionMode; readonly words?: string; readonly highlighted?: readonly string[]; readonly theme?: Readonly<Record<string, string>>; readonly shows?: string; readonly findings?: readonly string[]; readonly last?: SectionRevised }): string {
  const asked =
    ask.mode === "just"
      ? "Make this section better: easier to read at a glance, laid out cleanly at a phone's width and at a desk's, in the app's own look. Change no data it shows."
      : (ask.words ?? "").trim();
  return JSON.stringify({
    section: ask.located.name,
    asked,
    ...(ask.mode === "highlight" && ask.highlighted?.length ? { pointed_at: ask.highlighted } : {}),
    markup: ask.located.markup.text,
    rules: ask.located.rules.map((rule) => rule.text),
    shared_rules: ask.located.shared.map((rule) => rule.text),
    ...(ask.theme ? { look: ask.theme } : {}),
    ...(ask.shows ? { shows: ask.shows.slice(0, 1200) } : {}),
    ...(ask.findings?.length ? { your_last_answer: ask.last, what_broke: ask.findings, repair: "Your last answer broke the view as said in what_broke. Answer again, fixing each one." } : {}),
  });
}

/** The model's answer read: the section's markup, its rules and the sentence; undefined when it is none of those. */
export function readSectionReply(text: string): SectionRevised | undefined {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const parsed = JSON.parse(fenced.slice(start, end + 1)) as { markup?: unknown; css?: unknown; said?: unknown };
    if (typeof parsed.markup !== "string" || !parsed.markup.trim().startsWith("<")) return undefined;
    return { markup: parsed.markup.trim(), css: typeof parsed.css === "string" ? parsed.css : "", said: typeof parsed.said === "string" && parsed.said.trim() ? parsed.said.trim() : "Revised this section." };
  } catch {
    return undefined;
  }
}

/** Each model asked, timed, and what it spent. */
export interface SectionStage {
  readonly stage: "light" | "thinking";
  readonly model: string;
  readonly ms: number;
  readonly usage?: ThinkingReply["usage"];
}

export interface ReviseSectionOptions {
  readonly ai: HostAi;
  /** The view's whole script, as it draws now. */
  readonly source: string;
  /** The section, by the name the menu said. */
  readonly section: string;
  readonly mode: SectionMode;
  /** The person's words: "What should change?". */
  readonly words?: string;
  /** What they pointed at, in words ("the three day columns"). */
  readonly highlighted?: readonly string[];
  readonly theme?: Readonly<Record<string, string>>;
  /** The words the section shows now. */
  readonly shows?: string;
  /**
   * THE PAGE'S JUDGMENT of a composed view: the findings that keep it from
   * being offered (empty when it may be), in sentences — drawn as a draft,
   * the host's own checks, compared with what it replaces.
   */
  readonly judge: (source: string) => Promise<readonly string[]>;
}

export type ReviseSectionResult =
  | { readonly ok: true; readonly source: string; readonly said: string; readonly located: LocatedSection; readonly repaired: boolean; readonly stages: readonly SectionStage[] }
  | { readonly ok: false; readonly refused: string; readonly stages: readonly SectionStage[] };

/**
 * REVISE A SECTION: the light model first — the full one where the light
 * one's answer cannot be read — composed whole and judged; what fails is
 * handed back once, with the findings, to the full model; what fails again
 * is refused in words. Nothing is kept here: the page offers what passes.
 */
export async function reviseSection(options: ReviseSectionOptions): Promise<ReviseSectionResult> {
  const stages: SectionStage[] = [];
  const located = locateSection(options.source, options.section);
  if (!located) return { ok: false, refused: `“${options.section}” could not be found in the view's code, so it cannot be revised on its own.`, stages };
  const light = options.ai.off ? undefined : options.ai.light;
  const full = thinkingOf(options.ai);
  const first = light ?? full;
  if (!first) return { ok: false, refused: options.ai.withoutModel ?? "Revising a section needs AI, and none is on here.", stages };
  const ask = async (provider: ThinkingProvider, stage: SectionStage["stage"], prompt: string): Promise<SectionRevised | undefined> => {
    const began = Date.now();
    try {
      const reply = await provider.think({ system: SECTION_SYSTEM, prompt, state: {} as never, catalog: { candidates: [] } as never });
      stages.push({ stage, model: provider.model, ms: Date.now() - began, ...(reply.usage ? { usage: reply.usage } : {}) });
      return readSectionReply(reply.text);
    } catch {
      stages.push({ stage, model: provider.model, ms: Date.now() - began });
      return undefined;
    }
  };
  const base = { located, mode: options.mode, ...(options.words ? { words: options.words } : {}), ...(options.highlighted ? { highlighted: options.highlighted } : {}), ...(options.theme ? { theme: options.theme } : {}), ...(options.shows ? { shows: options.shows } : {}) };
  const firstStage = light ? "light" : "thinking";
  let revised = await ask(first, firstStage, sectionPrompt(base));
  // The light model's answer could not be read: the full one, once.
  if (!revised && light && full && full !== light) revised = await ask(full, "thinking", sectionPrompt(base));
  if (!revised) return { ok: false, refused: "The model did not answer with a revision of this section.", stages };
  let source = composeSection(options.source, located, revised);
  let findings = await options.judge(source);
  if (findings.length === 0) return { ok: true, source, said: revised.said, located, repaired: false, stages };
  /* Once, with what broke: the full model where there is one. */
  const repairer = full ?? first;
  const again = await ask(repairer, repairer === light ? "light" : "thinking", sectionPrompt({ ...base, findings, last: revised }));
  if (!again) return { ok: false, refused: `It could not be revised without breaking the view: ${findings.join(" ")}`, stages };
  source = composeSection(options.source, located, again);
  findings = await options.judge(source);
  if (findings.length > 0) return { ok: false, refused: `It could not be revised without breaking the view: ${findings.join(" ")}`, stages };
  return { ok: true, source, said: again.said, located, repaired: true, stages };
}
