import { MOST_STANDING } from "../places.js";
import { parseExpr, type Expr } from "./expr/parse.js";
import { defaultLabelField } from "./compiled.js";
import { warning, type Finding } from "./findings.js";
import { homeOf, viewsOf, type ViewBlock } from "./views.js";
import { parseTemplate } from "./template-parse.js";
import type { GraviewDocument, KindSpec } from "./schema.js";

/*
 * THE LOOK, JUDGED (Roadmap f-design-critic). Every other finding says what
 * is wrong; nothing said an app had too MUCH. The Graview Roadmap app grew a
 * "Stage board" and then four "Stage: X" places each showing one of its
 * columns, fifteen lenses beside six lists, and the advice that proposed
 * them could only add. These findings say clutter, focus and repetition —
 * always as warnings, never errors (an app with too much still works) and
 * never notes (each has an edit that makes the app better, not a question)
 * — and each carries the edits that fix it in `propose_change`'s words,
 * removals first among them.
 *
 * Each is said only where it is unambiguous, and never of what the
 * framework already derives well: an app with no `views.home` draws the
 * gallery of its places, a kind with a glance draws its card from it, a kind
 * with three facts or fewer shows them all on a derived card.
 */

/** A job as `purpose.jobs` says it (f-app-jobs): what this file reads of one. */
export interface DesignJob {
  readonly name: string;
  readonly ask: string;
  readonly kind: string;
  /** Which records answer it, in the rule language: what a home's list of them is narrowed by. */
  readonly where?: string;
  /** Their order: a field, or `{ by, direction }`. */
  readonly sort?: string | { readonly by: string; readonly direction?: "asc" | "desc" };
}

/** The jobs a document says, read as loosely as a page reads `purpose`: one without a kind or a question is the job checker's to refuse, not this file's to judge. */
const jobsSaid = (document: GraviewDocument): readonly DesignJob[] =>
  (document.purpose?.jobs ?? []).filter((job): job is DesignJob => typeof job?.name === "string" && typeof job.ask === "string" && typeof job.kind === "string");

export interface DesignOptions {
  /**
   * The app's jobs; left out, the document's own `purpose.jobs`. With none,
   * the two findings about jobs are not asked.
   */
  readonly jobs?: readonly DesignJob[];
}

/*
 * HOW MANY PLACES A PERSON SCANS. The bar stands at most `MOST_STANDING`
 * places on its row, Home among them, and folds the rest into "More"
 * (`barPlaces`); the home's gallery draws one card per place, two across on
 * a desk. Read as rows, the bar's row and one "More" list as long again is
 * as much as a person takes in as a choice: twelve. Past it, the places are
 * a list to search, and the ones past it are the ones nobody finds.
 */
export const MOST_PLACES = MOST_STANDING * 2;

type Lens = { readonly name?: unknown; readonly title?: unknown; readonly on?: unknown; readonly bindings?: unknown; readonly options?: unknown; readonly hidden?: unknown };
type Block = Record<string, unknown>;

const lensesOf = (document: GraviewDocument): readonly Lens[] => (document.lenses ?? []) as readonly Lens[];
const titleOf = (lens: Lens): string | undefined => (typeof lens.title === "string" && lens.title.trim().length > 0 ? lens.title : undefined);
const listed = (lens: Lens): boolean => titleOf(lens) !== undefined && lens.hidden !== true;
const kindsOfLens = (lens: Lens): readonly string[] => (typeof lens.on === "string" ? [lens.on] : lens.bindings && typeof lens.bindings === "object" ? Object.keys(lens.bindings) : []);
const listedWords = (words: readonly string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`);
const quoted = (titles: readonly string[]) => listedWords(titles.map((title) => `"${title}"`));
const pluralOfKind = (document: GraviewDocument, kind: string) => document.kinds[kind]?.plural ?? `${document.kinds[kind]?.noun ?? kind}s`;

/** Every block of a list, those inside a group or a `when` among them. */
function leaves(blocks: readonly unknown[]): Block[] {
  const out: Block[] = [];
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Block;
    if (Array.isArray(block["group"])) out.push(...leaves(block["group"]));
    else if (Array.isArray(block["show"])) out.push(...leaves(block["show"]));
    else out.push(block);
  }
  return out;
}

const parsed = (source: string): Expr | undefined => {
  try {
    return parseExpr(source);
  } catch {
    return undefined;
  }
};

/** `sort(X, …)` read as X: the order a list is in is not which records it holds. */
const unsorted = (e: Expr): Expr => (e.t === "call" && e.fn === "sort" && e.args[0] ? unsorted(e.args[0]) : e);
/** The kind `all('k')` names. */
const allOf = (e: Expr): string | undefined => (e.t === "call" && e.fn === "all" && e.args.length === 1 && e.args[0]!.t === "lit" && typeof e.args[0]!.value === "string" ? e.args[0]!.value : undefined);

/** The kinds a list's records are drawn from, those it lists whole, and the fields its filters read. */
function readsOf(source: string): { kinds: Set<string>; whole: Set<string>; filters: Set<string> } {
  const kinds = new Set<string>();
  const filters = new Set<string>();
  const whole = new Set<string>();
  const walk = (e: Expr, filtered: boolean) => {
    const kind = allOf(e);
    if (kind !== undefined) {
      kinds.add(kind);
      if (!filtered) whole.add(kind);
      return;
    }
    switch (e.t) {
      case "where":
        walk(e.set, true);
        identsOf(e.filter).forEach((name) => filters.add(name));
        return;
      case "call":
        // A sort is the records it sorts, whole if they are whole; anything else (a count, out()) is not a list of a kind.
        if (e.fn === "sort" && e.args[0]) walk(e.args[0], filtered);
        else e.args.forEach((arg) => walk(arg, true));
        return;
      case "binary":
        // A join is whole where either side is; a meet or a difference keeps some of its records, never all.
        walk(e.left, filtered || e.op !== "|");
        walk(e.right, filtered || e.op !== "|");
        return;
      default:
        return;
    }
  };
  const e = parsed(source);
  if (e) walk(e, false);
  return { kinds, whole, filters };
}

/** The bare names an expression reads: `stage`, and `partOf` of `partOf.name`. */
function identsOf(e: Expr): Set<string> {
  const out = new Set<string>();
  const walk = (x: Expr) => {
    switch (x.t) {
      case "ident":
        out.add(x.name);
        return;
      case "member":
        walk(x.object);
        return;
      case "list":
        x.items.forEach(walk);
        return;
      case "unary":
        walk(x.operand);
        return;
      case "binary":
        walk(x.left);
        walk(x.right);
        return;
      case "call":
        x.args.forEach(walk);
        return;
      case "where":
        walk(x.set);
        return;
      default:
        return;
    }
  };
  walk(e);
  return out;
}

/** `all('k') where f == 'v'` (sorted or not): one value of one field of one kind. */
function sliceOf(source: string): { kind: string; field: string; value: string } | undefined {
  const e = parsed(source);
  if (!e) return undefined;
  const set = unsorted(e);
  if (set.t !== "where") return undefined;
  const kind = allOf(set.set);
  const f = set.filter;
  if (kind === undefined || f.t !== "binary" || f.op !== "==") return undefined;
  const [ident, lit] = f.left.t === "ident" ? [f.left, f.right] : [f.right, f.left];
  if (ident.t !== "ident" || lit.t !== "lit" || typeof lit.value !== "string") return undefined;
  return { kind, field: ident.name, value: lit.value };
}

const listsOf = (lens: Lens): readonly Block[] => {
  const blocks = (lens.options as { blocks?: unknown } | undefined)?.blocks;
  return Array.isArray(blocks) ? leaves(blocks).filter((block) => typeof block["list"] === "string") : [];
};

const canonical = (value: unknown): string => JSON.stringify(value, (_key, v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : v));

/** What shows a kind's records split whole by a field: a status board by it, else the kind's own list grouped by it. */
function wholeSplits(document: GraviewDocument): Map<string, string> {
  const out = new Map<string, string>();
  lensesOf(document).forEach((lens) => {
    const title = titleOf(lens);
    if (lens.name !== "columns" || !title || !listed(lens)) return;
    for (const [kind, roles] of Object.entries((lens.bindings ?? {}) as Record<string, unknown>)) {
      const column = (roles as { column?: unknown } | undefined)?.column;
      if (typeof column === "string" && !out.has(`${kind}|${column}`)) out.set(`${kind}|${column}`, `"${title}"`);
    }
  });
  const lists = (document.pages as { lists?: Record<string, { group?: unknown }> } | undefined)?.lists ?? {};
  for (const [kind, list] of Object.entries(lists)) {
    const by = typeof list.group === "string" ? list.group : (list.group as { by?: unknown } | undefined)?.by;
    if (typeof by === "string" && !out.has(`${kind}|${by}`)) out.set(`${kind}|${by}`, `the list of ${pluralOfKind(document, kind)}`);
  }
  return out;
}

const removeLens = (document: GraviewDocument, lens: Lens): Record<string, unknown> => {
  const title = titleOf(lens)!;
  const twice = lensesOf(document).filter((one) => titleOf(one)?.toLowerCase() === title.toLowerCase()).length > 1;
  return { op: "remove-lens", title, ...(twice && typeof lens.on === "string" ? { on: lens.on } : {}) };
};

/** Places that show what another already shows: a lens bound as another is, or one column of a split shown whole. */
function repeatedPlaces(document: GraviewDocument): { findings: Finding[]; removed: Set<number> } {
  const findings: Finding[] = [];
  const removed = new Set<number>();
  const lenses = lensesOf(document);
  // The same lens, over the same records, bound and optioned the same: the later one repeats the first.
  const seen = new Map<string, number>();
  lenses.forEach((lens, index) => {
    if (!listed(lens)) return;
    const key = canonical({ name: lens.name, on: lens.on, bindings: lens.bindings, options: lens.options });
    const first = seen.get(key);
    if (first === undefined) return void seen.set(key, index);
    removed.add(index);
    findings.push(
      warning(
        "design-repeated-place",
        `lenses.${index}`,
        `"${titleOf(lens)}" draws what "${titleOf(lenses[first]!)}" draws: the same lens over the same records, bound the same way, so a person meets one picture under two names.`,
        `remove "${titleOf(lens)}"; "${titleOf(lenses[first]!)}" stays`,
        [removeLens(document, lens)],
      ),
    );
  });
  // A blocks place whose every list is one value of a field another place shows split whole.
  const splits = wholeSplits(document);
  const slices = new Map<string, { index: number; lens: Lens; value: string }[]>();
  lenses.forEach((lens, index) => {
    if (lens.name !== "blocks" || !listed(lens) || removed.has(index)) return;
    const lists = listsOf(lens);
    const each = lists.map((block) => sliceOf(block["list"] as string));
    const one = each[0];
    if (!one || each.some((s) => !s || s.kind !== one.kind || s.field !== one.field || s.value !== one.value)) return;
    const key = `${one.kind}|${one.field}`;
    if (!splits.has(key)) return;
    slices.set(key, [...(slices.get(key) ?? []), { index, lens, value: one.value }]);
  });
  for (const [key, found] of slices) {
    const [kind, field] = key.split("|") as [string, string];
    const keeper = splits.get(key)!;
    const titles = found.map((one) => titleOf(one.lens)!);
    found.forEach((one) => removed.add(one.index));
    findings.push(
      warning(
        "design-repeated-place",
        `lenses.${found[0]!.index}`,
        `${quoted(titles)} ${titles.length === 1 ? "shows" : "each show"} the ${pluralOfKind(document, kind)} of one ${field} (${found.map((one) => one.value).join(", ")}), which ${keeper} already shows side by side with every other ${field}: the same split, ${titles.length === 1 ? "one column of it again" : "a column at a time"}.`,
        `remove ${quoted(titles)}; ${keeper} keeps the whole split`,
        found.map((one) => removeLens(document, one.lens)),
      ),
    );
  }
  return { findings, removed };
}

/*
 * HOW SPECIFIC A PLACE IS, lowest hidden first: a slice of a split another
 * place shows whole says least of its own (0); then a kind's bare list where
 * a picture already shows every one of them (1, said by `tooManyPlaces`);
 * then any other slice of one kind (2); then a place drawn from several
 * kinds, which composes (3); and last a place that shows a kind whole — a
 * board, a calendar, a whole list (4).
 */
function specificity(lens: Lens, splits: ReadonlyMap<string, string>): number {
  if (lens.name !== "blocks") return 4;
  const lists = listsOf(lens);
  if (lists.length === 0) return 3;
  const reads = lists.map((block) => readsOf(block["list"] as string));
  const kinds = new Set(reads.flatMap((read) => [...read.kinds]));
  if (reads.some((read) => read.whole.size > 0)) return 4;
  if (kinds.size !== 1) return 3;
  const [kind] = kinds;
  return reads.some((read) => [...read.filters].some((field) => splits.has(`${kind}|${field}`))) ? 0 : 2;
}

/** The kinds a listed picture shows every one of: a status board with no column hidden, or a blocks list of all of them. */
function shownWhole(lens: Lens): readonly string[] {
  if (lens.name === "columns") return (lens.options as { hidden?: readonly unknown[] } | undefined)?.hidden?.length ? [] : kindsOfLens(lens);
  if (lens.name !== "blocks") return [];
  return listsOf(lens).flatMap((block) => [...readsOf(block["list"] as string).whole]);
}

function tooManyPlaces(document: GraviewDocument, removed: ReadonlySet<number>): Finding[] {
  const hide = new Set(document.pages?.hide ?? []);
  const lists = Object.keys(document.kinds).filter((kind) => !hide.has(kind));
  const lenses = lensesOf(document);
  const titled = new Set<string>();
  const pictures: number[] = [];
  lenses.forEach((lens, index) => {
    const title = titleOf(lens)?.toLowerCase();
    if (!listed(lens) || removed.has(index) || titled.has(title!)) return;
    titled.add(title!);
    pictures.push(index);
  });
  const count = lists.length + pictures.length;
  if (count <= MOST_PLACES) return [];
  const pages = document.pages as { primary?: readonly string[]; first?: string } | undefined;
  const standing = new Set([...(pages?.primary ?? []), ...(pages?.first ? [pages.first] : [])].map((word) => word.toLowerCase()));
  const stands = (...words: string[]) => words.some((word) => standing.has(word.toLowerCase()));
  const splits = wholeSplits(document);
  const whole = new Set(pictures.flatMap((index) => shownWhole(lenses[index]!)));
  // A place is a lens by its index, or a kind's list by its kind (hidden by its name: `set-lens-hidden` keeps it off as `pages.hide`).
  const ranked = [
    ...pictures.filter((index) => !stands(titleOf(lenses[index]!)!)).map((index) => ({ title: titleOf(lenses[index]!)!, said: `"${titleOf(lenses[index]!)!}"`, at: index, rank: specificity(lenses[index]!, splits) })),
    ...lists.filter((kind) => whole.has(kind) && !stands(kind, pluralOfKind(document, kind))).map((kind) => ({ title: kind, said: `the list of ${pluralOfKind(document, kind)}`, at: lists.indexOf(kind), rank: 1 })),
  ].sort((a, b) => a.rank - b.rank || b.at - a.at);
  const chosen = ranked.slice(0, count - MOST_PLACES);
  if (chosen.length === 0) return [];
  const titles = chosen.map((one) => one.said);
  return [
    warning(
      "design-too-many-places",
      "lenses",
      `This app offers ${count} places — ${lists.length} ${lists.length === 1 ? "list" : "lists"} and ${pictures.length} ${pictures.length === 1 ? "picture" : "pictures"} — and the bar stands ${MOST_STANDING - 1} beside Home; past ${MOST_PLACES} the rest is a list to search, not a choice to see.`,
      `keep ${listedWords(titles)} off the bar and the home (set-lens-hidden): ${titles.length === 1 ? "it says" : "they say"} the least of ${titles.length === 1 ? "its" : "their"} own — a slice of what another place shows whole first, then a list a picture already shows whole — and a link or the address still reaches ${titles.length === 1 ? "it" : "them"}`,
      chosen.map((one) => ({ op: "set-lens-hidden", title: one.title, hidden: true })),
    ),
  ];
}

/** The kind most of the app is about: the most relations, its own and those pointing at it, and places over it. Undefined on a tie. */
function mainKind(document: GraviewDocument): string | undefined {
  const score = new Map(Object.keys(document.kinds).map((kind) => [kind, 0]));
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const edge of Object.values(spec.edges ?? {})) {
      score.set(kind, (score.get(kind) ?? 0) + 1);
      for (const far of Array.isArray(edge.to) ? edge.to : []) if (far !== kind && score.has(far)) score.set(far, score.get(far)! + 1);
    }
  }
  for (const lens of lensesOf(document)) if (listed(lens)) for (const kind of kindsOfLens(lens)) if (score.has(kind)) score.set(kind, score.get(kind)! + 1);
  const ranked = [...score].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[0]![1] === 0 || ranked[1]?.[1] === ranked[0]![1]) return undefined;
  return ranked[0]![0];
}

const isFocal = (block: Block, inRow: boolean): boolean => typeof block["headline"] === "string" || (typeof block["figure"] === "string" && block["emphasis"] === "large" && !inRow);

function homeUnfocused(document: GraviewDocument): Finding[] {
  const home = homeOf(document);
  if (!home) return [];
  // Focal: a headline, or a large figure standing alone; a row of large figures is one row of stat tiles.
  let headlines = 0;
  let focal = 0;
  const count = (blocks: readonly unknown[], inRow: boolean) => {
    for (const raw of blocks) {
      if (!raw || typeof raw !== "object") continue;
      const block = raw as Block;
      if (Array.isArray(block["group"])) count(block["group"], block["direction"] === "row");
      else if (Array.isArray(block["show"])) count(block["show"], inRow);
      else if (isFocal(block, inRow)) {
        focal += 1;
        if (typeof block["headline"] === "string") headlines += 1;
      }
    }
  };
  count(home, false);
  if (focal === 0) {
    const kind = mainKind(document) ?? Object.keys(document.kinds)[0];
    const edits = kind ? [{ op: "set-home", blocks: [{ headline: `{count(all('${kind}')) | words | capital} ${pluralOfKind(document, kind)}` }, ...home] }] : [];
    return [warning("design-home-unfocused", "views.home", "The home has no headline: nothing on it is read first, so a person scans every block to learn what the app is about now.", "begin it with one headline that says the state of things in a sentence", edits)];
  }
  if (focal === 1) return [];
  // Keep the first focal block; say the others as words, and a large figure at its ordinary size.
  let kept = false;
  const calm = (blocks: readonly unknown[], inRow: boolean): unknown[] =>
    blocks.map((raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const block = raw as Block;
      if (Array.isArray(block["group"])) return { ...block, group: calm(block["group"], block["direction"] === "row") };
      if (Array.isArray(block["show"])) return { ...block, show: calm(block["show"], inRow) };
      if (!isFocal(block, inRow)) return block;
      if (!kept) {
        kept = true;
        return block;
      }
      if (typeof block["headline"] === "string") {
        const { headline, key, ...rest } = block;
        return { text: headline, ...(key !== undefined ? { key } : {}), ...rest };
      }
      const { emphasis: _large, ...rest } = block;
      return rest;
    });
  const said = [headlines > 0 ? `${headlines} ${headlines === 1 ? "headline" : "headlines"}` : "", focal - headlines > 0 ? `${focal - headlines} large ${focal - headlines === 1 ? "figure" : "figures"} standing alone` : ""].filter(Boolean).join(" and ");
  return [warning("design-home-unfocused", "views.home", `The home has ${said}: each asks to be read first, so none of them is.`, "keep the first; say the others as words, or as figures at their ordinary size", [{ op: "set-home", blocks: calm(home, false) }])];
}

/** The fields a kind's records are named by, the label's or the one it is named by unsaid. */
function labelFields(spec: KindSpec): Set<string> {
  if (!spec.label) return new Set([defaultLabelField(spec) ?? []].flat());
  return templateIdents(spec.label) ?? new Set();
}

function templateIdents(template: string): Set<string> | undefined {
  try {
    const out = new Set<string>();
    for (const part of parseTemplate(template)) if (part.expr) identsOf(part.expr).forEach((name) => out.add(name));
    return out;
  } catch {
    return undefined;
  }
}

/** The words a block says, as a template: its title, text, badge or headline; a field block's field. */
const saidBy = (block: Block): string | undefined => {
  for (const key of ["title", "headline", "text", "badge"]) if (typeof block[key] === "string") return block[key] as string;
  if (typeof block["field"] === "string") return `{${block["field"] as string}}`;
  return undefined;
};

function cardsRepeatTitles(document: GraviewDocument): Finding[] {
  const findings: Finding[] = [];
  const views = viewsOf(document);
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const naming = labelFields(spec);
    if (naming.size === 0) continue;
    const repeats = (template: string) => {
      const idents = templateIdents(template);
      return idents !== undefined && idents.size > 0 && [...idents].every((name) => naming.has(name));
    };
    for (const slot of ["card", "row"] as const) {
      const blocks = views[kind]?.[slot];
      if (!blocks || blocks.length === 0) continue;
      const all = leaves(blocks);
      if (all.length === 0 || !all.every((block) => (saidBy(block) !== undefined) && repeats(saidBy(block)!))) continue;
      findings.push(
        warning(
          "design-card-repeats-title",
          `views.${kind}.${slot}`,
          `${kind}'s ${slot} says only its name, so a ${slot} of ${pluralOfKind(document, kind)} is a list of names with nothing to compare them by.`,
          `drop it, and the ${slot} is derived: the name, then ${spec.glance ? "its glance" : "the first facts it has"}; or say a fact beside the name`,
          [{ op: "set-view", kind, slot, blocks: null }],
        ),
      );
    }
    if (spec.describe && repeats(spec.describe)) {
      findings.push(warning("design-card-repeats-title", `kinds.${kind}.describe`, `${kind}'s describe says "${spec.describe}", the name again, under the name.`, "drop it, or say a fact the name does not", [{ op: "set-describe", kind, describe: null }]));
    }
  }
  return findings;
}

/** An id said where a person reads: a record's `.id` where its name would do, and `{id}` itself with what separates it. */
const RAW_MEMBER = /\{\s*([A-Za-z_][A-Za-z0-9_.]*)\.id\s*(\|[^}]*)?\}/g;
const RAW_BARE = /(\s*[·•,—–|-]\s*)?#?\{\s*id\s*(?:\|[^}]*)?\}(\s*[·•,—–|-]\s*)?/g;

function readsAnId(template: string): boolean {
  try {
    return parseTemplate(template).some((part) => {
      if (!part.expr) return false;
      let found = false;
      const walk = (e: Expr) => {
        if (e.t === "ident" && e.name === "id") found = true;
        else if (e.t === "member") {
          if (e.name === "id") found = true;
          walk(e.object);
        } else if (e.t === "binary") (walk(e.left), walk(e.right));
        else if (e.t === "call") e.args.forEach(walk);
        else if (e.t === "unary") walk(e.operand);
      };
      walk(part.expr);
      return found;
    });
  } catch {
    return false;
  }
}

/** The template with each id said by name, or taken out; undefined when nothing is left to say. */
function withoutIds(template: string): string | undefined {
  const named = template.replace(RAW_MEMBER, (_all, path: string, format: string | undefined) => `{${path}${format ?? ""}}`);
  const left = named.replace(RAW_BARE, (_all, before: string | undefined, after: string | undefined) => (before && after ? before : "")).trim();
  return left.length > 0 && left !== template ? left : undefined;
}

function rawValues(document: GraviewDocument): Finding[] {
  const findings: Finding[] = [];
  const views = viewsOf(document);
  for (const [kind, spec] of Object.entries(document.kinds)) {
    if (spec.describe && readsAnId(spec.describe)) {
      const fixed = withoutIds(spec.describe);
      findings.push(warning("design-raw-value", `kinds.${kind}.describe`, `${kind}'s describe shows an id ("${spec.describe}"), which nobody reading it can use.`, fixed ? `say "${fixed}": a record is said by its name` : "say a fact a person reads instead", [{ op: "set-describe", kind, describe: fixed ?? null }]));
    }
    for (const slot of ["card", "row"] as const) {
      const blocks = views[kind]?.[slot];
      if (!blocks) continue;
      blocks.forEach((raw, index) => {
        if (!raw || typeof raw !== "object") return;
        const block = raw as Block;
        const template = saidBy(block);
        if (template === undefined || !(block["field"] === "id" || readsAnId(template))) return;
        const fixed = typeof block["field"] === "string" ? undefined : withoutIds(template);
        const key = ["title", "headline", "text", "badge"].find((one) => typeof block[one] === "string");
        const rewritten = fixed && key ? blocks.map((one, at) => (at === index ? { ...(one as Block), [key]: fixed } : one)) : blocks.filter((_one, at) => at !== index);
        findings.push(
          warning(
            "design-raw-value",
            `views.${kind}.${slot}.${index}`,
            `${kind}'s ${slot} shows an id ("${template}"), which nobody reading it can use.`,
            fixed ? `say "${fixed}": a record is said by its name` : "take it out, or say a fact a person reads",
            rewritten.length > 0 ? [{ op: "set-view", kind, slot, blocks: rewritten as readonly ViewBlock[] }] : [{ op: "set-view", kind, slot, blocks: null }],
          ),
        );
      });
    }
  }
  return findings;
}

/** Why a field is no glance: a long text, a list or a file has no room on a card. Undefined for one that reads at a glance. */
function noGlance(type: string): string | undefined {
  if (type === "text") return "a long text";
  if (type === "list") return "a list";
  if (/^(image|video|file)$/.test(type)) return "a file";
  return undefined;
}

/** The facts a card could show: fields a person reads at a glance, not the name. */
function glanceable(spec: KindSpec, naming: ReadonlySet<string>): string[] {
  return Object.keys(spec.fields).filter((name) => !naming.has(name) && noGlance(spec.fields[name]!.type) === undefined);
}

function noCardForMainKind(document: GraviewDocument): Finding[] {
  const kind = mainKind(document);
  if (!kind) return [];
  const spec = document.kinds[kind]!;
  if (spec.glance || viewsOf(document)[kind]?.card) return [];
  const naming = labelFields(spec);
  const readable = Object.keys(spec.fields).filter((name) => !naming.has(name));
  /*
   * WHAT A DERIVED CARD SHOWS: the author and the natural time first where
   * the kind's roles name them, then the fields as declared — three the
   * name does not say. Fine by derivation when each of the three reads at a
   * glance; said only when one of them is a long text, a list or a file.
   */
  const roles = (spec as { fieldRoles?: Readonly<Record<string, string>> }).fieldRoles ?? {};
  const led = [roles["who"], roles["when"]].filter((field): field is string => field !== undefined && readable.includes(field));
  const derived = [...new Set([...led, ...readable])].slice(0, 3);
  const poor = derived.filter((name) => noGlance(spec.fields[name]!.type) !== undefined);
  if (poor.length === 0) return [];
  const order = (type: string) => (type === "enum" ? 0 : type === "date" || type === "datetime" ? 1 : type === "number" || type === "boolean" ? 2 : 3);
  const fields = glanceable(spec, naming)
    .map((name, at) => ({ name, at, rank: order(spec.fields[name]!.type) }))
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .slice(0, 3)
    .map(({ name }) => name);
  if (fields.length === 0) return [];
  const plural = pluralOfKind(document, kind);
  return [
    warning(
      "design-no-card-for-main-kind",
      `kinds.${kind}.glance`,
      `${plural.charAt(0).toUpperCase()}${plural.slice(1)} are what this app is most about, and with no card and no glance theirs show ${derived.join(", ")}, in the order they were declared: ${poor.map((name) => `${name} is ${noGlance(spec.fields[name]!.type)}`).join(", ")}, with no room on a card.`,
      `say which facts a person compares ${plural} by: "glance": [${fields.map((field) => `"${field}"`).join(", ")}], or write its card`,
      [{ op: "set-glance", kind, fields }],
    ),
  ];
}

/*
 * THE TWO FINDINGS ABOUT JOBS, asked only of the jobs an app says it is for
 * (f-app-jobs): a job nothing answers, and a picture no job asks for, which
 * is the first to keep off the bar. That one is a note: jobs say what
 * people come to do most, not everything an app may show (todo's "Who may do
 * what" answers no job and is still worth a place).
 *
 * The derived home answers every job itself (f-design-composer): with no
 * `views.home`, the home opens on the jobs, each with its count, its first
 * records and its act. A declared home answers one where it lists the job's
 * kind, and so does a titled place over the kind. Only a declared home that
 * does neither leaves a job unanswered, and the edit gives the home the
 * job's question and its records.
 */
function jobFindings(document: GraviewDocument, jobs: readonly DesignJob[]): Finding[] {
  if (jobs.length === 0) return [];
  const findings: Finding[] = [];
  const lenses = lensesOf(document);
  const home = homeOf(document);
  if (home) {
    const homeLists = new Set(leaves(home).flatMap((block) => (typeof block["list"] === "string" ? [...readsOf(block["list"]).kinds] : [])));
    let blocks: readonly unknown[] = home;
    jobs.forEach((job, index) => {
      if (homeLists.has(job.kind) || lenses.some((lens) => listed(lens) && kindsOfLens(lens).includes(job.kind))) return;
      blocks = [...blocks, ...jobBlocks(job)];
      const said = `No place answers "${job.ask}": the home is the app's own and lists no ${pluralOfKind(document, job.kind)}, and nothing else draws them but the list of every one.`;
      findings.push(warning("design-job-unanswered", `purpose.jobs.${index}`, said, "give the home the job's question and its records", [{ op: "set-home", blocks: blocks as readonly ViewBlock[] }]));
    });
  }
  const asked = new Set(jobs.map((job) => job.kind));
  lenses.forEach((lens, index) => {
    if (!listed(lens) || kindsOfLens(lens).length === 0 || kindsOfLens(lens).some((kind) => asked.has(kind))) return;
    findings.push({ ...warning("design-place-for-no-job", `lenses.${index}`, `"${titleOf(lens)}" answers none of the jobs this app says it is for.`, `keep it off the bar (set-lens-hidden), or say the job it answers`, [{ op: "set-lens-hidden", title: titleOf(lens)!, hidden: true }]), severity: "note" });
  });
  return findings;
}

/** A job on a declared home: its question, then the first of its records in its order, saying so when there are none. */
function jobBlocks(job: DesignJob): Block[] {
  const sort = typeof job.sort === "string" ? { by: job.sort, direction: "asc" } : job.sort ? { by: job.sort.by, direction: job.sort.direction ?? "asc" } : undefined;
  return [
    { title: job.ask },
    { list: job.where ? `all('${job.kind}') where (${job.where})` : `all('${job.kind}')`, as: "row", limit: 5, empty: "Nothing right now.", ...(sort && sort.by !== "label" ? { sort } : {}) },
  ];
}

/**
 * THE LOOK OF A DOCUMENT, JUDGED: places that repeat each other, more places
 * than a person scans, a home with no one thing to read first, cards that
 * say only their name, ids shown to people, and the main kind's card left to
 * declaration order. Warnings only, each with the edits that fix it.
 * Exported from `@graview/core/check` for a host to ask alone.
 */
export function designFindings(document: GraviewDocument, options: DesignOptions = {}): Finding[] {
  const repeated = repeatedPlaces(document);
  return [
    ...repeated.findings,
    ...tooManyPlaces(document, repeated.removed),
    ...homeUnfocused(document),
    ...cardsRepeatTitles(document),
    ...rawValues(document),
    ...noCardForMainKind(document),
    ...jobFindings(document, options.jobs ?? jobsSaid(document)),
  ];
}
