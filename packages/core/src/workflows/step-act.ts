import * as z from "../schema/zod.js";
import { conditionProblems } from "../job-findings.js";
import { nearestAct } from "../mutations/act-spelling.js";
import type { ActStep } from "../workflow-shape.js";
import type { StepCheck, StepKind, StepShapes, WorkflowFinding } from "./steps.js";
import type { WorkflowWorld } from "./world.js";

/*
 * RUN AN ACT (Roadmap f-job-step-types): once, or once per record `over`
 * picks. The act is one the app gives — declared or derived — and what
 * `{ expr }` values read is the record the step is over. `key` is the
 * stable key of what it makes, a `{field}` template read on that record
 * and the step's arguments: a rerun with the same key changes the record
 * it made last time (`@graview/tools/workflows`).
 */

const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** The names a key's `{field}` template reads. */
export const keyFields = (key: string): string[] => [...key.matchAll(/\{([^{}|\s]+)(?:\s*\|[^{}]*)?\}/g)].map((found) => found[1]!);


export const actStep: StepKind<ActStep> = {
  key: "act",
  title: "Run an act",
  shape: (s: StepShapes) =>
    z.strictObject({
      act: s.name("act"),
      over: z.optional(z.strictObject({ kind: s.name("kind"), where: z.optional(s.expression), limit: z.optional(z.number().check(z.int(), z.minimum(1), z.maximum(10_000))) })),
      args: z.optional(z.record(z.string(), s.value)),
      key: z.optional(s.str(1, 300)),
      approve: z.optional(s.approve),
    }),
  findings(step, check: StepCheck): WorkflowFinding[] {
    const { world, said, index } = check;
    const out: WorkflowFinding[] = [];
    const at = `steps.${index}`;
    if (!world.acts.includes(step.act)) {
      const near = nearestAct(step.act, world.acts);
      const steps = (check.declared["steps"] as readonly Record<string, unknown>[] | undefined) ?? [];
      out.push({
        code: "workflow-act-unknown",
        severity: "error",
        path: `${at}.act`,
        message: `${said} runs "${step.act}", which is not an act of this app.`,
        fix: near ? `Did you mean "${near}"?` : "Name one of the app's acts, declared or derived (add-…, edit-<kind>, archive-<kind>).",
        ...(near ? { edits: [{ op: "set-workflow", name: check.workflow, workflow: { ...check.declared, steps: steps.map((one, i) => (i === index ? { ...one, act: near } : one)) } }] } : {}),
      });
    }
    if (step.over) {
      const kind = world.kinds.get(step.over.kind);
      if (!kind) out.push({ code: "workflow-kind-unknown", severity: "error", path: `${at}.over.kind`, message: `${said} runs over "${step.over.kind}" records, and "${step.over.kind}" is not a kind of this app.`, fix: `Name one of its kinds: ${quoted(world.kinds.keys())}.` });
      else if (step.over.where !== undefined) {
        for (const problem of conditionProblems(step.over.where, step.over.kind, kind, world)) {
          out.push({ code: "workflow-where-invalid", severity: "error", path: `${at}.over.where`, message: `${said} cannot pick its records: ${problem}.`, fix: `Write it in the rule language over the fields of "${step.over.kind}" (${quoted(Object.keys(kind.fields))}) and its relations.` });
        }
      }
    }
    if (step.key !== undefined) {
      const kind = step.over ? world.kinds.get(step.over.kind) : undefined;
      const readable = new Set(["id", "label", ...Object.keys(step.args ?? {}), ...(kind ? [...Object.keys(kind.fields), ...kind.computed] : [])]);
      const fields = keyFields(step.key);
      if (fields.length === 0) out.push({ code: "workflow-key-field-unknown", severity: "error", path: `${at}.key`, message: `${said}'s key "${step.key}" reads no field, so every run would make the same one record.`, fix: `Say what tells two apart in braces, like "{id}" or "{id}:{date}".` });
      for (const field of fields) {
        if (readable.has(field) || (step.over && !kind)) continue;
        out.push({
          code: "workflow-key-field-unknown",
          severity: "error",
          path: `${at}.key`,
          message: `${said}'s key reads "{${field}}", and ${step.over ? `"${step.over.kind}" has no field called that and the step hands the act no argument called that` : "the step hands the act no argument called that"}.`,
          fix: `Read one of ${quoted(readable)}.`,
        });
      }
    }
    return out;
  },
  words(step, noun) {
    const over = step.over ? ` for each ${noun(step.over.kind)}${step.over.where ? ` where ${step.over.where}` : ""}${step.over.limit ? ` (at most ${step.over.limit})` : ""}` : "";
    return `Run “${step.act}”${over}`;
  },
  touches(step, world: WorkflowWorld) {
    return { reads: step.over ? [step.over.kind] : [], writes: [...new Set([...(world.actOn(step.act) ?? []), ...(world.actMakes(step.act) ?? [])])] };
  },
};
