import { labelOf, type AnyGraphNode, type AnySchema, type Store } from "@graview/core";
import { mutationToolSchema } from "@graview/core/json-schema";
import { policyInstruction, type AgentStep } from "@graview/core/workflows";
import { firstJsonObject, resolveProposal, toCall, validateProposals, type ProposedCall } from "../intelligence.js";
import type { StepContext, StepRunner } from "./types.js";

/*
 * LET A MODEL PROPOSE (Roadmap f-job-step-types), on dreaming's terms: the
 * model is shown the step's instruction, the records of the kinds it reads
 * as the run's author sees them, and the acts it may propose with their
 * input schemas — the same schemas the agent tool surface hands a seat —
 * and answers with calls, each with how sure it is and why. A call to an
 * act not on the list is dropped; the rest go through the run's one door,
 * where `approve` and the confidence say what each becomes, exactly as the
 * app's own actor's judgments are routed. One request a step unless the
 * step's `budget.calls` says more is allowed (one is all it needs), and the
 * records shown are cut to the step's `budget.tokens` (50,000 when unsaid).
 * No model lent — or the host turned AI off — and the step is skipped, said
 * on the run, which is then `partial`: never a failure. What the call spent
 * — the reply's `usage` — is counted on the run (`spent`).
 */

const SYSTEM = [
  "You are an automated step of an app's workflow. You read the app's records and propose changes as calls to its acts.",
  'Answer with JSON only: {"proposals": [{"mutation": "<act>", "args": {…}, "confidence": 0.0-1.0, "why": "<one sentence>"}]}.',
  "Propose only the acts you are given, with arguments their schemas take. Name records by their id. Propose nothing when nothing is needed.",
].join(" ");

/** A record as the model reads it: its id, kind, name and fields. */
const said = (store: Store<AnySchema>, node: AnyGraphNode) => ({ id: node.id, kind: node.kind, name: labelOf(store.schema.tryDefinition(node.kind as string), node), ...Object.fromEntries(Object.entries(node).filter(([key]) => key !== "id" && key !== "kind" && !key.startsWith("$"))) });

export const runAgentStep: StepRunner<AgentStep> = {
  key: "agent",
  async run(step, context: StepContext) {
    const complete = context.ai?.off ? undefined : context.ai?.complete;
    if (!complete) return context.skipped("no model was lent, so the model's step did not run.");
    const seen = context.seen;
    const tokens = step.budget?.tokens ?? 50_000;
    const acts = step.acts.flatMap((name) => {
      try {
        return [mutationToolSchema(seen.mutation(name) as never)];
      } catch {
        return [];
      }
    });
    const head = `${step.agent}${policyInstruction(context.follows)}\n\nActs you may propose:\n${JSON.stringify(acts)}\n\nRecords (${step.reads.join(", ")}):\n`;
    const graph = seen.graph as unknown as { nodesOfKind(kind: string): AnyGraphNode[] };
    const lines: string[] = [];
    let size = Math.ceil((SYSTEM.length + head.length) / 4);
    let cut = 0;
    for (const kind of step.reads) {
      for (const node of seen.schema.tryDefinition(kind) ? graph.nodesOfKind(kind) : []) {
        const line = JSON.stringify(said(seen, node));
        if (size + Math.ceil(line.length / 4) > tokens) {
          cut++;
          continue;
        }
        size += Math.ceil(line.length / 4);
        lines.push(line);
      }
    }
    if (Math.ceil((SYSTEM.length + head.length) / 4) > tokens) return context.skipped(`its instruction and acts alone are past its budget of ${tokens} tokens.`);
    if (cut > 0) context.note(`Step ${context.index + 1}: ${cut} record${cut === 1 ? " was" : "s were"} left out to keep to its budget of ${tokens} tokens.`);
    let text: string;
    const model = step.model ?? context.ai?.name ?? "model";
    try {
      const reply = await complete({ system: SYSTEM, prompt: `${head}${lines.join("\n")}` });
      text = reply.text;
      const usage = reply.usage;
      context.spent({ calls: 1, model, ...(usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, ...(usage.costUsd !== undefined ? { costUsd: usage.costUsd } : {}) } : {}) });
      if (usage && usage.inputTokens + usage.outputTokens > tokens) context.note(`Step ${context.index + 1} spent ${usage.inputTokens + usage.outputTokens} tokens, past its budget of ${tokens}.`);
    } catch (error) {
      context.spent({ calls: 1, model });
      return context.skipped(`the model did not answer: ${error instanceof Error ? error.message : String(error)}`);
    }
    const parsed = firstJsonObject(text);
    const raw = (Array.isArray(parsed) ? parsed : ((parsed as { proposals?: unknown } | undefined)?.proposals ?? [])) as (ProposedCall & { confidence?: unknown; act?: string })[];
    const proposals = (Array.isArray(raw) ? raw : []).map((one) => ({ ...one, mutation: one.mutation ?? one.act ?? "" }));
    const valid = validateProposals(seen as Store<AnySchema>, proposals, step.acts);
    if (valid.length < proposals.length) context.note(`Step ${context.index + 1}: ${proposals.length - valid.length} of what the model proposed named an act it may not propose, and was let go.`);
    for (const proposal of valid) {
      const resolved = resolveProposal(seen as Store<AnySchema>, proposal);
      const sure = (proposal as { confidence?: unknown }).confidence;
      const confidence = typeof sure === "number" ? Math.min(1, Math.max(0, sure)) : 0.5;
      context.change({ calls: [toCall(resolved)], basis: proposal.why ?? step.agent, confidence, model });
    }
  },
};
