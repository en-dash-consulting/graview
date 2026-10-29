import * as z from "../schema/zod.js";
import type { AgentStep } from "../workflow-shape.js";
import type { StepCheck, StepKind, StepShapes, WorkflowFinding } from "./steps.js";
import type { WorkflowWorld } from "./world.js";

/*
 * LET A MODEL PROPOSE (Roadmap f-job-step-types): an instruction in words,
 * the kinds whose records it is shown and the acts it may propose — never
 * any other. Built on dreaming's runner in `@graview/tools/workflows`: what
 * it proposes is applied, suggested or let go by `approve` and how sure it
 * is. With no model lent, the step is skipped and the run says so.
 */

const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

export const agentStep: StepKind<AgentStep> = {
  key: "agent",
  title: "Let a model propose",
  shape: (s: StepShapes) =>
    z.strictObject({
      agent: s.str(1, 2000),
      reads: z.array(s.name("kind")).check(z.maxLength(40)),
      acts: z.array(s.str(1, 120)).check(z.maxLength(60)),
      model: z.optional(s.str(1, 120)),
      budget: z.optional(z.strictObject({ calls: z.optional(z.number().check(z.int(), z.minimum(1), z.maximum(1000))), tokens: z.optional(z.number().check(z.int(), z.minimum(1), z.maximum(10_000_000))) })),
      approve: z.optional(s.approve),
    }),
  findings(step, check: StepCheck): WorkflowFinding[] {
    const { world, said, index } = check;
    const at = `steps.${index}`;
    const out: WorkflowFinding[] = [];
    step.reads.forEach((kind, i) => {
      if (!world.kinds.has(kind)) out.push({ code: "workflow-kind-unknown", severity: "error", path: `${at}.reads.${i}`, message: `${said} reads "${kind}" records, and "${kind}" is not a kind of this app.`, fix: `Name one of its kinds: ${quoted(world.kinds.keys())}.` });
    });
    if (step.acts.length === 0) {
      const over = world.acts.filter((act) => (world.actOn(act) ?? []).some((kind) => step.reads.includes(kind)));
      const steps = (check.declared["steps"] as readonly Record<string, unknown>[] | undefined) ?? [];
      out.push({
        code: "workflow-agent-acts-empty",
        severity: "error",
        path: `${at}.acts`,
        message: `${said} lets a model propose, and names no act it may propose — so it could do nothing.`,
        fix: over.length > 0 ? `Name the acts it may propose, like ${quoted(over.slice(0, 4))}.` : "Name the acts it may propose.",
        ...(over.length > 0 ? { edits: [{ op: "set-workflow", name: check.workflow, workflow: { ...check.declared, steps: steps.map((one, i) => (i === index ? { ...one, acts: over.slice(0, 4) } : one)) } }] } : {}),
      });
    }
    step.acts.forEach((act, i) => {
      if (!world.acts.includes(act)) out.push({ code: "workflow-act-unknown", severity: "error", path: `${at}.acts.${i}`, message: `${said} lets a model propose "${act}", which is not an act of this app.`, fix: "Name one of the app's acts, declared or derived." });
    });
    return out;
  },
  words(step, noun) {
    const reads = step.reads.length > 0 ? ` reading ${step.reads.map(noun).join(", ")}` : "";
    return `Ask a model to ${step.agent.replace(/^./, (first) => first.toLowerCase()).replace(/[.!]$/, "")}${reads}, proposing ${step.acts.map((act) => `“${act}”`).join(", ") || "nothing"}`;
  },
  touches(step, world: WorkflowWorld) {
    return { reads: [...step.reads], writes: [...new Set(step.acts.flatMap((act) => [...(world.actOn(act) ?? []), ...(world.actMakes(act) ?? [])]))] };
  },
};
