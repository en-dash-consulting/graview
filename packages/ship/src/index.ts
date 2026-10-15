// A host that serves seats judges a sight that hides a field (Roadmap f-field-sight): loaded here, so every store this server opens can.
import "@graview/core/field-sight";
export { createFileAdapter } from "./file-adapter.js";
export type { FileAdapter } from "./file-adapter.js";
export {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  freshHref,
  PRINCIPAL_KEY,
  rememberedPrincipal,
} from "./browser-adapter.js";
export type { BrowserAdapter, BrowserAdapterOptions, StorageLike } from "./browser-adapter.js";
export { migrateSnapshot, pendingMigrations } from "./migrations.js";
export { countSteps, primitivesFor, primitivesForSteps, sayStep, stepsMigration } from "./steps.js";
export { applySteps, contentOperation, SEED_SYNC_AUTHOR, seedSteps } from "./sync-seed.js";
export type { SeedSyncOptions } from "./sync-seed.js";
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
export type { LiveSocketLike, RemoteBackoff, RemoteConflict, RemoteCounters, RemoteOptions, RemoteRefusal, RemoteStatus, RemoteStore } from "./remote.js";
export { conflictSentence, LIVE_PATH, LIVE_SUBPROTOCOL, LIVE_WIRE, liveSubprotocol, REFUSAL_REASONS } from "./live.js";
export type { Limit, LimitAnswer, LimitAsked, LiveClientMessage, LiveConnection, LiveServerMessage, LiveSocket, RefusalReason, WireRefusal } from "./live.js";
export { createStoreHandler, presenceSeenBy } from "./handler.js";
export type { AdapterStoreHandlerOptions, DeclarationChange, HeldStoreHandlerOptions, StoreHandler, StoreHandlerOptions } from "./handler.js";
export { announcePresence, authoredBy, isClientBatch, liveProtocol, presenceFrom, seatOfTab, serverBatchIds, visitorPresence, wireRefusalOf } from "./live-protocol.js";
export type { BatchClaim, LivePeer, LiveProtocol, LiveProtocolOptions, LiveReceived, LiveSocketState, ServedSocket, WireAnswer, WireAsked } from "./live-protocol.js";
export { SEAT_HEADERS, seatFromHeaders, serveStore, WIRE } from "./serve.js";
export type { ServeOptions, ServedStore } from "./serve.js";
export { backendFrom, holdBackend, preview, serve, SERVE_USAGE, shots, syncSeed } from "./cli.js";
export { heldBy, holdFileOf, holdStore, sayHeld } from "./store-hold.js";
export type { StoreHold, StoreHolder } from "./store-hold.js";
export type { PreviewPage } from "./cli.js";
export { previewPrincipal, servePreview } from "./serve-preview.js";
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
