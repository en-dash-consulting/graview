import { labelOf, type AnyGraphNode, type AnySchema, type Store } from "@graview/core";
import { mutationToolSchema } from "@graview/core/json-schema";
import { farReferenceOf, isFarReference, policyInstruction, type AgentStep } from "@graview/core/workflows";
import { firstJsonObject, resolveProposal, toCall, validateProposals, type ProposedCall } from "../intelligence.js";
import type { FarApp, StepContext, StepRunner } from "./types.js";

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
 *
 * ANOTHER APP'S KINDS AND ACTS (`@self/graview-public/ticket`, Roadmap
 * f-workflow-steps-in-another-app) are reached through the host
 * (`StepContext.otherApp`) as the run's actor: its records read there, its
 * acts listed with the input schemas its host says, and a call to one run
 * there through the door to it (`changeFar`). An app the host does not let
 * the run reach refuses the step whole, in words: a model shown half of
 * what it was asked to judge does not propose.
 */

const SYSTEM = [
  "You are an automated step of an app's workflow. You read the app's records and propose changes as calls to its acts.",
  'Answer with JSON only: {"proposals": [{"mutation": "<act>", "args": {…}, "confidence": 0.0-1.0, "why": "<one sentence>"}]}.',
  "Propose only the acts you are given, with arguments their schemas take. Name records by their id. Propose nothing when nothing is needed.",
].join(" ");

/** Said when a step reaches another app: what a name beginning "@" is. */
const FAR_SAID = 'An act or a kind written "@<app>/<name>" is another app\'s: propose it by that whole name, and name its records by their id there.';

/** The most records of another app's kind a step is shown: what one read asks its host for. */
const MOST_FAR_RECORDS = 500;

/** A record as the model reads it: its id, kind, name and fields. */
const said = (store: Store<AnySchema>, node: AnyGraphNode) => ({ id: node.id, kind: node.kind, name: labelOf(store.schema.tryDefinition(node.kind as string), node), ...Object.fromEntries(Object.entries(node).filter(([key]) => key !== "id" && key !== "kind" && !key.startsWith("$"))) });

export const runAgentStep: StepRunner<AgentStep> = {
  key: "agent",
  async run(step, context: StepContext) {
    const complete = context.ai?.off ? undefined : context.ai?.complete;
    if (!complete) return context.skipped("no model was lent, so the model's step did not run.");
    // Every other app it names, reached first: one it may not reach refuses the step.
    const apps = new Map<string, FarApp>();
    for (const name of [...step.reads, ...step.acts].filter(isFarReference)) {
      const ref = farReferenceOf(name);
      if (!ref) return context.skipped(`“${name}” names no kind or act of another app.`);
      if (apps.has(ref.address)) continue;
      const app = await context.otherApp(ref.address);
      if ("refused" in app) return context.skipped(`${app.refused}, so the model's step did not run.`);
      apps.set(ref.address, app);
    }
    const farAct = (name: string) => {
      const ref = isFarReference(name) ? farReferenceOf(name) : undefined;
      const app = ref ? apps.get(ref.address) : undefined;
      return ref && app && Object.hasOwn(app.shape.acts, ref.name) ? { ref, app, shape: app.shape.acts[ref.name]! } : undefined;
    };
    const seen = context.seen;
    const tokens = step.budget?.tokens ?? 50_000;
    const acts = step.acts.flatMap((name): readonly object[] => {
      if (isFarReference(name)) {
        const found = farAct(name);
        if (!found) {
          context.note(`Step ${context.index + 1}: “${name}” is not an act the app there has, so the model was not offered it.`);
          return [];
        }
        // Another app's act, by its whole name, with the schema its host says.
        return [{ name, ...(found.shape.title ? { title: found.shape.title } : {}), description: found.shape.description ?? found.shape.title ?? found.ref.name, inputSchema: found.shape.input, app: found.app.shape.name ?? found.ref.address }];
      }
      try {
        return [mutationToolSchema(seen.mutation(name) as never)];
      } catch {
        return [];
      }
    });
    const head = `${step.agent}${policyInstruction(context.follows)}${apps.size > 0 ? `\n\n${FAR_SAID}` : ""}\n\nActs you may propose:\n${JSON.stringify(acts)}\n\nRecords (${step.reads.join(", ")}):\n`;
    const graph = seen.graph as unknown as { nodesOfKind(kind: string): AnyGraphNode[] };
    const lines: string[] = [];
    let size = Math.ceil((SYSTEM.length + head.length) / 4);
    let cut = 0;
    const show = (line: string) => {
      if (size + Math.ceil(line.length / 4) > tokens) return void cut++;
      size += Math.ceil(line.length / 4);
      lines.push(line);
    };
    for (const kind of step.reads) {
      const ref = isFarReference(kind) ? farReferenceOf(kind) : undefined;
      if (ref) {
        // Read there, as the run's actor may see them: what its host answers, and nothing it keeps from it.
        const app = apps.get(ref.address)!;
        let records: Awaited<ReturnType<FarApp["read"]>>;
        try {
          records = await app.read(ref.name, { limit: MOST_FAR_RECORDS });
        } catch (error) {
          records = [];
          context.note(`Step ${context.index + 1}: ${kind} could not be read: ${error instanceof Error ? error.message : String(error)}.`);
        }
        if ("denied" in records) {
          context.note(`Step ${context.index + 1}: ${app.shape.name ?? ref.address} did not let it read ${kind}.`);
          continue;
        }
        for (const record of records) show(JSON.stringify({ id: record.id, kind, name: record.label, ...record.fields }));
        continue;
      }
      for (const node of seen.schema.tryDefinition(kind) ? graph.nodesOfKind(kind) : []) show(JSON.stringify(said(seen, node)));
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
    const here = proposals.filter((one) => !isFarReference(one.mutation));
    const there = proposals.filter((one) => isFarReference(one.mutation) && step.acts.includes(one.mutation) && farAct(one.mutation) && one.args !== null && typeof one.args === "object" && !Array.isArray(one.args));
    const valid = validateProposals(seen as Store<AnySchema>, here, step.acts.filter((act) => !isFarReference(act)));
    if (valid.length + there.length < proposals.length) context.note(`Step ${context.index + 1}: ${proposals.length - valid.length - there.length} of what the model proposed named an act it may not propose, and was let go.`);
    const sureOf = (proposal: object) => {
      const sure = (proposal as { confidence?: unknown }).confidence;
      return typeof sure === "number" ? Math.min(1, Math.max(0, sure)) : 0.5;
    };
    for (const proposal of valid) {
      const resolved = resolveProposal(seen as Store<AnySchema>, proposal);
      context.change({ calls: [toCall(resolved)], basis: proposal.why ?? step.agent, confidence: sureOf(proposal), model });
    }
    for (const proposal of there) {
      const { ref, app } = farAct(proposal.mutation)!;
      await context.changeFar({ address: ref.address, app, act: ref.name, args: proposal.args, basis: proposal.why ?? step.agent, confidence: sureOf(proposal), model });
    }
  },
};
