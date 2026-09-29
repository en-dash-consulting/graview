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

// Schema — the single declaration everything else derives from.
export { defineNode, isCurrent, labelOf, describeNode, tellApart } from "./schema/define-node.js";
export { nameOfAuthor } from "./who.js";
export { createSchema, SchemaError } from "./schema/schema.js";
export type {
  AnySchema,
  EdgeKindInfo,
  KindOfSchema,
  NodeOfKind,
  NodeOfSchema,
  Schema,
} from "./schema/schema.js";
export type {
  LifecycleDeclaration,
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
export { Graph, GraphError } from "./graph/graph.js";
export type { GraphListener, GraphOptions } from "./graph/graph.js";
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
export { defineInvariant, evaluate, UnregisteredInvariantError, violationsTouching } from "./invariants/engine.js";
export type {
  EvaluateOptions,
  InvariantContext,
  InvariantDefinition,
  InvariantEvalArgs,
  InvariantScope,
  Repair,
  Violation,
} from "./invariants/types.js";

// Arrangement — what a kind can be sorted, filtered and grouped by, and the grammar that carries it.
export {
  admitArrangement,
  arrange,
  arrangeable,
  arrangeAllows,
  asksForThePast,
  bucketStart,
  conditionHolds,
  edgesOf,
  formatArrangement,
  matches,
  NO_ARRANGEMENT,
  parseArrangement,
} from "./arrange.js";
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
} from "./arrange.js";

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
export { compileMutation, defineMutation, takesAnId } from "./mutations/define-mutation.js";
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
export type { ArgShape } from "./mutations/node-ref.js";
export type {
  AnyMutationDefinition,
  MutationCall,
  MutationContext,
  MutationDefinition,
  MutationDefinitionSpec,
} from "./mutations/types.js";

// Operation log — attribution, causality, selective undo.
export { OperationLog } from "./ops/log.js";
export { checkUndo, undoPrimitives } from "./ops/undo.js";
export type { UndoBlock, UndoCheck } from "./ops/undo.js";
export type { Author, Batch, Operation } from "./ops/types.js";
export {
  permits,
  permittedMutations,
  rolesOf,
  rolesWhoCould, whyNot,
} from "./permissions/policy.js";
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
export { article, humaniseField, readableFields, summarise, withArticle } from "./schema/define-node.js";
export type { ReadableField } from "./schema/define-node.js";
export { TEXT_PAIRS } from "./theme/types.js";
export { checkKitContrast, connectorHueColour, connectorKitFor, DEFAULT_KIT, kitVariables, resolveKit } from "./theme/kit.js";
export type { ConnectorKit, ConnectorRoute, Kit, KitContrastFinding, KitEndCap, KitOverrides, KitStrokePattern } from "./theme/kit.js";
export type { Brand, Scheme, TextPair, ThemeTokens } from "./theme/types.js";
export type { Grant, Policy, Principal, Refusal } from "./permissions/types.js";

// Store — graph + log + mutations + invariants, one object.
export { Store, violationKey } from "./store.js";
export type {
  ApplyOptions,
  ApplyResult,
  Preview,
  StoreOptions,
  UndoPreview,
} from "./store.js";

// Views — the cardinality x fidelity matrix.
export { createViewRegistry, FIDELITIES, placeSlug } from "./views/types.js";
export { FIGURES, FIGURE_NAMES, figureBrief, figureFaults, figureSvg } from "./schema/figures.js";
export type { Figure } from "./schema/figures.js";
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
 * native module and nothing here needs building.
 */
export { createSqliteAdapter, SQLITE_TABLE_SHAPE } from "./persistence/sqlite.js";
export type { SqliteAdapterOptions, SqliteDatabase, SqliteStatement } from "./persistence/sqlite.js";
export type { PersistenceAdapter } from "./persistence/types.js";

// Extending a schema without rewriting what was written against the base.
export { extendInvariants, extendMutations } from "./extend.js";

// Schema binding — infers mutation and invariant types from one schema.
export { bindSchema } from "./bind.js";
export type { SchemaBinding } from "./bind.js";

// App bundle, checks and generated agent docs.
export { formField, formFields, formComplete } from "./mutations/form.js";
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
export { describeApp } from "./cli/describe.js";
export type { DescribeOptions } from "./cli/describe.js";
export { beginning } from "./beginning.js";
export type { Beginning, KindBeginning } from "./beginning.js";
export { defineApp } from "./app.js";
export type { EntityBinding, GraviewApp, LensDeclaration } from "./app.js";
export { checkApp, formatFindings } from "./cli/check.js";
export type { CheckResult, Finding, Severity } from "./cli/check.js";
export { generateAgentsMd, generateLlmsTxt } from "./cli/docs.js";

// The city: a map drawn from the declaration, in lattice cells.
export { BLOCK, cityExtent, cityMap, MAX_SIDE, plotsOverlap, roadsOf, sharedEdges, sideFor, toIso } from "./city.js";
export type { CityHints, CityMap, Plot, Road } from "./city.js";
export { foldPresence, PRESENCE_TTL_MS, samePresence } from "./presence.js";
export type { Presence, PresenceChannel, PresenceRobot } from "./presence.js";
