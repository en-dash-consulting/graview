/*
 * ONE COPY OF ZOD, AND IT IS THIS ONE.
 *
 * A kind's fields are a `z.ZodObject`, so a project building one with a
 * DIFFERENT copy of zod hands `defineNode` a nominally incompatible type —
 * and comparing a declared field schema across two copies exhausts tsc's
 * heap rather than saying so. The scaffolder used to answer that with a
 * `paths` entry pointing at an exact version inside the framework's own
 * pnpm store, which typechecks until the framework bumps zod and then reads
 * as a corrupted install.
 *
 * Re-exporting is the answer that cannot drift: a project writes
 * `import { z } from "@graview/core"` and gets the copy the framework was
 * built with, for types and at runtime, with nothing to pin and nothing to
 * keep in step.
 */
export { z } from "zod";
/*
 * A field's definition and description, read the way the framework reads
 * them: through `_zod.def` and zod's registry, so a classic schema a product
 * wrote and a mini one the framework built (a compiled document's) read
 * alike (FR-57).
 */
export { defOf, descriptionOf } from "./schema/zod.js";
export type { ZodDef } from "./schema/zod.js";

// Schema — the single declaration everything else derives from.
export { defineNode, isCurrent, labelOf, describeNode, tellApart } from "./schema/define-node.js";
export { nameOfAuthor, viaSaid } from "./who.js";
export type { Person } from "./who.js";
export { createSchema, SchemaError } from "./schema/schema.js";
export type {
  AnySchema,
  DefinitionOfKind,
  EdgeKindInfo,
  KindOfSchema,
  NodeOfKind,
  NodeOfSchema,
  Schema,
} from "./schema/schema.js";
export type {
  LifecycleDeclaration,
  ComputedField,
  AnyNodeDefinition,
  DeclaredEdgeTargets,
  EdgeCardinality,
  EdgeDeclaration,
  EdgeMap,
  EmptyEdgeMap,
  FieldRoleMap,
  NodeDefinition,
  NodeDefinitionSpec,
  NodeOf,
  ValidateEdgeTargets,
} from "./schema/types.js";
export {
  mutationToolSchema,
  nodeJsonSchema,
  schemaJson,
  toJsonSchema,
} from "./schema/json-schema.js";
export type { JsonSchema, MutationToolSchema } from "./schema/json-schema.js";

// Graph — the reactive in-memory model the framework owns.
export { Graph, GraphError, MissingRecordError } from "./graph/graph.js";
export type { ApplyPrimitivesOptions, GraphListener, GraphOptions } from "./graph/graph.js";
export { diffSnapshots, EMPTY_DIFF, isEmptyDiff } from "./graph/diff.js";
export type { GraphDiff, NodeChange } from "./graph/diff.js";
export { invert, isUnset, normalise, UNSET, writesOf } from "./graph/primitives.js";
export type { Primitive } from "./graph/primitives.js";
export { TrackedReader } from "./graph/tracked.js";
export { edgeId } from "./graph/types.js";
export type {
  AnyGraphNode,
  GraphEdge,
  GraphNodeBase,
  GraphReader,
  GraphSnapshot,
} from "./graph/types.js";

// Invariants — pure evaluation, with repairs as the seam to affordances.
export { defineInvariant, evaluate, RuleBudgetError, UnregisteredInvariantError, violationsTouching } from "./invariants/engine.js";
export { FRAMEWORK_VERSION } from "./version.js";
export { capabilities, WIRE_PROTOCOL } from "./capabilities.js";
export type { Capabilities } from "./capabilities.js";
export { REFUSAL_REASONS, refusalOf } from "./refusal.js";
export { ActRefusal } from "./refused.js";
export type { RefusalReason, WireRefusal } from "./refusal.js";
export { assertReadable, FORMATS, formatStamp, NewerFormatError, upgradeOp, upgradeSnapshot } from "./formats.js";
export type { FormatName, FormatStamp } from "./formats.js";
export type {
  EvaluateOptions,
  InvariantContext,
  InvariantDefinition,
  InvariantEvalArgs,
  InvariantScope,
  Repair,
  Violation,
  ViolationStatus,
} from "./invariants/types.js";

// Arrangement — what a kind can be sorted, filtered and grouped by, and the grammar that carries it.
// Its functions are `@graview/core/arrange`'s, fetched with the list that arranges; a declaration names its types.
export type {
  Arrangeable,
  ArrangeContext,
  Arranged,
  ArrangeGraph,
  ArrangedGroup,
  Arrangement,
  ArrangementWords,
  ArrangeNode,
  ArrangeOffer,
  ArrangeOption,
  Condition,
  DateBucket,
  Grouping,
  OfferType,
  Sort,
  SortDirection,
} from "./arrangement.js";

// Search — one matcher finds a record, a kind, a place, an act or a rule; the graph is the result list.
export {
  actsOn,
  describeSearched,
  fold,
  fragmentOf,
  matchNode,
  parseQuery,
  search,
  searchableFields,
  squeeze,
  strengthOf,
  touchWeights,
} from "./search.js";
export type {
  Hit,
  HitAbout,
  MatchStrength,
  ParsedQuery,
  SearchCondition,
  SearchOptions,
  SearchResult,
  Why,
} from "./search.js";

// Mutations — the only writes.
export { argumentsTaken, compileMutation, defineMutation, takesAnId } from "./mutations/define-mutation.js";
export type { CompiledMutation } from "./mutations/define-mutation.js";
export {
  deriveEditMutations,
  deriveMutations,
  deriveRemoveMutations,
  derivedVia,
  editMutationName,
  editVia,
  removeMutationName,
  removeVia,
  fieldWriters,
  fieldsWrittenBy,
  settableFields,
  subjectKindsOf,
  unwrittenFields,
} from "./mutations/derive-edits.js";
export {
  argShape,
  describeArg,
  nodeRef,
  nodeRefArgs,
  nodeRefKinds,
} from "./mutations/node-ref.js";
export type { ArgShape, NodeRefArg } from "./mutations/node-ref.js";
// Records named the way people name them: a node argument takes a label (FR-33).
export { nameKey } from "./labels.js";
export type { RefCandidate, RefResolution } from "./labels.js";
export type {
  AnyMutationDefinition,
  MutationCall,
  MutationContext,
  MutationDefinition,
  MutationDefinitionSpec,
} from "./mutations/types.js";

// Operation log — attribution, causality, selective undo.
export { OperationLog } from "./ops/log.js";
export type { Epoch, LogArchive, LogReading } from "./ops/log.js";
export { isWithheld, namesUnseen, redact, touchedBy, touchesUnseen, withhold, WITHHELD_AUTHOR, WITHHELD_INTENT, type SeatLens } from "./ops/withheld.js";
export { FieldRevisions, fieldsWritten, NEVER_WRITTEN, writtenBy } from "./ops/revisions.js";
export type { FieldConflict, FieldRevision } from "./ops/revisions.js";
export { checkUndo, undoPrimitives, UndoBlockedError } from "./ops/undo.js";
export type { UndoBlock, UndoCheck, UndoRefused } from "./ops/undo.js";
export type { Author, Batch, Operation, Via } from "./ops/types.js";
export {
  actingAs,
  isSystem,
  permits,
  permittedMutations,
  rolesOf,
  rolesWhoCould, whyNot,
} from "./permissions/policy.js";
export type { PolicyWords } from "./permissions/policy.js";
export { PermissionDeniedError } from "./permissions/types.js";
export {
  brandFromAccent,
  checkBrandContrast,
  hueFor,
} from "./theme/derive.js";
export type { AccentBrandOptions, DerivedBrand, RefusedBrand } from "./theme/derive.js";
export {
  checkContrast,
  coloursIn,
  composite,
  contrast,
  luminance,
} from "./theme/contrast.js";
export type { ContrastFinding, Rgba } from "./theme/contrast.js";
export { DARK, LIGHT, SCHEMES } from "./theme/palettes.js";
export { isoShade, SHAPE, shapeOf, TYPOGRAPHY, typographyOf } from "./theme/look.js";
export type { IsoFace, IsoShade, IsoWash, ResolvedShape, ResolvedTypography } from "./theme/look.js";
export { googleCalendar, googleCalendarMapping } from "./sync/google-calendar.js";
export type { Fetcher, GoogleCalendarOptions } from "./sync/google-calendar.js";
export { syncConflictInvariant, SYNC_CONFLICTS } from "./sync/conflict.js";
export type { SyncConflictOptions } from "./sync/conflict.js";
export { SyncEngine } from "./sync/engine.js";
export type { SyncConflict, SyncOptions, SyncReport } from "./sync/engine.js";
export { EMPTY_SYNC_STATE, systemAuthor } from "./sync/types.js";
export type {
  RemoteAck,
  RemoteChange,
  RemoteLink,
  RemoteSystem,
  RemoteWrite,
  ResourceMapping,
  SyncMapping,
  SyncState,
} from "./sync/types.js";
export {
  checkpoint,
  checkpointOn,
  checkpointsBetween,
  effectivity,
  isEffectiveBetween,
  isEffectiveOn,
  isoDate,
} from "./temporal/effectivity.js";
export type { Checkpoint, Effectivity } from "./temporal/effectivity.js";
export { article, counted, fieldWords, humaniseField, nounOf, readableFields, summarise, valueWords, withArticle } from "./schema/define-node.js";
export type { ReadableField } from "./schema/define-node.js";
export { TEXT_PAIRS } from "./theme/types.js";
export { checkKitContrast, connectorHueColour, connectorKitFor, DEFAULT_KIT, kitVariables, resolveKit } from "./theme/kit.js";
export type { ConnectorKit, ConnectorRoute, Kit, KitContrastFinding, KitEndCap, KitOverrides, KitStrokePattern } from "./theme/kit.js";
export { layer, layerProperty, layerVariables, LAYERS, LOCAL_LAYERS, SCENE_LAYERS } from "./theme/layers.js";
export type { Layer } from "./theme/layers.js";
export type { Brand, Scheme, TextPair, ThemeTokens } from "./theme/types.js";
export type { Grant, Policy, Principal, Refusal, Sight } from "./permissions/types.js";
export { recordsOf, sees, sightedKinds } from "./permissions/sight.js";
export { writersOf, type Writers } from "./ops/writers.js";
export type { RecordedLog, Records } from "./permissions/sight.js";
export { answerSeenBy, hidesFrom, logSeenBy, seatLens, seenBy, seesId } from "./seen.js";
export { walkKinds } from "./schema/path.js";
export { tellTheWatchItsAuthors, tellTheWatchWhatIsUnseen } from "./watched.js";

// Integrity — a fold has a fingerprint, and a store can prove its own (FR-20).
export { sha256Hex, snapshotHash } from "./integrity.js";
export type { VerifyResult } from "./integrity.js";
// Stored data checked against its declaration (FR-21).
export { GRAPH_FINDING_CODES, repairPlan, validateGraph } from "./validate-graph.js";
export type {
  FindingRepair,
  GraphFinding,
  GraphFindingCode,
  RepairPlan,
  ValidatedApp,
  ValidateGraphOptions,
} from "./validate-graph.js";

// Store — graph + log + mutations + invariants, one object.
export { MODULES_AUTHOR, PREVIEW_BATCH, ReceiveError, Store, UnknownMutationError, violationKey } from "./store.js";
export type {
  Adopt,
  AdoptResult,
  AppendOp,
  ApplyOptions,
  ApplyResult,
  BatchPreview,
  CompactOptions,
  PlannedChange,
  Preview,
  PreviewOptions,
  Rebase,
  RebaseResult,
  StoreOptions,
  UndoPreview,
} from "./store.js";

// Views — the cardinality x fidelity matrix.
export { createViewRegistry, FIDELITIES, placeSlug } from "./views/types.js";
// Declared lenses that draw (FR-79), the arrangement (FR-80) and every place an app has.
export {
  SHIPPED_LENSES,
  SHIPPED_LENS_NAMES,
  arrangementFindings,
  bindsOf,
  declaredLenses,
  isShippedLens,
  openingOf,
  orderKinds,
  placesOf,
  requiredRolesOf,
} from "./places.js";
// A place's address under a host's base path, and back (FR-106).
export { addressOf, basePathOf, pathWithin } from "./address.js";
export type { AppPlace, DeclaredLenses, DrawnLens, Opening, PagesArrangement, PlaceFinding, ShippedLensName, UndrawnLens } from "./places.js";
export type {
  Cardinality,
  Fidelity,
  ViewCell,
  ViewRegistration,
  ViewMeta,
  Place,
  ViewRegistry,
} from "./views/types.js";

// Persistence — pluggable underneath the framework-owned graph.
export { createMemoryAdapter } from "./persistence/memory.js";
/*
 * The sqlite adapter, exported so `graview serve --sqlite` can reach it.
 * It takes a database OBJECT rather than opening one, so `better-sqlite3`
 * is the caller's dependency and never this package's — nothing here is a
 * native module and nothing here needs building. Under it is the SQL
 * adapter, which asks only for a synchronous `exec` — a Durable Object's
 * `ctx.storage.sql` as it is, or better-sqlite3 through `sqlFromDatabase`
 * (FR-09).
 */
export { createSqlAdapter, createSqliteAdapter, sqlFromDatabase, SQLITE_TABLE_SHAPE } from "./persistence/sqlite.js";
export type { SqlAdapterOptions, SqlExec } from "./persistence/sql.js";
export type { SqliteAdapterOptions, SqliteDatabase, SqliteStatement } from "./persistence/sqlite.js";
export type { PersistenceAdapter } from "./persistence/types.js";

// Extending a schema without rewriting what was written against the base.
export { extendInvariants, extendMutations } from "./extend.js";

// Schema binding — infers mutation and invariant types from one schema.
export { bindSchema } from "./bind.js";
export type { SchemaBinding } from "./bind.js";

// App bundle, checks and generated agent docs.
export { formArgs, formField, formFields, formComplete } from "./mutations/form.js";
export { argumentWords, failureWords, InvalidArguments } from "./mutations/words.js";
export type { FormField, ScalarField } from "./mutations/form.js";
export { resolveModules } from "./modules.js";
export { declareInstallation, INSTALLATION_MODULE } from "./installation.js";
export type { Installation, InstallationOf, InstallationOptions } from "./installation.js";
export type { ModuleDeclaration, ModuleMap, ModuleProjection } from "./modules.js";
export type {
  IntelligenceCapability,
  IntelligenceKind,
  IntelligenceProviderDeclaration,
  IntelligenceReach,
  MigrationDeclaration,
  SettingDeclaration,
} from "./app.js";
export { capabilitiesOf, describeCapability, providerCan } from "./app.js";
export { undecidableArguments } from "./mutations/decidable.js";
export type { UndecidableArgument } from "./mutations/decidable.js";
export { motion, readerSettings, textSize } from "./settings.js";
export { DECISION_BRIDGE_PATH, LOCAL_BRIDGE_PATH } from "./intelligence-bridge.js";
export { STUDIO_DOOR_PATH } from "./studio-door.js";
export type {
  DeclarationChange,
  StudioDoorAnswer,
  StudioDoorAsk,
  StudioDoorDiagnostic,
  StudioDoorSource,
  StudioDoorStatus,
} from "./studio-door.js";
export type {
  DecisionBridgeAnswer,
  DecisionBridgeAsk,
  DecisionBridgeStatus,
  LocalBridgeAnswer,
  LocalBridgeAsk,
  LocalBridgeStatus,
} from "./intelligence-bridge.js";
export { beginning } from "./beginning.js";
export type { Beginning, KindBeginning } from "./beginning.js";
export { defineApp } from "./app.js";
export type { EntityBinding, GraviewApp, LensDeclaration } from "./app.js";
export { foldPresence, nextExpiry, parseParticipant, participantKey, PRESENCE_TTL_MS, presenceName, presenceStands, REMOTE_PRESENCE_TTL_MS, samePresence, VISITOR_PRESENCE_TTL_MS } from "./presence.js";
export type { Participant, Presence, PresenceChannel, PresenceRobot } from "./presence.js";
