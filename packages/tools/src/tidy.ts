/*
 * `@graview/tools/tidy` — WHAT THE APP'S OWN ACTOR SUGGESTS, AND RUNNING IT.
 *
 * The framework kept the actor to what people said (`@graview/core/tidying`)
 * but never decided what to suggest. These are the deterministic judges —
 * duplicates to merge, links a record's own text names, finished records
 * old enough to set aside — and `dream`, which runs them as the actor and
 * suggests what they find (or applies it, where the host lets it). A
 * host's schedule, an alarm or `graview dream` calls it; `whileAway` says
 * what it did since a person last looked. Its own entry, and on no page's
 * first load: nothing a page draws needs it until the tray says so.
 */
export { archive, duplicates, links, JUDGES, type Candidate, type Judge, type JudgeContext } from "./tidy/judges.js";
export { dream, touchedIn, TIDYING_ACTOR, type DreamModel, type DreamOptions, type DreamOutcome, type DreamReport } from "./tidy/dream.js";
export { whileAway, type AwaySince, type WhileAway } from "./tidy/away.js";
