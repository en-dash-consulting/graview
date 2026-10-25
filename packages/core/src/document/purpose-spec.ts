import * as z from "../schema/zod.js";
import { NAME } from "./schema.js";

/*
 * A PURPOSE'S SHAPE, apart from the document's (Roadmap f-app-jobs): a page
 * that draws an app reads `purpose` loosely and answers no job, so this is
 * reached only by the checker (`documentJobFindings`), an edit (`add-job`),
 * and the JSON schema an editor reads (`cli/document-schema.ts`).
 */

/* Built the first time a purpose is read (each shape is `z.lazy` over it), not when the module loads. */
function build() {
  const str = (min: number, max: number) => z.string().check(z.minLength(min), z.maxLength(max));
  const name = (what: string) => z.string().check(z.regex(NAME, `${what} names are kebab-case, lower-case words joined by hyphens like "unbooked-soon"`));
  const key = str(1, 120);
  /**
   * A JOB: a question its people bring to the app, in their words (`ask`),
   * answered by the records of one kind (`kind`) its rule-language condition
   * holds for (`where`, the record as subject), in an order (`sort`, as a
   * kind's list takes one), with the act they usually take next on one
   * (`act`), for some roles or everybody (`roles`).
   */
  const JobSpec = z.strictObject({
    name: name("job"),
    ask: str(1, 200),
    kind: name("kind"),
    where: z.optional(str(1, 2000)),
    sort: z.optional(z.union([key, z.strictObject({ by: key, direction: z.optional(z.enum(["asc", "desc"])) })])),
    act: z.optional(name("act")),
    roles: z.optional(z.array(name("role")).check(z.minLength(1), z.maxLength(40))),
  });
  /** Who the app is for, in words, and the jobs they come to it to do — a dozen at most, which the checker says (`jobs-too-many`). */
  const PurposeSpec = z.strictObject({
    for: z.optional(str(1, 300)),
    jobs: z.optional(z.array(JobSpec).check(z.maxLength(40))),
  });
  return { JobSpec, PurposeSpec };
}
let built: ReturnType<typeof build> | undefined;
const shapes = () => (built ??= build());

export const JobSpec = z.lazy(() => shapes().JobSpec);
export const PurposeSpec = z.lazy(() => shapes().PurposeSpec);
export type JobSpec = z.infer<typeof JobSpec>;
export type PurposeSpec = z.infer<typeof PurposeSpec>;
