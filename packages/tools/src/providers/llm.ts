import type { AnySchema } from "@graview/core";
import type { Affordance, DeriveContext } from "../types.js";

export interface LlmProposal {
  readonly label: string;
  readonly mutation: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly why: string;
}

export interface LlmProvider<S extends AnySchema> {
  propose(context: DeriveContext<S>): Promise<readonly LlmProposal[]>;
}

const LLM_SCORE = 20;

/**
 * The LLM is ONE affordance provider, and an optional one — not the
 * mechanism. It runs last, only when the schema, the invariants and the
 * structure of the graph came up short, and everything it returns is checked
 * against the same schema and invariants as everything else.
 *
 * Nothing here talks to a model. An app injects one, which keeps the whole
 * tools package headless and testable, and keeps "no LLM configured" an
 * ordinary state rather than a degraded one.
 */
export async function deriveWithLlm<S extends AnySchema>(
  provider: LlmProvider<S>,
  context: DeriveContext<S>,
  existing: readonly Affordance[],
  options: { minimum?: number } = {},
): Promise<Affordance[]> {
  const minimum = options.minimum ?? 3;
  if (existing.length >= minimum) return [];

  const proposals = await provider.propose(context);
  const affordances: Affordance[] = [];
  proposals.forEach((proposal, index) => {
    // A proposal naming a mutation that does not exist is a hallucination,
    // and it stops here rather than reaching the interface.
    let known = true;
    try {
      context.store.mutation(proposal.mutation);
    } catch {
      known = false;
    }
    if (!known) return;

    affordances.push({
      id: `llm:${index}`,
      label: proposal.label,
      provider: "llm",
      mutation: proposal.mutation,
      args: proposal.args,
      open: [],
      score: LLM_SCORE - index,
      why: proposal.why,
      nodeIds: context.selection,
    });
  });
  return affordances;
}
