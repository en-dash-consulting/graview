import {
  formFields,
  labelOf,
  readableFields,
  violationsTouching,
  type AnySchema,
  type FormField,
  type Store,
} from "@graview/core";
import { validateProposals, type Completion, type ProposedCall } from "./intelligence.js";

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
}

export interface ChatContext {
  /** The current selection: what "this" means. */
  readonly selection?: readonly string[];
  /** Prior turns, oldest first, for responders that use them. */
  readonly history?: readonly { readonly role: "person" | "seat"; readonly text: string }[];
}

export type Responder<S extends AnySchema = AnySchema> = (
  store: Store<S>,
  text: string,
  context?: ChatContext,
) => Promise<ChatReply>;

const sentence = (parts: readonly string[]): string => parts.filter(Boolean).join(" ");

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
      labelOf(store.schema.tryDefinition(node.kind), node as never);

    /*
     * REFERENTS: the selection first — "this" means what is selected — then
     * any node whose label appears in the message, longest label first so
     * "Morning school run" wins over "run".
     */
    const referents: ({ id: string; kind: string } & Record<string, unknown>)[] = [];
    for (const id of context.selection ?? []) {
      const node = store.graph.getNode(id);
      if (node) referents.push(node as never);
    }
    const byLabel = [...store.graph.allNodes()]
      .map((node) => ({ node, label: name(node).toLowerCase() }))
      .filter(({ label }) => {
        // Whole words only: "Bo" must match "give it to Bo" and must not
        // match "elbow". Short names are real names.
        if (label.length < 2) return false;
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|\\W)${escaped}(\\W|$)`).test(asked);
      })
      .sort((a, b) => b.label.length - a.label.length);
    for (const { node } of byLabel) {
      if (!referents.some((held) => held.id === node.id)) referents.push(node as never);
    }

    const violations = store.violations();
    const readyRepairs = (subset = violations): ProposedCall[] =>
      subset.flatMap((violation) => {
        const repair = violation.repairs.find((candidate) => !candidate.missing?.length);
        return repair
          ? [{ mutation: repair.mutation, args: { ...repair.args }, why: violation.message }]
          : [];
      });

    // ------------------------------------------------------- the standing
    if (/\b(wrong|broken|problem|violat|standing|fix)\b/.test(asked)) {
      if (violations.length === 0) {
        return { say: "Nothing is broken — every declared rule holds.", proposals: [] };
      }
      return {
        say: sentence([
          `${violations.length} ${violations.length === 1 ? "problem" : "problems"}:`,
          violations
            .slice(0, 4)
            .map((violation) => violation.message)
            .join("; ") + (violations.length > 4 ? "…" : "."),
          "The repairs below come from the rules themselves.",
        ]),
        proposals: validateProposals(store, readyRepairs().slice(0, 4)),
      };
    }

    // -------------------------------------------- a mutation, said in words
    const phrased = store.allMutations().find((mutation) => {
      const title = (mutation.title ?? mutation.name).toLowerCase();
      return title.length > 3 && asked.includes(title);
    });
    if (phrased) {
      const args: Record<string, unknown> = {};
      const missing: string[] = [];
      const quoted = text.match(/"([^"]+)"/)?.[1];
      for (const field of formFields(phrased.input)) {
        const value = answerFrom(field, referents, quoted, options.today);
        if (value !== undefined) args[field.name] = value;
        else if (!field.optional) missing.push(field.name);
      }
      if (missing.length === 0) {
        return {
          say: `I can do that. Review it below — it applies like any other change, and undo works.`,
          proposals: validateProposals(store, [
            { mutation: phrased.name, args, why: `you asked in words` },
          ]),
        };
      }
      return {
        say: `"${phrased.title ?? phrased.name}" needs ${missing.join(", ")} — name the ${missing.length === 1 ? "thing" : "things"} (or select ${missing.length === 1 ? "it" : "them"}) and ask again.`,
        proposals: [],
      };
    }

    // ------------------------------------------------------ a named thing
    if (referents.length > 0) {
      const node = referents[0]!;
      const definition = store.schema.tryDefinition(node.kind);
      const facts = readableFields(node, definition, { limit: 3 })
        .map((field) => `${field.label.toLowerCase()} ${field.value}`)
        .join(", ");
      const touching = violationsTouching(violations, [node.id]);
      const degree = [...store.graph.allEdges()].filter(
        (edge) => edge.from === node.id || edge.to === node.id,
      ).length;
      return {
        say: sentence([
          `${name(node)} — a ${node.kind}${facts ? ` (${facts})` : ""},`,
          `connected to ${degree} ${degree === 1 ? "thing" : "things"}.`,
          touching.length > 0
            ? `Trouble: ${touching.map((violation) => violation.message).join("; ")}.`
            : "Nothing about it is broken.",
        ]),
        proposals: validateProposals(store, readyRepairs(touching).slice(0, 3)),
      };
    }

    // ------------------------------------------------------------ the shape
    const counts = (store.schema.kinds as readonly string[])
      .filter((kind) => !store.modules.disabledKinds.has(kind))
      .map((kind) => {
        const plural = store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;
        return `${store.graph.nodesOfKind(kind as never).length} ${plural}`;
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

/** One honest answer for one form field, or undefined — never a guess. */
function answerFrom(
  field: FormField,
  referents: readonly ({ id: string; kind: string } & Record<string, unknown>)[],
  quoted: string | undefined,
  today: string | undefined,
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
    case "date":
      return today ?? new Date().toISOString().slice(0, 10);
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
    const mutations = store
      .allMutations()
      .map((mutation) => `- ${mutation.name}: ${mutation.description ?? mutation.title ?? ""}`)
      .join("\n");
    const selected = (context.selection ?? [])
      .map((id) => {
        const node = store.graph.getNode(id);
        return node ? `${id} (${labelOf(store.schema.tryDefinition(node.kind), node as never)})` : id;
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
    const prompt = [
      "You are the seat of a typed context graph. Answer briefly and propose only declared mutations.",
      `Mutations:\n${mutations}`,
      trouble ? `Currently broken:\n${trouble}` : "Nothing is broken.",
      selected ? `Selected right now (what "this" means): ${selected}` : "Nothing is selected.",
      history ? `Conversation so far:\n${history}` : "",
      `Person: ${text}`,
      'Answer ONLY JSON: {"say": string, "proposals": [{"mutation": string, "args": object, "why": string}]}.',
    ]
      .filter(Boolean)
      .join("\n\n");
    const answer = await options.complete(prompt);
    const match = answer.match(/\{[\s\S]*\}/);
    if (!match) return { say: answer.trim() || "…", proposals: [] };
    try {
      const parsed = JSON.parse(match[0]) as { say?: string; proposals?: ProposedCall[] };
      return {
        say: typeof parsed.say === "string" && parsed.say.length > 0 ? parsed.say : "…",
        proposals: validateProposals(store, parsed.proposals ?? [], options.may),
      };
    } catch {
      return { say: answer.trim(), proposals: [] };
    }
  };
}
