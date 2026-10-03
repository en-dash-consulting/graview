/**
 * The runtime entry: everything a SERVER needs that any JavaScript runtime
 * can run — a Cloudflare Worker or Durable Object, Deno, Bun, Node (FR-09).
 *
 * The root entry reaches `node:fs` (the file adapter) and `node:http`
 * (`serveStore`); the browser entry is what a page runs, the localStorage
 * adapter and tab-to-tab presence among it. This one is the store, its
 * migrations, the wire as a fetch handler, and the other end of the wire —
 * and a test holds it to reaching no `node:` builtin.
 */
export { createStoreHandler, presenceSeenBy, SEAT_HEADERS, seatFromHeaders, WIRE } from "./handler.js";
export type { StoreHandler, StoreHandlerOptions } from "./handler.js";
export { openStore } from "./open-store.js";
export type { OpenStoreOptions, OpenedStore } from "./open-store.js";
export { migrateSnapshot, pendingMigrations } from "./migrations.js";
export type { MigrationRun } from "./migrations.js";
export { countSteps, primitivesFor, primitivesForSteps, sayStep, stepsMigration } from "./steps.js";
export type { MigrationStep, StepCount } from "./steps.js";
export { applySteps, contentOperation, SEED_SYNC_AUTHOR, seedSteps } from "./sync-seed.js";
export type { SeedSyncOptions } from "./sync-seed.js";
export { applyToSnapshot } from "./snapshot.js";
export type { GraphSnapshot } from "./snapshot.js";
export { assertBundle, exportBundle } from "./export.js";
export type { AppBundle } from "./export.js";
export type { StoredMeta } from "./meta.js";
export { health } from "./health.js";
export type { HealthReport } from "./health.js";
export { openRemote, seatHeaders } from "./remote.js";
export type { LiveSocketLike, RemoteConflict, RemoteOptions, RemoteStore } from "./remote.js";
export { conflictSentence, LIVE_PATH } from "./live.js";
export type { LiveClientMessage, LiveConnection, LiveServerMessage, LiveSocket } from "./live.js";
