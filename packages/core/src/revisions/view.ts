/*
 * A VIEW'S REVISION, COMPARED WITH WHAT IT REPLACES (Roadmap
 * f-revisions-say-what-broke).
 *
 * Homeflow's home view was rewritten whole by a chat: the "This week"
 * section's markup stayed and the stylesheet that laid it out (`.hf-week`,
 * `.hf-wk-*`) did not, and the first screen it was pictured by looked as it
 * had. Nothing said so. This says it: the classes the new drawing still uses
 * that some rule styled before and none styles now, the selectors taken out
 * whose markup is still drawn, the sections drawn before and not now, and
 * how the page's height moved — each in a sentence and as an entry.
 *
 * A class that was never styled — a hook for `graview.on`, a utility a
 * view draws for its own reading — is never said: only "styled before,
 * unstyled now". What a side is read from is the best it was handed: the
 * stylesheet a run drew with and the tree it drew (a headless run's `css`
 * and `drawing`, or a page's), else what its source's strings say.
 */
import { elementsOf, sectionsOfDrawing, type DrawnSection, type ElementLike } from "./sections.js";

/** One side of a revision: the view's source, and what a run of it drew where the host has it. */
export interface ViewRevisionSide {
  /** The view's whole source. */
  readonly source: string;
  /** The stylesheet it drew with (`HeadlessDescribed.css`, or the page's): read from the source's strings when left out. */
  readonly css?: string;
  /** What it drew (`HeadlessDescribed.drawing.root`, or a page's element): its classes and sections are read from it. */
  readonly drawing?: ElementLike;
  /** The classes its drawing uses, where the host has a list and no tree. */
  readonly classes?: readonly string[];
  /** How tall the page it is drawn on is, in CSS pixels, where the host measured it. */
  readonly height?: number;
}

/** A class the revision still draws that a rule styled before and none styles now. */
export interface UnstyledClass {
  readonly class: string;
  /** The selectors that styled it before. */
  readonly styledBy: readonly string[];
}

/** A selector the revision took out, while the markup it matched is still drawn. */
export interface RemovedSelector {
  readonly selector: string;
  /** The classes (`.name`) and ids (`#name`) in it, each still drawn. */
  readonly names: readonly string[];
}

export interface HeightChange {
  readonly before: number;
  readonly after: number;
  /** `after - before`, in CSS pixels. */
  readonly change: number;
  /** The change as a part of `before`: -0.5 is half as tall. */
  readonly ratio: number;
}

/** What a revision broke, as entries and in words. */
export interface ViewRevision {
  /** True when anything below was found; a height that moved less than a tenth is not. */
  readonly regressed: boolean;
  readonly unstyled: readonly UnstyledClass[];
  readonly selectorsRemoved: readonly RemovedSelector[];
  /** Sections drawn before and not now, by name. */
  readonly sectionsMissing: readonly DrawnSection[];
  readonly height?: HeightChange;
  /** Where each side was read from: its drawing and stylesheet, or its source alone. */
  readonly read: { readonly before: "drawing" | "source"; readonly after: "drawing" | "source" };
  /** One sentence per finding. */
  readonly said: readonly string[];
  /** The sentences together, or one saying nothing was lost. */
  readonly text: string;
}

/** Where an interpolation stood in a template's text: never part of a class or a selector. */
const HOLE = "\u0000";

/**
 * THE STRINGS A SCRIPT SAYS: each quoted string and template's text, an
 * interpolation left as a hole. Comments and regular expressions are passed
 * over; nothing is run.
 */
export function stringsOfSource(source: string): string[] {
  const out: string[] = [];
  const n = source.length;
  let i = 0;
  let last = "";
  const unescape = (text: string) => text.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/gs, (_, e: string) => (e === "n" ? "\n" : e === "t" ? "\t" : e[0] === "u" || e[0] === "x" ? String.fromCodePoint(parseInt(e.replace(/[ux{}]/g, ""), 16)) : e));
  const quoted = (quote: string) => {
    const start = ++i;
    while (i < n && source[i] !== quote && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
    const text = source.slice(start, i);
    i++;
    return unescape(text);
  };
  const regex = () => {
    i++;
    let inClass = false;
    while (i < n && source[i] !== "\n") {
      const c = source[i];
      if (c === "\\") i += 2;
      else if (c === "[") (inClass = true), i++;
      else if (c === "]") (inClass = false), i++;
      else if (c === "/" && !inClass) break;
      else i++;
    }
    i++;
    while (i < n && /[a-z]/i.test(source[i]!)) i++;
  };
  const template = (): string => {
    i++;
    let text = "";
    while (i < n) {
      const c = source[i]!;
      if (c === "\\") {
        text += unescape(source.slice(i, i + 2));
        i += 2;
      } else if (c === "`") {
        i++;
        return text;
      } else if (c === "$" && source[i + 1] === "{") {
        i += 2;
        code(true);
        text += HOLE;
      } else {
        text += c;
        i++;
      }
    }
    return text;
  };
  function code(inHole: boolean): void {
    let depth = 0;
    while (i < n) {
      const c = source[i]!;
      if (c === "/" && source[i + 1] === "/") {
        const end = source.indexOf("\n", i);
        i = end < 0 ? n : end;
      } else if (c === "/" && source[i + 1] === "*") {
        const end = source.indexOf("*/", i + 2);
        i = end < 0 ? n : end + 2;
      } else if (c === '"' || c === "'") {
        out.push(quoted(c));
        last = "a";
      } else if (c === "`") {
        out.push(template());
        last = "a";
      } else if (c === "/" && (last === "" || "(,=:[!&|?{};+-*%<>~^".includes(last))) {
        regex();
        last = "a";
      } else {
        if (c === "{") depth++;
        if (c === "}") {
          if (inHole && depth === 0) {
            i++;
            return;
          }
          depth--;
        }
        if (!/\s/.test(c)) last = c;
        i++;
      }
    }
  }
  code(false);
  return out;
}

/** A selector as it is compared: its whitespace and its combinators' spacing made one. */
const normalSelector = (selector: string) =>
  selector
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,])\s*/g, "$1")
    .trim();

/** Splits a selector list on its top-level commas. */
function splitList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < list.length; at++) {
    const c = list[at];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      out.push(list.slice(from, at));
      from = at + 1;
    }
  }
  out.push(list.slice(from));
  return out.map(normalSelector).filter(Boolean);
}

/** The at-rules whose blocks hold style rules of their own. */
const GROUPING = new Set(["media", "supports", "container", "layer", "scope", "document"]);

/** Every style rule's selector in a stylesheet, each once, in order. A keyframe's steps and a font's face are not selectors. */
export function selectorsOfStylesheet(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  const skipString = (at: number) => {
    const quote = text[at];
    let i = at + 1;
    while (i < text.length && text[i] !== quote) i += text[i] === "\\" ? 2 : 1;
    return i + 1;
  };
  const skipBlock = (at: number) => {
    let depth = 1;
    let i = at;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === '"' || c === "'") {
        i = skipString(i);
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    return i;
  };
  const rules = (from: number): number => {
    let prelude = "";
    let at = from;
    while (at < text.length) {
      const c = text[at]!;
      if (c === '"' || c === "'") {
        const end = skipString(at);
        prelude += text.slice(at, end);
        at = end;
      } else if (c === "}") return at + 1;
      else if (c === ";") {
        prelude = "";
        at++;
      } else if (c === "{") {
        const head = prelude.trim();
        prelude = "";
        if (head.startsWith("@")) {
          const name = (/^@([\w-]+)/.exec(head)?.[1] ?? "").toLowerCase();
          at = GROUPING.has(name) ? rules(at + 1) : skipBlock(at + 1);
        } else {
          out.push(...splitList(head));
          at = skipBlock(at + 1);
        }
      } else {
        prelude += c;
        at++;
      }
    }
    return at;
  };
  rules(0);
  return [...new Set(out)];
}

/** The classes and ids a selector names, as `.name` and `#name`; what is inside `[…]` and strings is not read. */
export function namesInSelector(selector: string): string[] {
  const plain = selector.replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"|'[^']*'/g, "");
  return [...new Set([...plain.matchAll(/([.#])(-?[_a-zA-Z -￿][\w -￿-]*)/g)].map((m) => `${m[1]}${m[2]}`))];
}

/** A selector a string of a script could hold, and not the words or the markup a string also holds. */
const looksLikeSelector = (selector: string) => !selector.includes(HOLE) && selector.length < 300 && !/[<;!@]|=>|^\d/.test(selector) && /^[\w\s.#:>+~*()[\]="'^$|,\\%-]+$/u.test(selector);

/** What one side draws and styles. */
interface SideRead {
  readonly from: "drawing" | "source";
  readonly selectors: readonly string[];
  /** Classes and ids it draws, as `.name` and `#name`. */
  readonly drawn: ReadonlySet<string>;
  readonly sections: readonly DrawnSection[];
}

const CLASS_ATTRIBUTE = /\b(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const ID_ATTRIBUTE = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const HEADING_MARKUP = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
const NAMED_LANDMARK = /<(section|nav|main|aside|header|footer|article|form)\b[^>]*?\baria-label\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function readSide(side: ViewRevisionSide): SideRead {
  const strings = side.css === undefined || (side.drawing === undefined && side.classes === undefined) ? stringsOfSource(side.source) : [];
  const selectors =
    side.css !== undefined
      ? selectorsOfStylesheet(side.css)
      : [...new Set(strings.filter((one) => one.includes("{") && one.includes("}")).flatMap((one) => selectorsOfStylesheet(one)).filter(looksLikeSelector))];
  const drawn = new Set<string>();
  let sections: DrawnSection[];
  if (side.drawing) {
    for (const element of elementsOf(side.drawing)) {
      for (const one of (element.getAttribute("class") ?? "").split(/\s+/)) if (one) drawn.add(`.${one}`);
      const id = element.getAttribute("id");
      if (id) drawn.add(`#${id}`);
    }
    sections = sectionsOfDrawing(side.drawing);
  } else {
    const tokens = (match: RegExpMatchArray) => (match[1] ?? match[2] ?? "").split(/\s+/).filter((one) => one && !one.includes(HOLE));
    for (const text of strings) {
      for (const match of text.matchAll(CLASS_ATTRIBUTE)) for (const one of tokens(match)) drawn.add(`.${one}`);
      for (const match of text.matchAll(ID_ATTRIBUTE)) for (const one of tokens(match)) drawn.add(`#${one}`);
    }
    const seen = new Set<string>();
    sections = [];
    const add = (name: string, as: string) => {
      const clean = name.replace(/\s+/g, " ").trim();
      if (!clean || clean.includes(HOLE) || seen.has(clean.toLowerCase())) return;
      seen.add(clean.toLowerCase());
      sections.push({ name: clean, as });
    };
    for (const text of strings) {
      for (const match of text.matchAll(NAMED_LANDMARK)) add(match[2] ?? match[3] ?? "", match[1]!.toLowerCase());
      for (const match of text.matchAll(HEADING_MARKUP)) add(match[2]!.replace(/<[^>]*>/g, ""), "heading");
    }
  }
  for (const one of side.classes ?? []) drawn.add(`.${one}`);
  return { from: side.drawing || side.classes ? "drawing" : "source", selectors, drawn, sections };
}

const MOST_NAMED = 8;
const listed = (names: readonly string[]) => (names.length <= MOST_NAMED ? names.join(", ") : `${names.slice(0, MOST_NAMED).join(", ")} and ${names.length - MOST_NAMED} more`);
const px = (n: number) => `${Math.round(n).toLocaleString("en-US")}px`;

/**
 * WHAT A REVISION OF A VIEW BROKE, against the version it replaces: the
 * classes it still draws that lost every rule styling them, the selectors
 * taken out while the markup they matched is still drawn, the sections
 * drawn before and not now, and how the page's height moved.
 */
export function compareViewRevision(before: ViewRevisionSide, after: ViewRevisionSide): ViewRevision {
  const was = readSide(before);
  const now = readSide(after);
  const styledNow = new Set(now.selectors.flatMap(namesInSelector));
  const styledBefore = new Map<string, string[]>();
  for (const selector of was.selectors) for (const name of namesInSelector(selector)) if (name.startsWith(".")) styledBefore.set(name, [...(styledBefore.get(name) ?? []), selector]);

  const unstyled: UnstyledClass[] = [...styledBefore]
    .filter(([name]) => now.drawn.has(name) && !styledNow.has(name))
    .map(([name, styledBy]) => ({ class: name.slice(1), styledBy }));
  const unstyledNames = new Set(unstyled.map((one) => `.${one.class}`));

  const kept = new Set(now.selectors);
  const selectorsRemoved: RemovedSelector[] = was.selectors
    .filter((selector) => !kept.has(selector))
    .map((selector) => ({ selector, names: namesInSelector(selector) }))
    .filter((one) => one.names.length > 0 && one.names.every((name) => now.drawn.has(name) && (was.from === "source" || was.drawn.has(name))));

  const present = new Set(now.sections.map((one) => one.name.toLowerCase()));
  const sectionsMissing = was.sections.filter((one) => !present.has(one.name.toLowerCase()));

  const height =
    before.height !== undefined && after.height !== undefined && before.height > 0
      ? { before: before.height, after: after.height, change: after.height - before.height, ratio: Math.round(((after.height - before.height) / before.height) * 1000) / 1000 }
      : undefined;
  const heightMoved = height !== undefined && Math.abs(height.ratio) >= 0.1 && Math.abs(height.change) >= 50;

  const said: string[] = [];
  if (unstyled.length > 0) {
    const names = unstyled.map((one) => `.${one.class}`);
    said.push(`${unstyled.length === 1 ? "A class" : `${unstyled.length} classes`} it still draws lost every rule that styled ${unstyled.length === 1 ? "it" : "them"} before: ${listed(names)}. Put back the rules for ${unstyled.length === 1 ? "it" : "them"}, or stop drawing ${unstyled.length === 1 ? "it" : "them"}.`);
  }
  /* A rule whose loss a class already said explains is not said again. */
  const notSaid = selectorsRemoved.filter((one) => !one.names.some((name) => unstyledNames.has(name)));
  if (notSaid.length > 0) said.push(`${notSaid.length === 1 ? "A rule was" : `${notSaid.length} rules were`} taken out while the markup ${notSaid.length === 1 ? "it" : "they"} styled is still drawn: ${listed(notSaid.map((one) => `"${one.selector}"`))}.`);
  if (sectionsMissing.length > 0) said.push(`${sectionsMissing.length === 1 ? "A section" : `${sectionsMissing.length} sections`} drawn before ${sectionsMissing.length === 1 ? "is" : "are"} not drawn now: ${listed(sectionsMissing.map((one) => `"${one.name}"`))}.`);
  if (height && heightMoved) said.push(`The page is ${px(height.after)} tall, ${height.change < 0 ? "down" : "up"} from ${px(height.before)} (${height.change < 0 ? "−" : "+"}${Math.round(Math.abs(height.ratio) * 100)}%).`);
  const regressed = said.length > 0;
  return {
    regressed,
    unstyled,
    selectorsRemoved,
    sectionsMissing,
    ...(height ? { height } : {}),
    read: { before: was.from, after: now.from },
    said,
    text: regressed ? said.join(" ") : `Nothing it drew before lost its style, and no section it drew is gone${height ? "; the page is about as tall" : ""}.`,
  };
}
