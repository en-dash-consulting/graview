import {
  labelOf,
  nounOf,
  placeSlug,
  readableFields,
  search,
  squeeze,
  violationsTouching,
  withArticle,
  type AnySchema,
  type AppPlace,
  type Hit,
  type Place,
  type Principal,
  type Store,
} from "@graview/core";
import { arrangeable, conditionHolds, type ArrangeGraph, type ArrangeOffer, type Condition } from "@graview/core/arrange";
import { readyRepairsOf, type ChatContext, type ChatReply } from "./conversation.js";
import { validateProposals } from "./intelligence.js";

/**
 * THE SEAT TAKES YOU WHERE YOU ASK.
 *
 * A person asks the seat for a place — "go to The week", "open Pay the
 * deposit", "deliverables due this week", "what's wrong", "tell me about
 * Ongoing support" — and the app should be THERE afterwards, not described
 * from a distance. This reads the ask against what the declaration and the
 * graph already name, graph-only and in order:
 *
 *   1. a place by its title (`placesOf`: the home, the scene, a declared
 *      lens, a kind's list);
 *   2. a record by its name (`search` under the seat's sight);
 *   3. a kind with a date or a status ("overdue tasks", "open decisions"),
 *      read against the kind's date field and its choice fields, landing on
 *      the kind's list narrowed by the same `filter` words a list page and a
 *      district carry — or, when those words cannot say it, the records
 *      themselves and an offer to show them as a view;
 *   4. "what's wrong" → the problems;
 *   5. "tell me about X" and "what is here" → X, or here, described.
 *
 * Each move is data a face applies directly: the routed face navigates to
 * its `address`, the scene turns its `kind`/`as`/`id`/`filter` into a stop
 * (`withPicture`, `withFocus`, `withSelection`). Every move says itself in
 * a sentence ("Went to The week."). Pure: no model, no DOM, no clock but
 * the `today` it is handed.
 *
 * SIGHT. Everything is read through the seat's own sight: a kind it may not
 * see has no place, no list and no records here, and a record it may not
 * see is never found. Asked for either, the answer is the one an absent
 * name gets — "Nothing by that name here." — so the reply cannot tell a
 * hidden thing from a thing that does not exist.
 */

/** A record the words found, as Find's strip draws it. */
export type NodeHit = Extract<Hit, { about: "node" }>;

/**
 * ONE MOVE THE SEAT MAKES, as data both faces apply.
 *
 * `address` is the routed face's path (under no base path; a host adds its
 * own, as `addressOf` does). The rest is what the scene needs to build the
 * same stop. `said` is the sentence the seat says having made it.
 */
export type SeatMove =
  /** The home or the scene itself (`slug` is a `placesOf` slug: `home`, `overview`). */
  | { readonly to: "place"; readonly slug: string; readonly title: string; readonly address: string; readonly face?: "scene" | "pages"; readonly said: string }
  /** A picture of a kind: a declared lens or a registered view (scene: `withPicture(state, kind, as)`). */
  | { readonly to: "picture"; readonly kind: string; readonly as: string; readonly title: string; readonly address: string; readonly said: string }
  /**
   * A kind's list or district, narrowed when `filter` is given — the
   * arrangement's own words (`due:after:2026-09-06,due:before:2026-09-14`):
   * a page's `?filter=`, a stop's `in.filter`.
   */
  | { readonly to: "kind"; readonly kind: string; readonly title: string; readonly filter?: string; readonly address: string; readonly said: string }
  /** One record (scene: focus and select it). */
  | { readonly to: "record"; readonly id: string; readonly kind: string; readonly label: string; readonly address: string; readonly said: string }
  /** The problems: the routed face's `/problems`, the scene's standing. */
  | { readonly to: "problems"; readonly address: string; readonly said: string };

/** Something the seat could not show by moving, offered instead: B3's draft of a view. */
export interface SeatOffer {
  /** What to draw, in the reader's words: "tasks overdue". */
  readonly draft: string;
  /** The words on the press. */
  readonly label: string;
}

/** Which of the five the ask was read as. */
export type AskAbout = "place" | "record" | "kind" | "problems" | "describe" | "here" | "picks";

export type AskAnswer =
  | {
      readonly about: AskAbout;
      /** What the seat says: the moves' sentences, and any facts read on the way. */
      readonly say: string;
      readonly moves: readonly SeatMove[];
      /** Records the words found, each a press, when no single one was meant. */
      readonly picks?: readonly NodeHit[];
      /** A picture the moves could not show. */
      readonly offer?: SeatOffer;
      /** The record or place it is about, when there is one: what a describer continues from. */
      readonly subject?: string;
      readonly unresolved?: undefined;
    }
  | {
      /**
       * The ask is not one of the five, or named nothing this seat can see.
       * `say` is set — "Nothing by that name here." — only when the ask was
       * plainly for a name (go to, open, tell me about); otherwise the
       * intelligence provider may answer it.
       */
      readonly unresolved: true;
      readonly say?: string;
    };

export interface AskContext {
  /** Who is asking: everything is read through this seat's sight. A person with every grant when unsaid. */
  readonly principal?: Principal;
  /** The app's places (`placesOf(app)`); without them only records, kinds and problems resolve. */
  readonly places?: readonly AppPlace[];
  /** Today, YYYY-MM-DD; the real day when unsaid. */
  readonly today?: string;
  /** The current selection: what "this" and "here" mean first. */
  readonly selection?: readonly string[];
  /** The place the reader stands in, by its `placesOf` slug: what "here" means when nothing is selected. */
  readonly place?: string;
  /** The day a week starts on: 1 (Monday) when unsaid, 0 for Sunday. */
  readonly weekStartsOn?: 0 | 1;
}

export const NOTHING_BY_THAT_NAME = "Nothing by that name here.";

type AnyNode = { id: string; kind: string } & Record<string, unknown>;

/* ------------------------------------------------------------------ words */

const fold = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The words that ask to be taken somewhere. */
const GO = /^(?:(?:can you |could you |please )?(?:go|take me|bring me|head|jump|navigate|switch|get me)(?: back)? to|(?:please )?(?:open|show(?: me)?|bring up|let me see|view)) (.+)$/;
/** The words that ask to be told about something. */
const TELL = /^(?:(?:can you |could you |please )?tell me (?:about|of)|what(?: is|'s| are) (?:in |on )?|describe|explain|who(?: is|'s)) (.+)$/;
/** "What is here", in the ways it is asked. */
const HERE = /^(?:what(?: is|'s| am i looking at| do i see)(?: (?:here|this|on (?:this|the) (?:page|screen)|in view|this place|this page))?|where am i|describe (?:this|here|this place|this page)|tell me about (?:this|here|this place|this page))$/;
const HERE_WORDS = new Set(["here", "this", "this place", "this page", "on this page", "on the page", "on this screen", "in view"]);
/** "What's wrong", and the record it may be about. */
const WRONG = /^(?:what(?: is|'s) (?:wrong|broken|the (?:problem|matter|trouble))|what needs (?:fixing|attention|doing)|any (?:problems|issues|trouble)|(?:show(?: me)? |go to |open )?(?:the )?(?:problems|issues|trouble|standing|what's wrong)|is (?:anything|something) (?:wrong|broken)|are there (?:any )?(?:problems|issues))(?: (?:with|about|on|in) (.+))?$/;

const stripThe = (text: string) => text.replace(/^(?:the|a|an|my|our) /, "");

/** Words that can sit around a kind and its filter without changing what is asked. */
const FILLER = new Set([
  "the", "a", "an", "my", "our", "all", "any", "of", "that", "which", "who", "are", "is", "be", "what", "whats", "what's", "with",
  "me", "show", "list", "every", "there", "do", "i", "have", "we", "due", "for", "please", "were", "was", "by", "from", "in", "on",
]);

/* ------------------------------------------------------------------- days */

const DAY_MS = 86_400_000;
const parseDay = (day: string): number => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const addDays = (day: string, days: number): string => dayOf(parseDay(day) + days * DAY_MS);

interface DateAsk {
  /** The words as said: "due this week", "overdue". */
  readonly words: string;
  /** Inclusive first and last day; either may be open. */
  readonly from?: string;
  readonly to?: string;
  /** "Overdue": before today, and not finished. */
  readonly overdue?: boolean;
}

/** The date words in an ask, against today: today, tomorrow, this/next week, this month, overdue. */
function readDate(asked: string, today: string, weekStartsOn: 0 | 1): { ask: DateAsk; rest: string } | undefined {
  const week = (offset: number) => {
    const weekday = new Date(parseDay(today)).getUTCDay();
    const back = (weekday - weekStartsOn + 7) % 7;
    const first = addDays(today, -back + offset * 7);
    return { from: first, to: addDays(first, 6) };
  };
  const month = () => {
    const first = `${today.slice(0, 8)}01`;
    const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
    return { from: first, to: addDays(dayOf(next.getTime()), -1) };
  };
  const shapes: readonly [RegExp, () => Omit<DateAsk, "words">][] = [
    [/\b(?:overdue|past due|late)\b/, () => ({ overdue: true, to: addDays(today, -1) })],
    [/\b(?:due |for |on )?today\b/, () => ({ from: today, to: today })],
    [/\b(?:due |for |on )?tomorrow\b/, () => ({ from: addDays(today, 1), to: addDays(today, 1) })],
    [/\b(?:due |for |on )?this week\b/, () => week(0)],
    [/\b(?:due |for |on )?next week\b/, () => week(1)],
    [/\b(?:due |for |on )?(?:last|previous) week\b/, () => week(-1)],
    [/\b(?:due |for |on )?this month\b/, () => month()],
  ];
  for (const [shape, range] of shapes) {
    const found = asked.match(shape);
    if (!found) continue;
    return { ask: { words: found[0], ...range() }, rest: asked.replace(found[0], " ").replace(/\s+/g, " ").trim() };
  }
  return undefined;
}

/* --------------------------------------------------------------- the seat */

/**
 * Reads an ask as one of the five, against one seat's sight.
 *
 * `store` may be the whole store or a seat's view of it; it is read through
 * `context.principal` either way.
 */
export function resolveAsk<S extends AnySchema>(store: Store<S>, text: string, context: AskContext = {}): AskAnswer {
  const principal: Principal = context.principal ?? { kind: "human" };
  const seen = store.seenBy(principal);
  const schema = seen.schema as AnySchema;
  const today = context.today ?? new Date().toISOString().slice(0, 10);
  const weekStartsOn = context.weekStartsOn ?? 1;
  const kept = store.kindsKeptFrom(principal);
  const off = store.modules.disabledKinds;
  const visibleKinds = (schema.kinds as readonly string[]).filter((kind) => !kept.has(kind) && !off.has(kind));
  const visible = new Set(visibleKinds);
  const places = (context.places ?? []).filter((place) => place.kind === null || visible.has(place.kind));
  const graph = seen.graph as unknown as { getNode(id: string): AnyNode | undefined; nodesOfKind(kind: string): readonly AnyNode[]; allNodes(): readonly AnyNode[] };

  const asked = fold(text).replace(/[?.!]+$/, "").trim();
  if (asked.length === 0) return { unresolved: true };

  const definitionOf = (kind: string) => schema.tryDefinition(kind);
  const nameOf = (node: AnyNode) => labelOf(definitionOf(node.kind), node);
  const pluralOf = (kind: string) => definitionOf(kind)?.plural ?? `${kind}s`;
  const listAddress = (kind: string) =>
    places.find((place) => place.kind === kind && place.address === `/${placeSlug(pluralOf(kind))}`)?.address ?? `/${placeSlug(pluralOf(kind))}`;
  const recordAddress = (node: AnyNode) => `/${placeSlug(pluralOf(node.kind))}/${encodeURIComponent(node.id)}`;
  const toRecord = (node: AnyNode): SeatMove => ({
    to: "record",
    id: node.id,
    kind: node.kind,
    label: nameOf(node),
    address: recordAddress(node),
    said: `Went to ${nameOf(node)}.`,
  });
  const toPlace = (place: AppPlace): SeatMove => {
    const said = `Went to ${place.title}.`;
    if (place.kind === null) {
      return { to: "place", slug: place.slug, title: place.title, address: place.address, ...(place.slug === "overview" ? { face: "scene" as const } : {}), said };
    }
    if (place.lens || place.address.startsWith("/places/")) {
      return { to: "picture", kind: place.kind, as: place.slug, title: place.title, address: place.address, said };
    }
    return { to: "kind", kind: place.kind, title: place.title, address: place.address, said };
  };
  const nothing = (): AskAnswer => ({ unresolved: true, say: NOTHING_BY_THAT_NAME });

  /** A short, true sentence about one record: what it is, three facts, and its trouble. */
  const describeRecord = (node: AnyNode): string => {
    const definition = definitionOf(node.kind);
    const facts = readableFields(node, definition, { limit: 3 })
      .map((field) => (field.alone.startsWith(field.label) ? field.alone : `${field.label.toLowerCase()} ${field.alone}`))
      .join(", ");
    const trouble = seen.violations().filter((violation) => violation.nodeIds.includes(node.id));
    return [
      `${nameOf(node)} — ${withArticle(nounOf(definition, node.kind))}${facts ? ` (${facts})` : ""}.`,
      trouble.length > 0 ? `Trouble: ${trouble.map((violation) => violation.message).join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  /** A place by its title, its slug, or its title without "the". */
  const placeNamed = (words: string): AppPlace | undefined => {
    const wanted = new Set([squeeze(words), squeeze(stripThe(words))]);
    for (const suffix of [" page", " view", " lens", " place", " picture", " list"]) {
      if (words.endsWith(suffix)) {
        wanted.add(squeeze(words.slice(0, -suffix.length)));
        wanted.add(squeeze(stripThe(words.slice(0, -suffix.length))));
      }
    }
    wanted.delete("");
    const named = (place: AppPlace) => wanted.has(squeeze(place.title)) || wanted.has(squeeze(stripThe(fold(place.title)))) || wanted.has(squeeze(place.slug));
    // A lens place before a kind's list of the same name; the first of several kinds that share a picture.
    return places.find((place) => place.kind !== null && place.address.startsWith("/places/") && named(place)) ?? places.find(named);
  };

  /** Records by name, under the seat's sight: the one meant, or the several the words find. */
  const recordsNamed = (words: string): { one?: AnyNode; picks: NodeHit[] } => {
    const found = search(store, words, { principal, today, limit: 6, ...(context.selection ? { from: context.selection } : {}) });
    const picks = found.hits.filter((hit): hit is NodeHit => hit.about === "node" && visible.has(hit.kind) && graph.getNode(hit.id) !== undefined);
    const exact = picks.filter((hit) => hit.why.field === "label" && hit.why.strength === "exact");
    if (exact.length === 1) return { one: graph.getNode(exact[0]!.id)!, picks };
    if (exact.length > 1) return { picks: exact };
    if (picks.length === 1 && found.total === 1) return { one: graph.getNode(picks[0]!.id)!, picks };
    return { picks };
  };

  const picksSaid = (picks: readonly NodeHit[]) => {
    const names = picks.map((hit) => `${hit.label} (${nounOf(definitionOf(hit.kind), hit.kind)})`);
    return `${picks.length === 1 ? "One thing matches" : `${picks.length} things match`}: ${names.join("; ")}.`;
  };

  /** Go to a place or a record by name, or say nothing is called that. */
  const goNamed = (words: string, describe: boolean): AskAnswer => {
    if (HERE_WORDS.has(words)) return here();
    const place = placeNamed(words);
    if (place) {
      const move = toPlace(place);
      return { about: "place", say: describe ? `${move.said} ${describePlace(place)}` : move.said, moves: [move], subject: place.slug };
    }
    const records = recordsNamed(stripThe(words) || words);
    if (records.one) {
      const move = toRecord(records.one);
      return { about: describe ? "describe" : "record", say: describe ? `${move.said} ${describeRecord(records.one)}` : move.said, moves: [move], subject: records.one.id };
    }
    if (records.picks.length > 0) return { about: "picks", say: picksSaid(records.picks), moves: [], picks: records.picks };
    const filtered = kindAsk(words);
    if (filtered) return filtered;
    /*
     * A kind this seat sees, named with words that are not a filter, is a
     * kind to go to when nothing else is said ("go to the tasks"), and an
     * ask for something else — a drawing, a change — otherwise. Only a name
     * that is nothing this seat can see is "nothing by that name".
     */
    const kind = kindIn(words);
    if (kind) {
      if (kind.rest.split(" ").every((word) => word === "" || FILLER.has(word))) {
        const title = pluralOf(kind.kind);
        const move: SeatMove = { to: "kind", kind: kind.kind, title, address: listAddress(kind.kind), said: `Went to the ${title.toLowerCase()}.` };
        return { about: "kind", say: move.said, moves: [move] };
      }
      return { unresolved: true };
    }
    return nothing();
  };

  /** What a place is, in a line: what it draws and how many. */
  const describePlace = (place: AppPlace): string => {
    if (place.kind === null) {
      const counts = visibleKinds
        .map((kind) => ({ kind, count: graph.nodesOfKind(kind).length }))
        .filter((one) => one.count > 0)
        .map((one) => `${one.count} ${(one.count === 1 ? nounOf(definitionOf(one.kind), one.kind) : pluralOf(one.kind)).toLowerCase()}`);
      const problems = seen.violations().length;
      return [counts.length > 0 ? `It holds ${list(counts)}.` : "It holds nothing yet.", problems > 0 ? `${problems === 1 ? "One problem" : `${problems} problems`} to see to.` : ""].filter(Boolean).join(" ");
    }
    const count = graph.nodesOfKind(place.kind).length;
    const plural = pluralOf(place.kind).toLowerCase();
    const flagged = new Set(seen.violations().flatMap((violation) => violation.nodeIds));
    const troubled = graph.nodesOfKind(place.kind).filter((node) => flagged.has(node.id)).length;
    return [
      place.lens ? `It draws the ${plural} as ${withArticle(place.lens)}${count > 0 ? ` — ${count} of them` : ""}.` : `${count === 0 ? "No" : count} ${count === 1 ? nounOf(definitionOf(place.kind), place.kind) : plural} ${count === 1 ? "is" : "are"} here.`,
      troubled > 0 ? `${troubled} ${troubled === 1 ? "has" : "have"} a problem.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  /** "What is here": the selection, else the place the reader stands in, else the home. */
  const here = (): AskAnswer => {
    const selected = (context.selection ?? []).map((id) => graph.getNode(id)).find((node): node is AnyNode => node !== undefined);
    if (selected) return { about: "here", say: describeRecord(selected), moves: [], subject: selected.id };
    const standing = places.find((place) => place.slug === context.place) ?? places.find((place) => place.slug === "home");
    if (standing) return { about: "here", say: `${standing.title}. ${describePlace(standing)}`, moves: [], subject: standing.slug };
    return { about: "here", say: describePlace({ slug: "home", title: "Home", kind: null, cardinality: "many", address: "/", stop: "#" }), moves: [] };
  };

  /* ---------------------------------------------- 3. a kind, narrowed */

  /** The kind a run of words names, by its plural or its noun, and the words left over. */
  const kindIn = (words: string): { kind: string; rest: string } | undefined => {
    const candidates = visibleKinds
      .flatMap((kind) => [pluralOf(kind), nounOf(definitionOf(kind), kind), kind].map((name) => ({ kind, name: fold(name) })))
      .filter((one) => one.name.length > 0)
      .sort((a, b) => b.name.length - a.name.length);
    for (const { kind, name } of candidates) {
      const at = ` ${words} `.indexOf(` ${name} `);
      if (at < 0) continue;
      return { kind, rest: ` ${words} `.replace(` ${name} `, " ").replace(/\s+/g, " ").trim() };
    }
    return undefined;
  };

  /** The date field an ask reads: the one its words name, a date role, or the kind's only date. */
  const dateFieldOf = (kind: string, words: readonly string[]): ArrangeOffer | undefined => {
    const dates = arrangeable(schema, kind).filters.filter((offer) => offer.about === "field" && offer.type === "date");
    if (dates.length === 0) return undefined;
    const named = dates.find((offer) => words.some((word) => fold(offer.key) === word || fold(offer.label) === word));
    if (named) return named;
    const roles = (definitionOf(kind)?.fieldRoles ?? {}) as Record<string, string>;
    for (const role of ["due", "deadline", "date", "when", "start", "end"]) {
      const field = roles[role];
      const offer = field ? dates.find((one) => one.key === field) : undefined;
      if (offer) return offer;
    }
    const byName = dates.find((offer) => ["due", "deadline", "date", "when", "on", "at"].includes(offer.key.toLowerCase()));
    return byName ?? (dates.length === 1 ? dates[0] : undefined);
  };

  /** "Not finished", in the arrangement's words when it can be said; undefined when it cannot. */
  const unfinishedOf = (kind: string): { conditions: Condition[]; holds: (node: AnyNode) => boolean } | "unsayable" => {
    const definition = definitionOf(kind);
    const offers = arrangeable(schema, kind).filters;
    const lifecycle = definition?.lifecycle;
    if (lifecycle) {
      return { conditions: [{ key: "is", value: "current" }], holds: (node) => conditionHolds(ctx, node, { key: "is", value: "current" }) };
    }
    const finished = offers.find((offer) => offer.about === "field" && offer.type === "boolean" && FINISHED.has(fold(offer.key)));
    if (finished) {
      return { conditions: [{ key: finished.key, value: "false" }], holds: (node) => node[finished.key] !== true };
    }
    const status = offers.find((offer) => offer.about === "field" && offer.type === "choice" && (offer.options ?? []).some((option) => FINISHED.has(fold(option))));
    if (status) {
      const done = new Set((status.options ?? []).filter((option) => FINISHED.has(fold(option))));
      const open = (status.options ?? []).filter((option) => !done.has(option));
      // One value left that is not finished is a condition the words can carry; several is not.
      if (open.length === 1) return { conditions: [{ key: status.key, value: open[0]! }], holds: (node) => node[status.key] === open[0] };
      return "unsayable";
    }
    return { conditions: [], holds: () => true };
  };

  const flaggedIds = new Set(seen.violations().flatMap((violation) => violation.nodeIds));
  const ctx = { schema, graph: seen.graph as unknown as ArrangeGraph, flagged: flaggedIds, today };

  /** A kind with a date, a status or a yes/no — "deliverables due this week", "open decisions", "done tasks". */
  const kindAsk = (words: string): AskAnswer | undefined => {
    const dated = readDate(words, today, weekStartsOn);
    const named = kindIn(dated?.rest ?? words);
    let kind = named?.kind;
    let rest = (named?.rest ?? dated?.rest ?? words).split(" ").filter(Boolean);
    if (!kind && dated) {
      /*
       * "What's due this week": the one kind that carries a date the words
       * can read — and among several, the one whose date the words name
       * ("due" is a task's `due`, not a rule's start of effect).
       */
      const said = words.split(" ");
      const carrying = visibleKinds.filter((one) => dateFieldOf(one, said) !== undefined);
      const naming = carrying.filter((one) => {
        const field = dateFieldOf(one, said)!;
        return said.some((word) => fold(field.key) === word || fold(field.label) === word);
      });
      const only = carrying.length === 1 ? carrying : naming;
      if (only.length !== 1) return undefined;
      kind = only[0]!;
    }
    if (!kind) return undefined;
    const offers = arrangeable(schema, kind).filters;
    const conditions: Condition[] = [];
    /* How it is said: "overdue tasks", "open decisions", "tasks due this week". */
    const phrases: string[] = [];
    const after: string[] = [];
    const holds: ((node: AnyNode) => boolean)[] = [];
    let unsayable = false;

    // A choice's own value: "open decisions", "growing plantings".
    const leftover: string[] = [];
    for (let at = 0; at < rest.length; at++) {
      const word = rest[at]!;
      const negated = at > 0 && (rest[at - 1] === "not" || rest[at - 1] === "un");
      const choice = offers.find((offer) => offer.about === "field" && offer.type === "choice" && (offer.options ?? []).some((option) => fold(option) === word));
      if (choice && !negated) {
        const value = (choice.options ?? []).find((option) => fold(option) === word)!;
        conditions.push({ key: choice.key, value });
        phrases.push(value);
        continue;
      }
      // A yes/no by its name or its label: "done tasks", "unfinished tasks", "tasks not done".
      const flag = offers.find((offer) => offer.about === "field" && offer.type === "boolean" && [fold(offer.key), fold(offer.label)].some((name) => name === word || name === word.replace(/^un/, "")));
      if (flag) {
        const yes = !negated && !(word.startsWith("un") && !fold(flag.key).startsWith("un"));
        conditions.push({ key: flag.key, value: String(yes) });
        phrases.push(yes ? word : `not ${word.replace(/^un/, "")}`);
        continue;
      }
      if (OPEN_WORDS.has(word) && !negated) {
        const open = unfinishedOf(kind);
        if (open === "unsayable") {
          unsayable = true;
          holds.push((node) => !finishedNode(schema, node));
        } else {
          conditions.push(...open.conditions);
          holds.push(open.holds);
        }
        phrases.push(word);
        continue;
      }
      if (word === "not" || word === "un") continue;
      // The date the words name ("sown this week") is read with the date, below.
      if (dated && offers.some((offer) => offer.type === "date" && (fold(offer.key) === word || fold(offer.label) === word))) continue;
      leftover.push(word);
    }
    rest = leftover;
    // Anything still unread is a sentence this is not.
    if (rest.some((word) => !FILLER.has(word))) return undefined;
    if (!dated && conditions.length === 0 && holds.length === 0) return undefined;

    const plural = pluralOf(kind).toLowerCase();
    const title = pluralOf(kind);
    if (dated) {
      const field = dateFieldOf(kind, words.split(" "));
      if (!field) {
        const move: SeatMove = { to: "kind", kind, title, address: listAddress(kind), said: `Went to the ${plural}.` };
        return {
          about: "kind",
          say: `${capital(title)} carry no date, so I can't tell which are ${/^(?:due|for|on|overdue|past due|late)\b/.test(dated.ask.words) ? dated.ask.words : `due ${dated.ask.words}`}. ${move.said}`,
          moves: [move],
        };
      }
      if (dated.ask.from) conditions.push({ key: field.key, value: `after:${addDays(dated.ask.from, -1)}` });
      if (dated.ask.to) conditions.push({ key: field.key, value: `before:${addDays(dated.ask.to, 1)}` });
      if (dated.ask.overdue) {
        const open = unfinishedOf(kind);
        if (open === "unsayable") {
          unsayable = true;
          holds.push((node) => !finishedNode(schema, node));
        } else {
          conditions.push(...open.conditions);
          holds.push(open.holds);
        }
      }
      const when = dated.ask.words.replace(/^(?:due|for|on) /, "");
      if (dated.ask.overdue) phrases.push("overdue");
      else after.push(dated.ask.words.startsWith("due") || fold(field.key) === "due" ? `due ${when}` : `${field.label.toLowerCase()} ${when}`);
    }

    const members = graph
      .nodesOfKind(kind)
      .filter((node) => conditions.every((condition) => conditionHolds(ctx, node, condition)) && holds.every((one) => one(node)));
    const words2 = [...phrases, ...after].join(" and ");
    const said = [...phrases, plural, ...after].join(" ");
    const picks: NodeHit[] = members.slice(0, 6).map((node) => ({
      about: "node",
      id: node.id,
      kind,
      label: nameOf(node),
      why: { field: conditions[0]?.key ?? "label", reading: conditions[0]?.key ?? "Name", fragment: words2, strength: "field" },
      current: true,
      flagged: flaggedIds.has(node.id),
      address: recordAddress(node),
    }));
    const counted = members.length === 0 ? `No ${plural} are ${words2}.` : `${members.length === 1 ? `One ${nounOf(definitionOf(kind), kind)} is` : `${members.length} ${plural} are`} ${words2}: ${list(members.slice(0, 6).map(nameOf))}${members.length > 6 ? `, and ${members.length - 6} more` : ""}.`;
    if (unsayable) {
      // The list cannot be narrowed to exactly these: say them, and offer a picture of them.
      return { about: "kind", say: counted, moves: [], picks, offer: { draft: said, label: "Show as a view" } };
    }
    const filter = conditions.map((condition) => `${condition.key}:${condition.value}`).join(",");
    const address = `${listAddress(kind)}?${new URLSearchParams({ filter }).toString()}`;
    const move: SeatMove = { to: "kind", kind, title: capital(said), filter, address, said: `Went to the ${said}.` };
    return { about: "kind", say: `${move.said} ${counted}`, moves: [move], picks };
  };

  /* ------------------------------------------------------- in order */

  // 4. What's wrong — with the whole, or with one thing.
  const wrong = asked.match(WRONG);
  if (wrong) {
    const about = wrong[1];
    if (about && !HERE_WORDS.has(about) && !/^(?:it|this|that)$/.test(about)) {
      const place = placeNamed(about);
      const records = place ? undefined : recordsNamed(stripThe(about) || about);
      if (records?.one) {
        const move = toRecord(records.one);
        return { about: "describe", say: `${move.said} ${describeRecord(records.one)}`, moves: [move], subject: records.one.id };
      }
      if (!place) return records && records.picks.length > 0 ? { about: "picks", say: picksSaid(records.picks), moves: [], picks: records.picks } : nothing();
    }
    if (about && /^(?:it|this|that)$|^(?:here|this place|this page)$/.test(about)) {
      const selected = (context.selection ?? []).map((id) => graph.getNode(id)).find((node): node is AnyNode => node !== undefined);
      if (selected) return { about: "describe", say: describeRecord(selected), moves: [], subject: selected.id };
    }
    const violations = seen.violations();
    if (violations.length === 0) return { about: "problems", say: "Nothing is wrong — every rule holds.", moves: [] };
    const move: SeatMove = { to: "problems", address: "/problems", said: "Went to the problems." };
    return {
      about: "problems",
      say: `${move.said} ${violations.length === 1 ? "One" : violations.length}: ${violations
        .slice(0, 4)
        .map((violation) => violation.message)
        .join("; ")}${violations.length > 4 ? "…" : "."}`,
      moves: [move],
    };
  }

  // 5a. What is here.
  if (HERE.test(asked)) return here();

  // 1, 2. Go to a place or a record by name.
  /*
   * "Open decisions" is the decisions still open, not the decisions'
   * list opened: where "open" reads as a filter on a kind, it is one.
   */
  if (/^open /.test(asked)) {
    const filtered = kindAsk(asked);
    if (filtered) return filtered;
  }
  const go = asked.match(GO) ?? asked.match(/^(?:go|take me|head|get me)(?: back)? (home)$/);
  if (go) return goNamed(go[1]!.trim(), false);

  // 5b. Tell me about a place or a record.
  const tell = asked.match(TELL);
  if (tell) {
    const told = goNamed(tell[1]!.trim(), true);
    // A question that names nothing by name is not refused here: it may be one a model can answer.
    return "unresolved" in told && told.unresolved && !/^tell me|^describe/.test(asked) ? { unresolved: true } : told;
  }

  // A bare place or a bare name is a place to go.
  const place = placeNamed(asked);
  if (place) {
    const move = toPlace(place);
    return { about: "place", say: move.said, moves: [move], subject: place.slug };
  }

  // 3. A kind with a date or a status.
  const filtered = kindAsk(asked);
  if (filtered) return filtered;

  return { unresolved: true };
}

/** Finished, read by the words a status or a yes/no usually uses for it. */
const FINISHED = new Set(["done", "finished", "complete", "completed", "closed", "resolved", "agreed", "cancelled", "canceled", "archived", "shipped", "delivered"]);
/** Words that ask for what is not finished. */
const OPEN_WORDS = new Set(["open", "unfinished", "outstanding", "pending", "remaining", "undone", "incomplete"]);

function finishedNode(schema: AnySchema, node: AnyNode): boolean {
  const offers = arrangeable(schema, node.kind).filters;
  return offers.some(
    (offer) =>
      offer.about === "field" &&
      ((offer.type === "boolean" && FINISHED.has(offer.key.toLowerCase()) && node[offer.key] === true) ||
        (offer.type === "choice" && typeof node[offer.key] === "string" && FINISHED.has(String(node[offer.key]).toLowerCase()))),
  );
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "A, B and C". */
function list(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * THE PLACES, FROM WHAT A FACE HOLDS: the schema and the places its view
 * registry names (a declared lens registers one). The same list `placesOf`
 * makes from the declaration — the home, the scene, each picture, each
 * kind's list, with the same addresses — for a seat that is handed a store
 * and its views rather than the app.
 */
export function placesFromViews(schema: AnySchema, places: readonly Place[], options: { readonly scene?: string } = {}): AppPlace[] {
  const plural = (kind: string) => (schema.tryDefinition(kind)?.plural as string | undefined) ?? `${kind}s`;
  const out: AppPlace[] = [
    { slug: "home", title: "Home", kind: null, cardinality: "many", address: "/", stop: "#" },
    { slug: "overview", title: options.scene ?? "Scene", kind: null, cardinality: "many", address: "/places/overview", stop: "#" },
  ];
  for (const place of places) {
    if (!(schema.kinds as readonly string[]).includes(place.kind)) continue;
    const shared = places.some((other) => other.as === place.as && other.kind !== place.kind);
    const of = shared ? `?of=${encodeURIComponent(placeSlug(plural(place.kind)))}` : "";
    out.push({
      slug: place.as,
      title: place.title,
      kind: place.kind,
      cardinality: "many",
      address: `/places/${encodeURIComponent(place.as)}${of}`,
      stop: shared ? `#focus=aggregate:${place.kind}&in.view=${encodeURIComponent(place.as)}` : `#view=${encodeURIComponent(place.as)}`,
    });
  }
  for (const kind of schema.kinds as readonly string[]) {
    out.push({ slug: placeSlug(plural(kind)), title: plural(kind), kind, cardinality: "many", address: `/${placeSlug(plural(kind))}`, stop: `#focus=aggregate:${kind}` });
  }
  return out;
}

/** What the resolver is handed from a turn's context. */
export function askContextOf(context: ChatContext & AskContext, today?: string): AskContext {
  return {
    ...(context.principal ? { principal: context.principal } : {}),
    ...(context.places ? { places: context.places } : {}),
    ...(context.selection ? { selection: context.selection } : {}),
    ...(context.place ? { place: context.place } : {}),
    ...((today ?? context.today) ? { today: today ?? context.today } : {}),
    ...(context.weekStartsOn !== undefined ? { weekStartsOn: context.weekStartsOn } : {}),
  };
}

/**
 * AN ASK, AS THE GRAPH RESPONDER TAKES IT: a whole reply when the moves are
 * the answer; otherwise the moves to carry, and whether the fuller answer
 * the responder already gives — the problems with their repairs, a record
 * with its relations — is the one meant.
 */
export function goingFrom<S extends AnySchema>(
  store: Store<S>,
  text: string,
  context: ChatContext,
  today?: string,
): { readonly reply?: ChatReply; readonly moves?: readonly SeatMove[]; readonly told?: string; readonly problems?: boolean } {
  const answer = resolveAsk(store, text, askContextOf(context, today));
  if (answer.unresolved) return answer.say ? { reply: { say: answer.say, proposals: [], grounded: true } } : {};
  if (answer.about === "picks") return {};
  const moves = answer.moves.length > 0 ? { moves: answer.moves } : {};
  const subject = answer.subject ? store.graph.getNode(answer.subject) : undefined;
  if (answer.about === "problems") return { ...moves, problems: true };
  if (subject && (answer.about === "describe" || answer.about === "here")) return { ...moves, told: subject.id };
  const proposals = subject ? validateProposals(store, readyRepairsOf(violationsTouching(store.violations(), [subject.id])).slice(0, 3)) : [];
  return {
    reply: {
      say: answer.say,
      proposals,
      grounded: true,
      ...moves,
      ...(answer.picks && answer.picks.length > 0 ? { picks: answer.picks } : {}),
      ...(answer.offer ? { offer: answer.offer } : {}),
    },
  };
}

/**
 * Keeps the moves a model proposed that the seat can make: each is read
 * again as an ask ("go to <it>") under the same sight, so a model can only
 * ever move the app to a place or a record the resolver itself would.
 */
export function movesFromNames<S extends AnySchema>(store: Store<S>, names: readonly unknown[], given: AskContext | ChatContext = {}): SeatMove[] {
  const context = askContextOf(given);
  const out: SeatMove[] = [];
  for (const name of names) {
    const words = typeof name === "string" ? name : typeof name === "object" && name !== null && typeof (name as { to?: unknown }).to === "string" ? (name as { to: string }).to : undefined;
    if (!words || words.trim().length === 0) continue;
    const answer = resolveAsk(store, /^(?:go|take me|open|show)\b/i.test(words.trim()) ? words : `go to ${words}`, context);
    if ("moves" in answer) for (const move of answer.moves) if (!out.some((held) => held.address === move.address)) out.push(move);
  }
  return out;
}
