import { error, warning, type Finding } from "../document/findings.js";
import type { GraviewDocument } from "../document/schema.js";
import { WorkflowSpec } from "../document/workflow-spec.js";
import { conditionProblems } from "../job-findings.js";
import { MOST_WORKFLOWS, type WorkflowDeclaration, type WorkflowStep, type WorkflowTrigger } from "../workflow-shape.js";
import { followsFindings } from "./policies.js";
import { scheduleOf } from "./schedule.js";
import { STEP_KINDS, stepKindOf, stepShapes, type WorkflowFinding } from "./steps.js";
import { workflowReach } from "./resolve.js";
import { workflowWorldOfDocument, type WorkflowWorld } from "./world.js";

/*
 * A DECLARATION'S WORKFLOWS, JUDGED (Roadmap f-jobs-declared), in one
 * vocabulary for a document and a TypeScript app, each finding with the
 * edit that fixes it where one can be written down. Codes:
 *
 *   workflow-steps-empty          a workflow with no step (error)
 *   workflow-schedule-invalid     words or cron that do not read (error)
 *   workflow-connection-unknown   `synced` names no connection (error)
 *   workflow-kind-unknown         a kind no kind of the app is (error)
 *   workflow-field-unknown        `changed` names a field the kind lacks (error)
 *   workflow-where-invalid        a rule that does not read, or reads what is not there (error)
 *   workflow-act-unknown          an act the app does not give (error)
 *   workflow-key-field-unknown    a key that reads what the step does not have (error)
 *   workflow-agent-acts-empty     a model's step that may propose nothing (error)
 *   workflow-sends-out-unasked    `approve: "apply"` said of a step that writes to another system (warning)
 *   workflow-follows-unknown      `follows` names no kind (error)
 *   workflow-shape                anything else not shaped as a workflow (error)
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** What is wrong with a value's shape, as zod says it, at paths under the workflow. */
function shapeIssues(spec: { safeParse(value: unknown): { success: boolean; error?: { issues: readonly { path: readonly PropertyKey[]; message: string; keys?: readonly string[] }[] } } }, value: unknown, prefix: string): { path: string; message: string }[] {
  const parsed = spec.safeParse(value);
  if (parsed.success) return [];
  return parsed.error!.issues.map((issue) => ({ path: [prefix, ...issue.path.map(String)].filter(Boolean).join("."), message: issue.keys ? `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a workflow here` : issue.message }));
}

/** Every finding about one workflow. */
export function workflowFindingsOf(name: string, raw: unknown, world: WorkflowWorld): WorkflowFinding[] {
  const out: WorkflowFinding[] = [];
  const said = `The workflow “${name}”`;
  if (!isRecord(raw)) return [{ code: "workflow-shape", severity: "error", path: "", message: `${said} is not a workflow: it is { title, when, steps }.`, fix: "Say its title, what starts it and its steps." }];
  const steps = raw["steps"];
  if (!Array.isArray(steps) || steps.length === 0) {
    out.push({ code: "workflow-steps-empty", severity: "error", path: "steps", message: `${said} has no steps, so it would do nothing.`, fix: "Give it a step — run an act, or let a model propose — or remove it.", edits: [{ op: "remove-workflow", name }] });
  }
  // The shape of everything but the steps, then each step by its own kind's shape: a union's refusal names no kind.
  const shaped = shapeIssues(WorkflowSpec as never, { ...raw, steps: [{ act: "x" }] }, "").filter((issue) => !issue.path.startsWith("steps"));
  for (const issue of shaped) out.push({ code: "workflow-shape", severity: "error", path: issue.path, message: `${said}: ${issue.message}.`, fix: "A workflow says title, when, status, approve and steps." });
  const stepsOk: WorkflowStep[] = [];
  (Array.isArray(steps) ? steps : []).forEach((step, index) => {
    const kind = stepKindOf(step);
    if (!kind) {
      out.push({ code: "workflow-shape", severity: "error", path: `steps.${index}`, message: `Step ${index + 1} of “${name}” is no kind of step Graview runs.`, fix: `A step says one of ${quoted(Object.keys(STEP_KINDS))}.` });
      return;
    }
    const issues = shapeIssues(kind.shape(stepShapes()) as never, step, `steps.${index}`);
    for (const issue of issues) out.push({ code: "workflow-shape", severity: "error", path: issue.path, message: `Step ${index + 1} of “${name}”: ${issue.message}.`, fix: `${kind.title}: see the shape a ${kind.key} step takes.` });
    if (issues.length === 0) stepsOk.push(step as WorkflowStep);
    else return;
    out.push(...kind.findings(step as never, { world, workflow: name, index, said: `Step ${index + 1} of “${name}”`, declared: raw }));
  });
  if (shaped.length > 0) return out;

  const declared = raw as unknown as WorkflowDeclaration;
  declared.when.forEach((trigger: WorkflowTrigger, at) => {
    const schedule = scheduleOf(trigger as { every?: string; cron?: string });
    if (typeof schedule === "string") out.push({ code: "workflow-schedule-invalid", severity: "error", path: `when.${at}.${"every" in trigger ? "every" : "cron"}`, message: `${said} cannot be run on its clock: ${schedule}.`, fix: 'Write it as "sunday 18:00", "day 03:00", "weekday 09:00", "month 1 09:00", "hour", or five-field cron.' });
    if ("synced" in trigger && !world.connections.has(trigger.synced)) {
      out.push({ code: "workflow-connection-unknown", severity: "error", path: `when.${at}.synced`, message: `${said} starts when “${trigger.synced}” finishes a pass, and the app has no connection called that.`, fix: world.connections.size > 0 ? `Name one of ${quoted(world.connections.keys())}.` : "The app declares no connection; declare one under connections, or start it another way." });
    }
    if ("made" in trigger || "changed" in trigger) {
      const kindName = "made" in trigger ? trigger.made : trigger.changed;
      const key = "made" in trigger ? "made" : "changed";
      const kind = world.kinds.get(kindName);
      if (!kind) {
        out.push({ code: "workflow-kind-unknown", severity: "error", path: `when.${at}.${key}`, message: `${said} starts when a “${kindName}” record is ${key}, and “${kindName}” is not a kind of this app.`, fix: `Name one of its kinds: ${quoted(world.kinds.keys())}.` });
        return;
      }
      if ("changed" in trigger) {
        for (const field of trigger.fields ?? []) {
          if (kind.fields[field] || kind.edges.has(field)) continue;
          out.push({ code: "workflow-field-unknown", severity: "error", path: `when.${at}.fields`, message: `${said} starts when a ${kindName}'s “${field}” changes, and ${kindName} has no field or relation called that.`, fix: `Name one of ${quoted(Object.keys(kind.fields))}.` });
        }
      }
      if (trigger.where !== undefined) {
        for (const problem of conditionProblems(trigger.where, kindName, kind, world)) out.push({ code: "workflow-where-invalid", severity: "error", path: `when.${at}.where`, message: `${said} cannot tell which records start it: ${problem}.`, fix: `Write it in the rule language over the fields of "${kindName}".` });
      }
    }
  });

  out.push(...followsFindings(declared.follows, world));

  // Said, not refused: a step that writes to another system unasked.
  stepsOk.forEach((step, index) => {
    const stated = (step as { approve?: string }).approve ?? declared.approve;
    if (stated !== "apply") return;
    const reach = workflowReach([step], world);
    if (!reach.sendsOut) return;
    const through = [...world.connections].filter(([, connection]) => connection.writes && connection.kinds.some((kind) => reach.writes.includes(kind))).map(([name]) => name);
    const own = (step as { approve?: string }).approve !== undefined;
    out.push({
      code: "workflow-sends-out-unasked",
      severity: "warning",
      path: own ? `steps.${index}.approve` : "approve",
      message: `Step ${index + 1} of “${name}” writes through ${quoted(through)} to another system without asking anybody first.`,
      fix: 'Allowed. Say approve: "ask" to have a person approve each run first.',
      edits: [{ op: "set-workflow", name, workflow: own ? { ...raw, steps: (raw["steps"] as unknown[]).map((one, i) => (i === index ? { ...(one as object), approve: "ask" } : one)) } : { ...raw, approve: "ask" } }],
    });
  });
  return out;
}

/** Every finding about an app's workflows, by name, at paths under `workflows`. */
export function workflowFindings(workflows: unknown, world: WorkflowWorld): (WorkflowFinding & { readonly workflow: string })[] {
  if (workflows === undefined) return [];
  if (!isRecord(workflows)) return [{ workflow: "", code: "workflow-shape", severity: "error", path: "", message: "workflows is the app's workflows by name.", fix: 'Write { "<name>": { title, when, steps } }.' }];
  const out: (WorkflowFinding & { readonly workflow: string })[] = [];
  if (Object.keys(workflows).length > MOST_WORKFLOWS) out.push({ workflow: "", code: "workflow-shape", severity: "error", path: "", message: `The app declares ${Object.keys(workflows).length} workflows; at most ${MOST_WORKFLOWS}.`, fix: "Fold some into others." });
  for (const [name, raw] of Object.entries(workflows)) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) out.push({ workflow: name, code: "workflow-shape", severity: "error", path: "", message: `“${name}” is not a workflow's name: kebab-case, like "next-weeks-events".`, fix: "Rename it in kebab-case." });
    for (const finding of workflowFindingsOf(name, raw, world)) out.push({ ...finding, workflow: name });
  }
  return out;
}

/** A document's workflows, judged with its own sentences at its own paths (`workflows.<name>.steps.0.act`): what `compileDocument` and `graview check` say of them. */
export function documentWorkflowFindings(document: GraviewDocument): Finding[] {
  if (document.workflows === undefined) return [];
  return workflowFindings(document.workflows, workflowWorldOfDocument(document)).map((finding) => {
    const path = ["workflows", finding.workflow, finding.path].filter(Boolean).join(".");
    return finding.severity === "warning" ? warning(finding.code, path, finding.message, finding.fix, finding.edits) : error(finding.code, path, finding.message, finding.fix, finding.edits ? { edits: finding.edits } : undefined);
  });
}
