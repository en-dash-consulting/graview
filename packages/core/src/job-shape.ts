/**
 * WHO AN APP IS FOR AND WHAT THEY COME TO DO (Roadmap f-app-jobs).
 *
 *   purpose: {
 *     for: "The couple and their planner, mostly on phones",
 *     jobs: [{ name: "unbooked-soon", ask: "What's still unbooked and due this month?",
 *              kind: "vendor", where: "status != 'booked' and due <= today() + 30", sort: "due", act: "book" }],
 *   }
 *
 * Until now nothing in a declaration said whom it served or what they come
 * to it to find out, so every look was assembled field by field from a type
 * table. A job is that question in the people's own words, and the answer as
 * the framework can work it out: the records of one kind that a rule-language
 * condition holds for (`where`, the record as its subject, as a computed field
 * reads), in an order (`sort`, as a kind's list takes one), with the act
 * people usually take next on one (`act`), for some roles or everybody.
 *
 * The same shape in a document (`purpose`) and in `defineApp({ purpose })`:
 * `where` is the rule language's words in both, so a TypeScript app's jobs
 * are judged and answered exactly as a document's are. `graview check` holds
 * each to the declaration (`job-*`); `@graview/core/jobs` resolves them
 * (`jobsOf`) and answers one as a seat may see it (`answerJob`).
 */
export interface AppPurpose {
  /** Who uses the app and where, in words: "The couple and their planner, mostly on phones". 1–300 characters. */
  readonly for?: string;
  /** What they come to do, at most twelve. */
  readonly jobs?: readonly JobDeclaration[];
}

/** A job's order: a field, a computed field or `label`, lowest first — or `{ by, direction }`. */
export type JobSort = string | { readonly by: string; readonly direction?: "asc" | "desc" };

export interface JobDeclaration {
  /** Kebab-case, unique among the app's jobs, like an act's name: "unbooked-soon". */
  readonly name: string;
  /** The question in the people's own words: "What's still unbooked and due this month?" 1–200 characters. */
  readonly ask: string;
  /** The kind whose records answer it. */
  readonly kind: string;
  /** Which of them, in the rule language with the record as subject: "status != 'booked' and due <= today() + 30". Every one, unsaid. */
  readonly where?: string;
  /** The order the answer comes in. As they are stored, unsaid. */
  readonly sort?: JobSort;
  /** The act people usually take next on one: an act whose subject is the kind. */
  readonly act?: string;
  /** The roles the job is for. Everybody, unsaid. */
  readonly roles?: readonly string[];
}

/** Whether a job is for a seat holding these roles: one that names no roles is everybody's. */
export const jobIsFor = (job: { readonly roles?: readonly string[] }, held: readonly string[] | undefined): boolean =>
  job.roles === undefined || job.roles.length === 0 || job.roles.some((role) => (held ?? []).includes(role));

/** The most jobs an app declares: past a dozen, the app is no longer saying what matters most. */
export const MOST_JOBS = 12;
