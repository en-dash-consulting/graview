import * as z from "../schema/zod.js";
import { EDGE_NAME, NAME } from "./schema.js";
import { STEP_KINDS, stepShapes } from "../workflows/steps.js";
import { MOST_STEPS, MOST_WORKFLOWS } from "../workflow-shape.js";

/*
 * A WORKFLOW'S SHAPE, apart from the document's (Roadmap f-jobs-declared):
 * a page that draws an app runs no workflow, so `workflows` is read loosely
 * by the compiler and this is reached only by the checker
 * (`documentWorkflowFindings`), an edit (`add-workflow`, `set-workflow`)
 * and the JSON schema an editor reads (`cli/document-schema.ts`). Its steps
 * are the closed set `STEP_KINDS` says.
 */

function build() {
  const str = (min: number, max: number) => z.string().check(z.minLength(min), z.maxLength(max));
  const kind = z.string().check(z.regex(NAME, 'kind names are kebab-case, lower-case words joined by hyphens like "grocery-list"'));
  const shapes = stepShapes();
  /** What starts a run: words or cron on the brand's clock, a record made or changed, a connection's pass, or a person. */
  const TriggerSpec = z.union([
    z.strictObject({ every: str(1, 80) }),
    z.strictObject({ cron: str(9, 120) }),
    z.strictObject({ made: kind, where: z.optional(shapes.expression) }),
    z.strictObject({ changed: kind, fields: z.optional(z.array(z.string().check(z.regex(EDGE_NAME))).check(z.minLength(1), z.maxLength(40))), where: z.optional(shapes.expression) }),
    z.strictObject({ synced: z.string().check(z.regex(NAME, 'connection names are kebab-case, like "calendar"')) }),
    z.strictObject({ byHand: z.literal(true) }),
  ]);
  const StepSpec = z.union(Object.values(STEP_KINDS).map((one) => one.shape(shapes)) as unknown as [z.ZodMiniType, z.ZodMiniType, ...z.ZodMiniType[]]);
  /** One workflow: its title, what starts it, whether it is paused, what its changes become, and its steps in order. */
  const WorkflowSpec = z.strictObject({
    title: str(1, 120),
    when: z.array(TriggerSpec).check(z.minLength(1), z.maxLength(12)),
    status: z.optional(z.enum(["active", "paused"])),
    approve: z.optional(shapes.approve),
    steps: z.array(StepSpec).check(z.minLength(1), z.maxLength(MOST_STEPS)),
  });
  const WorkflowsSpec = z.record(z.string().check(z.regex(NAME, 'workflow names are kebab-case, like "next-weeks-events"')), WorkflowSpec).check(z.refine((all: Record<string, unknown>) => Object.keys(all).length <= MOST_WORKFLOWS, `an app declares at most ${MOST_WORKFLOWS} workflows`));
  return { TriggerSpec, StepSpec, WorkflowSpec, WorkflowsSpec };
}
let built: ReturnType<typeof build> | undefined;
const shapes = () => (built ??= build());

export const WorkflowTriggerSpec = z.lazy(() => shapes().TriggerSpec);
export const WorkflowStepSpec = z.lazy(() => shapes().StepSpec);
export const WorkflowSpec = z.lazy(() => shapes().WorkflowSpec);
export const WorkflowsSpec = z.lazy(() => shapes().WorkflowsSpec);
export type WorkflowSpec = z.infer<typeof WorkflowSpec>;
