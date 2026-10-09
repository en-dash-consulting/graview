import {
  pluralOf,
  argumentWords,
  formFields,
  humanizeField,
  nounOf,
  tellApart,
  labelOf,
  readableFields,
  search,
  violationsTouching,
  withArticle,
  type AnySchema,
  type FormField,
  type Hit,
  type AppPlace,
  type Principal,
  type Store,
  type Violation,
} from "@graview/core";
import type { SeatMove, SeatOffer } from "./go.js";
import {
  droppedProposals,
  firstJsonObject,
  resolveProposal,
  validateProposals,
  type Completion,
  type ProposedCall,
} from "./intelligence.js";
import type { OfferedQuestion } from "./questions.js";

/**
 * A CONVERSATION over the same seam everything else uses.
 *
 * A turn takes words and the current selection and answers with something
 * to read plus zero or more proposed calls to declared mutations — the
 * exact shape a provider proposes, the exact path a seat applies through.
 * Chat is therefore not a new capability with new trust: it is the existing
 * intelligence contract given a voice, and the graph-native responder means
 * an app can hold a useful conversation before any key exists.
 */

export interface ChatReply {
  readonly say: string;
  readonly proposals: readonly ProposedCall[];
  /**
   * True when the answer is a FACT the graph holds — the standing, a named
   * thing, a when, a who, a rule's own repairs. A grounded answer outranks
   * any model on the ladder: a small local model asked who can play left
   * back will fluently invent a goalkeeper, and no rung may replace a fact
   * with a guess about the same fact.
   *
   * NOT for a reading of what somebody wants CHANGED. That is an
   * interpretation, and interpretation is the whole reason a model is on
   * the ladder at all: "add details to Meal, the name of the food and the
   * number of people it can feed" is two fields and a pattern-matcher can
   * only ever see one. Marking those answers grounded shut the model out of
   * exactly the turns it was there for — so a change is a `reading`, which
   * a model may improve on and must never be quietly worse than.
   */
  readonly grounded?: boolean;
  /**
   * The answer is "I could not read that", rather than an answer.
   *
   * The keyless rung reads a handful of sentence shapes, and says so when a
   * sentence is not one of them. That is honest, and on its own it is a dead
   * end: the person is left to guess which phrasing the pattern-matcher
   * wants, when the thing that reads any phrasing is one press away behind
   * the gear. A surface that knows no model is chosen can offer to choose
   * one — and a surface where one already is has nothing to offer, so this
   * is a fact about the ANSWER, not an instruction to the interface.
   */
  readonly unsure?: boolean;
  /**
   * QUESTIONS FOR THE PERSON, each standing at the node it is about.
   *
   * A decision that came back split, or not sure enough, is not applied and
   * not dropped: it is offered, with its options as presses. It travels here
   * — the seat's own answer — so every surface the seat speaks from can
   * stand it at the node by name: the chat thread now, a figure's bubble
   * when the city has one.
   */
  readonly questions?: readonly OfferedQuestion[];
  /**
   * THINGS THE WORDS FOUND, each a press. A message that named no act and
   * no fact but matched records is answered with them — the Find box's
   * strip, in prose — and a surface draws each as a way to go there.
   */
  readonly picks?: readonly Extract<Hit, { about: "node" }>[];
  /**
   * WHERE THE ANSWER TAKES THE APP. "Go to The week", "overdue tasks",
   * "what's wrong" are answered by being there: each move is data a face
   * applies (the routed face navigates to its `address`, the scene builds
   * the same stop) and says itself in a sentence. Read by `resolveAsk`
   * under the seat's sight, whoever proposed it — a model's moves too.
   */
  readonly moves?: readonly SeatMove[];
  /** A picture the moves could not show, offered: "Show as a view". */
  readonly offer?: SeatOffer;
}

export interface ChatContext {
  /** The current selection: what "this" means. */
  readonly selection?: readonly string[];
  /** Prior turns, oldest first, for responders that use them. */
  readonly history?: readonly { readonly role: "person" | "seat"; readonly text: string }[];
  /**
   * WHAT THE FLOOR ALREADY WORKED OUT, handed up the ladder.
   *
   * The graph-native reading of a change is usually right and always cheap,
   * and a model that starts from it does better than one starting from
   * nothing: it can keep it, correct the one argument it can see is wrong,
   * or split it into the several acts the sentence actually described. A
   * model that answers with nothing does not get to replace it.
   */
  readonly reading?: readonly ProposedCall[];
  /** Who is asking, so what the words find is only what this seat may see. */
  readonly principal?: Principal;
  /** The app's places (`placesOf(app)`), so an ask can be answered by going to one. */
  readonly places?: readonly AppPlace[];
  /** The place the reader stands in, by its slug: what "here" means when nothing is selected. */
  readonly place?: string;
  /** The day it is (YYYY-MM-DD) where the app is pinned to one: what "this week" and "overdue" are read against. */
  readonly today?: string;
}

export type Responder<S extends AnySchema = AnySchema> = (
  store: Store<S>,
  text: string,
  context?: ChatContext,
) => Promise<ChatReply>;

const sentence = (parts: readonly string[]): string => parts.filter(Boolean).join(" ");

/** The words around a bare name that still only ask about it: "tell me about the School run". */
const ASKING_WORDS = new Set(["tell", "me", "about", "what", "how", "show", "describe", "the", "a", "an", "and", "please"]);

/*
 * The words around what is being looked for: "where is the van", "anything
 * about moving". Dropped before the search, so the matcher is handed the
 * thing and not the asking.
 */
const LOOKING_WORDS = new Set([
  ...ASKING_WORDS,
  "where", "is", "are", "was", "find", "any", "anything", "something", "things", "called", "named",
  "which", "who", "of", "for", "with", "to", "in", "on", "i", "my", "do", "does", "have", "has",
  "can", "you", "it", "that", "this", "there", "we", "our", "got", "be",
]);

/** "a person", "a person and a date" — a list a person would say out loud. */
const withList = (words: readonly string[]): string =>
  words.length <= 1
    ? withArticle(words[0] ?? "something")
    : `${words.slice(0, -1).map(withArticle).join(", ")} and ${withArticle(words[words.length - 1]!)}`;

/**
 * The graph answers for itself. Deterministic, keyless, derived:
 * - "what's wrong / broken / problems" → the standing, with ready repairs;
 * - a node named in the message (or selected) → its facts, its trouble,
 *   and that trouble's repairs;
 * - a mutation's own title phrased in the message → that call, proposed
 *   with what can honestly be filled and nothing guessed;
 * - anything else → the shape of the graph and how to ask.
 */
export function graphResponder<S extends AnySchema>(
  options: { readonly today?: string } = {},
): Responder<S> {
  return async (store, text, context = {}) => {
    const asked = text.toLowerCase();
    const name = (node: { id: string; kind: string }): string =>
      labelOf(store.schema.tryDefinition(node.kind), node);

    /*
     * WHERE THE WORDS ASK TO GO, read first and without a model (`resolveAsk`,
     * fetched with the first ask rather than with the page). Problems and a
     * record told about keep the fuller answers below, with the move.
     */
    const going = (await import("./go.js")).goingFrom(store, text, context, options.today);
    if (going.reply) return going.reply;
    const told = going.told;
    const withMoves = (reply: ChatReply): ChatReply => (going.moves ? { ...reply, moves: going.moves } : reply);

    /*
     * REFERENTS: the selection first — "this" means what is selected — then
     * any node whose label appears in the message, longest label first so
     * "Morning school run" wins over "run".
     */
    const referents: ({ id: string; kind: string } & Record<string, unknown>)[] = [];
    /*
     * Matching is TOKEN-ALIGNED and punctuation-blind, or names fail for
     * the dumbest reasons: a child stored as "child2" must be found by
     * "child 2", and "child2's nap" by "child 2 nap". Both sides tokenize
     * on non-alphanumerics; a label matches when its squeezed form equals
     * some run of adjacent message tokens joined — token alignment is what
     * keeps "Bo" out of "elbow".
     */
    const tokens = asked.split(/[^a-z0-9]+/).filter(Boolean);
    const runs = new Set<string>();
    for (let start = 0; start < tokens.length; start++) {
      let joined = "";
      for (let end = start; end < Math.min(tokens.length, start + 6); end++) {
        joined += tokens[end];
        runs.add(joined);
      }
    }
    const squeeze = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const byLabel = [...store.graph.allNodes()]
      .map((node) => ({ node, label: squeeze(name(node)) }))
      .filter(({ label }) => label.length >= 2 && runs.has(label))
      .sort((a, b) => b.label.length - a.label.length);
    /*
     * A NAME SEVERAL THINGS SHARE NAMES NONE OF THEM. "Tell me about the
     * 2026 Tesla Model Y Performance" on a lot with three was answered
     * with the first one found and said nothing about the other two; the
     * words find them all below, each told apart.
     */
    const shared = new Map<string, number>();
    for (const { label } of byLabel) shared.set(label, (shared.get(label) ?? 0) + 1);
    for (const { node, label } of byLabel) {
      if ((shared.get(label) ?? 0) > 1) continue;
      if (!referents.some((held) => held.id === node.id)) referents.push(node);
    }
    /*
     * The SELECTION comes after anything the message NAMED. "This" means
     * what is selected — but a question that says "left back" out loud is
     * about left back, and a standing selection answering it instead was
     * the seat confidently describing the wrong thing.
     */
    for (const id of context.selection ?? []) {
      const node = store.graph.getNode(id);
      if (node && !referents.some((held) => held.id === node.id)) referents.push(node);
    }

    // "Tell me about it", found by the resolver: that record is what the answer is about.
    const subject = told && store.graph.getNode(told);
    if (subject) {
      const at = referents.findIndex((held) => held.id === subject.id);
      if (at >= 0) referents.splice(at, 1);
      referents.unshift(subject);
    }

    const violations = store.violations();
    const readyRepairs = (subset = violations): ProposedCall[] => readyRepairsOf(subset);

    // ------------------------------------------------------- the standing
    if (going.problems || (!told && /\b(wrong|broken|problem|violat|standing)\b/.test(asked))) {
      if (violations.length === 0) {
        return withMoves({ say: "Nothing is wrong: every rule holds.", proposals: [], grounded: true });
      }
      /*
       * THE SENTENCE MATCHES WHAT IS ACTUALLY BELOW IT.
       *
       * "The repairs below come from the rules themselves" was said
       * unconditionally, and `readyRepairs` drops every repair that still
       * needs an argument chosen — so a rule whose repair asks for one thing
       * ("hand it to someone": which someone is the decision the rule cannot
       * make) produced a seat promising repairs under an empty list. Naming
       * what the repair still wants is the honest answer, and it is the same
       * answer the phrased-mutation branch below already gives.
       */
      const offered = validateProposals(store, readyRepairs().slice(0, 4));
      /*
       * And what it wants is said the way a picker is named — by the KIND it
       * would pick, not by the argument's identifier. Otherwise the seat
       * asks for "a handler" where the strip and the routed face both say
       * "a person".
       */
      const asked = (mutation: string, field: string): string => {
        const declared = store.allMutations().find((candidate) => candidate.name === mutation);
        const spec = declared
          ? formFields(declared.input).find((candidate) => candidate.name === field)
          : undefined;
        return spec?.control === "node" && !spec.kinds.includes("*")
          ? spec.kinds.map((kind) => nounOf(store.schema.tryDefinition(kind), kind)).join(" or ")
          : humanizeField(field).toLowerCase();
      };
      const wants = [
        ...new Set(
          violations
            .flatMap((violation) => violation.repairs)
            .flatMap((repair) => (repair.missing ?? []).map((field) => asked(repair.mutation, field))),
        ),
      ];
      return withMoves({
        say: sentence([
          going.moves?.[0]?.said ?? "",
          `${violations.length} ${violations.length === 1 ? "problem" : "problems"}:`,
          violations
            .slice(0, 4)
            .map((violation) => violation.message)
            .join("; ") + (violations.length > 4 ? "…" : "."),
          offered.length > 0
            ? "The repairs below come from the rules themselves."
            : wants.length > 0
              ? `The rules name a way to fix ${violations.length === 1 ? "it" : "these"}, but it needs ${withList(wants)} chosen — select the record and its own actions will ask.`
              : "No rule here names a way to fix it.",
        ]),
        proposals: offered,
        grounded: true,
      });
    }

    // -------------------------------------------- a mutation, said in words
    /*
     * A QUESTION IS NEVER A CHANGE. "what depends on Pay the deposit?"
     * carries the title of an act ("Depends on") and the name of a record,
     * and was answered with a proposal to RUN that act on the record — an
     * apply button under a question, which is the graph answering wrongly
     * rather than not at all. A sentence that asks is answered from the
     * graph below; only a sentence that says does anything.
     */
    const question =
      /\?\s*$/.test(text) ||
      /^\s*(what|who|whom|whose|which|when|where|why|how|is|are|was|were|does|do|did|can|could|should|would|will|has|have)\b/.test(
        asked,
      );
    const phrased = question
      ? undefined
      : store.allMutations().find((mutation) => {
          const title = (mutation.title ?? mutation.name).toLowerCase();
          return title.length > 3 && asked.includes(title);
        });
    if (phrased) {
      const args: Record<string, unknown> = {};
      const missing: string[] = [];
      /*
       * The words for a text field: in quotes, else what follows the act's
       * own words and a "to" or "as" — "rename it to Pay the landlord".
       */
      const after = text.slice(text.toLowerCase().indexOf((phrased.title ?? phrased.name).toLowerCase()) + (phrased.title ?? phrased.name).length);
      // The things named are not the words: "rename Email to Todd to Email to Tom" leaves " to Email to Tom".
      const unnamed = referents.reduce((rest, node) => { const said = name(node).toLowerCase(); const at = rest.toLowerCase().indexOf(said); return at < 0 ? rest : `${rest.slice(0, at)} it${rest.slice(at + said.length)}`; }, after);
      const quoted = text.match(/"([^"]+)"/)?.[1] ?? unnamed.match(/^(?:\s+(?:it|this|that|them))?\s+(?:to|as)\s+(.+?)\s*[.!]?$/i)?.[1];
      // Each thing named fills ONE blank: the same record in both ends of a
      // tie is an act that cannot act, and never what was said.
      const unused = [...referents];
      for (const field of formFields(phrased.input)) {
        const value = answerFrom(field, unused, quoted, options.today ?? context.today, asked);
        if (value !== undefined) {
          args[field.name] = value;
          const at = unused.findIndex((node) => node.id === value);
          if (at >= 0) unused.splice(at, 1);
        } else if (!field.optional) missing.push(argumentWords(store.schema, phrased, field.name).label.toLowerCase());
      }
      /*
       * A READING, NOT A FACT. This branch matched an act's title in a
       * sentence and filled what it honestly could — right often enough to
       * be the floor, and not so right that a model should be kept out of
       * it. Marked grounded, it stopped the ladder dead: a person with a
       * model chosen still got the pattern-matcher's single act out of a
       * sentence that described three.
       */
      if (missing.length === 0) {
        return {
          say: `I can do that. Review it below.`,
          proposals: validateProposals(store, [
            { mutation: phrased.name, args, why: `you asked in words` },
          ]),
        };
      }
      return {
        // In the act's own words, never its identifiers: "“Rename” needs a name", not "needs label".
        say: `“${phrased.title ?? humanizeField(phrased.name)}” needs ${withList(missing)} — say ${missing.length === 1 ? "it" : "them"} (or select ${missing.length === 1 ? "it" : "them"}) and ask again.`,
        proposals: [],
      };
    }

    /*
     * ------------------------------------------- when / who, from the graph
     *
     * The declarations already answer these. WHEN: field roles name which
     * fields are a thing's start, end and day, and display.format says how
     * to speak them. WHO: an edge whose own description says "who…" IS the
     * who-relation — "who does the run", "who is there" — so following it
     * from the right node answers without knowing what a run is. The right
     * node is chosen honestly: the referent itself when it is timed, else
     * the referent's neighbor that best matches the question's remaining
     * words and any day named.
     */
    const DAY_WORDS: Record<string, string> = {
      mon: "mon", monday: "mon", tue: "tue", tues: "tue", tuesday: "tue",
      wed: "wed", wednesday: "wed", thu: "thu", thur: "thu", thurs: "thu", thursday: "thu",
      fri: "fri", friday: "fri", sat: "sat", saturday: "sat", sun: "sun", sunday: "sun",
    };
    const askedDay = tokens.map((token) => DAY_WORDS[token]).find(Boolean);
    const formatOf = (kind: string, field: string, value: unknown): string => {
      const format = store.schema.tryDefinition(kind)?.display?.format?.[field];
      return format ? format(value) : String(value);
    };
    const timing = (node: { id: string; kind: string } & Record<string, unknown>): string | null => {
      const roles = store.schema.tryDefinition(node.kind)?.fieldRoles as
        | Record<string, string>
        | undefined;
      if (!roles?.["start"]) return null;
      const start = node[roles["start"]];
      const end = roles["end"] ? node[roles["end"]] : undefined;
      const day = roles["day"] ? node[roles["day"]] : roles["days"] ? node[roles["days"]] : undefined;
      if (start === undefined && end === undefined) return null;
      const said = [
        start !== undefined ? formatOf(node.kind, roles["start"], start) : null,
        end !== undefined && roles["end"] ? `–${formatOf(node.kind, roles["end"], end)}` : null,
        Array.isArray(day) ? ` on ${day.join(", ")}` : day !== undefined ? ` on ${String(day)}` : null,
      ]
        .filter(Boolean)
        .join("");
      return said || null;
    };
    const neighborsOf = (id: string) => {
      const out: ({ id: string; kind: string } & Record<string, unknown>)[] = [];
      for (const edge of store.graph.allEdges()) {
        const other = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
        if (!other) continue;
        const found = store.graph.getNode(other);
        if (found && !out.some((held) => held.id === found.id)) out.push(found);
      }
      return out;
    };
    /**
     * The question's subjects, best first: the referent's neighbors ranked
     * by how many of the question's words their name shares and — when a
     * day is named — how exactly they sit on that day. An exact day FIELD
     * outranks a days array that merely contains it: "tuesday" means the
     * Tuesday one, not everything that also happens on Tuesdays.
     */
    const subjectsFor = (
      wantTimed: boolean,
    ): ({ id: string; kind: string } & Record<string, unknown>)[] => {
      const first = referents[0];
      if (!first) return [];
      const scored: { node: (typeof referents)[number]; score: number }[] = [];
      for (const candidate of neighborsOf(first.id)) {
        let score = 0;
        const squeezed = squeeze(name(candidate));
        for (const token of tokens) {
          if (token.length > 2 && squeezed.includes(token)) score += 1;
        }
        if (askedDay) {
          const roles = store.schema.tryDefinition(candidate.kind)?.fieldRoles as
            | Record<string, string>
            | undefined;
          const day = roles?.["day"] ? candidate[roles["day"]] : undefined;
          const days = roles?.["days"] ? candidate[roles["days"]] : undefined;
          if (day === askedDay) score += 4;
          else if (Array.isArray(days) && days.includes(askedDay)) score += 1;
        }
        if (wantTimed && !timing(candidate)) continue;
        if (score > 0) scored.push({ node: candidate, score });
      }
      const ranked = scored.sort((a, b) => b.score - a.score).map((held) => held.node);
      if (wantTimed && timing(first)) ranked.unshift(first);
      else if (!wantTimed) ranked.push(first);
      return ranked;
    };

    if (referents.length > 0 && /\bwhen\b/.test(asked)) {
      const subject = subjectsFor(true)[0] ?? null;
      const said = subject ? timing(subject) : null;
      if (subject && said) {
        return withMoves({
          say: `${name(subject)} runs ${said}.`,
          proposals: validateProposals(
            store,
            readyRepairs(violationsTouching(violations, [subject.id])).slice(0, 3),
          ),
          grounded: true,
        });
      }
    }

    if (referents.length > 0 && /\bwho(m|se)?\b/.test(asked)) {
      /*
       * A subject that cannot answer "who" is the wrong subject: walk the
       * ranked candidates until one actually has who-edges. The edge's own
       * description is the sentence — and its declared `inverse` ("who is
       * there") counts as a who-sentence read from the other end.
       */
      for (const subject of subjectsFor(false)) {
        const parts: string[] = [];
        const said = new Set<string>();
        for (const definition of store.schema.definitions) {
          for (const [edgeKind, spec] of Object.entries(
            definition.edges as Record<string, { description?: string; inverse?: string }>,
          )) {
            /*
             * Whoever declared the edge, the who-things are the nodes on
             * the OTHER side of the subject — in-neighbors when the edge
             * points at the subject, out-neighbors when it points away —
             * and the sentence is whichever declared line says "who".
             */
            const forward = /\bwho\b/i.test(spec.description ?? "");
            const backward = /\bwho\b/i.test(spec.inverse ?? "");
            if ((!forward && !backward) || said.has(edgeKind)) continue;
            said.add(edgeKind);
            const others = [
              ...store.graph.in(subject.id, edgeKind),
              ...store.graph.out(subject.id, edgeKind),
            ];
            if (others.length === 0) continue;
            const sentence = forward ? spec.description : spec.inverse;
            parts.push(`${sentence}: ${others.map((other) => name(other)).join(", ")}`);
          }
        }
        if (parts.length > 0) {
          return withMoves({
            say: `${name(subject)} — ${parts.join("; ")}.`,
            proposals: validateProposals(
              store,
              readyRepairs(violationsTouching(violations, [subject.id])).slice(0, 3),
            ),
            grounded: true,
          });
        }
      }
    }

    // ------------------------------------------------------ a named thing
    if (referents.length > 0) {
      const node = referents[0]!;
      /*
       * NAMING A THING IS NOT ASKING ABOUT IT. "Erin tends that plot" names
       * Erin and says a change; answered as a fact — "Erin — a gardener.
       * Connected to nothing yet." — and marked grounded, it kept the model
       * from ever reading it, and the seat described the gardener it had
       * just been told to connect. The description is still the floor's
       * best answer, but only a question, or the bare name, is a FACT.
       */
      const own = new Set(name(node).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const bare = tokens.every((token) => own.has(token) || ASKING_WORDS.has(token));
      const asking = question || bare;
      const definition = store.schema.tryDefinition(node.kind);
      /*
       * Each fact as it reads on its own, its LABEL lower-cased to sit in
       * brackets — "explicit: no", "year 2026" — and never its value: "tesla"
       * is a make somebody spelled with a capital. A bare value says what it
       * is, "make Tesla", "phone (555) 298-1878", or a VIN reads as noise.
       */
      const quietly = (label: string) => (label === label.toUpperCase() ? label : label.charAt(0).toLowerCase() + label.slice(1));
      /*
       * SAID, NOT PRINTED: a day as a person says one ("due 1 Sep 2026", not
       * "due 2026-09-01"), and a one-word yes/no as the state it is
       * ("not finished", not "finished: no").
       */
      const facts = readableFields(node, definition, { limit: 3 })
        .map((field) => {
          const raw = (node as Record<string, unknown>)[field.key];
          if (typeof raw === "boolean" && !/\s/.test(field.label)) return raw ? quietly(field.label) : `not ${quietly(field.label)}`;
          if (typeof raw === "string" && ISO_DAY.test(raw)) return `${quietly(field.label)} ${dayWords(raw)}`;
          return field.alone.startsWith(field.label) ? quietly(field.label) + field.alone.slice(field.label.length) : `${quietly(field.label)} ${field.alone}`;
        })
        .join(", ");
      const touching = violationsTouching(violations, [node.id]);
      /*
       * The relations, in the declarations' own words — "where they can
       * play: Goalkeeper, Left back" answers "what about Bo" the way a
       * person would, instead of a degree count.
       */
      const groups = new Map<string, { sentence: string; names: string[] }>();
      for (const edge of [...store.graph.allEdges()]) {
        const direction = edge.from === node.id ? "out" : edge.to === node.id ? "in" : null;
        if (!direction) continue;
        const other = store.graph.getNode(direction === "out" ? edge.to : edge.from);
        if (!other) continue;
        const key = `${edge.kind}|${direction}`;
        if (!groups.has(key)) {
          /*
           * Read from the end you are standing on. An edge is declared on
           * the kind at its `from` end, so its `description` is the reading
           * from there and its `inverse` the reading from the `to` end —
           * whichever kind this node is. "What is Ada seeing to?" was
           * answered "who is seeing to it: Pay the deposit", the item's
           * words in the person's mouth, because the caption was chosen by
           * which KIND declared the edge rather than by which END the node
           * is at.
           */
          let said: string | undefined;
          for (const definition of store.schema.definitions) {
            const spec = (definition.edges as Record<string, { description?: string; inverse?: string }>)[
              edge.kind
            ];
            if (!spec) continue;
            said = direction === "out" ? spec.description : (spec.inverse ?? spec.description);
            if (said) break;
          }
          groups.set(key, { sentence: said ?? humanizeField(edge.kind).toLowerCase(), names: [] });
        }
        const group = groups.get(key)!;
        if (group.names.length < 6) group.names.push(name(other));
      }
      const related = [...groups.values()]
        .slice(0, 4)
        // Each is a sentence of its own, so it starts like one: "The releases it is on: Blue Hour."
        .map((group) => `${group.sentence.charAt(0).toUpperCase()}${group.sentence.slice(1)}: ${group.names.join(", ")}`)
        .join(". ");
      return withMoves({
        say: sentence([
          going.moves?.[0]?.said ?? "",
          `${name(node)} — ${withArticle(nounOf(store.schema.tryDefinition(node.kind as string), node.kind as string))}${facts ? ` (${facts})` : ""}.`,
          related ? `${related}.` : "Connected to nothing yet.",
          touching.length > 0
            ? `Trouble: ${touching.map((violation) => violation.message).join("; ")}.`
            : "Nothing about it is broken.",
        ]),
        proposals: validateProposals(store, readyRepairs(touching).slice(0, 3)),
        ...(asking || told ? { grounded: true } : {}),
      });
    }

    // --------------------------------------------------- what the words find
    /*
     * NO ACT AND NO FACT, BUT THE WORDS FIND THINGS. "Where is the van" names
     * nothing by its whole name and asks for no change — and the Find box
     * would have answered it at once. The same matcher, the same seat's
     * view: the reply is the strip in prose, each thing a press. Not a
     * grounded answer — a model may yet read the sentence better.
     */
    {
      const words = asked.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0 && !LOOKING_WORDS.has(word));
      if (words.length > 0) {
        const found = search(store, words.join(" "), {
          ...(context.principal ? { principal: context.principal } : {}),
          ...(context.selection ? { from: context.selection } : {}),
          ...((options.today ?? context.today) ? { today: options.today ?? context.today } : {}),
          limit: 6,
        });
        const picks = found.hits.filter((hit): hit is Extract<Hit, { about: "node" }> => hit.about === "node");
        if (picks.length > 0) {
          // Two of one name are told apart: "2025 Subaru Outback Base · VIN 3VP1…" (the W-095 rule, in prose).
          const apart = tellApart(
            picks.flatMap((hit) => {
              const node = store.graph.getNode(hit.id);
              return node ? [node] : [];
            }),
            (kind) => store.schema.tryDefinition(kind),
          );
          const said = picks.map((hit) =>
            `${hit.label}${apart.has(hit.id) ? ` · ${apart.get(hit.id)}` : ""} (${nounOf(store.schema.tryDefinition(hit.kind), hit.kind)}${hit.why.field === "label" ? "" : `, ${hit.why.reading.toLowerCase()}: ${hit.why.fragment}`})`,
          );
          const how = found.total === 1 ? "One thing is" : `${numberWord(found.total)} things are`;
          return {
            say: `${how} called “${found.words}” — ${said.join("; ")}${found.total > picks.length ? `; and ${found.total - picks.length} more` : ""}.`,
            proposals: [],
            picks,
          };
        }
      }
    }

    // ------------------------------------------------------------ the shape
    const counts = (store.schema.kinds as readonly string[])
      .filter((kind) => !store.modules.disabledKinds.has(kind))
      .map((kind) => {
        const plural = pluralOf(store.schema, kind);
        return `${store.graph.nodesOfKind(kind).length} ${plural}`;
      })
      .join(", ");
    return {
      say: sentence([
        `This graph holds ${counts}.`,
        `Ask about anything by name, ask what's wrong, or say a change in its own words —`,
        `like "${store.allMutations()[0]?.title ?? "an action"}".`,
      ]),
      proposals: [],
    };
  };
}

/** The repairs the rules name that need nothing more chosen, as proposals. */
export function readyRepairsOf(violations: readonly Violation[]): ProposedCall[] {
  return violations.flatMap((violation) => {
    const repair = violation.repairs.find((candidate) => !candidate.missing?.length);
    return repair ? [{ mutation: repair.mutation, args: { ...repair.args }, why: violation.message }] : [];
  });
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const numberWord = (count: number): string => NUMBER_WORDS[count] ?? String(count);

/** One honest answer for one form field, or undefined — never a guess. */
function answerFrom(
  field: FormField,
  referents: readonly ({ id: string; kind: string } & Record<string, unknown>)[],
  quoted: string | undefined,
  today: string | undefined,
  /** The sentence, lower-cased: a choice is answered by its own word in it. */
  asked = "",
): unknown {
  switch (field.control) {
    case "node": {
      const match = referents.find(
        (node) => field.kinds.includes("*") || field.kinds.includes(node.kind),
      );
      return match?.id;
    }
    case "text":
      return quoted;
    case "date": {
      const day = today ?? new Date().toISOString().slice(0, 10);
      // A sentence that names no hour still has to give one when the act asks for a time of day.
      return field.time ? `${day}T09:00` : day;
    }
    /*
     * A CHOICE IS ITS OWN WORD. "Give a role keeper to Sam" names the role
     * the way a person would, and a closed set of options is the one kind
     * of argument a sentence can settle exactly: the option that appears
     * as a whole word is the answer; two of them, or none, is no answer.
     */
    case "choice": {
      const words = new Set(asked.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const named = (field.options ?? []).filter((option) =>
        option
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean)
          .every((part) => words.has(part)),
      );
      return named.length === 1 ? named[0] : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * A model holds the conversation, through the same one-function seam and
 * the same validation gate as every other model use. The reply contract is
 * JSON — something to say, calls to propose — and an unparseable answer
 * degrades to words with no proposals rather than to guesses.
 */
export function llmResponder<S extends AnySchema>(options: {
  readonly complete: Completion;
  readonly may?: readonly string[];
}): Responder<S> {
  return async (store, text, context = {}) => {
    /*
     * EACH ACT WITH WHAT IT TAKES. Listed by name and description alone, a
     * model proposed `add-plot` with no label and no beds, and the person
     * was handed a form for what they had just said in words. The same
     * form fields the menu asks with, said as a signature.
     */
    const argument = (field: FormField): string => {
      const type =
        field.control === "node"
          ? `name of ${field.kinds.includes("*") ? "anything" : field.kinds.join(" or ")}`
          : field.control === "choice"
            ? (field.options ?? []).map((option) => JSON.stringify(option)).join(" | ")
            : field.control === "date"
              ? field.time
                ? "YYYY-MM-DDTHH:MM"
                : "YYYY-MM-DD"
              : field.control === "text" || field.control === "number" || field.control === "boolean"
                ? field.control
                : "value";
      return `${field.name}${field.optional ? "?" : ""}: ${type}`;
    };
    const mutations = store
      .allMutations()
      .map(
        (mutation) =>
          `- ${mutation.name}(${formFields(mutation.input).map(argument).join(", ")}): ${mutation.description ?? mutation.title ?? ""}`,
      )
      .join("\n");
    /*
     * WHAT IS ACTUALLY IN HERE, BY NAME.
     *
     * A model that cannot see the names cannot use them: asked to add a
     * field to Meal it answers `{"kind": "Meal"}` and hopes, because the
     * prompt listed the acts and never the things. A bounded sample per
     * kind is enough to name anything a sentence is likely to mention, and
     * `resolveProposal` turns whichever name it picks into the id.
     */
    const shape = (store.schema.kinds as readonly string[])
      .filter((kind) => !store.modules.disabledKinds.has(kind))
      .map((kind) => {
        const definition = store.schema.tryDefinition(kind);
        const members = store.graph.nodesOfKind(kind);
        const names = members
          .slice(0, 12)
          .map((node) => labelOf(definition, node))
          .join(", ");
        return `- ${kind} (${pluralOf(store.schema, kind)}, ${members.length}): ${names}${members.length > 12 ? ", …" : ""}`;
      })
      .join("\n");
    /*
     * HOW THINGS ARE CONNECTED. A model told "move it to Erin" can only
     * answer from connections it can see; a bounded list is enough for the
     * graphs a conversation is held over.
     */
    const nameOf = (id: string): string => {
      const node = store.graph.getNode(id);
      return node ? labelOf(store.schema.tryDefinition(node.kind), node) : id;
    };
    const edges = [...store.graph.allEdges()];
    const connections = edges
      .slice(0, 40)
      .map((edge) => `- ${nameOf(edge.from)} —${edge.kind}→ ${nameOf(edge.to)}`)
      .join("\n");
    const selected = (context.selection ?? [])
      .map((id) => {
        const node = store.graph.getNode(id);
        return node ? `${id} (${labelOf(store.schema.tryDefinition(node.kind), node)})` : id;
      })
      .join(", ");
    const history = (context.history ?? [])
      .slice(-8)
      .map((turn) => `${turn.role === "person" ? "Person" : "You"}: ${turn.text}`)
      .join("\n");
    const trouble = store
      .violations()
      .map((violation) => `- ${violation.message}`)
      .join("\n");
    /*
     * The floor's reading, offered as a starting point rather than a rule.
     * "Keep it, correct it, or split it" is the instruction that turns one
     * loose sentence into the two or three acts it actually described.
     */
    const reading = (context.reading ?? [])
      .map((proposal) => `- ${proposal.mutation} ${JSON.stringify(proposal.args)}`)
      .join("\n");
    const keptKinds = store.kindsKeptFrom(context.principal);
    const places = (context.places ?? []).filter((place) => place.kind === null || !keptKinds.has(place.kind)).map((place) => place.title);
    const prompt = [
      [
        "You are the seat of a typed context graph. You answer questions about it and turn requests for change into proposals of its declared mutations, which the person reviews and applies.",
        "- Fill every argument a mutation takes. Refer to things by their exact name as listed below.",
        "- When a request needs something that does not exist yet, propose creating it first, then refer to it by the name you gave it. Choose sensible names and numbers rather than leaving them out.",
        '- "it", "that" and "this" mean what the conversation or the selection points at.',
        '- "say" is one short sentence in plain words. Do not restate the proposals in it; they are shown beneath it.',
        "- A question gets an answer and no proposals.",
      ].join("\n"),
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
      `Mutations:\n${mutations}`,
      shape ? `What is in the graph now:\n${shape}` : "",
      connections ? `How they are connected:\n${connections}${edges.length > 40 ? "\n- …" : ""}` : "",
      reading
        ? `A first reading of this request, worked out from the graph:\n${reading}\nKeep it, correct it, or split it into several — one proposal per distinct change the person described.`
        : "Where a request describes several changes, answer with several proposals — one per distinct change.",
      trouble ? `Currently broken:\n${trouble}` : "Nothing is broken.",
      selected ? `Selected right now (what "this" means): ${selected}` : "Nothing is selected.",
      /*
       * THE PLACES, so an answer can take the person to one. A model names
       * where to go; the seat reads that name again as an ask under the
       * same sight, so a move a model proposes is one the graph alone could
       * have made.
       */
      places.length > 0 ? `Places in the app: ${places.join(", ")}.` : "",
      history ? `Conversation so far:\n${history}` : "",
      `Person: ${text}`,
      'To take the person somewhere, put a place\'s title or a thing\'s exact name in "go".',
      'Answer ONLY JSON: {"say": string, "proposals": [{"mutation": string, "args": object, "why": string}], "go"?: [string]}.',
    ]
      .filter(Boolean)
      .join("\n\n");
    const answer = await options.complete(prompt);
    const read = firstJsonObject(answer);
    /*
     * A bare array IS the list of proposals — the shape a model reaches for
     * about as often as the one it was asked for.
     */
    const parsed = (Array.isArray(read) ? { proposals: read as ProposedCall[] } : read) as
      | { say?: string; proposals?: ProposedCall[]; go?: unknown; moves?: unknown }
      | undefined;
    /*
     * A PERSON IS NEVER SHOWN THE PLUMBING.
     *
     * The contract is JSON, and the old fallback put the raw answer in the
     * bubble when it would not parse — so a model that closed one brace too
     * many produced a chat message reading `{"say": "Yes", "proposals":
     * [{"mutation": "add-field", …}]}}`. `firstJsonObject` reads the object
     * the model meant; where there is no object at all, a model that was
     * asked for JSON and wrote prose is answering in the wrong shape, and
     * saying so is better than pasting it.
     */
    if (!parsed || typeof parsed !== "object") {
      const prose = answer.trim();
      const looksLikeJson = prose.startsWith("{") || prose.startsWith("[");
      return {
        say:
          prose.length > 0 && !looksLikeJson
            ? prose
            : "The model answered in a shape I could not read. Ask again, or try a different one from the gear.",
        proposals: [],
      };
    }
    /*
     * And a model names things the way a person does — "Meal", not
     * `declared:meal` — so a label that means exactly one node is read as
     * that node before the gate sees it.
     */
    const offered = (parsed.proposals ?? []).map((proposal) => resolveProposal(store, proposal));
    const kept = validateProposals(store, offered, options.may);
    /*
     * WHAT THE GATE TOOK OUT IS SAID OUT LOUD. A model that answers "Sure"
     * and names an act this app does not have used to leave a sentence with
     * nothing under it: no proposal, no refusal, no way to tell whether the
     * seat had understood. Silence is the one answer that cannot be acted
     * on.
     */
    const dropped = droppedProposals(store, offered, options.may);
    const unknown = dropped.filter((one) => one.why === "unknown").map((one) => one.proposal.mutation);
    const barred = dropped.filter((one) => one.why === "not-allowed").map((one) => one.proposal.mutation);
    const aside = [
      unknown.length > 0
        ? `It also suggested ${unknown.map((name) => `"${name}"`).join(", ")}, which this app has no act for.`
        : "",
      barred.length > 0
        ? `${barred.map((name) => `"${name}"`).join(", ")} is not something this seat may run.`
        : "",
      kept.length === 0 && offered.length > 0 ? "Nothing it suggested can be applied here." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const said = typeof parsed.say === "string" && parsed.say.length > 0 ? parsed.say : "";
    const named = [parsed.go, parsed.moves].flatMap((one) => (Array.isArray(one) ? one : typeof one === "string" ? [one] : []));
    const moves = named.length > 0 ? (await import("./go.js")).movesFromNames(store, named, context) : [];
    return {
      say: [said || moves.map((move) => move.said).join(" "), aside].filter(Boolean).join(" ") || "…",
      proposals: kept,
      ...(moves.length > 0 ? { moves } : {}),
    };
  };
}

/** A day alone, as the record holds it: `YYYY-MM-DD`. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A day as a person says it in a sentence: "1 Sep 2026". */
function dayWords(day: string): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return `${date} ${MONTHS[month - 1] ?? ""} ${year}`;
}
