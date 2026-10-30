import { argumentsTaken, labelOf, nodeRefArgs, pluralOf, withArticle, type AnySchema, type Store } from "@graview/core";
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
  /** A question back to the person before anything is offered: which records a destructive act was meant for. */
  readonly clarify?: string;
  /** The act Jev leaned to where code could not fill its values: the light model is told it first. */
  readonly act?: string;
  /** A person said as a pronoun, and whom it was taken as: "her" as Nora — said on the card so a reply can correct it. */
  readonly taken?: { readonly said: string; readonly as: string };
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

/** How sure the Fast slot must be to stand without the Thinking slot, and how sure before a reading goes unsaid. */
export const GRAPH_SURE = 0.6;
export const READING_SURE = 0.75;

const PEOPLE = new Set(["person", "people", "user", "users", "member", "members", "volunteer", "volunteers", "staff", "contact", "contacts", "employee", "employees", "client", "clients", "customer", "customers", "guest", "guests", "player", "players", "student", "students"]);
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
/** Verbs that give a record to someone. */
const GIVING: Readonly<Record<string, true>> = { assign: true, reassign: true, give: true, hand: true, delegate: true, allocate: true };

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
  // Declared so, and those whose words say so (the rota's volunteers beside its users).
  return [...new Set([...flagged, ...schema.definitions.filter((definition) => [definition.kind, (definition as { noun?: string }).noun, pluralOf(schema, definition.kind)].some((word) => word !== undefined && PEOPLE.has(word.toLowerCase()))).map((definition) => definition.kind)])];
}

/** The giving the words say, and to whom: "assign … to Sam" → "assigned to", "Sam". */
export function givingOf(words: string): { readonly called: string; readonly who?: string; readonly owned?: boolean } | undefined {
  // A person named without "to": "Sam should take care of these", "make this Nora's job", "these are Ada's".
  const owner =
    /^\s*([\p{L}][\p{L}'’-]*)\s+(?:should|can|will|could|is going to|needs to)\s+(?:take care of|handle|own|do|look after|take|deal with|pick up|be on)\b/iu.exec(words)?.[1] ??
    /\bmake\s+(?:this|these|it|them|this one)\s+([\p{L}][\p{L}-]*)['’]s\b/iu.exec(words)?.[1] ??
    /\b(?:this|these|it|they)\s+(?:is|are)\s+([\p{L}][\p{L}-]*)['’]s\b/iu.exec(words)?.[1] ??
    /\b([\p{L}][\p{L}-]*)['’]s\s+(?:job|task|responsibility|shift|now)\b/iu.exec(words)?.[1];
  if (owner && !/^(it|this|that|these|those|they|we|you|i|everyone|someone|nobody|it's|that's)$/i.test(owner)) return { called: "assigned to", who: capital(owner), owned: true };
  const who = /\bto\s+([\p{L}][\p{L}'’-]*)\s*[.!?]*\s*$/iu.exec(words)?.[1];
  const verb = words
    .toLowerCase()
    .split(/[^a-z]+/)
    .find((word) => word in GIVING);
  if (!verb) return undefined;
  // The link is named by its role, whatever verb was typed: "give this to Nora" and "assign it to Nora" both want "assigned to".
  return { called: "assigned to", ...(who ? { who: capital(who) } : {}) };
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
  options: { readonly store: Store<S>; readonly target: AiTarget; readonly said: string; readonly members?: readonly string[]; readonly follows?: { readonly said: string; readonly reading?: "itself" | "held" }; readonly where?: string; readonly principal?: { readonly id: string } },
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
  const { open, finished } = narrowingOf(said, options.follows !== undefined);
  const isDone = (id: string) => DONE.some((field) => (store.graph.getNode(id) as Record<string, unknown> | undefined)?.[field] === true);
  const members = all && (open || finished) ? { kind: all.kind, ids: all.ids.filter((id) => (finished ? isDone(id) : !isDone(id))) } : all;
  if (members && members.ids.length > 0) readings.push({ which: "held", records: members.ids, kind: members.kind, words: `the ${members.ids.length}${open ? " open" : finished ? " done" : ""} ${members.ids.length === 1 ? noun(members.kind) : plural(members.kind)}${where}`, close: false });
  /* A reply that only narrows or names the field keeps the reading it replies to; code holds it, the model is not asked again. */
  // "Call it owner" in a reply names the link the plan before it adds; said first, "call it X" renames the record.
  const renamed = options.follows ? /\bcall (?:it|that|the field)\s+["“']?([\p{L}][\p{L} ]*?)["”']?\s*[.!]*\s*$/iu.exec(said)?.[1] : undefined;
  const kept = open || finished ? "held" : renamed ? options.follows?.reading : undefined;
  if (kept && readings.some((one) => one.which === kept)) readings.splice(0, readings.length, ...readings.filter((one) => one.which === kept));
  if (readings.length === 0) return { sure: false, usage: { inputTokens: 0, outputTokens: 0 } };

  /* THE QUESTIONS, ONE CALL: which records, which act on them (said by what it does), which record the words name, and — where none — what the app would need. */
  const questions: Record<string, Question> = {};
  if (readings.length > 1) questions["reading"] = { type: "choice", instructions: `Someone said “${said}”${options.follows ? `, replying to “${options.follows.said}”${options.follows.reading ? `, which was taken as ${options.follows.reading === "itself" ? "the record itself" : "the records it holds"}` : ""}` : ""}. On a record that holds others, "these", "all", "them", "each", "everything", "the lot", "every one", "the whole list" and "the … ones" mean the records it holds; "this" or its name mean the record itself. Which do they mean?`, criteria: Object.fromEntries(readings.map((one) => [one.which, one.which === "itself" ? `${capital(one.words)} (the ${noun(one.kind)})` : capital(one.words)])) };
  const actsOn = (kind: string) =>
    store.allMutations().filter((mutation) => mutation.subject && (mutation.subject.kinds === "*" || (mutation.subject.kinds as readonly string[]).includes(kind)));
  const offered = readings.flatMap((reading) => actsOn(reading.kind).slice(0, 24).map((mutation) => ({ key: `${reading.which}:${mutation.name}`, reading, mutation })));
  questions["act"] = {
    type: "choice",
    instructions: `Which of these acts does “${words}” ask to be done? Judge each by what it does, not only its title: people say "close", "complete", "check off", "tick" or "finish" for an act that marks something done, "delete" for one that removes, "push" or "move" for one that changes a date or a place. A question, or "undo that", is none of them. "none" only where no act here does it.`,
    criteria: { ...Object.fromEntries(offered.map((one) => [one.key, `${one.mutation.title ?? one.mutation.name}: ${sentenceOf((one.mutation as { description?: string }).description)}${effectOf(one.mutation, schema, one.reading.kind)} — on ${one.reading.which === "itself" ? `the ${noun(one.reading.kind)} itself` : `each of ${one.reading.words}`}`])), none: "None of these acts does it" },
  };
  /* The records the words may name: the app's people, and records of the kinds the acts here take — those whose names the words share, where there are many. */
  const kindsOfPeople = peopleKinds(store);
  const refKinds = new Set([...kindsOfPeople, ...offered.flatMap((one) => nodeRefArgs((one.mutation as { input?: unknown }).input).filter((ref) => ref.name !== one.mutation.subject!.arg).flatMap((ref) => ref.kinds))]);
  const ofRefKinds = store.graph.allNodes().filter((node) => refKinds.has(node.kind) || refKinds.has("*"));
  const stems = new Set(words.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3).map((word) => word.slice(0, 4)));
  const labeled = (node: { readonly kind: string }) => labelOf(schema.tryDefinition(node.kind), node as never);
  const nameable = (ofRefKinds.length <= 25 ? ofRefKinds : ofRefKinds.filter((node) => labeled(node).toLowerCase().split(/[^\p{L}\p{N}]+/u).some((word) => word.length >= 3 && stems.has(word.slice(0, 4))))).filter((node) => node.id !== self?.id && !readings.some((one) => one.records.includes(node.id))).slice(0, 25);
  /*
   * PEOPLE SAID AS PRONOUNS. "Me", "my", "mine", "myself" are the person at
   * the seat: their own record, or the record of a kind an act takes that
   * bears their name. "Her", "him", "them", "that person" are someone the
   * context gives: a person the record links, the one named in the turn
   * before. One is taken; several, Jev chooses — and the card says whom.
   */
  const meAt = MINE.test(said) ? principalRecord(store, options.principal, refKinds) : undefined;
  const meName = MINE.test(said) && options.principal ? nameOfRecord(store, options.principal.id) : undefined;
  const theirsSaid = THEIRS.exec(said);
  const pronoun = (theirsSaid?.[1] ?? theirsSaid?.[2])?.toLowerCase();
  const fromContext = pronoun ? contextPeople(store, self?.id, options.follows?.said, kindsOfPeople) : [];
  if (pronoun && fromContext.length > 1) questions["pronoun"] = { type: "choice", instructions: `In “${said}”${options.follows ? `, said after “${options.follows.said}”` : ""}, whom does “${pronoun}” mean?`, criteria: { ...Object.fromEntries(fromContext.map((node) => [`r:${node.id}`, labeled(node)])), else: "Someone else" } };
  if (nameable.length > 0) questions["named"] = { type: "choice", instructions: `Which of these does “${words}” name, as the one to give it to, move it to, link it with or put it on?`, criteria: { ...Object.fromEntries(nameable.map((node) => [`r:${node.id}`, `${labeled(node)} (${withArticle(noun(node.kind))})`])), new: "Someone or something not listed here", none: "None is named" } };
  questions["need"] = { type: "choice", instructions: `If no act here can do “${words}”, what would each record need?`, criteria: { person: "A link to the person it is given or assigned to", other: "Something else: a field, a date, a number, a note", none: "Nothing: an act here can do it" } };

  const decided = await fast.decide({ said, ...(options.follows ? { replyingTo: options.follows.said } : {}), readings: readings.map((one) => one.words) }, questions);
  const reading0 = best(decided.answers["reading"]);
  const which = readings.length > 1 ? (reading0?.key === "itself" || reading0?.key === "held" ? reading0.key : undefined) : readings[0]!.which;
  const reading = readings.find((one) => one.which === which);
  if (!reading) return { sure: false, usage: decided.usage };
  const chosen = { ...reading, close: readings.length > 1 && (reading0?.chance ?? 1) < READING_SURE };
  const act = best(decided.answers["act"]);
  const named = best(decided.answers["named"]);
  const chosenPronoun = best(decided.answers["pronoun"]);
  const theirs = pronoun ? (fromContext.length === 1 ? fromContext[0] : chosenPronoun?.key.startsWith("r:") ? store.graph.getNode(chosenPronoun.key.slice(2)) : undefined) : undefined;
  const taken = pronoun && theirs ? { said: pronoun, as: labeled(theirs) } : undefined;
  const namedNode = meAt ?? theirs ?? (named?.key.startsWith("r:") && named.chance >= GRAPH_SURE ? store.graph.getNode(named.key.slice(2)) : undefined);
  // The person the words give it to: said here, else in the turn before; a pronoun, as the context took it.
  const givenHere = givingOf(said) ?? givingOf(words);
  const whoSaid = givenHere?.who && (MINE.test(givenHere.who) ? meAt ? labeled(meAt) : meName : THEIRS_WORD.test(givenHere.who) ? (theirs ? labeled(theirs) : undefined) : givenHere.who);
  const given = givenHere ? { called: givenHere.called, ...(whoSaid ? { who: whoSaid } : {}), ...(givenHere.owned ? { owned: true } : {}) } : undefined;
  const giving = given && renamed ? { ...given, called: renamed.toLowerCase() } : given;
  const sureOfReading = readings.length === 1 || (reading0?.chance ?? 0) >= 0.5;
  if (!sureOfReading) return { sure: false, reading: chosen, usage: decided.usage };

  /* AN ACT CAN DO IT: the one Jev picked, on the reading's records, its values filled from the graph — else the light model fills them. */
  const takesRefTo = (mutation: (typeof offered)[number]["mutation"], kinds: readonly string[]) => nodeRefArgs((mutation as { input?: unknown }).input).some((ref) => ref.name !== mutation.subject!.arg && (ref.kinds.includes("*") || ref.kinds.some((kind) => kinds.includes(kind))));
  const giveTo = [...kindsOfPeople, ...(namedNode ? [namedNode.kind] : [])];
  /* A question, or "undo that", is not an act to propose: the light model answers it in words. */
  if (asking(said) || UNDOING.test(said)) return { sure: false, reading: chosen, usage: decided.usage };
  const ranks = actRanks(decided.answers["act"]);
  const onReading = (name: string) => offered.find((one) => one.mutation.name === name && one.reading.which === chosen.which);
  const removes = (one: (typeof offered)[number] | undefined) => Boolean(one && ((one.mutation as { destructive?: boolean }).destructive || (one.mutation as { derived?: { act?: string } }).derived?.act === "remove"));
  let mutationName = act && act.key !== "none" ? act.key.slice(act.key.indexOf(":") + 1) : undefined;
  let sureOfAct = act !== undefined && act.key !== "none" && act.chance >= GRAPH_SURE;
  // Two acts that do the same thing ("Drop it", "Remove the task") split Jev's chance between them: together they are sure.
  if (!sureOfAct && ranks.length > 1 && ranks[0]!.chance + ranks[1]!.chance >= 0.8 && removes(onReading(ranks[0]!.name)) && removes(onReading(ranks[1]!.name))) sureOfAct = true;
  // The record the words name decides between acts: "move this to Someday" names a list, so the act that takes a list.
  if (mutationName && namedNode && onReading(mutationName) && !takesRefTo(onReading(mutationName)!.mutation, [namedNode.kind])) {
    // An act whose values code cannot fill ("Move the date" wants a date) gives way to one that takes the record named, when it is named surely.
    const leaning = onReading(mutationName)!.mutation as { input?: { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> } };
    const refNames = new Set(nodeRefArgs(leaning.input).map((ref) => ref.name));
    const wantsAValue = Object.entries(leaning.input?.shape ?? {}).some(([arg, field]) => !refNames.has(arg) && !field.safeParse(undefined).success && !field.safeParse(calledTo(said)).success);
    const floor = named && named.chance >= 0.9 && wantsAValue ? 0 : 0.05;
    const taking = ranks.filter((one) => one.chance >= floor).map((one) => onReading(one.name)).find((one) => one && (one.mutation as { derived?: { act?: string } }).derived?.act !== "merge" && takesRefTo(one.mutation, [namedNode.kind]));
    if (taking) {
      mutationName = taking.mutation.name;
      sureOfAct = true;
    }
  }
  // Given to a person code resolved (a pronoun, "me", "X should…"), and one act here takes them: that act, whatever Jev weighed.
  if (!sureOfAct && namedNode && giving?.who && (taken || meAt || giving.owned)) {
    const takers = offered.filter((one) => one.reading.which === chosen.which && (one.mutation as { derived?: { act?: string } }).derived?.act !== "merge" && nodeRefArgs((one.mutation as { input?: unknown }).input).some((ref) => ref.name !== one.mutation.subject!.arg && sameAs(store, namedNode, ref.kinds) !== undefined && kindsOfPeople.some((kind) => ref.kinds.includes(kind))));
    if (takers.length === 1) {
      mutationName = takers[0]!.mutation.name;
      sureOfAct = true;
    }
  }
  // A record the words name, and one act here that takes it, likely enough: that act ("give this to her" — Ada — is "Cover it").
  if (!sureOfAct && namedNode) {
    const taking = ranks.filter((one) => one.chance >= 0.3).map((one) => onReading(one.name)).find((one) => one && (one.mutation as { derived?: { act?: string } }).derived?.act !== "merge" && nodeRefArgs((one.mutation as { input?: unknown }).input).some((ref) => ref.name !== one.mutation.subject!.arg && sameAs(store, namedNode, ref.kinds) !== undefined));
    if (taking) {
      mutationName = taking.mutation.name;
      sureOfAct = true;
    }
  }
  /* A RENAME SAID AS A STATEMENT ("the name should be X", "call it X", "X is a better name"): the act that writes the record's name, on the record itself, its value the words' — read by code. */
  const newName = renamed === undefined ? renameOf(said) : undefined;
  const itself = readings.find((one) => one.which === "itself");
  if (newName && itself) {
    // The act that names the record: it takes one value besides the record, and that value is its name (it writes it, or the argument is called so).
    const NAMES = ["label", "name", "title"];
    const naming = offered.find((one) => {
      const rest = (argumentsTaken(one.mutation) ?? []).filter((arg) => arg !== one.mutation.subject!.arg);
      return one.reading.which === "itself" && rest.length === 1 && (NAMES.includes(rest[0]!) || ((one.mutation as { writes?: readonly string[] }).writes ?? []).some((field) => NAMES.includes(field)));
    });
    const arg = naming ? (argumentsTaken(naming.mutation) ?? []).find((one) => one !== naming.mutation.subject!.arg) : undefined;
    const field = arg ? ((naming!.mutation as { input?: { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> } }).input?.shape ?? {})[arg] : undefined;
    if (naming && arg && field?.safeParse(newName).success) {
      return { sure: true, reading: { ...itself, close: false }, each: { act: naming.mutation.name, args: { [arg]: newName } }, usage: decided.usage };
    }
  }
  // Jev's act on the other reading ("Archive the list" where the words meant the tasks): the same act on the reading chosen.
  if (mutationName && !onReading(mutationName)) {
    const meant = offered.find((one) => one.mutation.name === mutationName);
    const same = (other: (typeof offered)[number]) => {
      const a = (meant?.mutation as { derived?: { act?: string } } | undefined)?.derived?.act;
      const b = (other.mutation as { derived?: { act?: string } }).derived?.act;
      return a !== undefined ? a === b : (other.mutation.title ?? other.mutation.name).split(/\s+/)[0]!.toLowerCase() === (meant?.mutation.title ?? mutationName ?? "").split(/\s+/)[0]!.toLowerCase();
    };
    const twin = offered.find((one) => one.reading.which === chosen.which && same(one));
    if (twin) mutationName = twin.mutation.name;
  }
  const picked = mutationName && sureOfAct ? onReading(mutationName) : undefined;
  // Words that give a record to someone are done only by an act that takes them.
  if (picked && !(giving?.who && !takesRefTo(picked.mutation, giveTo))) {
    const rest = (argumentsTaken(picked.mutation) ?? []).filter((arg) => arg !== picked.mutation.subject!.arg);
    const refs = nodeRefArgs((picked.mutation as { input?: unknown }).input);
    const shape = ((picked.mutation as { input?: { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> } }).input?.shape ?? {}) as Record<string, { safeParse(value: unknown): { success: boolean } }>;
    const args: Record<string, unknown> = {};
    let complete = true;
    for (const arg of rest) {
      const ref = refs.find((one) => one.name === arg);
      const optional = ref ? ref.optional : (shape[arg]?.safeParse(undefined).success ?? true);
      const meant = ref && namedNode ? sameAs(store, namedNode, ref.kinds) : undefined;
      if (ref && meant) args[arg] = meant.id;
      else if (!ref && !optional && rest.filter((one) => !refs.some((r) => r.name === one)).length === 1 && calledTo(said) !== undefined && shape[arg]?.safeParse(calledTo(said)).success) args[arg] = calledTo(said);
      else if (!optional) complete = false;
    }
    // A change that changes nothing (an edit with no value) is not an answer.
    if ((picked.mutation as { derived?: { act?: string } }).derived?.act === "edit" && Object.keys(args).length === 0) complete = false;
    if (!complete) return { sure: false, reading: chosen, ...(taken ? { taken } : {}), act: picked.mutation.name, usage: decided.usage };
    /*
     * A DESTRUCTIVE ACT OVER SEVERAL NEEDS A CLEAR READING. "Drop the ones
     * I've done" once proposed dropping all 6 tasks: an act that removes or
     * sets aside is offered over more than one record only where the words
     * said which (all of them, or the done or open ones) or Jev was sure of
     * the reading; else the card asks which.
     */
    if (removing(picked.mutation) && chosen.records.length > 1 && !explicitReading(said) && (unreadNarrowing(said) || !(reading0 && reading0.chance >= 0.9))) {
      return { sure: true, reading: chosen, clarify: whichOf(store, picked.mutation.title ?? picked.mutation.name, chosen), usage: decided.usage };
    }
    return { sure: true, reading: chosen, ...(taken ? { taken } : {}), each: { act: picked.mutation.name, args }, usage: decided.usage };
  }

  /* NONE CAN: code, not the model's wording, says no act here gives these records to someone — and only then what the app lacks: a link to the person the words name. */
  const need = best(decided.answers["need"]);
  const anActGives = offered.some((one) => one.reading.which === chosen.which && takesRefTo(one.mutation, giveTo));
  if (giving?.who && !anActGives && ((need?.key === "person" && need.chance >= GRAPH_SURE) || meAt !== undefined || meName !== undefined || taken !== undefined || giving.owned === true)) {
    const who = giving.who ?? (namedNode && kindsOfPeople.includes(namedNode.kind) ? labeled(namedNode) : undefined);
    if (!who) return { sure: false, reading: chosen, usage: decided.usage };
    const lacks = renamed ? `${capital(plural(chosen.kind))} have no ${giving.called}.` : `${capital(plural(chosen.kind))} have no one ${giving.called} them.`;
    return { sure: true, reading: chosen, ...(taken ? { taken } : {}), missing: { said: lacks, need: { link: { on: chosen.kind, called: giving.called, to: "person" } }, who }, text: lacks, usage: decided.usage };
  }
  return { sure: false, reading: chosen, ...(taken ? { taken } : {}), ...(mutationName && act && act.chance >= 0.3 ? { act: mutationName } : {}), usage: decided.usage };
}

/** "Me", "my", "mine", "myself": the person at the seat. */
const MINE = /\b(me|my|mine|myself)\b/i;
/** Someone the context gives, where the words name a person by a pronoun. */
const THEIRS = /\b(?:to|off|from|for|with)\s+(her|him|them|that person|whoever)\b|\b(?:take|put|move|swap|drop)\s+(her|him)\b/i;
const THEIRS_WORD = /^(her|him|them|they|that person|whoever)$/i;

/** The seat's own record: theirs by id, else one of a kind an act takes that bears their name. */
function principalRecord<S extends AnySchema>(store: Store<S>, principal: { readonly id: string } | undefined, kinds: ReadonlySet<string>): { readonly id: string; readonly kind: string } | undefined {
  if (!principal) return undefined;
  const own = store.graph.getNode(principal.id);
  const name = own ? labelOf((store.schema as AnySchema).tryDefinition(own.kind), own as never).toLowerCase() : undefined;
  const bearing = name ? store.graph.allNodes().find((node) => node.id !== principal.id && kinds.has(node.kind) && labelOf((store.schema as AnySchema).tryDefinition(node.kind), node as never).toLowerCase() === name) : undefined;
  // A record of a kind an act takes comes first ("take this off me": the volunteer, not the user).
  return bearing ?? (own && kinds.has(own.kind) ? own : own);
}

/** What the seat is called, from its record. */
function nameOfRecord<S extends AnySchema>(store: Store<S>, id: string): string | undefined {
  const node = store.graph.getNode(id);
  return node ? labelOf((store.schema as AnySchema).tryDefinition(node.kind), node as never) : undefined;
}

/** The people a pronoun may mean: those the record links, then those the turn before names. */
function contextPeople<S extends AnySchema>(store: Store<S>, id: string | undefined, before: string | undefined, kinds: readonly string[]): readonly { readonly id: string; readonly kind: string }[] {
  const schema = store.schema as AnySchema;
  const linked = id ? [...store.graph.in(id), ...store.graph.out(id)].filter((node) => kinds.includes(node.kind)) : [];
  const words = (before ?? "").toLowerCase();
  const named = words ? store.graph.allNodes().filter((node) => kinds.includes(node.kind) && labelOf(schema.tryDefinition(node.kind), node as never).toLowerCase().split(/\s+/).some((word) => word.length >= 3 && new RegExp(`\\b${word.replace(/[^\p{L}\p{N}]/gu, "")}\\b`, "u").test(words))) : [];
  // The turn before names whom it means; the record's own links are the rest.
  const all = [...named, ...linked];
  // One person once: the user Ada and the volunteer Ada are one Ada.
  const nameOf = (node: { readonly id: string; readonly kind: string }) => labelOf(schema.tryDefinition(node.kind), node as never).toLowerCase();
  return all.filter((node, index) => all.findIndex((other) => nameOf(other) === nameOf(node)) === index).slice(0, 8);
}

/** The record the words mean, as a kind an act takes: itself, or the one of that kind bearing its name (the user Ada as the volunteer Ada). */
function sameAs<S extends AnySchema>(store: Store<S>, node: { readonly id: string; readonly kind: string }, kinds: readonly string[]): { readonly id: string; readonly kind: string } | undefined {
  if (kinds.includes("*") || kinds.includes(node.kind)) return node;
  const schema = store.schema as AnySchema;
  const name = labelOf(schema.tryDefinition(node.kind), store.graph.getNode(node.id) as never).toLowerCase();
  return store.graph.allNodes().find((other) => kinds.includes(other.kind) && labelOf(schema.tryDefinition(other.kind), other as never).toLowerCase() === name);
}

/**
 * TWO ASKS IN ONE SENTENCE: "archive the done ones, then close the rest" is
 * two parts, each an instruction of its own. Split at "and", "then", ", then"
 * or "; " only where each side begins with a verb-like word and says more
 * than a word — so "assign these to Sam and Nora" and "rename it to Pack and
 * Go" stay one.
 */
export function askedParts(said: string): readonly string[] {
  const parts = said
    .split(/\s*(?:,\s*and then|,\s*then|\band then\b|;|\bthen\b|,?\s+and\s+)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return [said];
  const NOT_A_VERB = /^(the|a|an|my|our|your|this|these|that|those|all|every|each|some|it|them|they|he|she|i|we|you|to|for|with|on|in|at|by|of|from|tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
  const instruction = (part: string) => {
    const words = part.split(/\s+/);
    return words.length >= 2 && /^[a-z]/.test(words[0]!) && !NOT_A_VERB.test(words[0]!);
  };
  return parts.every(instruction) ? parts : [said];
}

/**
 * WORDS THAT NARROW TO DONE OR OPEN RECORDS, however they are said:
 * "finished", "completed", "the done stuff", "ones I've done", "outstanding",
 * "remaining", "unfinished", "still to do". A bare "open" ("open this") is a
 * verb unless a reply narrows with it.
 */
export function narrowingOf(said: string, replying = false): { readonly open: boolean; readonly finished: boolean } {
  const words = said.toLowerCase();
  const finished =
    /\b(done|finished|completed|complete|closed|ticked|checked)( off)? (ones?|tasks?|items?|stuff|things|bits)\b/.test(words) ||
    /\b(ones?|tasks?|items?|things|stuff) (i'?ve|we'?ve|i have|we have|that are|that'?s|already) (done|finished|completed|closed|ticked off)\b/.test(words) ||
    /\balready (done|finished|completed)\b/.test(words) ||
    /\bthe (finished|completed)\b/.test(words);
  const open =
    /\b(outstanding|remaining|unfinished|undone|incomplete|pending)\b/.test(words) ||
    /\b(still to do|left to do|not done|not finished|not yet done)\b/.test(words) ||
    /\b(open) (ones?|tasks?|items?|stuff|things)\b/.test(words) ||
    (replying && /\bopen\b/.test(words));
  return finished && open ? { open: false, finished: false } : { open, finished };
}

/** Whether the words say which records: all of them, or the done or open ones. */
export function explicitReading(said: string): boolean {
  const { open, finished } = narrowingOf(said);
  if (open || finished) return true;
  // A word that narrows in a way code does not read ("the old ones", "the big tasks") leaves the reading unclear, however sure Jev is.
  if (unreadNarrowing(said)) return false;
  return /\b(all|every|each|everything|the lot|the whole (list|lot)|every one|both|these|those)\b/i.test(said);
}

/** "The old ones", "the urgent tasks": a word narrowing the records that is neither done nor open — code cannot say which those are. */
export function unreadNarrowing(said: string): boolean {
  const found = /\bthe ([a-z]+) (ones?|tasks?|items?|stuff|things|shifts?|songs?)\b/i.exec(said)?.[1]?.toLowerCase();
  return found !== undefined && !["other", "rest", "whole", "same"].includes(found) && !narrowingOf(`the ${found} ones`).open && !narrowingOf(`the ${found} ones`).finished;
}

/** An act that removes or sets aside: one that must be meant for exactly the records it takes. */
export function removing(mutation: { readonly destructive?: boolean; readonly derived?: { readonly act?: string } }): boolean {
  return mutation.destructive === true || mutation.derived?.act === "remove" || mutation.derived?.act === "archive";
}

/** The question back: "Should I drop the 1 done task, or all 6 tasks in This week?" */
function whichOf<S extends AnySchema>(store: Store<S>, title: string, reading: Reading): string {
  const schema = store.schema as AnySchema;
  const verb = title.trim().split(/\s+/)[0]!.toLowerCase();
  const isDone = (id: string) => DONE.some((field) => (store.graph.getNode(id) as Record<string, unknown> | undefined)?.[field] === true);
  const done = reading.records.filter(isDone);
  const noun = ((schema.tryDefinition(reading.kind) as { noun?: string } | undefined)?.noun ?? reading.kind).toLowerCase();
  const many = pluralOf(schema, reading.kind).toLowerCase();
  const where = / (in .+)$/.exec(reading.words)?.[1];
  const all = `all ${reading.records.length} ${many}${where ? ` ${where}` : ""}`;
  if (done.length > 0 && done.length < reading.records.length) return `Should I ${verb} the ${done.length} done ${done.length === 1 ? noun : many}, or ${all}?`;
  return `Should I ${verb} ${all}? Say “all” to go ahead, or say which.`;
}

/** Words that ask rather than tell: a question to answer, not an act to propose. */
export function asking(said: string): boolean {
  // Said politely or indirectly, it is still an instruction: "could you close these", "please…", "I'd like…", "X should…", "can we…".
  if (politely(said)) return false;
  // "Do" asks only with a subject after it ("do we have…"); "do what is left" tells.
  return /\?\s*$/.test(said) || /^\s*(who|whom|whose|what|whats|what's|when|where|which|why|how|is|are|was|were|can|could|should|any|anything|tell me|show me|list)\b/i.test(said) || /^\s*(do|does|did)\s+(you|we|i|they|it|he|she|anyone|anybody|any)\b/i.test(said);
}

/** An instruction said politely or indirectly: a request, not a question to answer in words. */
export function politely(said: string): boolean {
  const words = said.trim().toLowerCase();
  if (/^(please|pls|kindly)\b/.test(words)) return true;
  if (/^(could|can|would|will) (you|we|u)\s+(please\s+)?(?!tell|say|explain|show me what|see)\w+/.test(words) && !/^(could|can|would|will) (you|we) (be|have)\b/.test(words)) return true;
  if (/^(i'?d like|i would like|i want|i need|let'?s|we should|we need to)\b/.test(words)) return true;
  // "These should be marked done", "Sam should take care of these": what ought to be, said of the records or of a person.
  if (/^[\p{L}'’]+(\s[\p{L}'’]+)?\s+(should|needs to|need to|has to|have to|ought to)\s+(be\s+)?\w+/u.test(words) && !/^(what|who|which|when|where|why|how|is|are|do|does)\b/.test(words)) return true;
  return false;
}

/** A rename said as a statement: "name should be X", "call it X", "X is a better name", "rename it to X" → "X". */
export function renameOf(said: string): string | undefined {
  const text = said.trim().replace(/[.!]+$/, "");
  const forms = [
    /^(?:the\s+|its\s+|this\s+|list\s+|task\s+)*name\s+should\s+be\s+["“']?(.+?)["”']?$/i,
    /^(?:please\s+)?call\s+(?:this one|this list|this task|this shift|this song|it|this)\s+["“']?(.+?)["”']?$/i,
    /^["“']?(.+?)["”']?\s+is\s+a\s+better\s+name$/i,
    /^(?:please\s+)?(?:re)?name\s+(?:this one|this list|this task|this shift|this song|it|this)\s+(?:to\s+|as\s+)?["“']?(.+?)["”']?$/i,
    /^(?:let'?s\s+)?call\s+(?:it|this)\s+["“']?(.+?)["”']?$/i,
  ];
  for (const form of forms) {
    const found = form.exec(text)?.[1]?.trim();
    if (found) return found;
  }
  return undefined;
}

/** "Undo that": the app's own undo takes back the last change; no act here does. */
export const UNDOING = /^\s*(undo|take (that|it) back|revert|go back)\b/i;

/** The one value the words give "to" or "as": "rename this to Packing" → "Packing". */
function calledTo(said: string): string | undefined {
  const value = /\b(?:to|as)\s+["“']?(.+?)["”']?\s*[.!]?\s*$/i.exec(said)?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Every act Jev weighed, likeliest first, with how likely. */
function actRanks(answer: Answer | undefined): readonly { readonly name: string; readonly chance: number }[] {
  if (answer?.type !== "choice") return [];
  return Object.entries(answer.probabilities)
    .filter(([key]) => key !== "none")
    .sort((a, b) => b[1] - a[1])
    .map(([key, chance]) => ({ name: key.slice(key.indexOf(":") + 1), chance }));
}

/** A description as the end of a sentence: its own words, a space after. */
function sentenceOf(description: string | undefined): string {
  const said = description?.trim();
  return said ? `${said}${/[.!?]$/.test(said) ? "" : "."} ` : "";
}

/** What an act does, said from what it declares: the fields it writes, the links it makes and breaks, what it makes or removes. */
export function effectOf(mutation: { readonly name: string; readonly writes?: readonly string[]; readonly sets?: Readonly<Record<string, unknown>>; readonly connects?: readonly string[]; readonly severs?: readonly string[]; readonly creates?: readonly string[]; readonly destructive?: boolean; readonly derived?: { readonly act?: string }; readonly input?: unknown; readonly subject?: { readonly arg: string } }, schema: AnySchema, kind: string): string {
  const parts: string[] = [];
  const args = (argumentsTaken(mutation as never) ?? []).filter((arg) => arg !== mutation.subject?.arg);
  const refs = nodeRefArgs(mutation.input).filter((ref) => ref.name !== mutation.subject?.arg);
  const shape = ((schema.tryDefinition(kind) as { fields?: { shape?: Record<string, { _zod?: { def?: { type?: string; innerType?: { _zod?: { def?: { type?: string } } } } } }> } } | undefined)?.fields?.shape ?? {});
  const typeOf = (field: string) => shape[field]?._zod?.def?.type === "optional" ? shape[field]?._zod?.def?.innerType?._zod?.def?.type : shape[field]?._zod?.def?.type;
  const derived = mutation.derived?.act;
  if (derived === "remove") parts.push("removes it");
  else if (derived === "archive") parts.push("sets it aside in the archive");
  else if (derived === "unarchive") parts.push("brings it back from the archive");
  else if (derived === "merge") parts.push("merges it into another");
  else if (derived === "edit") parts.push("changes any of its fields to values given");
  for (const field of mutation.writes ?? []) {
    if (mutation.sets && field in mutation.sets) parts.push(`sets ${field} to ${String(mutation.sets[field])}`);
    else if (args.includes(field)) parts.push(`sets ${field} to a value given`);
    else if (typeOf(field) === "boolean") parts.push(`sets ${field} yes or no`);
    else parts.push(`changes ${field}`);
  }
  for (const arg of args) if (!(mutation.writes ?? []).includes(arg) && !refs.some((ref) => ref.name === arg) && derived !== "edit") parts.push(`takes ${arg}`);
  const to = [...new Set(refs.flatMap((ref) => ref.kinds))].filter((one) => one !== "*").join(" or ");
  if ((mutation.connects?.length ?? 0) > 0 && (mutation.severs?.length ?? 0) > 0) parts.push(`moves it to another ${to || "record"}`);
  else if ((mutation.connects?.length ?? 0) > 0) parts.push(`links it to ${withArticle(to || "record")}`);
  else if ((mutation.severs?.length ?? 0) > 0) parts.push(`unlinks it from ${withArticle(to || "record")}`);
  if (mutation.destructive && derived !== "remove") parts.push("removes it for good");
  if ((mutation.creates?.length ?? 0) > 0) parts.push(`adds a new ${mutation.creates!.join(" or ")}`);
  return parts.length > 0 ? `(It ${parts.join(", ")}.)` : "";
}

