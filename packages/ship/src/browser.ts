/**
 * The browser entry: everything in `@graview/ship` that does not need a
 * filesystem. An app bundled for the page imports from here, so a bundler
 * never meets `node:fs` through the file adapter.
 */
export {
  BROWSER_DATABASE,
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  freshHref,
  PRINCIPAL_KEY,
  rememberedPrincipal,
} from "./browser-adapter.js";
export type { BrowserAdapter, BrowserAdapterOptions, StorageLike } from "./browser-adapter.js";
export type { IDBFactoryLike } from "./indexed-entries.js";
export { migrateSnapshot, pendingMigrations } from "./migrations.js";
export { countSteps, primitivesFor, sayStep, stepsMigration } from "./steps.js";
export type { MigrationStep, StepCount } from "./steps.js";
export type { MigrationRun } from "./migrations.js";
export { openStore } from "./open-store.js";
export type { Compaction, OpenStoreOptions, OpenedStore } from "./open-store.js";
export { applyToSnapshot } from "./snapshot.js";
export type { GraphSnapshot } from "./snapshot.js";
export { assertBundle, exportBundle } from "./export.js";
export type { AppBundle, ExportOptions } from "./export.js";
export type { StoredMeta } from "./meta.js";
export { health } from "./health.js";
export type { HealthReport } from "./health.js";
export { openRemote, RemoteRefusedError, seatHeaders } from "./remote.js";
// Notify me (Roadmap f-notify-subscriptions): the asking seat's subscriptions on a served store.
export { remoteSubscriptions, SUBSCRIPTIONS_PATH } from "./remote-subscriptions.js";
export type { RemoteSubscriptionsOptions } from "./remote-subscriptions.js";
// The views a person tidies from the place menu (Roadmap f-place-menu-views): `keptViews` over a served store.
export { remoteViews, VIEWS_PATH } from "./remote-views.js";
export type { RemoteViewsOptions, ViewsPost } from "./remote-views.js";
// The host's files at an address, for a page's `files` (FR-163): what the dev door answers.
export { filesAt } from "./files-at.js";
export { SEAT_HEADERS } from "./seat-headers.js";
export { createBroadcastPresence, presenceChannelName } from "./presence.js";
export type { BroadcastPresenceOptions, ChannelLike } from "./presence.js";
export type { LiveSocketLike, RemoteBackoff, RemoteConflict, RemoteCounters, RemoteOptions, RemoteRefusal, RemoteState, RemoteStatus, RemoteStore } from "./remote.js";
export { conflictSentence, LIVE_PATH, LIVE_SUBPROTOCOL, LIVE_WIRE, REFUSAL_REASONS } from "./live.js";
export type { LiveClientMessage, LiveServerMessage, RefusalReason, WireRefusal } from "./live.js";
export {
  assertPhotoFits,
  photosUsed,
  storageBytes,
  PhotoTooLarge,
  PHOTO_BUDGET_BYTES,
  PHOTO_MAX_BYTES,
} from "./photos.js";
export type { PhotoBudget, PhotoField } from "./photos.js";
