import { fieldWords, labelOf, nounOf, type AnySchema, type DisplayChoice, type DisplayChoiceHeard, type DisplayOptionOffer, type DisplayOptionsAsked, type DisplayOptionsHost, type DrawnLens, type GraviewApp } from "@graview/core";
import { districtState } from "@graview/core/city";
import { lowerFirst } from "@graview/core/words";
import { fieldSpecOf } from "@graview/core/blocks";
import { arrange, arrangeable, parseArrangement, type ArrangeContext } from "@graview/core/arrange";
import { draftView, isDraftFailure, judgeLens, lensFromSpec, recipeDraft, type DraftLens, type DraftRecipe, type DraftSight } from "@graview/tools/draft";
import type { Completion } from "@graview/tools";
import type { ComposeChangeHost, ProposeChangeAnswer, ReshapeProposal } from "@graview/tools/reshape";
import { BOARD_AT_MOST, fieldTypeOf, mainDate } from "./kind-shape.js";
import { lensNarrows } from "./page-parts.js";

/*
 * OTHER WAYS TO SHOW THIS (Roadmap f-display-options-switch), worked out:
 * no React, so a test, the switch and a harness agree on it
 * (`display-options-switch.tsx` draws it). Fetched when the switch is
 * first asked for: a page that never opens it carries none of this.
 *
 * WHAT IS OFFERED IS WHAT THE FIELDS CAN DRAW. A board where a choice has
 * values, a calendar where a date has them in the month around today (a
 * list in their order where they all fall elsewhere: never an empty month),
 * a timeline and a grid where roles and links say so, cards always; the
 * places the kind already has; what a host hands in. Each is a lens the seat
 * could have drawn (`recipeDraft`, `judgeLens`), so it needs no model, and
 * each edit passed the host's composer before anybody sees it.
 *
 * KEEPING ONE IS ONE CHANGE. On a kind's list: the lens, kept off the bar
 * and the page list, and the list opening as it (`pages.lists.<kind>.opens`)
 * — a place it already has needs only the last. On a place: the lens drawn
 * in the place's own title and address. The host takes the edits as one
 * proposal, and its undo takes all of them back.
 */

/** A way to show the data, worked out and judged. */
export interface DisplayOption {
  /** Which one: the same on every offer of it. */
  readonly key: string;
  /** What the switch calls it: "Board by status". */
  readonly label: string;
  /** How a sentence says it: "a board by status". */
  readonly phrase: string;
  /** What sort of picture it is: what a choice ranks the next offer by. */
  readonly shape: string;
  readonly from: DisplayChoice["from"];
  readonly hostId?: string;
  /** Added to what was chosen before, when the offer is ranked. */
  readonly weight?: number;
  /** Its title, as what it draws is called. */
  readonly title: string;
  /** What it draws, whoever offered it: no two options, nor the page as it stands, draw the same. */
  readonly drawing: string;
  readonly drawn: DrawnLens;
  /** The change keeping it makes, as one. */
  readonly edits: readonly unknown[];
}

type Node = { readonly id: string; readonly kind: string } & Readonly<Record<string, unknown>>;

export interface OptionsInput {
  readonly app: Pick<GraviewApp<AnySchema>, "schema"> & Partial<GraviewApp<AnySchema>>;
  /** The document the app was made from: what its host's composer checks a change against. */
  readonly document: object | undefined;
  readonly compose: ComposeChangeHost | undefined;
  readonly kind: string;
  /** The place's title, on a place. */
  readonly place?: string;
  /** What the page is called. */
  readonly name: string;
  /** The records as this seat sees them. */
  readonly nodes: readonly Node[];
  readonly today: string;
  readonly sight?: DraftSight;
  /** How many of this kind's records link to a kind across a relation: what a grid is drawn from. */
  readonly linked?: (id: string, edge: string) => boolean;
  readonly offers?: readonly DisplayOptionOffer[];
  readonly choices?: readonly DisplayChoice[];
  /** What the page's address narrows it to (`?filter=`): on a kind's list, an option that flows is not offered, since kept it would not be drawn there. */
  readonly filter?: string;
}

/** Whether an option flows with the page — blocks: a kind's list that opens as one draws the list instead at an address that narrows it. */
export const optionFlows = (drawn: Pick<DrawnLens, "lens">): boolean => drawn.lens === "blocks";

/**
 * AT AN ADDRESS THAT NARROWS THE LIST (Roadmap f-other-ways-at-a-filter): a
 * kind's list that opens as a place draws the place there only where the
 * place narrows itself, which a picture does and a place that flows does
 * not — it is the list again. So on a list at `?filter=`, an option that
 * flows is withheld: keeping it would show the list, not what was chosen.
 */
const withheldAtTheAddress = (input: OptionsInput, drawn: Pick<DrawnLens, "lens">): boolean => input.place === undefined && input.filter !== undefined && input.filter !== "" && optionFlows(drawn);

/**
 * THE RECORDS AN OPTION IS DRAWN OVER: what the page itself shows of them —
 * every one, or those its address narrows it to (`?filter=`), judged by
 * the same arranging a place on a page is, so that the preview and the
 * page once it is kept agree. A word the kind cannot be narrowed by
 * narrows nothing, as on the page.
 */
export function recordsShown<N extends { readonly id: string; readonly kind: string }>(schema: AnySchema, graph: ArrangeContext["graph"], kind: string, nodes: readonly N[], filter: string | undefined, flagged: ReadonlySet<string> = new Set()): readonly N[] {
  const asked = filter ? (parseArrangement({ filter }).filter ?? []) : [];
  const offered = asked.length > 0 ? arrangeable(schema, kind).filters : [];
  const conditions = asked.filter((condition) => offered.some((one) => one.key === condition.key));
  if (conditions.length === 0) return nodes;
  return arrange(nodes as never, { filter: conditions }, { schema, graph, flagged }).nodes as unknown as readonly N[];
}

/** The most an offer shows at once. */
export const MOST_OPTIONS = 4;
const ISO = /^\d{4}-\d{2}-\d{2}/;
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

const shapeOfField = (schema: AnySchema, kind: string): Readonly<Record<string, unknown>> => ((schema.tryDefinition(kind)?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {});

/** A kind's own choices that take one value, its main one first. */
function choicesOf(schema: AnySchema, kind: string): readonly string[] {
  const shape = shapeOfField(schema, kind);
  const choices = Object.keys(shape).filter((field) => {
    const spec = fieldSpecOf(shape[field]) as { type?: string; multiple?: boolean } | undefined;
    return spec?.type === "enum" && !spec.multiple;
  });
  const main = districtState(schema, kind)?.field;
  return main && choices.includes(main) ? [main, ...choices.filter((one) => one !== main)] : choices;
}

/** The date a calendar stands on: the kind's main one, else any date a record fills. */
function dateOf(schema: AnySchema, kind: string, nodes: readonly Node[]): { readonly start: string; readonly end?: string; readonly done?: string } | undefined {
  const filled = (field: string) => nodes.some((node) => typeof node[field] === "string" && ISO.test(node[field] as string));
  const main = mainDate(schema, kind);
  if (main && filled(main.field)) return { start: main.field, ...(main.end ? { end: main.end } : {}), ...(main.done ? { done: main.done } : {}) };
  const field = Object.keys(shapeOfField(schema, kind)).find((one) => ["date", "datetime"].includes(fieldTypeOf(schema, kind, one) ?? "") && filled(one));
  return field ? { start: field } : undefined;
}

/** A way to show the kind, as a recipe the seat could have made, and what it is called. */
interface Candidate {
  readonly recipe: DraftRecipe;
  readonly label: string;
  readonly phrase: string;
  readonly shape: string;
}

/** WHAT THE FIELDS CAN DRAW, best first: each only where the records fill what it stands on. */
function candidatesOf(input: OptionsInput): readonly Candidate[] {
  const { app, kind, nodes, today } = input;
  const schema = app.schema as AnySchema;
  const definition = schema.tryDefinition(kind);
  const said = (field: string) => fieldWords(definition, field).toLowerCase();
  const filled = (field: string) => nodes.some((node) => node[field] !== undefined && node[field] !== null && node[field] !== "");
  const choices = choicesOf(schema, kind).filter(filled);
  const out: Candidate[] = [];
  const main = choices[0];
  if (main && nodes.length <= BOARD_AT_MOST) out.push({ recipe: { lens: "columns", kind, column: main }, label: `Board by ${said(main)}`, phrase: `a board by ${said(main)}`, shape: "board" });
  const date = dateOf(schema, kind, nodes);
  if (date) {
    const month = today.slice(0, 7);
    const here = nodes.some((node) => typeof node[date.start] === "string" && (node[date.start] as string).startsWith(month));
    const calendar: DraftRecipe = { lens: "calendar", kind, start: date.start, ...(date.end ? { end: date.end } : {}), ...(date.done ? { done: date.done } : {}), range: "month" };
    out.push(here ? { recipe: calendar, label: `Calendar by ${said(date.start)}`, phrase: `a calendar by ${said(date.start)}`, shape: "calendar" } : { recipe: { lens: "blocks", kind, as: "row", sort: { by: date.start } }, label: `In order of ${said(date.start)}`, phrase: `a list in order of ${said(date.start)}`, shape: "order" });
  }
  const roles = (definition?.fieldRoles ?? {}) as Readonly<Record<string, string>>;
  const [start, end, column] = [roles["start"], roles["end"], roles["column"] ?? roles["day"]];
  if (start && end && column && fieldTypeOf(schema, kind, start) === "number" && fieldTypeOf(schema, kind, end) === "number" && fieldTypeOf(schema, kind, column) === "enum" && filled(start) && filled(column)) {
    out.push({ recipe: { lens: "timeline", kind, start, end, column }, label: `Timeline by ${said(column)}`, phrase: `a timeline by ${said(column)}`, shape: "timeline" });
  }
  for (const [edge, spec] of Object.entries((definition?.edges ?? {}) as Readonly<Record<string, { readonly to?: readonly string[] | "*" }>>)) {
    const across = Array.isArray(spec?.to) ? spec.to.find((other) => other !== kind && schema.tryDefinition(other)) : undefined;
    if (!across || !input.linked || !nodes.some((node) => input.linked!(node.id, edge))) continue;
    const noun = nounOf(schema.tryDefinition(across), across);
    out.push({ recipe: { lens: "coverage", kind, across, link: edge }, label: `Grid by ${noun}`, phrase: `a grid by ${noun}`, shape: "grid" });
    break;
  }
  out.push({ recipe: { lens: "blocks", kind, as: "card" }, label: "Cards", phrase: "cards", shape: "cards" });
  if (main) out.push({ recipe: { lens: "blocks", kind, as: "row", group: main }, label: `Rows by ${said(main)}`, phrase: `rows by ${said(main)}`, shape: "rows" });
  else if (input.place !== undefined) out.push({ recipe: { lens: "blocks", kind, as: "row" }, label: "Rows", phrase: "rows", shape: "rows" });
  return out;
}

/** What a lens draws, whatever it is called. */
const drawingOf = (lens: { readonly name?: unknown; readonly lens?: unknown; readonly bindings?: unknown; readonly options?: unknown }) => JSON.stringify([lens.name ?? lens.lens, lens.bindings ?? {}, (lens.options as { blocks?: unknown } | undefined)?.blocks ?? (lens.options as { range?: unknown } | undefined)?.range ?? null]);

/** What sort of picture a lens is, for one a host handed in or the app already has. */
function shapeOfLens(lens: { readonly name: string; readonly options?: Readonly<Record<string, unknown>> }): string {
  if (lens.name === "columns") return "board";
  if (lens.name === "coverage") return "grid";
  if (lens.name === "blocks") return (lens.options?.["blocks"] as readonly { as?: string }[] | undefined)?.some((one) => one.as === "card") ? "cards" : "rows";
  return lens.name;
}

/** The app's lenses, as the declaration says them. */
const lensesOf = (app: OptionsInput["app"]) => (app.lenses ?? []) as readonly (DraftLens & { readonly hidden?: boolean; readonly create?: boolean })[];
const overKind = (lens: DraftLens, kind: string) => lens.on === kind || (lens.on === undefined && Object.prototype.hasOwnProperty.call(lens.bindings ?? {}, kind));

/** The title a kind's list opens as now, where it opens as one. */
const opensNow = (input: OptionsInput): string | undefined => (input.app.pages?.lists as Readonly<Record<string, { readonly opens?: string }>> | undefined)?.[input.kind]?.opens;

/** The change keeping a new lens makes: in the place's own name on a place; beside the rest, off the lists, and what the list opens as on a kind's list. */
function editsOfLens(input: OptionsInput, lens: DraftLens): readonly unknown[] {
  const spec = { lens: lens.name, on: input.kind, ...(lens.bindings ? { bindings: lens.bindings } : {}), ...(lens.options ? { options: lens.options } : {}) };
  if (input.place !== undefined) {
    const was = lensesOf(input.app).find((one) => one.title === input.place);
    return [{ op: "add-lens", title: input.place, ...spec, replace: input.place, ...(was?.create === false ? { create: false } : {}) }];
  }
  return [{ op: "add-lens", title: lens.title, ...spec }, { op: "set-lens-hidden", title: lens.title, on: input.kind, hidden: true }, opensAs(input, lens.title)];
}

const opensAs = (input: OptionsInput, title: string) => ({ op: "arrange-pages", opens: { [input.kind]: title } });

/**
 * A LENS KEPT OFF THE LISTS THAT DRAWS THE SAME: used again rather than made
 * twice. Keeping never removes a lens, since nothing says who wrote one kept
 * off the lists and an author's may be what the app opens on; so a former
 * keeping's stays, and what a kind can hold of them is what the kind can be
 * drawn as. Only one that draws all the preview does, in the same way.
 */
const hiddenDrawing = (input: OptionsInput, lens: DraftLens) => {
  if (input.place !== undefined) return undefined;
  const drawing = drawingOf(lens);
  const options = JSON.stringify(lens.options ?? {});
  // The whole of its options, not what `drawingOf` reads: an author's board with a `cap` draws less than a preview of the board without one. A lens a host's option made, narrowed or not, is itself again.
  return lensesOf(input.app).find((one) => one.hidden === true && overKind(one, input.kind) && drawingOf(one) === drawing && JSON.stringify(one.options ?? {}) === options);
};

/** Passed the host's composer: a change it would refuse is not offered. */
function passes(input: OptionsInput, edits: readonly unknown[]): boolean {
  if (!input.compose || !input.document) return false;
  try {
    return input.compose({ document: input.document as never, edits }).ok;
  } catch {
    return false;
  }
}

/** A title no lens holds, where it was handed in. */
function freeLensTitle(app: OptionsInput["app"], title: string): string {
  const taken = new Set(lensesOf(app).map((one) => one.title));
  if (!taken.has(title)) return title;
  for (let n = 2; ; n++) if (!taken.has(`${title} ${n}`)) return `${title} ${n}`;
}

/** A place drawn by a lens that says more than the records: another way would lose that, and show what keeping it would not be asked to. */
const placeSaysMore = (input: OptionsInput): boolean => {
  const now = input.place === undefined ? undefined : lensesOf(input.app).find((one) => one.title === input.place);
  return now !== undefined && lensNarrows(now, input.kind);
};

/** What is shown now, as a lens draws: never offered as another way. */
function drawingNow(input: OptionsInput): string | undefined {
  const title = input.place ?? opensNow(input);
  const now = title === undefined ? undefined : lensesOf(input.app).find((one) => one.title === title);
  // A list opening as a narrowed lens is not shown whole: drawing it whole is still another way.
  return now && !lensNarrows(now, input.kind) ? drawingOf(now) : undefined;
}

/** A lens somebody wrote, judged and checked: a host's, or a model's. */
function judged(input: OptionsInput, spec: unknown, about: Pick<DisplayOption, "from" | "label" | "phrase"> & { readonly hostId?: string; readonly weight?: number; readonly key: string }): DisplayOption | undefined {
  if (placeSaysMore(input)) return undefined;
  const written = lensFromSpec(spec);
  const drawing = drawingOf(written);
  if (drawing === drawingNow(input)) return undefined;
  const lens: DraftLens = { ...written, on: input.kind, title: freeLensTitle(input.app, written.title) };
  const verdict = judgeLens(input.app as GraviewApp<AnySchema>, lens, input.sight);
  if (!verdict.ok || withheldAtTheAddress(input, verdict.drawn)) return undefined;
  const again = hiddenDrawing(input, lens);
  if (again && again.title === opensNow(input)) return undefined;
  const edits = again ? [opensAs(input, again.title)] : editsOfLens(input, lens);
  if (!passes(input, edits)) return undefined;
  return { ...about, shape: shapeOfLens(lens), title: again?.title ?? lens.title, drawing, drawn: verdict.drawn, edits };
}

/** THE WAYS TO SHOW THIS PAGE, judged and ranked, the page as it stands not among them, and at most `MOST_OPTIONS`: at least one of a host's where it handed any in. */
export function displayOptionsFor(input: OptionsInput): readonly DisplayOption[] {
  if (input.nodes.length === 0 || placeSaysMore(input)) return [];
  const now = drawingNow(input);
  const seen = new Set<string>(now ? [now] : []);
  const all: DisplayOption[] = [];
  // The places the kind already has: a kind's list may open as one, with nothing new made.
  if (input.place === undefined) {
    for (const lens of lensesOf(input.app)) {
      if (lens.title === undefined || lens.hidden === true || !overKind(lens, input.kind) || lens.title === opensNow(input) || lensNarrows(lens, input.kind)) continue;
      const verdict = judgeLens({ ...input.app, lenses: lensesOf(input.app).filter((one) => one !== lens) } as never, { ...lens, on: input.kind }, input.sight);
      if (!verdict.ok || withheldAtTheAddress(input, verdict.drawn)) continue;
      const edits = [opensAs(input, lens.title)];
      if (!passes(input, edits)) continue;
      const drawing = drawingOf(lens);
      seen.add(drawing);
      all.push({ key: `place:${lens.title}`, label: lens.title, phrase: `“${lens.title}”`, shape: shapeOfLens(lens), from: "place", title: lens.title, drawing, drawn: verdict.drawn, edits });
    }
  }
  for (const candidate of candidatesOf(input)) {
    const draft = recipeDraft(candidate.recipe, { app: input.app as GraviewApp<AnySchema>, ...(input.sight ? { sight: input.sight } : {}) });
    if (isDraftFailure(draft) || withheldAtTheAddress(input, draft.drawn)) continue;
    const drawing = drawingOf(draft.lens);
    if (seen.has(drawing)) continue;
    const again = hiddenDrawing(input, draft.lens);
    const edits = again ? [opensAs(input, again.title)] : editsOfLens(input, draft.lens);
    if (!passes(input, edits)) continue;
    seen.add(drawing);
    all.push({ key: `${candidate.shape}:${drawing}`, label: candidate.label, phrase: candidate.phrase, shape: candidate.shape, from: "graview", title: again?.title ?? draft.lens.title, drawing, drawn: draft.drawn, edits });
  }
  for (const offer of input.offers ?? []) {
    const option = optionOfOffer(input, offer);
    if (!option || seen.has(option.drawing)) continue;
    seen.add(option.drawing);
    all.push(option);
  }
  return chosenFirst(all, input.choices ?? [], input.kind);
}

/** Whether what a host said is an offer at all: it says who it is and what it is called. */
const isOffer = (offer: unknown): offer is DisplayOptionOffer => {
  const said = offer as { readonly id?: unknown; readonly label?: unknown; readonly lens?: unknown } | null;
  return typeof said?.id === "string" && said.id !== "" && typeof said.label === "string" && said.label !== "" && typeof said.lens === "object" && said.lens !== null;
};

/** One option a host handed in, judged and checked, or nothing: what a host says never takes the page down. */
export function optionOfOffer(input: OptionsInput, offer: unknown): DisplayOption | undefined {
  if (!isOffer(offer)) return undefined;
  try {
    return judged(input, offer.lens, { key: `host:${offer.id}`, label: offer.label, phrase: lowerFirst(offer.label), from: "host", hostId: offer.id, ...(typeof offer.weight === "number" ? { weight: offer.weight } : {}) });
  } catch {
    return undefined;
  }
}

/** What a host hands in, now or later; what throws or is no list is nothing said. */
export function offersFrom(host: DisplayOptionsHost | undefined, asked: DisplayOptionsAsked): { readonly now: readonly unknown[]; readonly late?: Promise<readonly unknown[]> } {
  try {
    const said: unknown = host?.offers?.(asked);
    if (Array.isArray(said)) return { now: said };
    if (typeof (said as { then?: unknown } | null | undefined)?.then === "function") return { now: [], late: Promise.resolve(said).then((late) => (Array.isArray(late) ? late : []), () => []) };
  } catch {
    // Nothing said.
  }
  return { now: [] };
}

/** What a host remembers being chosen, the choices that read as choices. */
export function choicesFrom(host: DisplayOptionsHost | undefined): readonly DisplayChoice[] {
  try {
    const said: unknown = host?.chosen?.();
    return Array.isArray(said) ? said.filter(isChoice) : [];
  } catch {
    return [];
  }
}

/**
 * ONE MORE, WHERE A HOST LENT A MODEL: a lens it writes for this kind, judged
 * as any other. The options are there without it; it joins when it answers,
 * and an answer that does not draw is none at all.
 */
export async function modelOption(input: OptionsInput, complete: Completion): Promise<DisplayOption | undefined> {
  try {
    const drafted = await draftView(`Whatever would make ${input.name.toLowerCase()} clearest to read`, { app: input.app as GraviewApp<AnySchema>, complete, ...(input.sight ? { sight: input.sight } : {}) });
    if (isDraftFailure(drafted)) return undefined;
    const lens = drafted.lens;
    return judged(input, { lens: lens.name, title: lens.title, ...(lens.bindings ? { bindings: lens.bindings } : {}), ...(lens.options ? { options: lens.options } : {}) }, { key: `model:${drawingOf(lens)}`, label: capital(lens.title), phrase: `“${lens.title}”`, from: "model" });
  } catch {
    return undefined;
  }
}

/**
 * THE OFFER, RANKED: a kind of picture kept for this kind counts most, kept
 * for another kind counts too, then what a host weighs it at; otherwise the
 * order the fields made them in.
 */
export function rankOptions(options: readonly DisplayOption[], choices: readonly DisplayChoice[], kind: string): readonly DisplayOption[] {
  const score = (option: DisplayOption) => choices.reduce((sum, choice) => sum + (choice.key === option.key || choice.shape === option.shape ? (choice.kind === kind ? 3 : 1) : 0), option.weight ?? 0);
  return options.map((option, at) => ({ option, at, score: score(option) })).sort((a, b) => b.score - a.score || a.at - b.at).map((one) => one.option);
}

/** Ranked and kept to the most an offer shows, a host's among them where it handed one in. */
function chosenFirst(options: readonly DisplayOption[], choices: readonly DisplayChoice[], kind: string): readonly DisplayOption[] {
  const ranked = rankOptions(options, choices, kind);
  const shown = ranked.slice(0, MOST_OPTIONS);
  const theirs = ranked.find((one) => one.from === "host");
  if (theirs && !shown.includes(theirs)) shown[shown.length - 1] = theirs;
  return shown;
}

// ── what was chosen, in this browser ────────────────────────────────────────

const isChoice = (one: unknown): one is DisplayChoice => {
  const said = one as Partial<DisplayChoice> | null;
  return typeof said?.key === "string" && typeof said.shape === "string" && typeof said.kind === "string";
};
const CHOICES = (app: string) => `graview:display-choices:${app}`;
const MOST_REMEMBERED = 40;
/* A private window, a sandboxed frame: remembered for this page only. */
const HELD = /* @__PURE__ */ new Map<string, readonly DisplayChoice[]>();

/** What this browser remembers being chosen in this app. */
export function readChoices(app: string): readonly DisplayChoice[] {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(CHOICES(app)) ?? "null");
    if (Array.isArray(kept)) return kept.filter(isChoice);
  } catch {
    // Read from what this page holds instead.
  }
  return HELD.get(app) ?? [];
}

function writeChoices(app: string, choices: readonly DisplayChoice[]): void {
  HELD.set(app, choices);
  try {
    if (choices.length === 0) localStorage.removeItem(CHOICES(app));
    else localStorage.setItem(CHOICES(app), JSON.stringify(choices));
  } catch {
    // Remembered for this page only.
  }
}

export function keepChoice(app: string, choice: DisplayChoice): void {
  writeChoices(app, [...readChoices(app), choice].slice(-MOST_REMEMBERED));
}

/** A choice taken back: it ranks nothing any more. */
export function forgetChoice(app: string, key: string, at: string): void {
  writeChoices(app, readChoices(app).filter((one) => !(one.key === key && one.at === at)));
}

// ── the switch ──────────────────────────────────────────────────────────────

export interface OptionSwitchState {
  readonly options: readonly DisplayOption[];
  /** The option drawn on the page, by its key; null is the page as it stands. */
  readonly shown: string | null;
  readonly phase: "choosing" | "keeping" | "kept" | "undone";
  /** What became of the last thing asked, in a sentence. */
  readonly said?: string;
  /** What the host said of the change it kept. */
  readonly note?: string;
  readonly canUndo: boolean;
}

export interface OptionSwitch {
  get(): OptionSwitchState;
  subscribe(listener: () => void): () => void;
  /** Shows an option on the page, or (null) the page as it stands: nothing is written. */
  flip(key: string | null): void;
  /** More options, joining the offer; what is shown does not move. */
  join(options: readonly DisplayOption[]): void;
  /** An option that did not draw: never offered after all. */
  drop(key: string): void;
  keep(): Promise<void>;
  undo(): Promise<void>;
}

export interface OptionSwitchOptions {
  readonly options: readonly DisplayOption[];
  readonly name: string;
  /** Applies the change, as one, through the host's door to a change to the app. */
  readonly propose: (proposal: ReshapeProposal) => ProposeChangeAnswer | Promise<ProposeChangeAnswer>;
  readonly kind?: string;
  /** The app's key, under which this browser remembers. */
  readonly appKey?: string;
  readonly onKept?: (heard: DisplayChoiceHeard) => void;
}

/** What a host is handed: the change to the app, said in plain words. */
export function proposalOfOption(option: DisplayOption, name: string): ReshapeProposal {
  const said = `${name} shows as ${option.phrase}.`;
  return { said, add: [], drop: [], card: { said, adds: [], keeps: [], drops: [], breaking: [] }, edits: option.edits };
}

/** The switch's state, apart from what draws it, so what is kept outlives a page drawn again. */
export function createOptionSwitch(given: OptionSwitchOptions): OptionSwitch {
  const heard = new Set<() => void>();
  let state: OptionSwitchState = { options: given.options, shown: null, phase: "choosing", canUndo: false };
  let undoIt: (() => void | Promise<void>) | undefined;
  let kept: DisplayChoice | undefined;
  let offered: readonly string[] = [];
  const set = (next: Partial<OptionSwitchState>) => {
    state = { ...state, ...next };
    heard.forEach((listener) => listener());
  };
  const hear = (undone: boolean) => {
    if (!kept) return;
    try {
      given.onKept?.({ kept, offered, undone });
    } catch {
      // A host that could not hear it changes nothing here.
    }
  };
  return {
    get: () => state,
    subscribe(listener) {
      heard.add(listener);
      return () => void heard.delete(listener);
    },
    flip(key) {
      if (state.phase !== "choosing" || key === state.shown) return;
      if (key !== null && !state.options.some((one) => one.key === key)) return;
      const { said: _said, ...rest } = state;
      state = rest;
      set({ shown: key });
    },
    join(options) {
      if (state.phase !== "choosing") return;
      const fresh = options.filter((one) => !state.options.some((other) => other.key === one.key || other.drawing === one.drawing));
      if (fresh.length === 0) return;
      // They join at the most an offer shows: what Graview worked out gives way, from the last, and never what is shown.
      const joined = [...state.options, ...fresh];
      for (let at = joined.length - 1; at >= 0 && joined.length > MOST_OPTIONS; at--) if (joined[at]!.from !== "host" && joined[at]!.from !== "model" && joined[at]!.key !== state.shown) joined.splice(at, 1);
      set({ options: joined });
    },
    drop(key) {
      if (!state.options.some((one) => one.key === key)) return;
      set({ options: state.options.filter((one) => one.key !== key), shown: state.shown === key ? null : state.shown });
    },
    async keep() {
      const option = state.options.find((one) => one.key === state.shown);
      if (!option || state.phase !== "choosing") return;
      set({ phase: "keeping" });
      let answer: ProposeChangeAnswer;
      try {
        answer = await given.propose(proposalOfOption(option, given.name));
      } catch {
        return set({ phase: "choosing", said: "It couldn't be kept." });
      }
      if (answer === "declined") return set({ phase: "choosing", said: "It wasn't kept." });
      if (typeof answer === "object") undoIt = answer.undo;
      offered = state.options.map((one) => one.key);
      kept = { key: option.key, kind: given.kind ?? "", shape: option.shape, from: option.from, ...(option.hostId ? { hostId: option.hostId } : {}), at: new Date().toISOString() };
      if (given.appKey !== undefined) keepChoice(given.appKey, kept);
      hear(false);
      set({ phase: "kept", said: `${given.name} now shows as ${option.phrase}.`, canUndo: undoIt !== undefined, ...(typeof answer === "object" && answer.note ? { note: answer.note } : {}) });
    },
    async undo() {
      const back = undoIt;
      if (state.phase !== "kept" || !back) return;
      // Taken before it is called: a second press finds nothing to undo.
      undoIt = undefined;
      try {
        await back();
      } catch {
        undoIt = back;
        return set({ said: "It couldn't be put back." });
      }
      if (kept && given.appKey !== undefined) forgetChoice(given.appKey, kept.key, kept.at);
      hear(true);
      const { note: _note, ...rest } = state;
      state = rest;
      set({ phase: "undone", said: `${given.name} is as it was.`, canUndo: false });
    },
  };
}

/** The records' names, for telling whether a drawing shows any of them. */
export function namesOfRecords(schema: AnySchema, kind: string, nodes: readonly Node[]): readonly string[] {
  const definition = schema.tryDefinition(kind);
  return nodes.slice(0, 200).map((node) => labelOf(definition, node as never)).filter((one) => one.length > 1);
}
