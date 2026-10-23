// A host that serves seats judges a sight that hides a field (Roadmap f-field-sight): loaded here, so every store this server opens can.
import "@graview/core/field-sight";
// And merges text typed together (Roadmap f-collab-text): a keystroke carried over the log, a whole write as a splice, an undo per person.
import "@graview/core/typing";
export { createFileAdapter } from "./file-adapter.js";
export type { FileAdapter } from "./file-adapter.js";
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
export { countSteps, primitivesFor, primitivesForSteps, sayStep, stepsMigration } from "./steps.js";
export { applySteps, contentOperation, SEED_SYNC_AUTHOR, sayRefusals, seedRefusals, seedSteps } from "./sync-seed.js";
export type { SeedRefusal, SeedSyncOptions } from "./sync-seed.js";
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
export { filesAt } from "./files-at.js";
export { createBroadcastPresence, presenceChannelName } from "./presence.js";
export type { BroadcastPresenceOptions, ChannelLike } from "./presence.js";
export type { LiveSocketLike, RemoteBackoff, RemoteConflict, RemoteCounters, RemoteOptions, RemoteRefusal, RemoteState, RemoteStatus, RemoteStore } from "./remote.js";
export { conflictSentence, LIVE_PATH, LIVE_SUBPROTOCOL, LIVE_WIRE, liveSubprotocol, REFUSAL_REASONS } from "./live.js";
export type { HostRefusalReason, Limit, LimitAnswer, LimitAsked, LiveClientMessage, LiveConnection, LiveServerMessage, LiveSocket, RefusalReason, WireRefusal } from "./live.js";
export { createStoreHandler, presenceSeenBy } from "./handler.js";
// Notify me (Roadmap f-notify-subscriptions): the wire's route, its client, and the file `graview serve` keeps them in.
export { answerSubscriptions } from "./subscriptions.js";
export { remoteSubscriptions, SUBSCRIPTIONS_PATH } from "./remote-subscriptions.js";
export type { SubscriptionsAnswer, SubscriptionsPost } from "./subscriptions.js";
export type { RemoteSubscriptionsOptions } from "./remote-subscriptions.js";
export { fileSubscriptions } from "./file-subscriptions.js";
// The views a person tidies from the place menu (Roadmap f-place-menu-views): the route's answer, its client, and the file `graview serve` keeps them in.
export { answerViews, keepsTheApp, VIEWS_PATH } from "./views.js";
export type { ViewsAnswer, ViewsPost } from "./views.js";
export { remoteViews } from "./remote-views.js";
export type { RemoteViewsOptions } from "./remote-views.js";
export { fileViews } from "./file-views.js";
export { GOOGLE_TOKEN_URL, runConnections, sayReport } from "./connections.js";
export type { ConnectionStates, ConnectionStateStore, ConnectionTokenRequest, RunConnectionsOptions, RunningConnections } from "./connections.js";
export { fileConnectionState, readEnvFile } from "./connections-file.js";
export type { AdapterStoreHandlerOptions, DeclarationChange, HeldStoreHandlerOptions, StoreHandler, StoreHandlerOptions } from "./handler.js";
export { announcePresence, authoredBy, isClientBatch, liveProtocol, opFormatOf, opsFor, presenceFrom, seatOfTab, serverBatchIds, visitorPresence, wireRefusalOf } from "./live-protocol.js";
export type { BatchClaim, LivePeer, LiveProtocol, LiveProtocolOptions, LiveReceived, LiveSocketState, ServedSocket, WireAnswer, WireAsked } from "./live-protocol.js";
export { SEAT_HEADERS, seatFromHeaders, serveStore, WIRE } from "./serve.js";
export type { ServeOptions, ServedStore } from "./serve.js";
export { backendFrom, holdBackend, preview, serve, SERVE_USAGE, shots, connectionsFileOf, subscriptionsFileOf, syncSeed } from "./cli.js";
export { heldBy, holdFileOf, holdStore, sayHeld } from "./store-hold.js";
export type { StoreHold, StoreHolder } from "./store-hold.js";
export type { PreviewPage } from "./cli.js";
export { PREVIEW_APP_PATH, previewPrincipal, servePreview } from "./serve-preview.js";
export { bundleAppForPage, findBundler, NO_BUNDLER } from "./preview-app.js";
export type { Preview, PreviewOptions } from "./serve-preview.js";
export type { StoreBackend } from "./cli.js";
export {
  assertPhotoFits,
  photosUsed,
  storageBytes,
  PhotoTooLarge,
  PHOTO_BUDGET_BYTES,
  PHOTO_MAX_BYTES,
} from "./photos.js";
export type { PhotoBudget, PhotoField } from "./photos.js";
