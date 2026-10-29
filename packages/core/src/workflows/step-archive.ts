import * as z from "../schema/zod.js";
import { conditionProblems } from "../job-findings.js";
import type { ArchiveStep } from "../workflow-shape.js";
import type { KindNoun, StepCheck, StepKind, StepShapes, WorkflowFinding } from "./steps.js";
import type { WorkflowWorld } from "./world.js";

/*
 * SET ASIDE WHAT IS DONE WITH (Roadmap f-retention-rules): the records of
 * one kind a rule holds of, once they have stood so long — "archive
 * grocery lists where status == 'done' after 3 days". Archived, never
 * removed (FR-173): each keeps its fields, its links and its history, and
 * "Bring it back" undoes it. Deterministic, so it spends no model. The
 * run holds it to what people said — a record left alone, a kind the app
 * says is never tidied — and never sets aside again a record a person
 * brought back from one of this workflow's archives
 * (`@graview/tools/workflows`).
 */

const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** How long, in words: "3 days", "1 day", "2 weeks", "12 hours". */
const AFTER = /^\s*(\d{1,4})\s*(hour|hours|day|days|week|weeks)\s*$/i;

/** How long `after` asks a record to have stood, in milliseconds, or undefined when its words do not read. */
export function afterMs(after: string): number | undefined {
  const found = AFTER.exec(after);
  if (!found) return undefined;
  const unit = found[2]!.toLowerCase().replace(/s$/, "");
  return Number(found[1]) * (unit === "hour" ? 3_600_000 : unit === "day" ? 86_400_000 : 7 * 86_400_000);
}

/** `after` said: "3 days after it last changed", "7 days after its date". */
export function afterWords(after: ArchiveStep["after"]): string {
  if (after === undefined) return "";
  if (typeof after === "string") return ` ${after.trim()} after it last changed`;
  return ` ${after.days} ${after.days === 1 ? "day" : "days"} after its ${after.field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}`;
}

export const archiveStep: StepKind<ArchiveStep> = {
  key: "archive",
  title: "Archive what is done with",
  shape: (s: StepShapes) =>
    z.strictObject({
      archive: s.name("kind"),
      where: z.optional(s.expression),
      after: z.optional(z.union([s.str(1, 40), z.strictObject({ field: s.str(1, 120), days: z.number().check(z.int(), z.minimum(0), z.maximum(36_500)) })])),
      approve: z.optional(s.approve),
    }),
  findings(step, check: StepCheck): WorkflowFinding[] {
    const { world, said, index } = check;
    const at = `steps.${index}`;
    const out: WorkflowFinding[] = [];
    const kind = world.kinds.get(step.archive);
    if (!kind) {
      out.push({ code: "workflow-kind-unknown", severity: "error", path: `${at}.archive`, message: `${said} archives "${step.archive}" records, and "${step.archive}" is not a kind of this app.`, fix: `Name one of its kinds: ${quoted(world.kinds.keys())}.` });
      return out;
    }
    if (!world.acts.includes(`archive-${step.archive}`)) {
      out.push({ code: "workflow-archive-never", severity: "error", path: `${at}.archive`, message: `${said} archives ${world.noun(step.archive)} records, and the app says they are never archived.`, fix: `Take "archives: false" off "${step.archive}", or let this step go.` });
    }
    if (step.where !== undefined) {
      for (const problem of conditionProblems(step.where, step.archive, kind, world)) {
        out.push({ code: "workflow-where-invalid", severity: "error", path: `${at}.where`, message: `${said} cannot pick its records: ${problem}.`, fix: `Write it in the rule language over the fields of "${step.archive}" (${quoted(Object.keys(kind.fields))}) and its relations.` });
      }
    }
    if (typeof step.after === "string" && afterMs(step.after) === undefined) {
      out.push({ code: "workflow-archive-after-invalid", severity: "error", path: `${at}.after`, message: `${said} waits "${step.after}", which does not read as how long.`, fix: `Say it as a number and hours, days or weeks — "3 days" — or as { "field": "<a date field>", "days": 3 }.` });
    } else if (typeof step.after === "object" && !kind.fields[step.after.field]) {
      out.push({ code: "workflow-archive-after-invalid", severity: "error", path: `${at}.after.field`, message: `${said} counts from "${step.after.field}", and "${step.archive}" has no field called that.`, fix: `Count from one of its fields: ${quoted(Object.keys(kind.fields))}.` });
    }
    return out;
  },
  words(step, noun: KindNoun) {
    return `Archive ${noun(step.archive)} records${step.where ? ` where ${step.where}` : ""}${afterWords(step.after)}`;
  },
  touches(step, _world: WorkflowWorld) {
    return { reads: [step.archive], writes: [step.archive] };
  },
};
