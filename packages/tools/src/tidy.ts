/*
 * `@graview/tools/tidy` — WHAT THE APP'S OWN ACTOR SUGGESTS, AND RUNNING IT.
 *
 * The framework kept the actor to what people said (`@graview/core/tidying`)
 * but never decided what to suggest. Here code finds what is worth asking
 * about (blocking), a System One model the host lends judges it — the same
 * thing twice, which record a relation means, finished, which option fits
 * — and code routes each answer by how much the change would undo: made
 * where the host lets it, suggested, or let go. The deterministic judges —
 * duplicates by a shared name or key, links a record's own text names,
 * finished records long unchanged — are the floor without a model. A
 * host's schedule, an alarm or `graview dream` calls `dream`; `whileAway`
 * says what it did since a person last looked. Its own entry, and on no
 * page's first load: nothing a page draws needs it until the tray says so.
 */
export { archive, categorize, duplicates, links, missingLinks, JUDGES, type Candidate, type Judge, type JudgeContext } from "./tidy/judges.js";
export { dream, touchedIn, TIDYING_ACTOR, type DreamOptions, type DreamOutcome, type DreamReport } from "./tidy/dream.js";
export { BANDS, routeOf, type Band, type Route, type Severity } from "./tidy/policy.js";
export { memoryDreamCache, type DreamAnswers, type DreamBudget, type DreamCache, type DreamUsage } from "./tidy/asking.js";
export { NONE_FITS, NONE_OF_THESE, QUESTION_SET } from "./tidy/judging.js";
export { systemOneOf, type DreamModel, type SystemOneAnswer, type SystemOneDecide } from "./tidy/system-one.js";
export { whileAway, type AwaySince, type WhileAway } from "./tidy/away.js";
