/**
 * `@graview/core/tidying` — THE APP'S OWN ACTOR, AND WHAT PEOPLE SAID TO IT.
 *
 * A background actor ("Graview, tidying", an author that says `automated:
 * true`) applies what it is sure of, with lineage, and suggests what it is
 * not (`store.suggest`), which waits for a person in the Suggested tray.
 * These read it back without the store's methods: which suggestions wait
 * and which were declined in a log, who a suggestion is, what the
 * declaration lets the actor tidy, why a change of its would be refused,
 * and Activity's rows with an actor's run folded into one digest. What a
 * page draws a record with — `isLeftAlone`, `isAutomated` — is the main
 * entry's; the store enforces the same answers whatever reads them.
 */
export { declinedIn, declinesIn, suggestionKey, suggestionsIn, tidyingOf, tidyingRefusal } from "./ops/tidying.js";
export { digestWords, foldDigests, isSuggestionBatch } from "./ops/digest.js";
export type { ActivityRow } from "./ops/digest.js";
export { LEFT_ALONE } from "./graph/archived.js";
