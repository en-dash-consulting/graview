import { argumentsTaken, labelOf, nodeRefArgs, pluralOf, type AnySchema, type Store } from "@graview/core";
import type { AiTarget, PlanNeed } from "@graview/core/catalog";
import type { FastProvider } from "./ai.js";
import type { Answer } from "./fast.js";
import type { Question } from "./questions.js";

/**
 * A PLAN OVER THE GRAPH, DECIDED BY THE FAST SLOT (Roadmap
 * f-menu-type-anything). "Assign all these to Sam" is not an open question:
 * with a typed graph its parts are typed decisions Jev answers in one call —
 * which records (the list itself, or the records it holds), which act (or
 * none of them), which person (one the app has, or someone new), and what
 * the app would need where no act can do it — and code composes the plan
 * from the answers. The Thinking slot is not called when Jev is sure.
 *
 * THE READING IS EXPLICIT. On a record that holds others — a list, a
 * column, a group — "these", "all", "them", "each", "everything" mean the
 * records it holds, and "this" or its name the record itself. Code offers
 * both readings and the Fast slot picks; where the pick is close, the card
 * says which it took in a line a reply can flip.
 */

/** Which records the words are about: the target itself, or what it holds. */
export interface Reading {
  readonly which: "itself" | "held";
  readonly records: readonly string[];
  readonly kind: string;
  /** "the 6 tasks in This week", "This week itself". */
  readonly words: string;
  /** Whether the pick was close: the card then says the reading it took. */
  readonly close: boolean;
}

/** What the Fast slot decided, read by code: an act over the records, or what the app lacks — or not sure. */
export interface GraphDecision {
  readonly sure: boolean;
  readonly reading?: Reading;
  readonly each?: { readonly act: string; readonly args: Readonly<Record<string, unknown>> };
  readonly missing?: { readonly said: string; readonly need: PlanNeed; readonly who?: string };
  readonly text?: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

/** How sure the Fast slot must be to stand without the Thinking slot, and how sure before a reading goes unsaid. */
export const GRAPH_SURE = 0.6;
export const READING_SURE = 0.75;

const PEOPLE = new Set(["person", "people", "user", "users", "member", "members"]);
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
/** Verbs that give a record to someone, and how each says it was done. */
const GIVING: Readonly<Record<string, string>> = { assign: "assigned", give: "given", hand: "handed", delegate: "delegated", send: "sent", allocate: "allocated", route: "routed", pass: "passed" };

/** The record a target holds others of: the biggest group of records linked to it, of one kind other than its own. */
export function heldBy<S extends AnySchema>(store: Store<S>, id: string): { readonly kind: string; readonly ids: readonly string[] } | undefined {
  const self = store.graph.getNode(id);
  if (!self) return undefined;
  const groups = new Map<string, string[]>();
  for (const node of [...store.graph.in(id), ...store.graph.out(id)]) {
    if (node.kind === self.kind) continue;
    groups.set(node.kind, [...new Set([...(groups.get(node.kind) ?? []), node.id])]);
  }
  const biggest = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  return biggest && biggest[1].length > 1 ? { kind: biggest[0], ids: biggest[1] } : undefined;
}

/** The kinds that are the app's people: declared so, else by their words. */
function peopleKinds<S extends AnySchema>(store: Store<S>): readonly string[] {
  const schema = store.schema as AnySchema;
  const flagged = schema.definitions.filter((definition) => (definition as { people?: boolean }).people).map((definition) => definition.kind);
  if (flagged.length > 0) return flagged;
  return schema.definitions.filter((definition) => [definition.kind, (definition as { noun?: string }).noun, pluralOf(schema, definition.kind)].some((word) => word !== undefined && PEOPLE.has(word.toLowerCase()))).map((definition) => definition.kind);
}

/** The giving the words say, and to whom: "assign … to Sam" → "assigned to", "Sam". */
export function givingOf(words: string): { readonly called: string; readonly who?: string } | undefined {
  const who = /\bto\s+([\p{L}][\p{L}'’-]*)\s*[.!?]*\s*$/iu.exec(words)?.[1];
  const verb = words
    .toLowerCase()
    .split(/[^a-z]+/)
    .find((word) => word in GIVING);
  if (!verb) return undefined;
  return { called: `${GIVING[verb]} to`, ...(who ? { who: capital(who) } : {}) };
}

/** The fields that say a record is finished, read by a reply that narrows to the open ones. */
const DONE = ["done", "completed", "finished", "closed"];

/** The best of a Choice and how sure, or nothing. */
function best(answer: Answer | undefined): { readonly key: string; readonly chance: number } | undefined {
  if (answer?.type !== "choice") return undefined;
  const chance = answer.probabilities[answer.choice] ?? answer.confidence;
  return { key: answer.choice, chance };
}

export async function decideOverTheGraph<S extends AnySchema>(
  fast: FastProvider,
  options: { readonly store: Store<S>; readonly target: AiTarget; readonly said: string; readonly members?: readonly string[]; readonly follows?: { readonly said: string; readonly reading?: "itself" | "held" }; readonly where?: string },
): Promise<GraphDecision> {
  const { store, target, said } = options;
  const schema = store.schema as AnySchema;
  const words = `${said} ${options.follows?.said ?? ""}`.trim();
  /* THE READINGS: the record itself, and the records it holds (or the list's own records). */
  const self = target.on === "record" ? store.graph.getNode(target.id) : undefined;
  const held = self ? heldBy(store, self.id) : undefined;
  const listed = (options.members ?? []).filter((id) => store.graph.getNode(id) !== undefined);
  const readings: Reading[] = [];
  const where = options.where ? ` in ${options.where}` : self ? ` in ${labelOf(schema.tryDefinition(self.kind), self as never)}` : "";
  const plural = (kind: string) => pluralOf(schema, kind).toLowerCase();
  const noun = (kind: string) => ((schema.tryDefinition(kind) as { noun?: string } | undefined)?.noun ?? kind).toLowerCase();
  if (self) readings.push({ which: "itself", records: [self.id], kind: self.kind, words: `${labelOf(schema.tryDefinition(self.kind), self as never)} itself`, close: false });
  const all = held ?? (listed.length > 0 ? { kind: store.graph.getNode(listed[0]!)!.kind, ids: listed.filter((id) => store.graph.getNode(id)!.kind === store.graph.getNode(listed[0]!)!.kind) } : undefined);
  /* A reply that narrows ("only the open ones") keeps what is not done — read by code from the records, not by a model. */
  const open = /\b(open|not done|unfinished|left to do|still to do)\b/i.test(said) && options.follows !== undefined;
  const members = all && open ? { kind: all.kind, ids: all.ids.filter((id) => !DONE.some((field) => (store.graph.getNode(id) as Record<string, unknown> | undefined)?.[field] === true)) } : all;
  if (members && members.ids.length > 0) readings.push({ which: "held", records: members.ids, kind: members.kind, words: `the ${members.ids.length}${open ? " open" : ""} ${members.ids.length === 1 ? noun(members.kind) : plural(members.kind)}${where}`, close: false });
  /* A reply that only narrows or names the field keeps the reading it replies to; code holds it, the model is not asked again. */
  const renamed = /\bcall (?:it|that|the field)\s+["“']?([\p{L}][\p{L} ]*?)["”']?\s*[.!]*\s*$/iu.exec(said)?.[1];
  const kept = open ? "held" : renamed ? options.follows?.reading : undefined;
  if (kept && readings.some((one) => one.which === kept)) readings.splice(0, readings.length, ...readings.filter((one) => one.which === kept));
  if (readings.length === 0) return { sure: false, usage: { inputTokens: 0, outputTokens: 0 } };

  /* THE QUESTIONS, ONE CALL: which records, which act on them, which person, and — where none — what the app would need. */
  const questions: Record<string, Question> = {};
  if (readings.length > 1) questions["reading"] = { type: "choice", instructions: `Someone said “${said}”${options.follows ? `, replying to “${options.follows.said}”${options.follows.reading ? `, which was taken as ${options.follows.reading === "itself" ? "the record itself" : "the records it holds"}` : ""}` : ""}. On a record that holds others, "these", "all", "them", "each" and "everything" mean the records it holds; "this" or its name mean the record itself. Which do they mean?`, criteria: Object.fromEntries(readings.map((one) => [one.which, one.which === "itself" ? `${capital(one.words)} (the ${noun(one.kind)})` : capital(one.words)])) };
  const actsOn = (kind: string) =>
    store.allMutations().filter((mutation) => mutation.subject && (mutation.subject.kinds === "*" || (mutation.subject.kinds as readonly string[]).includes(kind)));
  const offered = readings.flatMap((reading) => actsOn(reading.kind).slice(0, 20).map((mutation) => ({ key: `${reading.which}:${mutation.name}`, reading, mutation })));
  questions["act"] = { type: "choice", instructions: `Which of these does “${words}” ask to be done? "none" where no act here can do it.`, criteria: { ...Object.fromEntries(offered.map((one) => [one.key, `${one.mutation.title ?? one.mutation.name} — on ${one.reading.which === "itself" ? `the ${noun(one.reading.kind)} itself` : `each of ${one.reading.words}`}`])), none: "None of these can do it" } };
  const people = peopleKinds(store).flatMap((kind) => store.graph.allNodes().filter((node) => node.kind === kind)).slice(0, 30);
  if (people.length > 0) questions["person"] = { type: "choice", instructions: `Whom does “${words}” name?`, criteria: { ...Object.fromEntries(people.map((node) => [`p:${node.id}`, labelOf(schema.tryDefinition(node.kind), node as never)])), new: "Someone not listed here", none: "Nobody is named" } };
  questions["need"] = { type: "choice", instructions: `If no act here can do “${words}”, what would each record need?`, criteria: { person: "A link to the person it is given or assigned to", other: "Something else: a field, a date, a number, a note", none: "Nothing: an act here can do it" } };

  const decided = await fast.decide({ said, ...(options.follows ? { replyingTo: options.follows.said } : {}), readings: readings.map((one) => one.words) }, questions);
  const reading0 = best(decided.answers["reading"]);
  const which = readings.length > 1 ? (reading0?.key === "itself" || reading0?.key === "held" ? reading0.key : undefined) : readings[0]!.which;
  const reading = readings.find((one) => one.which === which);
  if (!reading) return { sure: false, usage: decided.usage };
  const chosen = { ...reading, close: readings.length > 1 && (reading0?.chance ?? 1) < READING_SURE };
  const act = best(decided.answers["act"]);
  const person = best(decided.answers["person"]);
  const personId = person?.key.startsWith("p:") && person.chance >= GRAPH_SURE ? person.key.slice(2) : undefined;
  const given = givingOf(words);
  const giving = given && renamed ? { ...given, called: renamed.toLowerCase() } : given;
  const sureOfReading = readings.length === 1 || (reading0?.chance ?? 0) >= 0.5;
  if (!sureOfReading) return { sure: false, reading: chosen, usage: decided.usage };

  /* AN ACT CAN DO IT: over every record the reading names, its values filled from the graph — or not sure. */
  /* An act the words name: one of its title's words begins one of theirs ("finish" for "Finish it") — else not one to run without a model's word. */
  /* A kind's own name is not an act's name: "Change the task" is not named by "the tasks". */
  const nouns = new Set(readings.flatMap((one) => [noun(one.kind), noun(store.graph.getNode(String((options.target as { id?: string }).id ?? ""))?.kind ?? "")]).map((word) => word.toLowerCase().slice(0, 4)));
  const said4 = new Set(words.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4).map((word) => word.slice(0, 4)).filter((stem) => !nouns.has(stem)));
  const named = (title: string) => title.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((word) => word.length >= 4 && said4.has(word.slice(0, 4)));
  const kindsOfPeople = peopleKinds(store);
  const givesAPerson = (mutation: (typeof offered)[number]["mutation"]) => nodeRefArgs((mutation as { input?: unknown }).input).some((ref) => ref.kinds.some((kind) => kindsOfPeople.includes(kind)));
  /* Words that give a record to someone are done only by an act that takes a person. */
  const picked = act && act.key !== "none" && act.chance >= GRAPH_SURE ? offered.find((one) => one.key === act.key && one.reading.which === chosen.which && named(one.mutation.title ?? one.mutation.name) && (!giving || givesAPerson(one.mutation))) : undefined;
  if (picked) {
    const rest = (argumentsTaken(picked.mutation) ?? []).filter((arg) => arg !== picked.mutation.subject!.arg);
    const refs = nodeRefArgs((picked.mutation as { input?: unknown }).input);
    const args: Record<string, unknown> = {};
    for (const arg of rest) {
      const ref = refs.find((one) => one.name === arg);
      if (ref && personId && ref.kinds.includes(store.graph.getNode(personId)!.kind)) args[arg] = personId;
      else if (!ref?.optional) return { sure: false, reading: chosen, usage: decided.usage };
    }
    const title = picked.mutation.title ?? picked.mutation.name;
    return { sure: true, reading: chosen, each: { act: picked.mutation.name, args }, text: `${capital(title)} — ${chosen.records.length === 1 ? `on ${chosen.words}` : `each of ${chosen.words}`}.`, usage: decided.usage };
  }

  /* NONE CAN: what the app lacks, in words, and the need — a link to the person the words name. */
  const need = best(decided.answers["need"]);
  /* Code, not the model's wording, says whether an act here can give a record to a person: one that takes a person on this reading's records. */
  const anActGives = offered.some((one) => one.reading.which === chosen.which && givesAPerson(one.mutation));
  const noneCan = (act?.key === "none" && act.chance >= GRAPH_SURE) || !anActGives;
  if (noneCan && need?.key === "person" && need.chance >= GRAPH_SURE && giving) {
    const who = personId ? labelOf(schema.tryDefinition(store.graph.getNode(personId)!.kind), store.graph.getNode(personId) as never) : giving.who;
    if (!who) return { sure: false, reading: chosen, usage: decided.usage };
    const lacks = renamed ? `${capital(plural(chosen.kind))} have no ${giving.called}.` : `${capital(plural(chosen.kind))} have no one ${giving.called} them.`;
    return { sure: true, reading: chosen, missing: { said: lacks, need: { link: { on: chosen.kind, called: giving.called, to: "person" } }, who }, text: lacks, usage: decided.usage };
  }
  return { sure: false, reading: chosen, usage: decided.usage };
}

