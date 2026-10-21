/**
 * `@graview/core/seat` — WHAT THE SEAT AND THE SEEDING READ BEYOND A PAGE.
 *
 * An act's answer as the seat that asked may see it (`answerSeenBy`, FR-55),
 * every place an app has — where an ask can go, and what a host lists when
 * an app is opened (`placesOf`, `placesFrom`) — and the order things are
 * made in (`beginning`), which the seeding, the scene's empty ground and the
 * seat's plans read — and the archive behind the undo horizon as one seat
 * may see it (`archivedSeenBy`, FR-198), which a host answers
 * `HistoryHost.archived` with.
 *
 * Apart from `@graview/core` because a bundler places a whole file in a
 * page's first chunk when the first chunk can reach it and any chunk uses
 * it (FR-179): the seat's tools, the seeding and the scene are fetched as
 * they are first asked or drawn, and a host lists places on its server. The
 * types (`AppPlace`, `Beginning`, `KindBeginning`) stay on `@graview/core`.
 */
export { answerSeenBy } from "./answer-seen.js";
export { archivedSeenBy, type ArchivedSeen } from "./archived-seen.js";
export { beginning } from "./beginning.js";
export { placesFrom, placesOf } from "./app-places.js";
