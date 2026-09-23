import type { Store } from "@graview/core";
import {
  drawFigure,
  graphResponder,
  nearestFigure,
  validateProposals,
  type ChatReply,
  type Completion,
  type ProposedCall,
  type Responder,
} from "@graview/tools";
import type { FieldType, StudioSchema } from "./meta.js";

/*
 * THE DECLARATION ANSWERS FOR ITSELF.
 *
 * Both halves of this existed and nothing joined them: the studio could
 * take a proposal from an agent seat, and the chat panel could turn words
 * into proposals — but the one surface whose subject is the declaration was
 * the one surface you could not talk to, so changing a kind meant holding
 * the whole shape in your head and taking one act at a time.
 *
 * This is the graph-native floor of that conversation, and it is keyless by
 * construction: every answer is read off the meta-graph (what kinds are
 * there, what an act writes, what a rule judges, who may take it, which
 * kinds have no figure) and every change is a PROPOSED studio act filled
 * from a template — never a write. A model upgrades it through the same
 * one-function `Completion` seam everything else uses, and both rungs hand
 * their proposals to the same `validateProposals` gate, so neither can name
 * an act the studio does not have.
 */

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

export interface StudioResponderOptions {
  /**
   * The model behind a drawing, when the person has chosen one. Without it
   * a figure ask is answered with the nearest SHIPPED figure, which is an
   * honest answer — and the reply says which it was, because being shown a
   * machine's work and told it was a choice is the one thing a seat must
   * never do.
   */
  readonly complete?: Completion;
}

const squeeze = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "");
/** Singular and plural of a word, squeezed, so "tasks" finds the kind "task". */
const forms = (word: string): string[] => {
  const one = squeeze(word);
  const out = [one, `${one}s`, `${one}es`];
  if (one.endsWith("ies")) out.push(`${one.slice(0, -3)}y`);
  if (one.endsWith("s")) out.push(one.slice(0, -1));
  return out;
};

/**
 * THE TYPE A NAME IMPLIES, and nothing cleverer.
 *
 * "a due date" is a date and "how many" is a number, in every domain that
 * has ever existed. Where the name says nothing, the answer is a string —
 * never a guess dressed up as a decision, because the person is about to
 * see the act before they keep it and can change it there.
 */
export function typeFromName(name: string): FieldType {
  const said = name.toLowerCase();
  if (/\b(date|due|deadline|when|day|birthday|expires?|starts?|ends?)\b/.test(said)) return "date";
  if (/\b(count|number|quantity|amount|size|age|price|cost|hours?|minutes?|score|rank)\b/.test(said)) return "number";
  if (/^(is|has|was|can|should)\b|\b(done|complete|completed|active|archived|urgent|flag)\b/.test(said)) return "boolean";
  if (/\b(notes?|note|description|comment|comments|body|summary|detail|details)\b/.test(said)) return "text";
  return "string";
}

/** The graph-native studio conversation: the declaration, in its own words. */
export function studioResponder(options: StudioResponderOptions = {}): Responder<StudioSchema> {
  const floor = graphResponder<StudioSchema>();

  return async (store, text, context) => {
    const asked = text.toLowerCase();
    const said = squeeze(text);
    /*
     * A QUESTION IS NEVER A CHANGE — the same rule the graph responder
     * keeps. "what roles are there?" must not propose adding one.
     */
    const question =
      /\?\s*$/.test(text) ||
      /^\s*(what|who|whom|whose|which|when|where|why|how|is|are|was|were|does|do|did|can|could|should|would|will|has|have)\b/.test(asked);
    /*
     * A SENTENCE THAT OPENS WITH AN INSTRUCTION IS NOT A QUESTION.
     *
     * The branches below answer questions about the declaration, and they
     * recognised them by the words they contained rather than by what the
     * sentence was doing. "Add a Meal kind, with the name of the food and
     * how many people it feeds" contains "kind" and "how many", so it was
     * answered with an inventory of the kinds — and answered as a FACT,
     * which takes the turn away from the model entirely. The one sentence
     * most needing a model's help was the one guaranteed not to reach it.
     */
    const imperative =
      /^\s*(add|give|put|attach|link|connect|tie|relate|make|create|draw|declare|rename|remove|delete|set|call)\b/.test(asked);
    /**
     * A FACT the declaration holds: what kinds there are, what an act
     * writes, who may take it. No model may replace one of these.
     */
    const grounded = (say: string, proposals: readonly ProposedCall[] = []): ChatReply => ({
      say,
      proposals: validateProposals(store as Store<StudioSchema>, proposals),
      grounded: true,
    });
    /**
     * A READING of what somebody wants changed — right often enough to be
     * the floor, and never so right that a model should be kept out of it.
     * Where a model is on the ladder this goes up as a starting point; where
     * none is, it is the answer.
     */
    const reading = (say: string, proposals: readonly ProposedCall[] = []): ChatReply => ({
      say,
      proposals: validateProposals(store as Store<StudioSchema>, proposals),
    });
    /**
     * A sentence this rung could not read. Honest, and a dead end on its
     * own — so it is marked, and a surface with no model chosen can offer
     * the one that reads any phrasing.
     */
    const unsure = (say: string): ChatReply => ({ say, proposals: [], unsure: true });

    const all = (kind: string): Node[] => [...store.graph.allNodes()].filter((node) => node.kind === kind) as Node[];
    const label = (node: Node | undefined): string => String(node?.["label"] ?? node?.id ?? "");
    const out = (id: string, kind: string): Node[] => store.graph.out(id, kind) as Node[];
    const into = (id: string, kind: string): Node[] => store.graph.in(id, kind) as Node[];
    const list = (words: readonly string[]): string =>
      words.length <= 1 ? (words[0] ?? "nothing") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

    /**
     * The node of a meta-kind whose name (or plural) the message says,
     * longest name first — and, where it matters, only within the PART of
     * the sentence that names it.
     *
     * "every shift needs a volunteer" names two kinds and means a rule over
     * the first: searching the whole sentence picked "volunteer" because it
     * is the longer word, which is the seat confidently declaring a rule
     * over the wrong thing. So each branch says where to look.
     */
    const named = (kind: string, within: string = said): Node | undefined => {
      const hay = squeeze(within);
      /*
       * THE EARLIEST NAME WINS, AND ITS OWN NAME BEATS ITS PLURAL.
       *
       * Longest-match alone read "Add details to Meal. The name of the food
       * and the number of people it can feed" as a field on USER — because
       * the user kind's plural is "People", "people" is inside "number of
       * people", and six letters beat four. The kind this sentence is about
       * is the one it says FIRST after pointing at it; a plural buried in a
       * description of something else is not a subject.
       */
      const hits = all(kind).flatMap((node) => {
        const said = [
          { text: label(node), rank: 0 },
          { text: String(node["title"] ?? ""), rank: 0 },
          { text: String(node["plural"] ?? ""), rank: 1 },
        ].filter((one) => one.text.length > 0);
        const found = said
          .flatMap((one) => forms(one.text).map((form) => ({ form, rank: one.rank })))
          .filter(({ form }) => form.length >= 3 && hay.includes(form))
          .map(({ form, rank }) => ({ node, at: hay.indexOf(form), length: form.length, rank }))
          .sort((a, b) => a.at - b.at || a.rank - b.rank || b.length - a.length);
        return found.length > 0 ? [found[0]!] : [];
      });
      return hits.sort((a, b) => a.at - b.at || a.rank - b.rank || b.length - a.length)[0]?.node;
    };
    /** The clause a phrase points at, cut at the first sentence end. */
    const clause = (phrase: string | undefined): string => (phrase ?? "").split(/[.;\n]/)[0] ?? "";

    // ------------------------------------------------------------ figures
    /*
     * The drawing gap, recorded honestly when figures shipped: `drawFigure`
     * carries the house style and judges its own answer with the checker's
     * own function, and it was reachable from code and from the CLI and
     * from nowhere a person sits. This is where a person sits.
     */
    const aboutFigures = /\b(figure|figures|drawing|drawn|draw|icon|picture)\b/.test(asked);
    if (aboutFigures && !imperative && /\b(no|without|missing|which|what|any|lack|lacks|lacking)\b/.test(asked) && !/\bfor\b/.test(asked)) {
      const kinds = all("kind");
      const undrawn = kinds.filter((kind) => typeof kind["figure"] !== "string" || kind["figure"] === "");
      return grounded(
        undrawn.length === 0
          ? `Every kind is drawn — ${list(kinds.map((kind) => label(kind)))}.`
          : `${undrawn.length} of ${kinds.length} ${kinds.length === 1 ? "kind has" : "kinds have"} no figure: ${list(undrawn.map((kind) => label(kind)))}. Ask me to draw one by name.`,
      );
    }
    if (aboutFigures) {
      const kind = named("kind");
      if (!kind) {
        return unsure(
          `Say which kind to draw — ${list(all("kind").map((one) => label(one)))} — and I will draw it in the house style.`,
        );
      }
      const drawn = options.complete
        ? await drawFigure(label(kind), typeof kind["description"] === "string" ? (kind["description"] as string) : undefined, options.complete)
        : { kind: label(kind), figure: nearestFigure(label(kind)), from: "shipped" as const, refused: ["nothing is behind the seat to draw with"] };
      const propose: ProposedCall[] = [
        {
          mutation: "set-figure",
          args: { id: kind.id, figure: drawn.figure },
          why: drawn.from === "model" ? "drawn in the house style and passed the checker's own figure test" : "the nearest shipped figure",
        },
      ];
      return reading(
        drawn.from === "model"
          ? `Drawn for ${label(kind)}, in the house style — the checker's own figure test passed it. Keep it or ask again for another.`
          : `I did not draw it: ${list(drawn.refused ?? [])}. The nearest shipped figure is "${drawn.figure}", which is an honest placeholder rather than a drawing of ${label(kind)}.`,
        propose,
      );
    }

    // ----------------------------------------------------- who may what
    if (!imperative && /\bwho\b/.test(asked) && /\b(may|can|allowed|permitted|able)\b/.test(asked)) {
      const act = named("act");
      const grants = all("grant").filter((g) => (act ? out(g.id, "may").some((one) => one.id === act.id) || g["allActs"] === true : true));
      if (grants.length === 0) {
        return grounded(
          act
            ? `No grant names ${label(act)}, so only a seat that may do anything can take it.`
            : `This declaration grants nothing — every act is open to whoever is here.`,
        );
      }
      const lines = grants.map((g) => {
        const roles = g["everyone"] === true ? "everyone" : list(out(g.id, "lets").map((role) => label(role)));
        const acts = g["allActs"] === true ? "every act" : list(out(g.id, "may").map((one) => String(one["title"] ?? label(one))));
        const kinds = g["allKinds"] === true ? "" : ` on ${list(out(g.id, "over").map((one) => label(one)))}`;
        return `${roles} may ${acts}${kinds}${g["self"] === true ? ", on their own record only" : ""}`;
      });
      return grounded(`${lines.join("; ")}.`);
    }

    // ------------------------------------------- what an act does, exactly
    const act = named("act");
    if (act && !imperative && /\b(write|writes|do|does|change|changes|act|touch)\b/.test(asked)) {
      const writes = Array.isArray(act["writes"]) ? (act["writes"] as unknown[]).map(String) : [];
      const parts = [
        writes.length > 0 ? `writes ${list(writes)}` : null,
        out(act.id, "creates").length > 0 ? `brings ${list(out(act.id, "creates").map((one) => label(one)))} into being` : null,
        out(act.id, "connects").length > 0 ? `makes the tie ${list(out(act.id, "connects").map((one) => label(one)))}` : null,
        out(act.id, "severs").length > 0 ? `breaks the tie ${list(out(act.id, "severs").map((one) => label(one)))}` : null,
      ].filter((part): part is string => part !== null);
      const on = out(act.id, "on").map((one) => label(one));
      const repaired = into(act.id, "repairs").map((one) => label(one));
      return grounded(
        `${String(act["title"] ?? label(act))} ${parts.length > 0 ? parts.join(", ") : "writes nothing the declaration names"}${on.length > 0 ? `, on ${list(on)}` : ""}.${act["destructive"] === true ? " It is destructive." : ""}${repaired.length > 0 ? ` It repairs ${list(repaired)}.` : ""}`,
      );
    }

    // --------------------------------------------- what a rule judges
    const rule = named("rule");
    if (rule && !imperative && /\b(judge|judges|rule|hold|holds|check|checks|mean|means)\b/.test(asked)) {
      const over = out(rule.id, "over").map((one) => label(one));
      const repairs = out(rule.id, "repairs").map((one) => String(one["title"] ?? label(one)));
      return grounded(
        `${String(rule["title"] ?? label(rule))} — ${String(rule["description"] ?? "no description")} It judges ${rule["wholeGraph"] === true ? "the whole graph" : over.length > 0 ? list(over) : "nothing"}${rule["judgesPast"] === true ? ", including the past" : ""}. ${repairs.length > 0 ? `Put right by ${list(repairs)}.` : "It names no repair, so the interface can only complain about it."}`,
      );
    }

    // ------------------------------------------------------ what is here
    if (!imperative && /\b(kind|kinds|shape|declare|declares|declared|model|models|track)\b/.test(asked) && /\b(what|which|list|show|how many|any)\b/.test(asked)) {
      const kinds = all("kind");
      const lines = kinds.map((kind) => {
        const fields = into(kind.id, "of").length;
        const edges = into(kind.id, "from-kind").length;
        return `${label(kind)} (${fields} field${fields === 1 ? "" : "s"}, ${edges} relation${edges === 1 ? "" : "s"})`;
      });
      return grounded(
        `${kinds.length} kind${kinds.length === 1 ? "" : "s"}: ${list(lines)}. There ${all("act").length === 1 ? "is" : "are"} ${all("act").length} act${all("act").length === 1 ? "" : "s"} and ${all("rule").length} rule${all("rule").length === 1 ? "" : "s"}.`,
      );
    }

    // --------------------------------- a role or a kind, named in words
    /*
     * "add a new Role for Participant" — and it must be THE FLOOR that
     * answers it, not a model.
     *
     * The graph responder only recognises an act when the message contains
     * its title exactly, so "add a new role" missed "Add a role", the floor
     * returned an ungrounded answer, and the on-device model got the turn.
     * It proposed `add-role` with no label at all, which the store then
     * refused for the arguments — a dead end with the person's own sentence
     * on one side of it and a zod error on the other.
     */
    const naming = /^\s*(?:add|create|make|declare)\b/.test(asked) || /\bnew\b/.test(asked);
    if (naming && !question) {
      const what = /\brole\b/.test(asked) ? "role" : /\bkind\b/.test(asked) ? "kind" : null;
      if (what) {
        /*
         * What it is to be CALLED, from the ways people actually say it:
         * in quotes, after "called"/"named"/"for", or in front of the word
         * itself ("add a participant role"). Never guessed — with no name
         * the seat asks for one rather than proposing an act that cannot
         * apply.
         */
        const given =
          text.match(/["'“”']([^"'“”']+)["'“”']/)?.[1] ??
          new RegExp(`\\b(?:called|named|for)\\s+(?:an?\\s+|the\\s+)?([A-Za-z][A-Za-z0-9 _-]*?)\\s*$`, "i").exec(text)?.[1] ??
          new RegExp(`\\b([A-Za-z][\\w-]*)\\s+${what}s?\\b`, "i").exec(text)?.[1];
        const called = given?.trim().replace(/^(a|an|the|new)\s+/i, "").trim();
        if (!called || /^(new|a|an|the)$/i.test(called)) {
          return unsure(
            `What should the ${what} be called? Say it in quotes, or "add a ${what} called …", and I will propose it.`,
          );
        }
        if (what === "role") {
          const already = all("role").find((role) => squeeze(label(role)) === squeeze(called));
          if (already) return grounded(`There is already a role called ${label(already)}.`);
          return reading(
            `A new role, "${called}". It is a seat somebody can hold — grants are what let it do anything, so it can take no act until one says so.`,
            [{ mutation: "add-role", args: { label: called }, why: `you asked for a ${called} role` }],
          );
        }
        const already = all("kind").find((kind) => squeeze(label(kind)) === squeeze(called));
        if (already) return grounded(`There is already a kind called ${label(already)}.`);
        return reading(
          `A new kind, "${called}", with a name to be called by. Check it below before you keep it.`,
          [{ mutation: "add-kind", args: { label: called }, why: `you asked for a ${called} kind` }],
        );
      }
    }

    // ------------------------------------------------- a tie, said in words
    /*
     * "Attach Meals to Shifts" — which the floor did not know at all, so the
     * turn fell through to a model, which proposed `add-edge` with no kind
     * and no label and earned a validation refusal in zod's own words.
     *
     * Which end declares it is a real decision and the seat must not hide
     * that it made one: a shift HAS meals, so the tie is declared on the
     * shift and points at the meal. The reply says so, and the proposal is
     * editable before it is kept.
     */
    const tying =
      /\b(attach|link|connect|relate|tie)\b.*\b(to|onto|with)\b/.test(asked) ||
      /\b(has|have|holds?|carr(?:y|ies))\b\s+(?:many\s+|some\s+|a\s+|an\s+)?/.test(asked);
    if (tying && !question) {
      const joined = /\b(?:attach|link|connect|relate|tie)\b\s+(.+?)\s+\b(?:to|onto|with)\b\s*(.*)$/i.exec(text);
      const owning = /^\s*(?:a|an|each|every|the)?\s*(.+?)\s+\b(?:has|have|holds|hold|carries|carry)\b\s+(?:many\s+|some\s+|a\s+|an\s+)?(.*)$/i.exec(text);
      // "attach A to B" hangs the tie on B; "a B has A" already says B first.
      const from = joined ? named("kind", clause(joined[2])) : owning ? named("kind", clause(owning[1])) : undefined;
      const to = joined ? named("kind", clause(joined[1])) : owning ? named("kind", clause(owning[2])) : undefined;
      if (from && to) {
        const plural = String(to["plural"] ?? "") || `${label(to)}s`;
        return reading(
          `A tie declared on ${label(from)}, pointing at ${label(to)} — a ${label(from)} has ${plural.toLowerCase()}. Change any of it below before you keep it.`,
          [
            {
              mutation: "add-edge",
              args: {
                kind: from.id,
                to: to.id,
                label: plural.toLowerCase(),
                description: `its ${plural.toLowerCase()}`,
                inverse: `the ${label(from)} it is on`,
                cardinality: "many",
              },
              why: `you asked to tie ${label(to)} to ${label(from)}`,
            },
          ],
        );
      }
      if (joined || owning) {
        return unsure(
          `Say both kinds by name and I will propose the tie — there ${all("kind").length === 1 ? "is" : "are"} ${list(all("kind").map((one) => label(one)))}.`,
        );
      }
    }

    // ----------------------------------------------- a field, said in words
    /*
     * "add a due date to tasks" — the shape a person actually says. The
     * kind is named at the end, the field in the middle, and the type is
     * whatever the name implies. Optional unless the person says otherwise:
     * a required field added to a kind that already has records is a
     * migration nobody asked for.
     */
    const adding = /^\s*(add|give|put)\b/.test(asked) && /\b(to|on|for)\b/.test(asked);
    if (adding) {
      const between = /\b(?:add|give|put)\b\s+(?:an?\s+|the\s+)?(.+?)\s+\b(?:to|on|for)\b\s*(.*)$/i.exec(text);
      const field = between?.[1]?.trim();
      /*
       * The kind is what comes AFTER "to", read no further than the end of
       * that sentence: everything after the full stop is a description of
       * the FIELD, and letting it name the kind put "details" on the wrong
       * one entirely.
       */
      const kind = named("kind", clause(between?.[2]));
      if (!kind && field && between?.[2]) {
        /*
         * AND WHEN THE KIND IT POINTS AT IS NOT ONE, IT SAYS SO.
         *
         * Reaching past the clause for any kind name anywhere in the
         * sentence is how "add details to Meal. The name of the food and
         * the number of people it can feed" put a field on USER: no kind
         * called Meal existed, and "people" is the user kind's plural.
         * Guessing a subject from a description of something else is worse
         * than asking.
         */
        return unsure(
          `There is no kind called "${clause(between[2]).trim()}". There ${all("kind").length === 1 ? "is" : "are"} ${list(all("kind").map((one) => label(one)))} — or ask me to add it first.`,
        );
      }
      if (kind && field && !/\b(edge|relation|tie|act|rule|role)\b/i.test(field)) {
        const type = typeFromName(field);
        const required = /\brequired\b|\bmust\b|\balways\b/.test(asked);
        return reading(
          `"${field}" reads as ${type === "text" ? "a long text" : `a ${type}`}, on ${label(kind)}${required ? ", required" : ", optional so the records that already exist stay valid"}. Check it below before you keep it.`,
          [
            {
              mutation: "add-field",
              args: { kind: kind.id, label: field, type, required },
              why: `you asked for "${field}" on ${label(kind)}`,
            },
          ],
        );
      }
    }

    // ------------------------------------------------ a rule, said in words
    const needs = /\b(every|each|all)\b.*\b(needs?|must|should|requires?|has to have)\b/.test(asked);
    if (needs) {
      const subject = /\b(?:every|each|all)\b\s+(.+?)\s+\b(?:needs?|must|should|requires?|has to have)\b/i.exec(text);
      const kind = named("kind", subject?.[1] ?? said) ?? named("kind");
      if (kind) {
        const name = text
          .trim()
          .replace(/[.?!]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60);
        return reading(
          `A rule over ${label(kind)}. The judgement itself is code — the studio declares the rule and names where its body goes; the file it writes says so where the checkout must fill it in.`,
          [
            {
              mutation: "add-rule",
              args: { kind: kind.id, label: name, description: text.trim() },
              why: `you said every ${label(kind)} needs it`,
            },
          ],
        );
      }
    }

    // ------------------------------------ everything else the graph can say
    /*
     * AND WHEN NOTHING HERE COULD READ IT, that is worth saying rather than
     * answering a different question. The graph responder's last resort is
     * a description of the shape — true, and not what was asked — so an
     * answer with nothing under it from a sentence that was plainly asking
     * for a CHANGE is marked as unread, and a surface with no model chosen
     * can offer the rung that reads any phrasing.
     */
    const fallback = await floor(store, text, context);
    return fallback.grounded || fallback.proposals.length > 0 || question
      ? fallback
      : { ...fallback, unsure: true };
  };
}
