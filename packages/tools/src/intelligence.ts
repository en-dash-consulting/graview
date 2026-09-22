import {
  argShape,
  formFields,
  labelOf,
  nodeRefArgs,
  type AnySchema,
  type FormField,
  type MutationCall,
  type Store,
} from "@graview/core";
import type { Affordance, AffordanceProvider, OpenParameter } from "./types.js";

/**
 * INTELLIGENCE IS ONE SEAM, whoever supplies it.
 *
 * Three layers of trust share it: the graph's own structural derivations,
 * a model reached through a completion function, and a customer's external
 * agent arriving over the derived tool surface. All three produce the same
 * thing — proposed calls to declared mutations — and everything downstream
 * (preview, permission, the op log, selective undo) treats them exactly
 * like a human's, because they travel the same path. There is no second,
 * privileged way in, and "add AI" is choosing a provider, not an
 * integration.
 */

export interface ProposedCall {
  readonly mutation: string;
  readonly args: Readonly<Record<string, unknown>>;
  /** Why this provider suggests it, in one sentence. */
  readonly why?: string;
}

/**
 * THE FIRST WHOLE JSON OBJECT IN AN ANSWER, or nothing.
 *
 * Models fence code, apologise first, explain afterwards and — often
 * enough to matter — close one brace too many. Taking everything between
 * the first `{` and the last `}` swallowed the extra, `JSON.parse` threw,
 * and the caller fell back to showing the person the raw answer: a chat
 * bubble containing `{"say": "Yes", "proposals": [...]}}`, which is the
 * seat handing over its own plumbing.
 *
 * Scanning for the BALANCED close instead reads the object the model meant
 * and ignores whatever it typed after it. Strings and their escapes are
 * respected, or a brace inside a description ends the object early.
 */
export function firstJsonObject(answer: string): unknown {
  /*
   * EITHER SHAPE THE MODEL ACTUALLY USES.
   *
   * Asked for `{"say", "proposals"}`, a model answers with the bare ARRAY
   * of proposals often enough to matter — the sibling seam on this very
   * contract asks for exactly that — and reading from the first `{` found
   * the first PROPOSAL inside the array, returned it as the whole answer,
   * and left the person looking at "…" with a perfectly good list thrown
   * away. Whichever bracket opens first is the value the model meant.
   */
  const object = answer.indexOf("{");
  const array = answer.indexOf("[");
  const start = array !== -1 && (object === -1 || array < object) ? array : object;
  if (start === -1) return undefined;
  const opener = answer[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let at = start; at < answer.length; at++) {
    const char = answer[at]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === opener) depth += 1;
    else if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(answer.slice(start, at + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/**
 * A NAME IS NOT AN ID, and a model will hand you a name.
 *
 * Asked to add a field to Meal, a model answers `{"kind": "Meal"}` — the
 * word on the screen rather than the node's id — and the store refuses it
 * for the arguments, in zod's words, under a struck-through line. That is
 * a lookup, not a guess: where EXACTLY ONE node of a kind the argument
 * accepts carries that label, the label means that node. Where two do, or
 * none, the value is left exactly as it came and the form asks.
 */
export function resolveProposal<S extends AnySchema>(
  store: Store<S>,
  proposal: ProposedCall,
): ProposedCall {
  let mutation;
  try {
    mutation = store.mutation(proposal.mutation);
  } catch {
    return proposal;
  }
  const args: Record<string, unknown> = { ...proposal.args };
  let moved = false;
  for (const field of formFields((mutation as { input?: unknown }).input)) {
    if (field.control !== "node") continue;
    const said = args[field.name];
    if (typeof said !== "string" || said.length === 0) continue;
    if (store.graph.getNode(said)) continue;
    const wanted = said.trim().toLowerCase();
    const found = [...store.graph.allNodes()].filter(
      (node) =>
        (field.kinds.includes("*") || field.kinds.includes(node.kind as string)) &&
        labelOf(store.schema.tryDefinition(node.kind as string), node as never).trim().toLowerCase() === wanted,
    );
    if (found.length === 1) {
      args[field.name] = found[0]!.id;
      moved = true;
    }
  }
  return moved ? { ...proposal, args } : proposal;
}

/** A proposal as the store's own call shape, ready for apply/preview. */
export function toCall(proposal: ProposedCall): MutationCall {
  return { name: proposal.mutation, args: { ...proposal.args } };
}

export interface Intelligence<S extends AnySchema = AnySchema> {
  readonly name: string;
  /** What this provider may call. Absent means anything declared. */
  readonly may?: readonly string[];
  propose(store: Store<S>): Promise<readonly ProposedCall[]>;
}

/** The whole vendor surface: one prompt in, one string out. */
export type Completion = (prompt: string) => Promise<string>;

/**
 * WHAT THE GATE TOOK OUT, AND WHY — so a seat can say so.
 *
 * `validateProposals` drops silently, which is right for a provider filling
 * the inspector and wrong for a conversation: a model that answers "Sure"
 * and names `add_field` on an app whose act is `add-field` left a person
 * looking at a sentence with nothing under it and no way to know why. The
 * seat can only say what it is told.
 */
export function droppedProposals<S extends AnySchema>(
  store: Store<S>,
  proposals: readonly ProposedCall[],
  may?: readonly string[],
): readonly { readonly proposal: ProposedCall; readonly why: "unknown" | "not-allowed" }[] {
  const allowed = may === undefined ? null : new Set(may);
  const out: { proposal: ProposedCall; why: "unknown" | "not-allowed" }[] = [];
  for (const proposal of proposals) {
    if (typeof proposal.mutation !== "string") continue;
    let known = true;
    try {
      store.mutation(proposal.mutation);
    } catch {
      known = false;
    }
    if (!known) out.push({ proposal, why: "unknown" });
    else if (allowed && !allowed.has(proposal.mutation)) out.push({ proposal, why: "not-allowed" });
  }
  return out;
}

/** Drops proposals naming unknown or disallowed mutations, with no guessing. */
export function validateProposals<S extends AnySchema>(
  store: Store<S>,
  proposals: readonly ProposedCall[],
  may?: readonly string[],
): readonly ProposedCall[] {
  const allowed = may === undefined ? null : new Set(may);
  return proposals.filter((proposal) => {
    if (typeof proposal.mutation !== "string") return false;
    if (allowed && !allowed.has(proposal.mutation)) return false;
    try {
      store.mutation(proposal.mutation);
    } catch {
      return false;
    }
    return proposal.args !== null && typeof proposal.args === "object";
  });
}

/**
 * An LLM as a provider: the model reads a compact statement of the
 * declaration and the current trouble, and answers with calls to declared
 * mutations. Vendor-neutral by construction — the adapter is one async
 * function, so claude/openai/local are one line each in the host.
 */
export function llmIntelligence<S extends AnySchema>(options: {
  readonly name: string;
  readonly complete: Completion;
  readonly may?: readonly string[];
}): Intelligence<S> {
  return {
    name: options.name,
    ...(options.may ? { may: options.may } : {}),
    async propose(store) {
      const kinds = (store.schema.kinds as readonly string[])
        .map((kind) => {
          const definition = store.schema.tryDefinition(kind);
          const count = store.graph.nodesOfKind(kind as never).length;
          return `- ${kind} (${definition?.plural ?? `${kind}s`}, ${count} present): ${definition?.description ?? ""}`;
        })
        .join("\n");
      const mutations = store
        .allMutations()
        .map((mutation) => `- ${mutation.name}: ${mutation.description ?? mutation.title ?? ""}`)
        .join("\n");
      const trouble = store
        .violations()
        .map((violation) => `- ${violation.message}`)
        .join("\n");
      const prompt = [
        "You are proposing changes to a typed context graph.",
        "Kinds:",
        kinds,
        "Mutations you may call:",
        mutations,
        trouble ? `Currently broken:\n${trouble}` : "Nothing is currently broken.",
        'Answer ONLY a JSON array of {"mutation": string, "args": object, "why": string}.',
      ].join("\n\n");
      const answer = await options.complete(prompt);
      const match = answer.match(/\[[\s\S]*\]/);
      if (!match) return [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return [];
      }
      if (!Array.isArray(parsed)) return [];
      return validateProposals(store, parsed as ProposedCall[], options.may);
    },
  };
}

/**
 * Starter data FROM THE DECLARATION ALONE — the intelligence an empty app
 * has before any key exists. For each mutation that creates a kind with no
 * members yet, synthesise honest arguments off the derived form: sample
 * text, today's date, a bounded number, the first choice. Anything needing
 * a node that does not exist is left for the next round rather than faked.
 */
export function templateIntelligence<S extends AnySchema>(
  options: { readonly name?: string; readonly today?: string } = {},
): Intelligence<S> {
  return {
    name: options.name ?? "starter",
    async propose(store) {
      const today = options.today ?? new Date().toISOString().slice(0, 10);
      const proposals: ProposedCall[] = [];
      const fill = (field: FormField, hint?: string): { ok: boolean; value?: unknown } => {
        switch (field.control) {
          case "text":
            // "First gardener", not "First label": the field is almost
            // always the thing's name, and the hint is what it names.
            return { ok: true, value: `First ${hint ?? field.name}` };
          case "date":
            return { ok: true, value: today };
          case "number":
            return { ok: true, value: field.min ?? 1 };
          case "boolean":
            return { ok: true, value: false };
          case "choice":
            return field.options?.length
              ? { ok: true, value: field.options[0] }
              : { ok: false };
          case "variant": {
            const arm = field.options[0];
            if (!arm) return { ok: false };
            const held: Record<string, unknown> = { [field.tag]: arm.value };
            for (const child of arm.fields) {
              const answer = fill(child);
              if (!answer.ok && !child.optional) return { ok: false };
              if (answer.ok) held[child.name] = answer.value;
            }
            return { ok: true, value: held };
          }
          case "group": {
            const held: Record<string, unknown> = {};
            for (const child of field.fields) {
              const answer = fill(child);
              if (!answer.ok && !child.optional) return { ok: false };
              if (answer.ok) held[child.name] = answer.value;
            }
            return { ok: true, value: held };
          }
          default:
            return { ok: false };
        }
      };

      for (const mutation of store.allMutations()) {
        const creates = mutation.creates ?? [];
        const empty = creates.filter(
          (kind) => store.graph.nodesOfKind(kind as never).length === 0,
        );
        if (empty.length === 0) continue;
        const args: Record<string, unknown> = {};
        let possible = true;
        for (const field of formFields(mutation.input)) {
          const answer = fill(field, empty[0]);
          if (!answer.ok) {
            if (!field.optional) possible = false;
            continue;
          }
          args[field.name] = answer.value;
        }
        if (!possible) continue;
        proposals.push({
          mutation: mutation.name,
          args,
          why: `nothing of kind ${empty.join(", ")} exists yet`,
        });
      }

      // Repairs whose arguments the violation already decided.
      for (const violation of store.violations()) {
        const repair = violation.repairs.find((candidate) => !candidate.missing?.length);
        if (!repair) continue;
        proposals.push({
          mutation: repair.mutation,
          args: { ...repair.args },
          why: violation.message,
        });
      }
      return validateProposals(store, proposals);
    },
  };
}

/**
 * An Intelligence as an affordance provider, for the suggestion surfaces.
 *
 * `deriveAffordances` is synchronous and a model is not, so the wrapper
 * answers from a cache keyed to the log length and refreshes in the
 * background; `notify` tells the host a fresh answer landed (a re-render
 * re-derives). Every suggestion says which provider and why, and applies
 * through the ordinary path — previewable, attributed, undoable.
 */
export function intelligenceProvider<S extends AnySchema>(
  intelligence: Intelligence<S>,
  hooks: { readonly notify?: () => void } = {},
): AffordanceProvider<S> {
  let version = -1;
  let pending = false;
  let cached: readonly ProposedCall[] = [];
  return {
    name: "llm",
    derive({ store }) {
      const now = store.log.all().length;
      if (now !== version && !pending) {
        pending = true;
        void intelligence
          .propose(store)
          .then((proposals) => {
            cached = proposals;
            version = now;
            hooks.notify?.();
          })
          .catch(() => {
            cached = [];
            version = now;
          })
          .finally(() => {
            pending = false;
          });
      }
      const affordances: Affordance[] = cached.map((proposal, index) => {
        const mutation = store.allMutations().find((m) => m.name === proposal.mutation);
        return {
          id: `llm:${intelligence.name}:${index}`,
          label: mutation?.title ?? proposal.mutation,
          provider: "llm",
          mutation: proposal.mutation,
          args: proposal.args,
          open: [],
          score: 25,
          why: `${intelligence.name}: ${proposal.why ?? "suggested"}`,
          nodeIds: [],
        };
      });
      return { affordances };
    },
  };
}

/** Something readable for logs and seats: the provider's own sentence. */
export function describeProposal<S extends AnySchema>(
  store: Store<S>,
  proposal: ProposedCall,
): string {
  const mutation = store.allMutations().find((m) => m.name === proposal.mutation);
  const subject = mutation?.subject?.arg;
  const id = subject ? proposal.args[subject] : undefined;
  const node = typeof id === "string" ? store.graph.getNode(id) : undefined;
  const title = mutation?.title ?? proposal.mutation;
  return node
    ? `${title} — ${labelOf(store.schema.tryDefinition(node.kind), node as never)}`
    : title;
}

/**
 * WHAT A PROPOSAL HAS NOT SAID YET.
 *
 * A responder proposes from the graph and knows nothing of the policy, so
 * the seat asks the store whether the person may do a thing before offering
 * it. It knows just as little about the ACT'S OWN ARGUMENTS — a model told
 * "add a shift called soup kitchen" will happily answer `add-shift` with no
 * arguments at all, or with the label and none of the day, the place and
 * the hours. Applied, the store refuses, and what reaches the person is the
 * validator talking to itself:
 *
 *   Refused: Invalid arguments for mutation "add-shift" label: Invalid
 *   input: expected string, received undefined; on: Invalid input: …
 *
 * That is not a refusal, it is a stack trace. The act was never impossible;
 * it was under-specified, and the framework already knows what to do with
 * an under-specified act — it asks. A person pressing "Add a shift" from
 * the menu gets the same questions one at a time, with the graph's own
 * candidates offered for anything that names a node.
 *
 * So: the arguments this proposal still owes, in the shape the ask already
 * takes. Empty means it is ready to apply.
 */
export function stillNeeded<S extends AnySchema>(
  store: Store<S>,
  proposal: ProposedCall,
): readonly OpenParameter[] {
  const mutation = store.allMutations().find((one) => one.name === proposal.mutation);
  if (!mutation) return [];
  const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
  const refs = nodeRefArgs(mutation.input);
  const owed: OpenParameter[] = [];
  for (const name of Object.keys(shape)) {
    if (optionalArg(shape[name])) continue;
    const given = proposal.args[name];
    /*
     * Given means given. A model that answers `""` or `null` for a required
     * field has not answered it — and the empty string is the common one,
     * because a model asked for JSON fills every key it was shown.
     */
    if (given !== undefined && given !== null && given !== "") continue;
    const ref = refs.find((candidate) => candidate.name === name);
    owed.push({
      name,
      ...(ref ? { kinds: ref.kinds } : {}),
      ...(ref
        ? {
            candidates: ref.kinds.includes("*")
              ? store.graph.allNodes().map((node) => node.id)
              : ref.kinds.flatMap((kind) =>
                  store.graph.nodesOfKind(kind as never).map((node) => node.id),
                ),
          }
        : {}),
      shape: argShape(mutation.input, name),
    });
  }
  return owed;
}

/** Whether an argument may be left out, so it does not count as unanswered. */
function optionalArg(schema: unknown): boolean {
  const type = (schema as { _def?: { type?: string } })?._def?.type;
  return type === "optional" || type === "default" || type === "nullable";
}
