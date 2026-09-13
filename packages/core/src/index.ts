// Schema — the single declaration everything else derives from.
export { defineNode, isCurrent, labelOf, describeNode } from "./schema/define-node.js";
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

// Mutations — the only writes.
export { compileMutation, defineMutation } from "./mutations/define-mutation.js";
export type { CompiledMutation } from "./mutations/define-mutation.js";
export {
  deriveEditMutations,
  editMutationName,
  editVia,
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
export { Store } from "./store.js";
export type {
  ApplyOptions,
  ApplyResult,
  Preview,
  StoreOptions,
  UndoPreview,
} from "./store.js";

// Views — the cardinality x fidelity matrix.
export { createViewRegistry, FIDELITIES, placeSlug } from "./views/types.js";
export { FIGURES, FIGURE_NAMES, figureFaults, figureSvg } from "./schema/figures.js";
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
export type { Installation, InstallationOptions } from "./installation.js";
export type { ModuleDeclaration, ModuleMap, ModuleProjection } from "./modules.js";
export type { IntelligenceProviderDeclaration, MigrationDeclaration, SettingDeclaration } from "./app.js";
export { motion, readerSettings, textSize } from "./settings.js";
export { defineApp } from "./app.js";
export type { EntityBinding, GraviewApp, LensDeclaration } from "./app.js";
export { checkApp, formatFindings } from "./cli/check.js";
export type { CheckResult, Finding, Severity } from "./cli/check.js";
export { generateAgentsMd, generateLlmsTxt } from "./cli/docs.js";
