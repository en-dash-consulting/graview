import {
  actingAs,
  declaredLenses,
  isShippedLens,
  isSystem,
  placesOf,
  SHIPPED_LENSES,
  SHIPPED_LENS_NAMES,
  type AnySchema,
  type DrawnLens,
  type GraviewApp,
  type LensDeclaration,
  type Principal,
  type ShippedLensName,
} from "@graview/core";
import { fieldSpecOf, parseExpr, type Expr } from "@graview/core/document";
import type { DraftTools } from "./agent/tools.js";
import { firstJsonObject, type Completion } from "./intelligence.js";

/*
 * THE SEAT DRAWS A VIEW ON THE FLY, AND KEEPS IT AS A LENS.
 *
 * Asked for a way of seeing — "a board of deliverables by status", "a
 * timeline of dates", "who covers what" — the seat drafts a picture from
 * what the app already declares, and draws it in place of the picture the
 * reader was looking at. A draft is DATA: a lens the framework ships, bound
 * to the app's own fields and relations, or a lens drawn from blocks (the
 * vocabulary a document's views are written in). It is never code, so it
 * draws in the sandbox every declared lens draws in and can write nothing
 * but through the acts the app declares.
 *
 * Without a model, a draft is a template: the ask's words pick the lens
 * (board, calendar, timeline, who-covers-what, layout, plan, list) and the
 * kind, and the declaration's own roles and field types fill its bindings.
 * With a model (the app's `complete`), an ask no template reads goes to it
 * for the same JSON, and what comes back is judged exactly as a declared
 * lens is — `declaredLenses`, its bindings, and its blocks' expressions —
 * before anything is drawn. A draft that
 * cannot be drawn says why in one sentence and hands back the last one that
 * could.
 *
 * Every draft binds only what the seat may see: it is judged against the
 * app's schema narrowed to the kinds the seat's sight reaches, so a kind it
 * may not see is a kind that does not exist ("Nothing by that name here").
 *
 * Kept, a draft is the `add-lens` edit it carries: `keepLens`
 * (`@graview/tools/keep`, where the declaration is written) runs it
 * through `editDocument`, `compileDocument` (graview check) and
 * `diffDocuments` for a document app, or `checkApp` for a declared one,
 * and hands back the `remove-lens` edit that takes it back.
 *
 * `@graview/tools/draft` — an entry of its own, fetched when the seat is
 * first asked to draw: a page whose reader never asks carries none of it.
 */

/** The lens a draft would declare: a shipped lens, its title, the kind it stands on, its bindings and options. */
export interface DraftLens {
  readonly name: ShippedLensName;
  readonly title: string;
  readonly on: string;
  readonly bindings?: Readonly<Record<string, unknown>>;
  readonly options?: Readonly<Record<string, unknown>>;
}

/** The document edit a draft becomes when it is kept. */
export interface AddLensEdit {
  readonly op: "add-lens";
  readonly title: string;
  readonly lens: ShippedLensName;
  readonly on: string;
  readonly bindings?: Readonly<Record<string, unknown>>;
  readonly options?: Readonly<Record<string, unknown>>;
}

/** The document edit that takes a kept lens back. */
export interface RemoveLensEdit {
  readonly op: "remove-lens";
  readonly title: string;
  readonly on?: string;
}

/**
 * WHAT A TEMPLATE MADE A DRAFT FROM, so asking again ("group by owner",
 * "only this month") can make it again with one thing changed. Absent on a
 * draft a model wrote whole.
 */
export interface DraftRecipe {
  readonly lens: ShippedLensName;
  readonly kind: string;
  /** A title the reader gave ("call it The pipeline"); otherwise one is made from the rest. */
  readonly title?: string;
  /** A board's columns: a choice field. */
  readonly column?: string;
  /** A calendar's or a timeline's span. */
  readonly start?: string;
  readonly end?: string;
  readonly done?: string;
  /** A calendar's range: day, week, month, quarter, year, agenda. */
  readonly range?: string;
  /** Who covers what: the kind across, and the relation that joins them. */
  readonly across?: string;
  readonly link?: string;
  /** A layout: the fields it stands at, and the relation that fills a slot. */
  readonly x?: string;
  readonly y?: string;
  readonly fill?: string;
  readonly fillFrom?: "occupant";
  /** A plan: the field that holds a region's outline. */
  readonly outline?: string;
  /** A list: the choice it is grouped by, the field it is ordered by, what it keeps, how each reads. */
  readonly group?: string;
  readonly sort?: { readonly by: string; readonly direction?: "asc" | "desc" };
  readonly where?: readonly { readonly expr: string; readonly says: string }[];
  readonly as?: "row" | "card";
}

/** A view the seat drew: what it is, what it would declare, and what keeping it would edit. */
export interface SeatDraft {
  readonly title: string;
  /** One line, in the reader's words: "A board of deliverables by status." */
  readonly said: string;
  /** The kind it is a picture of. */
  readonly kind: string;
  readonly lens: DraftLens;
  /** What `@graview/primitives` draws it with (`declaredLensView`). */
  readonly drawn: DrawnLens;
  /** The edit keeping it would make. */
  readonly edit: AddLensEdit;
  /** A template read the ask; or a model wrote it, and it was judged before it was drawn. */
  readonly by: "template" | "model";
  /** What was asked, in order: the first ask, then each refinement. */
  readonly asks: readonly string[];
  readonly recipe?: DraftRecipe;
}

/** A draft that could not be drawn: why, in one sentence, and the last one that could. */
export interface DraftFailure {
  readonly failed: string;
  readonly lastGood?: SeatDraft;
}

export type DraftResult = SeatDraft | DraftFailure;

export const isDraftFailure = (result: DraftResult): result is DraftFailure => "failed" in result;

/** What a seat may see, by kind. Unsaid, every kind. */
export interface DraftSight {
  readonly kinds: readonly string[];
}

export interface DraftOptions<S extends AnySchema = AnySchema> {
  readonly app: GraviewApp<S>;
  /** The kinds the seat may see (`draftSight`); a draft binds nothing else. */
  readonly sight?: DraftSight;
  /** The app's model, when it has one: asked only for what no template reads. */
  readonly complete?: Completion;
  /** The draft on screen: kept when this ask cannot be drawn. */
  readonly lastGood?: SeatDraft;
}

// ── sight ───────────────────────────────────────────────────────────────────

/**
 * THE KINDS A SEAT MAY SEE, as a draft reads them: every kind when the
 * policy says nothing of sight, or for the system; otherwise the kinds a
 * sight grants one of the principal's roles (an agent, the person it acts
 * for). `own` sights still reach the kind — which records is the store's
 * question, asked as the draft is drawn.
 */
export function draftSight<S extends AnySchema>(app: Pick<GraviewApp<S>, "schema" | "policy">, principal: Principal): DraftSight {
  const all = app.schema.kinds as readonly string[];
  const sees = app.policy?.sees;
  if (!sees?.length || isSystem(principal)) return { kinds: all };
  const roles = actingAs(principal).roles ?? [];
  const granted = new Set(sees.filter((sight) => sight.roles === "*" || roles.some((role) => (sight.roles as readonly string[]).includes(role))).flatMap((sight) => sight.kinds));
  return { kinds: all.filter((kind) => granted.has(kind)) };
}

/** The schema as a seat sees it: only the kinds it may see, and only relations between them. */
function seenSchema(schema: AnySchema, sight: DraftSight | undefined): AnySchema {
  if (!sight) return schema;
  const kinds = new Set(sight.kinds.filter((kind) => schema.tryDefinition(kind) !== undefined));
  if (kinds.size === schema.kinds.length) return schema;
  const narrowed = new Map<string, unknown>();
  const definitionOf = (kind: string) => {
    if (!kinds.has(kind)) return undefined;
    if (!narrowed.has(kind)) {
      const definition = schema.tryDefinition(kind) as { edges?: Record<string, { to: readonly string[] | "*" }> } | undefined;
      const edges = Object.fromEntries(
        Object.entries(definition?.edges ?? {}).flatMap(([name, edge]) => {
          if (edge.to === "*") return [[name, edge]];
          const to = edge.to.filter((target) => kinds.has(target));
          return to.length > 0 ? [[name, { ...edge, to }]] : [];
        }),
      );
      narrowed.set(kind, { ...definition, edges });
    }
    return narrowed.get(kind);
  };
  return {
    ...schema,
    definitions: schema.definitions.filter((definition) => kinds.has(definition.kind)),
    kinds: schema.kinds.filter((kind) => kinds.has(kind)),
    tryDefinition: definitionOf,
    definition: (kind: string) => {
      const found = definitionOf(kind);
      if (!found) throw new Error(`Unknown node kind "${kind}"`);
      return found;
    },
  } as unknown as AnySchema;
}

// ── the declaration, read for drawing ────────────────────────────────────────

type FieldType = "string" | "text" | "number" | "integer" | "boolean" | "date" | "datetime" | "enum" | "list" | "url" | "email";

interface FieldInfo {
  readonly name: string;
  readonly type: FieldType | undefined;
  readonly options?: readonly string[];
  /** How a person says it: its display label, else its name in words, lower case. */
  readonly words: string;
}

interface EdgeInfo {
  readonly name: string;
  /** The kind that declares it. */
  readonly from: string;
  readonly to: readonly string[];
  readonly words: string;
}

interface KindInfo {
  readonly kind: string;
  /** "deliverables" */
  readonly plural: string;
  /** "deliverable" */
  readonly noun: string;
  readonly fields: readonly FieldInfo[];
  readonly roles: Readonly<Record<string, string>>;
  /** Relations it declares, to kinds the seat may see. */
  readonly edges: readonly EdgeInfo[];
}

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const wordsOf = (name: string) => kebab(name).replace(/[-_]+/g, " ").trim();
const capital = (text: string) => (text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1));

interface Reading {
  readonly schema: AnySchema;
  readonly kinds: readonly KindInfo[];
  info(kind: string): KindInfo | undefined;
}

function readApp(schema: AnySchema): Reading {
  const kinds: KindInfo[] = [];
  for (const kind of schema.kinds as readonly string[]) {
    const definition = schema.tryDefinition(kind) as
      | {
          fields?: { shape?: Record<string, unknown> };
          edges?: Record<string, { to: readonly string[] | "*"; description?: string }>;
          plural?: string;
          noun?: string;
          fieldRoles?: Record<string, string>;
          display?: { labels?: Record<string, string>; hide?: readonly string[] };
        }
      | undefined;
    if (!definition) continue;
    const labels = definition.display?.labels ?? {};
    const fields = Object.entries(definition.fields?.shape ?? {})
      .filter(([name]) => name !== "id" && name !== "kind")
      .map(([name, field]) => {
        const spec = fieldSpecOf(field) as { type?: FieldType; options?: readonly string[] } | undefined;
        return { name, type: spec?.type, ...(spec?.options ? { options: spec.options } : {}), words: (labels[name] ?? wordsOf(name)).toLowerCase() };
      });
    const edges = Object.entries(definition.edges ?? {}).map(([name, edge]) => ({
      name,
      from: kind,
      to: edge.to === "*" ? (schema.kinds as readonly string[]).filter((other) => other !== kind) : edge.to,
      words: wordsOf(name),
    }));
    const plural = (definition.plural ?? `${wordsOf(kind)}s`).toLowerCase();
    kinds.push({ kind, plural, noun: (definition.noun ?? wordsOf(kind)).toLowerCase(), fields, roles: definition.fieldRoles ?? {}, edges });
  }
  const byKind = new Map(kinds.map((info) => [info.kind, info]));
  return { schema, kinds, info: (kind) => byKind.get(kind) };
}

const fieldOf = (info: KindInfo, name: string | undefined) => (name === undefined ? undefined : info.fields.find((field) => field.name === name));
const isDate = (field: FieldInfo | undefined) => field?.type === "date" || field?.type === "datetime";
const isNumber = (field: FieldInfo | undefined) => field?.type === "number" || field?.type === "integer";

// ── the ask, read ────────────────────────────────────────────────────────────

const normal = (ask: string) =>
  ` ${ask
    .toLowerCase()
    .replace(/[“”"’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

const says = (text: string, phrase: string) => text.includes(` ${phrase} `);
const singular = (word: string) => (word.endsWith("ies") ? `${word.slice(0, -3)}y` : word.endsWith("ses") ? word.slice(0, -2) : word.endsWith("s") ? word.slice(0, -1) : word);

/** The kinds an ask names, by plural, noun or name, in the order the ask names them. */
function kindsNamed(text: string, reading: Reading): readonly KindInfo[] {
  const found: { info: KindInfo; at: number }[] = [];
  for (const info of reading.kinds) {
    const names = new Set([info.plural, info.noun, `${info.noun}s`, wordsOf(info.kind), `${wordsOf(info.kind)}s`]);
    let at = -1;
    for (const name of names) {
      const index = text.indexOf(` ${name} `);
      if (index >= 0 && (at < 0 || index < at)) at = index;
    }
    if (at >= 0) found.push({ info, at });
  }
  return found.sort((a, b) => a.at - b.at).map((one) => one.info);
}

/** A field of a kind the words name: by its label, its name in words, or a word of either. */
function fieldNamed(info: KindInfo, words: string, accept?: (field: FieldInfo) => boolean): FieldInfo | undefined {
  const wanted = words.trim().toLowerCase();
  if (wanted.length === 0) return undefined;
  const candidates = info.fields.filter((field) => !accept || accept(field));
  return (
    candidates.find((field) => field.words === wanted || wordsOf(field.name) === wanted || field.name.toLowerCase() === wanted) ??
    candidates.find((field) => field.words === singular(wanted) || wordsOf(field.name) === singular(wanted)) ??
    candidates.find((field) => wanted.split(" ").some((word) => word.length > 2 && (field.words.split(" ").includes(word) || field.words.split(" ").includes(singular(word)))))
  );
}

/** A relation of a kind the words name. */
function edgeNamed(info: KindInfo, words: string, reading: Reading): EdgeInfo | undefined {
  const wanted = words.trim().toLowerCase();
  if (wanted.length === 0) return undefined;
  return (
    info.edges.find((edge) => edge.words === wanted || edge.name.toLowerCase() === wanted) ??
    // "by gardener": the relation that reaches that kind.
    info.edges.find((edge) => edge.to.some((target) => {
      const other = reading.info(target);
      return other !== undefined && (other.noun === singular(wanted) || other.plural === wanted || wordsOf(target) === singular(wanted));
    })) ??
    info.edges.find((edge) => wanted.split(" ").some((word) => word.length > 2 && edge.words.split(" ").includes(word)))
  );
}

/** What follows "by" in the ask, up to the next joining word. */
function byWhat(text: string): string | undefined {
  const match = / (?:grouped |group |split |sorted |organi[sz]ed )?by ([\p{L}\p{N}' -]+?)(?= (?:and|with|for|in|on|only|where|from|this|that|as|sorted|grouped) |\s*$)/u.exec(text);
  return match?.[1]?.trim();
}

type Intent = "coverage" | "calendar" | "timeline" | "columns" | "board" | "plan" | "blocks";

const COVERAGE = /\bwho\b.*\b(covers?|cover|tends?|owns?|handles?|does|works? on|looks? after|is on|is assigned|staffs?|runs?)\b|\bcoverage\b|\bmatrix\b|\bwho covers\b/;
const CALENDAR = /\bcalendar\b|\bmonth\b|\bagenda\b|\bschedule\b|\bdue\b|\bdeadlines?\b|\bdates?\b|\bwhen\b/;
const TIMELINE = /\btimeline\b|\bover time\b|\bgantt\b|\bspans?\b|\bweek\b/;
const COLUMNS = /\bboard\b|\bkanban\b|\bcolumns?\b|\bpipeline\b|\bstages?\b|\bstatus\b/;
const LAYOUT = /\blaid out\b|\blayout\b|\bseating\b|\bwhere (?:they|it|each) (?:sits?|lies?|stands?)\b|\bfloor\b/;
const PLAN = /\bplan\b|\bmap\b|\bregions?\b/;
const LIST = /\blist\b|\btable\b|\bgroup(?:ed)? by\b|\bsort(?:ed)? by\b|\bonly\b|\bjust the\b/;

function intentsOf(text: string): readonly Intent[] {
  const out: Intent[] = [];
  // "a list of decisions grouped by status": the reader named the shape, whatever else the words say.
  if (/\blist\b|\btable\b/.test(text)) out.push("blocks");
  if (COVERAGE.test(text)) out.push("coverage");
  if (LAYOUT.test(text)) out.push("board");
  if (/\bfloor plan\b/.test(text) || PLAN.test(text)) out.push("plan");
  if (TIMELINE.test(text)) out.push("timeline");
  if (CALENDAR.test(text)) out.push("calendar");
  if (COLUMNS.test(text)) out.push("columns");
  if (LIST.test(text) && !out.includes("blocks")) out.push("blocks");
  // "deliverables by status": a choice to put things in columns by, said without the word board.
  if (out.length === 0 && byWhat(text)) out.push("columns");
  return out;
}

// ── the date words a filter or a range is said in ────────────────────────────

interface Window {
  readonly range?: string;
  readonly cond: (field: string, done?: string) => string;
  readonly says: (field: FieldInfo) => string;
}

const windowOf = (text: string): Window | undefined => {
  const notDone = (done?: string) => (done ? ` and not ${done}` : "");
  if (/\boverdue\b|\blate\b|\bpast due\b/.test(text)) return { cond: (f, done) => `days(today(), ${f}) < 0${notDone(done)}`, says: (f) => `overdue by ${f.words}` };
  if (/\btoday\b/.test(text)) return { range: "day", cond: (f) => `days(today(), ${f}) == 0`, says: (f) => `with ${f.words} today` };
  if (/\bthis week\b|\bnext 7 days\b|\bnext week\b/.test(text)) return { range: "week", cond: (f) => `days(today(), ${f}) >= 0 and days(today(), ${f}) <= 6`, says: (f) => `with ${f.words} in the next week` };
  if (/\bthis month\b|\bnext 30 days\b|\bnext month\b/.test(text)) return { range: "month", cond: (f) => `days(today(), ${f}) >= 0 and days(today(), ${f}) <= 30`, says: (f) => `with ${f.words} in the next month` };
  if (/\blast month\b|\bpast month\b/.test(text)) return { range: "month", cond: (f) => `days(today(), ${f}) >= -30 and days(today(), ${f}) <= 0`, says: (f) => `with ${f.words} in the last month` };
  if (/\bthis year\b/.test(text)) return { range: "year", cond: (f) => `days(today(), ${f}) >= 0 and days(today(), ${f}) <= 365`, says: (f) => `with ${f.words} in the next year` };
  if (/\bquarter\b/.test(text)) return { range: "quarter", cond: (f) => `days(today(), ${f}) >= 0 and days(today(), ${f}) <= 91`, says: (f) => `with ${f.words} in the next quarter` };
  return undefined;
};

const rangeOf = (text: string): string | undefined => {
  if (/\bagenda\b|\bin order\b/.test(text)) return "agenda";
  if (/\btoday\b|\bday\b/.test(text)) return "day";
  if (/\bweek\b/.test(text)) return "week";
  if (/\bquarter\b/.test(text)) return "quarter";
  if (/\byears\b/.test(text)) return "years";
  if (/\byear\b/.test(text)) return "year";
  if (/\bmonth\b/.test(text)) return "month";
  return undefined;
};

// ── templates: one per shipped lens ──────────────────────────────────────────

const PEOPLE = /^(user|person|people|member|staff|gardener|volunteer|owner|agent|employee|worker|team|player|customer|client|contact|party|attendee|guest)s?$/;

/** Why a template could not draw, said about the kind: "no date field on deliverables". */
class Cannot extends Error {}
const cannot = (why: string): never => {
  throw new Cannot(why);
};

function chooseColumn(info: KindInfo, by: string | undefined): FieldInfo {
  const choices = info.fields.filter((field) => field.type === "enum");
  if (by) {
    const named = fieldNamed(info, by);
    if (named && named.type === "enum") return named;
    if (named) cannot(`${info.plural}' ${named.words} is not a choice, so it has no columns`);
  }
  const byRole = fieldOf(info, info.roles["status"] ?? info.roles["column"]);
  if (byRole?.type === "enum") return byRole;
  const status = choices.find((field) => /^(status|stage|state|phase)$/.test(field.name));
  if (status) return status;
  if (choices[0]) return choices[0];
  return cannot(`${info.plural} have no choice field to put in columns`);
}

function chooseDates(info: KindInfo, text: string): { start: FieldInfo; end?: FieldInfo; done?: FieldInfo } {
  const dates = info.fields.filter(isDate);
  const role = (name: string) => {
    const field = fieldOf(info, info.roles[name]);
    return isDate(field) ? field : undefined;
  };
  const mentioned = dates.find((field) => says(text, field.words) || says(text, wordsOf(field.name)));
  const start = mentioned ?? role("start") ?? dates.find((field) => /^(due|date|on|at|start|starts|begins|from|sown|when)/i.test(field.name)) ?? dates[0];
  if (!start) return cannot(`no date field on ${info.plural}`);
  const end = role("end") ?? dates.find((field) => field !== start && /^(end|ends|until|to|finish|finished|harvested|due|closes|through)/i.test(field.name));
  const done = info.fields.find((field) => field.type === "boolean" && /^(done|finished|complete|completed|closed)$/.test(field.name));
  return { start, ...(end && end !== start ? { end } : {}), ...(done ? { done } : {}) };
}

function timelineRoles(info: KindInfo): { start: FieldInfo; end: FieldInfo; column: FieldInfo } | undefined {
  const start = fieldOf(info, info.roles["start"]);
  const end = fieldOf(info, info.roles["end"]);
  const column = fieldOf(info, info.roles["column"] ?? info.roles["day"] ?? info.roles["columns"]);
  if (isNumber(start) && isNumber(end) && column?.type === "enum") return { start: start!, end: end!, column };
  return undefined;
}

function coverageOf(reading: Reading, named: readonly KindInfo[], text: string, by: string | undefined): { rows: KindInfo; across: KindInfo; link: EdgeInfo } {
  const candidates: { rows: KindInfo; across: KindInfo; link: EdgeInfo; score: number }[] = [];
  for (const rows of reading.kinds) {
    for (const link of rows.edges) {
      for (const target of link.to) {
        const across = reading.info(target);
        if (!across || across.kind === rows.kind) continue;
        let score = 0;
        if (named.includes(rows)) score += 4;
        if (named.includes(across)) score += 4;
        if (PEOPLE.test(across.kind) || PEOPLE.test(across.noun)) score += 3;
        if (by && (link.words.includes(by) || across.noun === singular(by))) score += 5;
        if (link.words.split(" ").some((word) => word.length > 2 && text.includes(` ${word}`))) score += 2;
        candidates.push({ rows, across, link, score });
      }
    }
  }
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best) return cannot(named[0] ? `${named[0].plural} are joined to nothing else, so there is no who-covers-what to draw` : "nothing here is joined to anything else, so there is no who-covers-what to draw");
  return best;
}

/** A recipe from an ask, for one lens over one kind. */
function recipeFor(intent: Intent, info: KindInfo, reading: Reading, text: string, named: readonly KindInfo[]): DraftRecipe {
  const by = byWhat(text);
  switch (intent) {
    case "columns": {
      if (by) {
        const field = fieldNamed(info, by);
        // "deliverables by owner", where owner is a relation: who covers what.
        if (!field || field.type !== "enum") {
          const edge = edgeNamed(info, by, reading);
          if (edge) {
            const across = reading.info(edge.to[0]!)!;
            return { lens: "coverage", kind: info.kind, across: across.kind, link: edge.name };
          }
        }
      }
      return { lens: "columns", kind: info.kind, column: chooseColumn(info, by).name };
    }
    case "calendar": {
      const dates = chooseDates(info, text);
      const range = rangeOf(text);
      return { lens: "calendar", kind: info.kind, start: dates.start.name, ...(dates.end ? { end: dates.end.name } : {}), ...(dates.done ? { done: dates.done.name } : {}), ...(range ? { range } : {}) };
    }
    case "timeline": {
      const roles = timelineRoles(info);
      // A timeline is minutes of a day in columns; asked of dates, the honest timeline of dates is a calendar over a longer range.
      if (roles && !/\bdates?\b|\bdue\b|\bdeadlines?\b|\bmonths?\b|\byears?\b/.test(text)) return { lens: "timeline", kind: info.kind, start: roles.start.name, end: roles.end.name, column: roles.column.name };
      const dates = chooseDates(info, text);
      return { lens: "calendar", kind: info.kind, start: dates.start.name, ...(dates.end ? { end: dates.end.name } : {}), ...(dates.done ? { done: dates.done.name } : {}), range: rangeOf(text) ?? "quarter" };
    }
    case "coverage": {
      const found = coverageOf(reading, named, text, by);
      return { lens: "coverage", kind: found.rows.kind, across: found.across.kind, link: found.link.name };
    }
    case "board": {
      const x = fieldOf(info, info.roles["x"]) ?? info.fields.find((field) => field.name === "x");
      const y = fieldOf(info, info.roles["y"]) ?? info.fields.find((field) => field.name === "y");
      if (!isNumber(x) || !isNumber(y)) return cannot(`${info.plural} have no x and y to be laid out by`);
      const inward = reading.kinds.flatMap((other) => other.edges.filter((edge) => edge.to.includes(info.kind) && other.kind !== info.kind));
      const fill = inward[0] ?? info.edges[0];
      if (!fill) return cannot(`nothing is joined to ${info.plural} to fill them`);
      return { lens: "board", kind: info.kind, x: x!.name, y: y!.name, fill: fill.name, ...(fill.from !== info.kind ? { fillFrom: "occupant" as const } : {}) };
    }
    case "plan": {
      const outline = fieldOf(info, info.roles["outline"]) ?? info.fields.find((field) => field.name === "outline");
      if (!outline) return cannot(`${info.plural} have no outline to draw a plan from`);
      return { lens: "plan", kind: info.kind, outline: outline.name };
    }
    case "blocks": {
      const recipe: { -readonly [K in keyof DraftRecipe]: DraftRecipe[K] } = { lens: "blocks", kind: info.kind, as: /\bcards?\b/.test(text) ? "card" : "row" };
      const group = / group(?:ed)? by ([\p{L}\p{N} -]+?)(?= (?:and|only|sorted|with)|\s*$)/u.exec(text)?.[1] ?? (by && !/ sort(?:ed)? by /.test(text) ? by : undefined);
      if (group) {
        const field = fieldNamed(info, group);
        if (!field || field.type !== "enum") return cannot(field ? `${info.plural}' ${field.words} is not a choice, so they cannot be grouped by it` : `${info.plural} have nothing called ${group} to group by`);
        recipe.group = field.name;
      }
      const sort = / sort(?:ed)? by ([\p{L}\p{N} -]+?)(?= (?:and|only|grouped|with)|\s*$)/u.exec(text)?.[1];
      if (sort) {
        const field = fieldNamed(info, sort);
        if (!field) return cannot(`${info.plural} have nothing called ${sort} to sort by`);
        recipe.sort = { by: field.name, ...(/\b(newest|latest|desc|descending|most)\b/.test(text) ? { direction: "desc" as const } : {}) };
      }
      const where = filtersFrom(info, text);
      if (where.length > 0) recipe.where = where;
      return recipe;
    }
  }
}

/** "only open ones", "only this month", "overdue": the conditions an ask keeps a list to. */
function filtersFrom(info: KindInfo, text: string): { expr: string; says: string }[] {
  const out: { expr: string; says: string }[] = [];
  const window = windowOf(text);
  if (window) {
    const dates = info.fields.filter(isDate);
    const role = fieldOf(info, info.roles["start"]);
    const field = dates.find((one) => says(text, one.words)) ?? (isDate(role) ? role : undefined) ?? dates[0];
    if (!field || !isDate(field)) cannot(`no date field on ${info.plural}`);
    const done = info.fields.find((one) => one.type === "boolean" && /^(done|finished|complete|completed|closed)$/.test(one.name));
    out.push({ expr: window.cond(field!.name, /\boverdue\b|\blate\b|\bpast due\b/.test(text) ? done?.name : undefined), says: window.says(field!) });
  }
  // "only open", "just the agreed ones": a choice's value.
  if (/\bonly\b|\bjust\b|\bthat are\b|\bwhich are\b/.test(text)) {
    for (const field of info.fields) {
      if (field.type !== "enum") continue;
      const value = field.options?.find((option) => says(text, option.toLowerCase()) || says(text, wordsOf(option)));
      if (value) out.push({ expr: `${field.name} == '${value.replace(/'/g, "")}'`, says: `that are ${wordsOf(value)}` });
    }
    if (/\bnot done\b|\bundone\b|\bunfinished\b|\bopen ones\b|\bstill to do\b/.test(text)) {
      const done = info.fields.find((one) => one.type === "boolean" && /^(done|finished|complete|completed)$/.test(one.name));
      if (done) out.push({ expr: `not ${done.name}`, says: `not ${done.words}` });
    }
  }
  return out;
}

// ── a recipe, drawn ──────────────────────────────────────────────────────────

const LENS_WORDS: Record<ShippedLensName, string> = { columns: "A board", calendar: "A calendar", timeline: "A timeline", coverage: "A grid", board: "A layout", plan: "A plan", blocks: "A list", reach: "A picture" };

function titled(recipe: DraftRecipe, reading: Reading): { title: string; detail: string } {
  const info = reading.info(recipe.kind)!;
  const words = (name: string | undefined) => (name ? (fieldOf(info, name)?.words ?? wordsOf(name)) : "");
  switch (recipe.lens) {
    case "columns":
      return { title: `${capital(info.plural)} by ${words(recipe.column)}`, detail: `of ${info.plural} by ${words(recipe.column)}` };
    case "calendar": {
      const range = recipe.range ?? "month";
      if (range === "agenda") return { title: `${capital(info.plural)} in date order`, detail: `of ${info.plural} in order of ${words(recipe.start)}` };
      const span = range === "years" ? "year" : range;
      return { title: `${capital(info.plural)} by ${span}`, detail: `of ${info.plural} by ${words(recipe.start)}, a ${span} at a time` };
    }
    case "timeline":
      return { title: `${capital(info.plural)} over the ${words(recipe.column)}`, detail: `of ${info.plural} from ${words(recipe.start)} to ${words(recipe.end)}, by ${words(recipe.column)}` };
    case "coverage": {
      const across = reading.info(recipe.across!)!;
      return { title: `${capital(info.plural)} by ${across.noun}`, detail: `of which ${across.noun} covers which ${info.noun}` };
    }
    case "board":
      return { title: `${capital(info.plural)} where they stand`, detail: `of ${info.plural} where they stand` };
    case "plan":
      return { title: `${capital(info.plural)} on a plan`, detail: `of ${info.plural}` };
    default: {
      const parts = [recipe.where?.map((one) => one.says).join(" and "), recipe.group ? `by ${words(recipe.group)}` : undefined, recipe.sort ? `in order of ${words(recipe.sort.by)}` : undefined].filter((part): part is string => !!part);
      return { title: [capital(info.plural), ...parts].join(" "), detail: [`of ${info.plural}`, ...parts].join(" ") };
    }
  }
}

function lensOf(recipe: DraftRecipe, title: string): DraftLens {
  const base = { title, on: recipe.kind };
  switch (recipe.lens) {
    case "columns":
      return { name: "columns", ...base, bindings: { [recipe.kind]: { column: recipe.column } } };
    case "calendar":
      return {
        name: "calendar",
        ...base,
        bindings: { [recipe.kind]: { start: recipe.start, ...(recipe.end ? { end: recipe.end } : {}), ...(recipe.done ? { done: recipe.done } : {}) } },
        ...(recipe.range ? { options: { range: recipe.range } } : {}),
      };
    case "timeline":
      return { name: "timeline", ...base, bindings: { [recipe.kind]: { start: recipe.start, end: recipe.end, column: recipe.column } } };
    case "coverage":
      return { name: "coverage", ...base, bindings: { rows: { kind: recipe.kind }, columns: { kind: recipe.across }, link: { edge: recipe.link } } };
    case "board":
      return {
        name: "board",
        ...base,
        bindings: { slots: { kind: recipe.kind }, x: { field: recipe.x, on: "slots" }, y: { field: recipe.y, on: "slots" }, fill: { edge: recipe.fill } },
        ...(recipe.fillFrom ? { options: { fillFrom: recipe.fillFrom } } : {}),
      };
    case "plan":
      return { name: "plan", ...base, bindings: { regions: { kind: recipe.kind }, outline: { field: recipe.outline, on: "regions" } } };
    default: {
      const where = recipe.where?.length ? ` where ${recipe.where.map((one) => (recipe.where!.length > 1 ? `(${one.expr})` : one.expr)).join(" and ")}` : "";
      const list: Record<string, unknown> = { list: `all('${recipe.kind}')${where}`, as: recipe.as ?? "row" };
      if (recipe.group) list["group"] = recipe.group;
      if (recipe.sort) list["sort"] = recipe.sort.direction ? { by: recipe.sort.by, direction: recipe.sort.direction } : recipe.sort.by;
      list["empty"] = "Nothing here yet.";
      return { name: "blocks", ...base, options: { blocks: [list] } };
    }
  }
}

/** A title no place of the app already has: the draft's own, or numbered after it. */
function freeTitle<S extends AnySchema>(title: string, app: GraviewApp<S>): string {
  const slug = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  const taken = new Set(["home", "overview", ...placesOf(app).map((place) => place.slug), ...(app.lenses ?? []).flatMap((lens) => (lens.title ? [slug(lens.title)] : []))]);
  if (!taken.has(slug(title))) return title;
  for (let n = 2; ; n++) if (!taken.has(slug(`${title} ${n}`))) return `${title} ${n}`;
}

// ── judging a lens, however it was written ──────────────────────────────────

/** What each block may say besides the key that names it, for a place about no one record. */
const PLACE_BLOCKS: Readonly<Record<string, readonly string[]>> = {
  title: [],
  headline: [],
  text: ["tone"],
  figure: ["as", "currency", "label"],
  list: ["sort", "limit", "group", "empty", "as"],
  progress: ["label"],
  group: ["direction"],
  when: ["show"],
  divider: [],
};

/**
 * WHAT IS WRONG WITH A LENS'S BLOCKS, if anything, in one sentence: each
 * block one the vocabulary has, each expression one the rule language
 * parses, and every kind, field and choice it names one the seat may see.
 * Read with the parser a page already runs, so drafting loads no checker.
 */
function blocksProblem(reading: Reading, blocks: unknown): string | undefined {
  if (!Array.isArray(blocks) || blocks.length === 0) return "it has no blocks to draw";
  if (blocks.length > 40) return "it has more blocks than a place draws";
  const parsed = (source: unknown, what: string): Expr | string => {
    if (typeof source !== "string" || source.trim() === "") return `its ${what} says nothing`;
    try {
      return parseExpr(source);
    } catch (error) {
      return `its ${what} does not read: ${error instanceof Error ? error.message.replace(/ \(at character.*$/, "") : String(error)}`;
    }
  };
  /** The kind of record an expression's set holds, where it says: all('k'), and that filtered. */
  const kindOf = (e: Expr): KindInfo | undefined | null => {
    if (e.t === "where") return kindOf(e.set);
    if (e.t === "call" && e.fn === "all") {
      const word = e.args[0];
      return word?.t === "lit" && typeof word.value === "string" ? (reading.info(word.value) ?? null) : undefined;
    }
    return undefined;
  };
  /** The first name an expression reads that the kinds it stands on do not have. */
  const stray = (e: Expr, over: KindInfo | undefined): string | undefined => {
    switch (e.t) {
      case "lit":
        return undefined;
      case "ident":
        return over && !over.fields.some((field) => field.name === e.name) && !over.edges.some((edge) => edge.name === e.name) ? `${over.plural} have nothing called ${e.name}` : undefined;
      case "member":
        return stray(e.object, over);
      case "list":
        return e.items.map((item) => stray(item, over)).find(Boolean);
      case "unary":
        return stray(e.operand, over);
      case "binary":
        return stray(e.left, over) ?? stray(e.right, over);
      case "where": {
        const kind = kindOf(e.set);
        if (kind === null) return "Nothing by that name here";
        return stray(e.set, over) ?? stray(e.filter, kind ?? undefined);
      }
      case "call": {
        if (e.fn === "all") return kindOf(e) === null ? "Nothing by that name here" : undefined;
        return e.args.map((arg) => stray(arg, over)).find(Boolean);
      }
    }
  };
  const judge = (list: readonly unknown[], depth: number): string | undefined => {
    if (depth > 4) return "its blocks nest deeper than a place draws";
    for (const block of list) {
      if (!isRecord(block)) return "a block is not an object";
      const type = Object.keys(PLACE_BLOCKS).find((key) => key in block);
      if (!type) return `"${Object.keys(block)[0] ?? ""}" is not a block a place draws`;
      const extra = Object.keys(block).find((key) => key !== type && !PLACE_BLOCKS[type]!.includes(key));
      if (extra) return `a ${type} block takes no "${extra}"`;
      const value = block[type];
      if (type === "list" || type === "figure" || type === "when") {
        if (type === "figure" && value === true) continue;
        const e = parsed(value, type);
        if (typeof e === "string") return e;
        const wrong = stray(e, undefined);
        if (wrong) return wrong;
        if (type === "list") {
          const kind = kindOf(e);
          if (kind === null || kind === undefined) return kind === null ? "Nothing by that name here" : "its list does not say which records it lists, like all('task')";
          for (const key of ["group", "sort"] as const) {
            const said = block[key];
            const name = typeof said === "string" ? said : isRecord(said) && typeof said["by"] === "string" ? said["by"] : undefined;
            if (said === undefined) continue;
            const field = name ? kind.fields.find((one) => one.name === name) : undefined;
            if (!field) return `${kind.plural} have nothing called ${String(name ?? said)} to ${key} by`;
            if (key === "group" && field.type !== "enum") return `${kind.plural}' ${field.words} is not a choice, so they cannot be grouped by it`;
          }
        }
        if (type === "when") {
          const show = block["show"];
          if (!Array.isArray(show)) return "a when block shows a list of blocks";
          const inner = judge(show, depth + 1);
          if (inner) return inner;
        }
      } else if (type === "group") {
        if (!Array.isArray(value)) return "a group block holds a list of blocks";
        const inner = judge(value, depth + 1);
        if (inner) return inner;
      } else if (type !== "divider" && typeof value !== "string") return `a ${type} block says words`;
      else if (typeof value === "string") {
        // A template's braces read like any expression, up to a formatter's bar.
        for (const brace of value.matchAll(/\{([^{}]*)\}/g)) {
          const inner = brace[1]!.split(/\|(?![|])/)[0]!;
          const e = parsed(inner, `${type}'s braces`);
          if (typeof e === "string") return e;
          const wrong = stray(e, undefined);
          if (wrong) return wrong;
        }
      }
    }
    return undefined;
  };
  return judge(blocks, 1);
}

/**
 * WHETHER A LENS DRAWS, judged as a declared one is, against what the seat
 * may see: the shipped lens's own sorting (`declaredLenses`, the table
 * `graview check` and `placesOf` read), its bindings against the seen
 * kinds' fields, and the blocks it is drawn from (their expressions parsed,
 * the kinds, fields and choices they name read against what the seat sees).
 * The first thing wrong, in one sentence; or what the primitives draw it
 * with. A kept lens is judged in full again where it is kept (`keepLens`).
 *
 * Judged with what a hosted page already runs and nothing more: the edit
 * vocabulary and the checker (`keepLens`, `@graview/tools/keep`) stay
 * with the host that writes the declaration, so drafting adds nothing to
 * what a page loads before it is asked to draw.
 */
export function judgeLens<S extends AnySchema>(app: GraviewApp<S>, lens: DraftLens, sight?: DraftSight): { readonly ok: true; readonly drawn: DrawnLens } | { readonly ok: false; readonly failed: string } {
  const schema = seenSchema(app.schema as AnySchema, sight);
  const fail = (why: string) => ({ ok: false as const, failed: `Couldn't draw that: ${why.replace(/\.$/, "")}.` });
  if (!isShippedLens(lens.name) || lens.name === "reach") return fail(`"${String(lens.name)}" is not a picture the seat can draw; it draws ${SHIPPED_LENS_NAMES.filter((name) => name !== "reach").join(", ")}`);
  if (typeof lens.title !== "string" || lens.title.trim().length === 0 || lens.title.length > 80) return fail("it needs a title of a few words");
  if (typeof lens.on !== "string" || !schema.tryDefinition(lens.on)) return fail("Nothing by that name here");
  // Every kind a binding names is one the seat may see.
  const shipped = SHIPPED_LENSES[lens.name];
  const bindings = (lens.bindings ?? {}) as Record<string, unknown>;
  if (shipped.binds === "fields") {
    for (const [kind, roles] of Object.entries(bindings)) {
      if (!schema.tryDefinition(kind)) return fail("Nothing by that name here");
      const fields = Object.keys((schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } }).fields?.shape ?? {});
      for (const [role, field] of Object.entries((roles ?? {}) as Record<string, unknown>)) {
        if (typeof field !== "string" || !fields.includes(field)) return fail(`${wordsOf(kind)} has no field "${String(field)}" for its ${role}`);
      }
      for (const role of shipped.requiredRoles) if (!(role in ((roles ?? {}) as object))) return fail(`a ${lens.name} needs ${wordsOf(kind)}'s ${role}`);
    }
  } else if (shipped.binds === "entities") {
    for (const role of shipped.requiredRoles) {
      const binding = bindings[role] as Record<string, unknown> | undefined;
      if (!binding) return fail(`a ${lens.name} needs its ${role}`);
      if (typeof binding["kind"] === "string" && !schema.tryDefinition(binding["kind"])) return fail("Nothing by that name here");
    }
  }
  const extended = { ...app, schema, lenses: [...(app.lenses ?? []), lens as unknown as LensDeclaration] } as GraviewApp<AnySchema>;
  const index = extended.lenses!.length - 1;
  const sorted = declaredLenses(extended);
  const at = `lenses.${index}`;
  const finding = sorted.findings.find((one) => one.path === at || one.path.startsWith(`${at}.`));
  if (finding) return fail(finding.message.replace(/^"[^"]*" /, "it "));
  const undrawn = sorted.undrawn.find((one) => one.index === index);
  if (undrawn) return fail(undrawn.why);
  const drawn = sorted.drawn.find((one) => one.index === index);
  if (!drawn) return fail("its bindings name something the app does not have");
  // The scene keeps its own address whatever a place is called (FR-132).
  if (drawn.as === "overview") return fail(`"${lens.title}" is the scene's own address; give it another title`);
  if (lens.name === "blocks") {
    const wrong = blocksProblem(readApp(schema), lens.options?.["blocks"]);
    if (wrong) return fail(wrong);
  }
  return { ok: true, drawn };
}

/** The edit that keeps a lens. */
export function lensEditOf(lens: DraftLens): AddLensEdit {
  return { op: "add-lens", title: lens.title, lens: lens.name, on: lens.on, ...(lens.bindings ? { bindings: lens.bindings } : {}), ...(lens.options ? { options: lens.options } : {}) };
}

/** The edit that takes a kept lens back. */
export function takeBackEditOf(edit: Pick<AddLensEdit, "title" | "on">): RemoveLensEdit {
  return { op: "remove-lens", title: edit.title, on: edit.on };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A lens as a model or a tool caller writes it — `lens` or `name` for which — read as a draft's lens, to be judged. */
export function lensFromSpec(value: unknown): DraftLens {
  const spec = isRecord(value) ? value : {};
  const name = String(spec["lens"] ?? spec["name"] ?? "") as ShippedLensName;
  const bindings = spec["bindings"];
  const on = typeof spec["on"] === "string" ? spec["on"] : isRecord(bindings) && SHIPPED_LENSES[name]?.binds === "fields" ? (Object.keys(bindings)[0] ?? "") : "";
  return { name, title: typeof spec["title"] === "string" ? spec["title"].trim() : "", on, ...(isRecord(bindings) ? { bindings } : {}), ...(isRecord(spec["options"]) ? { options: spec["options"] } : {}) };
}

/** What a template would have made a lens from, read back from the lens, so asking again works on a lens a model wrote. */
export function recipeOfLens(lens: DraftLens): DraftRecipe | undefined {
  const roles = (kind: string) => (isRecord(lens.bindings?.[kind]) ? (lens.bindings![kind] as Record<string, unknown>) : {});
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  const own = roles(lens.on);
  switch (lens.name) {
    case "columns":
      return text(own["column"]) ? { lens: "columns", kind: lens.on, column: own["column"] as string } : undefined;
    case "calendar": {
      const range = text(lens.options?.["range"]);
      return text(own["start"]) ? { lens: "calendar", kind: lens.on, start: own["start"] as string, ...(text(own["end"]) ? { end: own["end"] as string } : {}), ...(text(own["done"]) ? { done: own["done"] as string } : {}), ...(range ? { range } : {}) } : undefined;
    }
    case "timeline":
      return text(own["start"]) && text(own["end"]) && text(own["column"]) ? { lens: "timeline", kind: lens.on, start: own["start"] as string, end: own["end"] as string, column: own["column"] as string } : undefined;
    case "coverage": {
      const across = isRecord(lens.bindings?.["columns"]) ? text((lens.bindings!["columns"] as Record<string, unknown>)["kind"]) : undefined;
      const link = isRecord(lens.bindings?.["link"]) ? text((lens.bindings!["link"] as Record<string, unknown>)["edge"]) : undefined;
      return across && link ? { lens: "coverage", kind: lens.on, across, link } : undefined;
    }
    case "blocks": {
      const blocks = lens.options?.["blocks"];
      // A single list of one kind's records, as a template writes one: anything richer is the model's to change.
      if (!Array.isArray(blocks) || blocks.length !== 1 || !isRecord(blocks[0])) return undefined;
      const list = blocks[0];
      const whole = new RegExp(`^all\\('${lens.on}'\\)(?: where (.+))?$`).exec(String(list["list"] ?? ""));
      if (!whole) return undefined;
      const sort = list["sort"];
      return {
        lens: "blocks",
        kind: lens.on,
        as: list["as"] === "card" ? "card" : "row",
        ...(typeof list["group"] === "string" ? { group: list["group"] } : {}),
        ...(typeof sort === "string" ? { sort: { by: sort } } : isRecord(sort) && typeof sort["by"] === "string" ? { sort: { by: sort["by"], ...(sort["direction"] === "desc" ? { direction: "desc" as const } : {}) } } : {}),
        ...(whole[1] ? { where: [{ expr: whole[1], says: "as asked" }] } : {}),
      };
    }
    default:
      return undefined;
  }
}

/** A lens already judged, as a draft: what a tool caller's lens or the one on screen becomes before it is changed. */
export function draftFromLens<S extends AnySchema>(app: GraviewApp<S>, lens: DraftLens, drawn: DrawnLens, sight: DraftSight | undefined, by: "template" | "model"): SeatDraft {
  const info = readApp(seenSchema(app.schema as AnySchema, sight)).info(lens.on);
  const recipe = recipeOfLens(lens);
  return { title: lens.title, said: `${LENS_WORDS[lens.name] ?? "A picture"} of ${info?.plural ?? wordsOf(lens.on)}.`, kind: lens.on, lens, drawn, edit: lensEditOf(lens), by, asks: [], ...(recipe ? { recipe } : {}) };
}

/** A draft as a tool answers with it: plain JSON a model can hand back to keep_lens. */
export function draftAnswer(draft: SeatDraft): Readonly<Record<string, unknown>> {
  return {
    title: draft.title,
    said: draft.said,
    lens: { title: draft.lens.title, lens: draft.lens.name, on: draft.lens.on, ...(draft.lens.bindings ? { bindings: draft.lens.bindings } : {}), ...(draft.lens.options ? { options: draft.lens.options } : {}) },
    edit: draft.edit,
    by: draft.by,
    check: "It draws, and graview check would take it.",
  };
}

function fromRecipe<S extends AnySchema>(recipe: DraftRecipe, reading: Reading, options: DraftOptions<S>, asks: readonly string[], keepTitle?: string): DraftResult {
  const named = titled(recipe, reading);
  const title = recipe.title ?? keepTitle ?? freeTitle(named.title, options.app);
  const lens = lensOf(recipe, title);
  const judged = judgeLens(options.app, lens, options.sight);
  if (!judged.ok) return { failed: judged.failed, ...(options.lastGood ? { lastGood: options.lastGood } : {}) };
  return { title, said: `${LENS_WORDS[recipe.lens]} ${named.detail}.`, kind: recipe.kind, lens, drawn: judged.drawn, edit: lensEditOf(lens), by: "template", asks, recipe };
}

// ── drafting ────────────────────────────────────────────────────────────────

/** The kinds an intent can be drawn over, best first. */
function kindsFor(intent: Intent, reading: Reading, named: readonly KindInfo[], text: string): readonly KindInfo[] {
  if (named.length > 0) return named;
  const fits = (info: KindInfo): boolean => {
    switch (intent) {
      case "columns":
        return info.fields.some((field) => field.type === "enum");
      case "calendar":
        return info.fields.some(isDate);
      case "timeline":
        return timelineRoles(info) !== undefined || info.fields.some(isDate);
      case "coverage":
        return info.edges.some((edge) => edge.to.some((target) => target !== info.kind));
      case "board":
        return info.fields.some((field) => field.name === "x") && info.fields.some((field) => field.name === "y");
      case "plan":
        return info.fields.some((field) => field.name === "outline") || info.roles["outline"] !== undefined;
      default:
        return true;
    }
  };
  const fitting = reading.kinds.filter(fits);
  // "timeline of dates": a kind whose date is mentioned first.
  return [...fitting].sort((a, b) => Number(b.fields.some((field) => says(text, field.words))) - Number(a.fields.some((field) => says(text, field.words))));
}

/**
 * A DRAFT FROM AN ASK, BY TEMPLATE ALONE: no model, no key. The ask's
 * words pick the lens and the kind; the declaration's roles and field types
 * fill the bindings. Undefined when the ask names no way of seeing a
 * template knows (a model may still read it); a failure when it does and
 * the app cannot draw it ("no date field on deliverables").
 */
export function templateDraft<S extends AnySchema>(ask: string, options: DraftOptions<S>): DraftResult | undefined {
  const reading = readApp(seenSchema(options.app.schema as AnySchema, options.sight));
  const text = normal(ask);
  const intents = intentsOf(text);
  if (intents.length === 0) return undefined;
  const named = kindsNamed(text, reading);
  let why: string | undefined;
  for (const intent of intents) {
    const kinds = intent === "coverage" ? [named[0] ?? reading.kinds[0]].filter((one): one is KindInfo => !!one) : kindsFor(intent, reading, named, text);
    for (const info of kinds) {
      try {
        const recipe = recipeFor(intent, info, reading, text, named);
        const drafted = fromRecipe(recipe, reading, options, [ask]);
        if (!isDraftFailure(drafted)) return drafted;
        why ??= drafted.failed;
      } catch (error) {
        if (!(error instanceof Cannot)) throw error;
        why ??= `Couldn't draw that: ${error.message}.`;
      }
    }
    if (kinds.length === 0 && named.length === 0) why ??= `Couldn't draw that: nothing here has what ${LENS_WORDS[intent].toLowerCase()} needs.`;
  }
  return { failed: why ?? "Couldn't draw that: Nothing by that name here.", ...(options.lastGood ? { lastGood: options.lastGood } : {}) };
}

/**
 * A DRAFT FROM AN ASK. A template first — it is instant and needs no key;
 * then, for an ask no template reads, the app's model, whose answer is
 * judged exactly as a declared lens is before it is drawn. A draft that
 * cannot be drawn says why in one line and keeps the last good one.
 */
export async function draftView<S extends AnySchema>(ask: string, options: DraftOptions<S>): Promise<DraftResult> {
  const keep = options.lastGood ? { lastGood: options.lastGood } : {};
  if (ask.trim().length === 0) return { failed: "Say what you would like to see, like “a board of tasks by status”.", ...keep };
  const templated = templateDraft(ask, options);
  if (templated && !isDraftFailure(templated)) return templated;
  if (!options.complete) return templated ?? { failed: "Couldn't draw that without a model: ask for a board, a calendar, a timeline, a list or who covers what.", ...keep };
  const modeled = await modelDraft(ask, options, undefined);
  // The template's reason is the better sentence when the model could not do better.
  if (isDraftFailure(modeled) && templated) return templated;
  return modeled;
}

// ── refining ────────────────────────────────────────────────────────────────

/**
 * ASKING AGAIN: the draft on screen, with one thing changed — "group by
 * owner", "only this month", "as a calendar", "call it The pipeline". Each
 * turn replaces the draft; a turn that cannot be drawn says why and hands
 * the draft back as the last good one.
 */
export async function refineDraft<S extends AnySchema>(draft: SeatDraft, ask: string, options: DraftOptions<S>): Promise<DraftResult> {
  const keep = { lastGood: draft };
  const opts: DraftOptions<S> = { ...options, lastGood: draft };
  const reading = readApp(seenSchema(options.app.schema as AnySchema, options.sight));
  const text = normal(ask);
  const info = reading.info(draft.kind);
  const asks = [...draft.asks, ask];
  if (!info) return { failed: "Couldn't change that: Nothing by that name here.", ...keep };
  const recipe = draft.recipe;
  const retitled = /^ (?:call|name|title) (?:it|this)? ?(.+?) $/.exec(text) ?? / (?:call|name) it (.+?) $/.exec(text);
  try {
    if (retitled) {
      const said = ask.replace(/^.*?\b(?:call|name|title)\b\s*(?:it|this)?\s*/i, "").replace(/^["“']|["”']$/g, "").trim();
      if (said.length === 0) return { failed: "Couldn't change that: say what to call it.", ...keep };
      const lens = { ...draft.lens, title: freeTitle(said, options.app) };
      const judged = judgeLens(options.app, lens, options.sight);
      if (!judged.ok) return { failed: judged.failed, ...keep };
      return { ...draft, title: lens.title, lens, drawn: judged.drawn, edit: lensEditOf(lens), asks, ...(recipe ? { recipe: { ...recipe, title: lens.title } } : {}) };
    }
    // "as a calendar", "show it as a list": the same kind, another lens.
    const as = / as (?:a |an )?(board|kanban|calendar|timeline|list|table|cards|rows|grid|plan|layout)\b/.exec(text);
    if (as) {
      const wanted: Intent = as[1] === "board" || as[1] === "kanban" ? "columns" : as[1] === "calendar" ? "calendar" : as[1] === "timeline" ? "timeline" : as[1] === "grid" ? "coverage" : as[1] === "plan" ? "plan" : as[1] === "layout" ? "board" : "blocks";
      const next = recipeFor(wanted, info, reading, text, [info]);
      const blocksAs = as[1] === "cards" ? "card" : as[1] === "rows" ? "row" : undefined;
      const carried: DraftRecipe = wanted === "blocks" && recipe?.lens === "blocks" ? { ...recipe, ...(blocksAs ? { as: blocksAs } : {}) } : wanted === "blocks" && recipe?.lens === "columns" ? { ...next, group: recipe.column, ...(blocksAs ? { as: blocksAs } : {}) } : next;
      return fromRecipe(withoutTitle(carried), reading, opts, asks);
    }
    if (recipe) {
      const changed = refineRecipe(recipe, info, reading, text);
      if (changed) return fromRecipe(changed, reading, opts, asks);
    }
  } catch (error) {
    if (!(error instanceof Cannot)) throw error;
    return { failed: `Couldn't change that: ${error.message}.`, ...keep };
  }
  if (!options.complete) return { failed: "Couldn't change that without a model: try “group by status”, “only this month” or “as a calendar”.", ...keep };
  const modeled = await modelDraft(ask, opts, draft);
  return isDraftFailure(modeled) ? modeled : { ...modeled, asks };
}

const withoutTitle = (recipe: DraftRecipe): DraftRecipe => {
  const { title: _title, ...rest } = recipe;
  void _title;
  return rest;
};

/** One change to a recipe, read from the ask; undefined when the ask says none a template knows. */
function refineRecipe(recipe: DraftRecipe, info: KindInfo, reading: Reading, text: string): DraftRecipe | undefined {
  const by = / (?:group(?:ed)?|split|organi[sz]ed?|put them|columns) by ([\p{L}\p{N} -]+?)(?= (?:and|only|with)|\s*$)/u.exec(text)?.[1] ?? (/^ by /.test(text) ? byWhat(text) : undefined);
  if (by) {
    const field = fieldNamed(info, by);
    if (field?.type === "enum") return recipe.lens === "blocks" ? { ...withoutTitle(recipe), group: field.name } : { lens: "columns", kind: recipe.kind, column: field.name };
    const edge = edgeNamed(info, by, reading);
    if (edge) return { lens: "coverage", kind: recipe.kind, across: edge.to[0]!, link: edge.name };
    return cannot(field ? `${info.plural}' ${field.words} is not a choice, so they cannot be grouped by it` : `${info.plural} have nothing called ${by} to group by`);
  }
  const sort = / (?:sort(?:ed)?|order(?:ed)?) by ([\p{L}\p{N} -]+?)(?= (?:and|only|with)|\s*$)/u.exec(text)?.[1];
  if (sort) {
    const field = fieldNamed(info, sort);
    if (!field) return cannot(`${info.plural} have nothing called ${sort} to sort by`);
    const base: DraftRecipe = recipe.lens === "blocks" ? withoutTitle(recipe) : { lens: "blocks", kind: recipe.kind, as: "row", ...(recipe.lens === "columns" ? { group: recipe.column } : {}) };
    return { ...base, sort: { by: field.name, ...(/\b(newest|latest|desc|descending|most)\b/.test(text) ? { direction: "desc" as const } : {}) } };
  }
  if (/\b(?:all of them|everything|show all|clear the filter|no filter|without the filter)\b/.test(text)) {
    if (recipe.lens !== "blocks" || !recipe.where) return cannot("it already shows all of them");
    const { where: _where, ...rest } = withoutTitle(recipe);
    void _where;
    return rest;
  }
  const window = windowOf(text);
  if (window && recipe.lens === "calendar" && window.range) return { ...withoutTitle(recipe), range: window.range };
  if (window && recipe.lens === "calendar" && !window.range) {
    // "overdue" on a calendar: a list of what is past, in date order.
    return { lens: "blocks", kind: recipe.kind, as: "row", sort: { by: recipe.start! }, where: filtersFrom(info, text) };
  }
  const where = filtersFrom(info, text);
  if (where.length > 0) {
    const base: DraftRecipe = recipe.lens === "blocks" ? withoutTitle(recipe) : { lens: "blocks", kind: recipe.kind, as: "row", ...(recipe.lens === "columns" ? { group: recipe.column } : {}) };
    return { ...base, where: [...(base.where ?? []), ...where] };
  }
  const range = recipe.lens === "calendar" ? rangeOf(text) : undefined;
  if (range) return { ...withoutTitle(recipe), range };
  return undefined;
}

// ── a model's draft, judged ─────────────────────────────────────────────────

/** What a model is told the app is: the kinds the seat may see, their fields and relations. */
function appInWords(reading: Reading): string {
  return reading.kinds
    .map((info) => {
      const fields = info.fields.map((field) => `${field.name} (${field.type ?? "value"}${field.options ? `: ${field.options.join(" | ")}` : ""})`).join(", ");
      const edges = info.edges.map((edge) => `${edge.name} → ${edge.to.join(" | ")}`).join(", ");
      const roles = Object.entries(info.roles).map(([role, field]) => `${role}=${field}`).join(", ");
      return `- ${info.kind} ("${info.plural}"): ${fields}${edges ? `; relations: ${edges}` : ""}${roles ? `; roles: ${roles}` : ""}`;
    })
    .join("\n");
}

const LENS_GUIDE = [
  'columns — a board, records in columns by one choice field: {"lens": "columns", "on": K, "bindings": {K: {"column": "<enum field>"}}}',
  'calendar — records on a calendar by a date: {"lens": "calendar", "on": K, "bindings": {K: {"start": "<date field>", "end"?: "<date field>", "done"?: "<boolean field>"}}, "options": {"range"?: "day" | "week" | "month" | "quarter" | "year" | "agenda"}}',
  'timeline — minutes of a day in columns: {"lens": "timeline", "on": K, "bindings": {K: {"start": "<number field>", "end": "<number field>", "column": "<enum field>"}}}',
  'coverage — who covers what, a grid of two kinds joined by a relation: {"lens": "coverage", "on": K, "bindings": {"rows": {"kind": K}, "columns": {"kind": J}, "link": {"edge": "<relation of K to J>"}}}',
  'blocks — anything else, as blocks: {"lens": "blocks", "on": K, "options": {"blocks": [{"headline": "words"}, {"list": "all(\'K\') where <condition>", "group"?: "<enum field>", "sort"?: "<field>" | {"by": "<field>", "direction": "desc"}, "as"?: "row" | "card", "empty"?: "words"}, {"figure": "count(all(\'K\'))", "label": "words"}]}}. Conditions read a record\'s own fields: status == \'open\', not done, days(today(), due) <= 7.',
].join("\n");

function promptFor(ask: string, reading: Reading, current: SeatDraft | undefined): string {
  return [
    "You draw a view of an app's data as JSON — never code. The app's kinds, their fields (with types) and relations:",
    appInWords(reading),
    "",
    "The lenses you may use (prefer the first four; use blocks only when none of them fits):",
    LENS_GUIDE,
    "",
    current ? `The view on screen now:\n${JSON.stringify(current.lens)}\nChange it as asked, and keep everything not asked about.` : "",
    `Asked: ${JSON.stringify(ask)}`,
    'Answer with ONE JSON object: {"title": "<a few words, like Deliverables by status>", "lens": …, "on": …, "bindings"?: …, "options"?: …}. Name only the kinds, fields and relations listed above. If it cannot be drawn from them, answer {"failed": "<one sentence saying why>"}.',
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function modelDraft<S extends AnySchema>(ask: string, options: DraftOptions<S>, current: SeatDraft | undefined): Promise<DraftResult> {
  const keep = options.lastGood ? { lastGood: options.lastGood } : {};
  const reading = readApp(seenSchema(options.app.schema as AnySchema, options.sight));
  let answer: string;
  try {
    answer = await options.complete!(promptFor(ask, reading, current));
  } catch {
    return { failed: "Couldn't draw that: the model did not answer.", ...keep };
  }
  const parsed = firstJsonObject(answer);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { failed: "Couldn't draw that: the model's answer was not a view.", ...keep };
  const said = parsed as Record<string, unknown>;
  if (typeof said["failed"] === "string") return { failed: `Couldn't draw that: ${said["failed"].replace(/^Couldn't draw that:\s*/i, "").replace(/\.$/, "")}.`, ...keep };
  const written = lensFromSpec(said);
  if (!isShippedLens(written.name)) return { failed: `Couldn't draw that: "${written.name}" is not a picture the seat can draw.`, ...keep };
  const title = written.title ? written.title.slice(0, 80) : (current?.title ?? capital(ask.trim()).slice(0, 80));
  const lens: DraftLens = { ...written, title: current && current.title === title ? title : freeTitle(title, options.app) };
  const judged = judgeLens(options.app, lens, options.sight);
  if (!judged.ok) return { failed: judged.failed, ...keep };
  const drafted = draftFromLens(options.app, lens, judged.drawn, options.sight, "model");
  return { ...drafted, asks: [ask] };
}

/**
 * THE LENSES A READER KEPT FOR THEMSELVES, beside the app's own: a
 * declaration's lenses with each kept lens that still draws appended, so a
 * code-declared app shows "Your lenses" in its place list without its
 * declaration changing. A kept lens that no longer draws is passed over.
 */
export function withReaderLenses<S extends AnySchema>(app: GraviewApp<S>, kept: readonly AddLensEdit[], sight?: DraftSight): GraviewApp<S> {
  let lenses = [...(app.lenses ?? [])];
  for (const edit of kept) {
    const lens: DraftLens = { name: edit.lens, title: edit.title, on: edit.on, ...(edit.bindings ? { bindings: edit.bindings } : {}), ...(edit.options ? { options: edit.options } : {}) };
    if (lenses.some((one) => one.title === lens.title)) continue;
    const judged = judgeLens({ ...app, lenses } as GraviewApp<S>, lens, sight);
    if (judged.ok) lenses = [...lenses, lens as unknown as LensDeclaration];
  }
  return lenses.length === (app.lenses ?? []).length ? app : ({ ...app, lenses } as GraviewApp<S>);
}

/**
 * THE TWO TOOLS a connector's chat draws and keeps views with, as the tool
 * runtime calls them: `draft_view` (an ask, a lens to check, or the lens on
 * screen to change) and `keep_lens` (the lens, checked again, handed to the
 * host's write). Here rather than in the runtime, so a seat that never asks
 * carries none of it.
 */
export async function runDraftTool<S extends AnySchema>(
  name: string,
  args: Readonly<Record<string, unknown>>,
  context: { readonly app: GraviewApp<S>; readonly principal: Principal; readonly drafts?: DraftTools },
): Promise<{ readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly error: string; readonly reason?: "invalid" }> {
  const { app, drafts } = context;
  const sight = draftSight(app, context.principal);
  const judged = (value: unknown) => {
    const lens = lensFromSpec(value);
    return { lens, verdict: judgeLens(app, lens, sight) };
  };
  if (name === "keep_lens") {
    const { lens, verdict } = judged(args);
    if (!verdict.ok) return { ok: false, error: verdict.failed, reason: "invalid" };
    if (!drafts?.keep) return { ok: false, error: "This app's declaration cannot be written from here." };
    const edit = lensEditOf(lens);
    const kept = await drafts.keep(edit);
    if (!kept.ok) return { ok: false, error: kept.error };
    return { ok: true, data: { kept: edit, said: kept.said ?? `Adds “${edit.title}” to the places.`, undo: takeBackEditOf(edit) } };
  }
  if (args["lens"] !== undefined) {
    const { lens, verdict } = judged(args["lens"]);
    if (!verdict.ok) return { ok: false, error: verdict.failed, reason: "invalid" };
    return { ok: true, data: draftAnswer(draftFromLens(app, lens, verdict.drawn, sight, "model")) };
  }
  const options = { app, sight, ...(drafts?.complete ? { complete: drafts.complete } : {}) };
  const ask = String(args["ask"] ?? "");
  let result: DraftResult;
  if (args["current"] !== undefined) {
    const { lens, verdict } = judged(args["current"]);
    if (!verdict.ok) return { ok: false, error: verdict.failed, reason: "invalid" };
    result = await refineDraft(draftFromLens(app, lens, verdict.drawn, sight, "model"), ask, options);
  } else result = await draftView(ask, options);
  if (isDraftFailure(result)) return { ok: false, error: result.failed, reason: "invalid" };
  return { ok: true, data: draftAnswer(result) };
}
