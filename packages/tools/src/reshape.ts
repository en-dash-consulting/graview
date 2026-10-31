import type { MutationCall } from "@graview/core";
import { documentOf, type GraviewDocument } from "@graview/core/document";
import { hasTrait, TRAIT_BRINGS, TRAIT_WORDS, TRAITS, traitsOfDocument, type TraitName } from "@graview/core/traits";
import type { Answer, Decide } from "./fast.js";
import type { Question } from "./questions.js";
import { noulOf } from "./tidy/system-one.js";

/** Whether a seat may change the app's declaration — the studio's door's judgment, here for a page that fetched this entry (the quick ask's plan) without the whole of `@graview/tools`. */
export { mayChangeDeclaration } from "./agent/declaration.js";

/*
 * `@graview/tools/reshape` — ASK AI IN AN APP PROPOSES A CHANGE TO THE APP
 * ITSELF (Roadmap f-seat-reshape).
 *
 * The seat's tools read, and the menu's suggestions cover records, so "we
 * also need to track who's driving" had no path inside the app: it went to
 * a chat somewhere else. Now the person's words are matched to structure
 * through the same judgments as the new-app starter (`./starter.ts`): a
 * Noul per trait the app lacks ("does what they asked for need people who
 * own things?") and a Noul per part it has ("did they ask to stop keeping
 * areas?"), over one state — what they said and the app in words. Whatever
 * `decide` the host passes answers them (Jev, as `dream` takes one; a stub
 * in a test), and code reads the answers with thresholds.
 *
 * What the page says is a CARD — what is added, kept and dropped, as chips
 * a person toggles, with anything breaking said plainly — and what it hands
 * the host on Accept is the READING: the traits to add and the kinds and
 * traits to drop, as the person left them. The host composes the edits
 * from that reading (`composeReshape`, `@graview/core/compose`: code writes
 * every edit, the model never writes a kind, a field or a rule), previews
 * them with its data and applies them as the person, as one undoable
 * change (Graview Cloud: its propose_change and apply_change). The
 * composer never rides on a page: a page that fetched it when asked made
 * the editor live up front, which no page carries.
 *
 * The seat offers it only where a host handed `onProposeChange` and the
 * seat's role may change the declaration (`mayChangeDeclaration`); a viewer
 * is never offered it. Its own entry: a page fetches it with the first such
 * ask, never up front.
 */

/** One request: the state the model reads and the typed questions over it, keyed so `readReshape` can say each answer back. */
export interface ReshapeAsk {
  readonly state: Readonly<Record<string, unknown>>;
  readonly questions: Readonly<Record<string, Question>>;
}

/** How the answers are read. */
export interface ReshapeThresholds {
  /** A trait the app lacks is added at this Noul or above. 0.7 when unsaid. */
  readonly add?: number;
  /** A kind or a trait the app has is dropped at this Noul or above: dropping loses records, so the bar is the same as adding, never lower. 0.7 when unsaid. */
  readonly drop?: number;
}
const DEFAULTS: Required<ReshapeThresholds> = { add: 0.7, drop: 0.7 };

/** The answers read: the traits to add, the kinds and traits to drop (by name, as `composeReshape` takes them), and every raw Noul kept. */
export interface ReshapeReading {
  /** In `TRAITS` order. */
  readonly add: readonly TraitName[];
  /** Kinds by name and traits by name, as asked. */
  readonly drop: readonly string[];
  readonly needs: Readonly<Partial<Record<TraitName, number>>>;
  /** Keyed `kind:<name>` and `trait:<name>`. */
  readonly drops: Readonly<Record<string, number>>;
}

/** One toggle on the card: a trait added or dropped, or a kind kept or dropped, in a person's words. */
export interface ReshapeChip {
  readonly what: "trait" | "kind";
  readonly name: string;
  /** "people who own things", "vendors". */
  readonly words: string;
  /** What an added trait brings, in words (`TRAIT_BRINGS`): "a person kind (or the people the app has), an owner link, …". */
  readonly brings?: string;
}

/** The change as a person reads it before accepting it. */
export interface ReshapeCard {
  /** One sentence: "This adds people who own things and keeps categories and vendors." */
  readonly said: string;
  readonly adds: readonly ReshapeChip[];
  readonly keeps: readonly ReshapeChip[];
  readonly drops: readonly ReshapeChip[];
  /** What the change loses, as far as the seat can say — a dropped kind's records, a dropped trait's fields and links; the host's preview says the rest. Empty when nothing is lost. */
  readonly breaking: readonly string[];
}

/** What the seat hands the host: the words, the reading as the person left it on the card, and the card they saw. */
export interface ReshapeProposal {
  /** What the person asked for, in their words. */
  readonly said: string;
  /** The traits to add, in `TRAITS` order: what `composeReshape` composes. */
  readonly add: readonly TraitName[];
  /** The kinds and traits to drop, by name. */
  readonly drop: readonly string[];
  readonly card: ReshapeCard;
  /**
   * WHAT FINISHES THE ASK ONCE THE APP HAS CHANGED (Roadmap
   * f-menu-type-anything): the records to make and change in the changed
   * app — "add Nick as a person, give each task in This week to him" — as
   * calls of its acts, a record made named by its `mintedHint` in the calls
   * after it. The host applies them with the change to the app, as one
   * change, previewed whole before it lands and taken back with one undo.
   */
  readonly records?: readonly MutationCall[];
  /** Whose words made the plan, as the records' ops say it: `ai:<name>`. */
  readonly via?: string;
  /**
   * THE CHANGE TO THE APP AS EDITS (Roadmap f-menu-type-anything): the least
   * the ask needs, written by `planEdits` in the edit vocabulary; a host
   * applies these (`composeAppChange({ document, edits })`) in place of
   * composing `add` and `drop`, which a plan leaves empty.
   */
  readonly edits?: readonly unknown[];
}

/** A turn run through the host's model: the proposal (null when the reading changes nothing), the reading, the raw answers to keep, and what the call cost. */
export interface ReshapeTurn {
  readonly proposal: ReshapeProposal | null;
  readonly reading: ReshapeReading;
  readonly answers: Readonly<Record<string, Answer>>;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

/**
 * What the host says it did with a proposal a person accepted: applied or
 * declined — or applied with the one way back, which the card offers as
 * Undo (the change to the app and the records it made, taken back together).
 */
export type ProposeChangeAnswer = "applied" | "declined" | { readonly applied: true; readonly undo: () => void | Promise<void>; /** What the card says beside it: "Kept until this page reloads." */ readonly note?: string };

/**
 * THE HOST THAT APPLIES A CHANGE TO THE APP (`onProposeChange`). Handed the
 * proposal a person accepted — the card they saw and the reading that
 * made it — the host composes the edits (`composeReshape` on
 * `@graview/core/compose`, with the app's document), previews and applies
 * them under its own policy, as the person, as one undoable change, and
 * answers `"applied"`; or declines (a read-only seat, a plan without
 * structure changes) and answers `"declined"`. Without the hook the seat
 * never offers the change.
 */
export type ProposeChangeHost = (proposal: ReshapeProposal) => ProposeChangeAnswer | Promise<ProposeChangeAnswer>;

/**
 * A CHANGE TO THE APP SHOWN ON THIS PAGE ONLY, NOT KEPT (Roadmap
 * f-make-any-page-better): "Make “Tasks” better" drafts edits over the
 * view spec, and the page is drawn with them applied before anybody keeps
 * them. The host lays the changed app over this page alone — nothing is
 * written, nobody else sees it — and answers the way to put the page back
 * (`undo`), which the card calls on Discard and before Keep hands the same
 * change to `onProposeChange`. Unsaid, the card says what would change
 * without drawing it.
 */
export type DraftChangeHost = (proposal: ReshapeProposal) => { readonly undo: () => void | Promise<void> } | Promise<{ readonly undo: () => void | Promise<void> }>;

/**
 * THE HOST'S COMPOSER, LENT TO A PAGE (Roadmap f-menu-type-anything): a
 * plan's edits (or a reshape's traits) applied to the app's document and
 * judged by the checker — the changed document, the app it compiles to and
 * what changed in words, or a refusal. `composeAppChange` from `@graview/core/compose` is
 * one; a host hands it (`composeChange`) so the quick ask can offer a
 * whole plan that finishes an ask, rehearsed before it is offered, while
 * the composer and the checker stay off the page. Unsaid, a missing
 * capability is said, and who could add it, without a plan.
 */
export type ComposeChangeHost = (change: { readonly document: GraviewDocument; readonly edits?: readonly unknown[]; readonly add?: readonly TraitName[]; readonly drop?: readonly string[] }) =>
  | { readonly ok: true; readonly document: GraviewDocument; readonly app: object; readonly said: readonly string[] }
  | { readonly ok: false; readonly refused: string };

/** The seat's tool, as a host's model is told of it: the Roadmap's `propose-change`, spelled as the surface spells its tools. */
export const PROPOSE_CHANGE = "propose_change";

/**
 * THE APP'S DOCUMENT, FOR THE SEAT: the one it was compiled from, which the
 * compiler remembered (`documentOf`); none for an app declared in code,
 * whose seat is then offered no change — its declaration is its code. A
 * code app that wants the seat to propose remembers itself
 * (`rememberDocument(app, toDocument(app).document)`), off the page's
 * first load. Never `toDocument` here: writing an app as a document is
 * not a page's to carry.
 */
export function documentOfApp(app: object): GraviewDocument | undefined {
  return documentOf(app);
}

const lower = (value: string) => value.toLowerCase();
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const listed = (words: readonly string[], join = "and") => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} ${join} ${words[words.length - 1]}`);
const humanized = (kind: string) =>
  kind
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
/** A kind's plural as the declaration spells it, else its noun with an s, else its name humanized. */
const pluralOf = (document: GraviewDocument, kind: string): string => {
  const spec = document.kinds[kind];
  return lower(spec?.plural ?? (spec?.noun ? `${spec.noun}s` : `${humanized(kind)}s`));
};
const isTrait = (name: string): name is TraitName => (TRAITS as readonly string[]).includes(name);
const byTraitOrder = (a: TraitName, b: TraitName) => TRAITS.indexOf(a) - TRAITS.indexOf(b);

/** The app in words, as the model reads it: what it keeps, what it is made of, what it lacks. */
function appState(document: GraviewDocument): Record<string, unknown> {
  const has = traitsOfDocument(document);
  const carried = new Set(has.map((trait) => trait.trait));
  return {
    name: document.name,
    keeps: Object.keys(document.kinds).map((kind) => pluralOf(document, kind)),
    "made of": has.map((trait) => trait.said),
    lacks: TRAITS.filter((trait) => !carried.has(trait)).map((trait) => TRAIT_WORDS[trait]),
  };
}

/**
 * THE QUESTIONS, one request: whether what they asked for needs each trait
 * the app lacks (`need:<trait>`), and whether they asked to stop keeping
 * each kind (`drop:kind:<name>`) or each trait the app has
 * (`drop:trait:<name>`). The state is what they said and the app in words.
 */
export function reshapeQuestions(said: string, document: GraviewDocument): ReshapeAsk {
  const has = new Set(traitsOfDocument(document).map((trait) => trait.trait));
  const questions: Record<string, Question> = {};
  for (const trait of TRAITS) {
    if (has.has(trait)) continue;
    questions[`need:${trait}`] = {
      type: "noul",
      instructions: `Does what they asked for need ${TRAIT_WORDS[trait]}, which ${document.name} has no part for yet?`,
      criteria: { true: `It needs ${TRAIT_WORDS[trait]}: they asked for it, or what they asked for cannot be kept without it.`, false: "Not asked for, and not needed to keep what they asked for." },
    };
  }
  for (const kind of Object.keys(document.kinds)) {
    const plural = pluralOf(document, kind);
    questions[`drop:kind:${kind}`] = {
      type: "noul",
      instructions: `Did they ask ${document.name} to stop keeping ${plural}?`,
      criteria: { true: `They said the ${plural} go: to drop them, remove them or stop tracking them.`, false: `${capital(plural)} stay: nothing they said asks for them to go.` },
    };
  }
  for (const trait of TRAITS) {
    if (!has.has(trait)) continue;
    questions[`drop:trait:${trait}`] = {
      type: "noul",
      instructions: `Did they ask ${document.name} to stop having ${TRAIT_WORDS[trait]}?`,
      criteria: { true: `They said it goes: to drop or stop ${TRAIT_WORDS[trait]}.`, false: "It stays: nothing they said asks for it to go." },
    };
  }
  return { state: { said, app: appState(document) }, questions };
}

const DROP_KEY = /^drop:(kind|trait):(.+)$/s;

/**
 * THE ANSWERS READ WITH THRESHOLDS: a trait is added at `add` or above, a
 * kind or trait dropped at `drop` or above. Every raw Noul is kept beside
 * the reading, so a host that keeps the answers can read them again under
 * other thresholds without asking the model again. An answer under a key no
 * question asks is refused rather than dropped.
 */
export function readReshape(answers: Readonly<Record<string, Answer>>, thresholds: ReshapeThresholds = {}): ReshapeReading {
  const at = { ...DEFAULTS, ...thresholds };
  const keys = Object.keys(answers);
  if (keys.length === 0) throw new Error("readReshape was handed no answers.");
  const strange = keys.filter((key) => !/^need:/.test(key) && !DROP_KEY.test(key));
  if (strange.length > 0) throw new Error(`readReshape does not know the question ${strange.map((key) => `"${key}"`).join(", ")}: it reads need:<trait>, drop:kind:<name> and drop:trait:<name>.`);
  const needs: Partial<Record<TraitName, number>> = {};
  const drops: Record<string, number> = {};
  for (const [key, answer] of Object.entries(answers)) {
    const dropped = DROP_KEY.exec(key);
    if (dropped) {
      drops[`${dropped[1]}:${dropped[2]}`] = noulOf(answer) ?? 0;
      continue;
    }
    const trait = key.slice("need:".length);
    if (isTrait(trait)) needs[trait] = noulOf(answer) ?? 0;
  }
  return {
    add: (Object.keys(needs) as TraitName[]).filter((trait) => needs[trait]! >= at.add).sort(byTraitOrder),
    drop: Object.entries(drops)
      .filter(([, noul]) => noul >= at.drop)
      .map(([key]) => key.slice(key.indexOf(":") + 1)),
    needs,
    drops,
  };
}

/**
 * THE CARD, IN WORDS, FROM THE READING: each trait added with what its
 * module brings (`TRAIT_BRINGS`), the kinds kept, the kinds and traits
 * dropped, and what the drops lose as far as the seat can say. Pure, and
 * the same function answers a chip toggled on the card — the person's
 * `add` and `drop` in, the card out — so what they accept is always the
 * reading the card shows. The host composes the edits from that reading.
 */
export function reshapeCard(options: { readonly said: string; readonly document: GraviewDocument; readonly add: readonly TraitName[]; readonly drop: readonly string[] }): ReshapeProposal {
  const { said, document } = options;
  const add = [...new Set(options.add)].sort(byTraitOrder);
  const drop = [...new Set(options.drop)];
  const carried = traitsOfDocument(document);
  const adds: ReshapeChip[] = add.filter((trait) => !hasTrait(document, trait)).map((trait) => ({ what: "trait", name: trait, words: TRAIT_WORDS[trait], brings: TRAIT_BRINGS[trait] }));
  const already = add.filter((trait) => hasTrait(document, trait));
  const droppedKinds = Object.keys(document.kinds).filter((kind) => drop.includes(kind));
  const droppedTraits = carried.filter((trait) => drop.includes(trait.trait) && !Object.hasOwn(document.kinds, trait.trait));
  const drops: ReshapeChip[] = [
    ...droppedKinds.map((kind): ReshapeChip => ({ what: "kind", name: kind, words: pluralOf(document, kind) })),
    ...droppedTraits.map((trait): ReshapeChip => ({ what: "trait", name: trait.trait, words: TRAIT_WORDS[trait.trait] })),
  ];
  const keeps: ReshapeChip[] = Object.keys(document.kinds)
    .filter((kind) => !droppedKinds.includes(kind))
    .map((kind) => ({ what: "kind", name: kind, words: pluralOf(document, kind) }));
  const breaking = [
    ...droppedKinds.map((kind) => `All ${pluralOf(document, kind)} records go, with their links.`),
    ...droppedTraits.flatMap((trait) => {
      const carriers = [...trait.fields, ...trait.relations];
      return carriers.length > 0 ? [`What carries ${TRAIT_WORDS[trait.trait]} goes: ${listed(carriers)}, with its values and links.`] : [];
    }),
  ];
  const parts: string[] = [];
  if (adds.length > 0) parts.push(`adds ${listed(adds.map((chip) => chip.words))}`);
  if (drops.length > 0) parts.push(`drops ${listed(drops.map((chip) => chip.words))}`);
  if (keeps.length > 0) parts.push(`keeps ${listed(keeps.map((chip) => chip.words))}`);
  const sentence = adds.length + drops.length === 0 ? `Nothing in ${document.name} changes for that.` : `This ${listed(parts)}.`;
  const alreadySaid = already.length > 0 ? ` ${document.name} already has ${listed(already.map((trait) => TRAIT_WORDS[trait]))}.` : "";
  return { said, add: adds.map((chip) => chip.name as TraitName), drop: drops.map((chip) => chip.name), card: { said: `${sentence}${alreadySaid}`, adds, keeps, drops, breaking } };
}

/**
 * ONE TURN: the questions, the host's `decide`, the reading, the card. The
 * proposal is null when the reading adds and drops nothing — the words
 * asked for no change to the app's shape, and the seat says so or answers
 * them another way.
 */
export async function proposeReshape(options: { readonly said: string; readonly document: GraviewDocument; readonly decide: Decide; readonly thresholds?: ReshapeThresholds }): Promise<ReshapeTurn> {
  const { state, questions } = reshapeQuestions(options.said, options.document);
  const { answers, usage } = await options.decide(state, questions);
  const reading = readReshape(answers, options.thresholds ?? {});
  const made = reading.add.length + reading.drop.length === 0 ? null : reshapeCard({ said: options.said, document: options.document, add: reading.add, drop: reading.drop });
  const proposal = made && made.add.length + made.drop.length === 0 ? null : made;
  return { proposal, reading, answers, usage };
}
