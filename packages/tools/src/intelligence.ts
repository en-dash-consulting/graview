import {
  formFields,
  labelOf,
  type AnySchema,
  type FormField,
  type MutationCall,
  type Store,
} from "@graview/core";
import type { Affordance, AffordanceProvider } from "./types.js";

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
