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
export { defineNode, isCurrent, labelOf } from "./schema/define-node.js";
// A picture or a document on a record (FR-162), and the host that stores them (FR-163).
export { fileKindOf, filesOf, isFileValue, isImage, safeFileHref } from "./schema/files.js";
export type { FileValue, HostFiles } from "./schema/files.js";
export { fileField, imageField } from "./schema/file-field.js";
// A link to another app (FR-171): its address on a record, and the host that says what it is called.
export { isAppAddress, isAppLinkField } from "./schema/app-link.js";
export type { AppResolution, LinkedApp, ResolveApp } from "./schema/app-link.js";
export { appLinkField } from "./schema/app-link-field.js";
// A date that repeats: the rule kept beside it, its occurrences worked out and never stored.
export { dateOn, isRepeat, isRepeatField, nextOccurrence, occurrences, repeatedBy, repeatKey, validRepeat, WEEKDAYS } from "./repeat.js";
export type { Repeat, Weekday } from "./repeat.js";
export { repeatField } from "./schema/repeat-field.js";
export { nameOfAuthor } from "./who.js";
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
  PageFields,
  ValidateEdgeTargets,
} from "./schema/types.js";
// A kind's JSON Schema and an act's tool schema are `@graview/core/json-schema`'s: a page's first load does not carry them (FR-165).

// Graph — the reactive in-memory model the framework owns.
export { Graph, GraphError, MissingRecordError } from "./graph/graph.js";
export { ARCHIVED, archivedFrom, isArchived } from "./graph/archived.js";
export type { Archived, ArchivedOption } from "./graph/archived.js";
export type { ApplyPrimitivesOptions, GraphListener, GraphOptions } from "./graph/graph.js";
export { diffSnapshots, EMPTY_DIFF, isEmptyDiff } from "./graph/diff.js";
export type { GraphDiff, NodeChange } from "./graph/diff.js";
export { invert, isUnset, normalize, UNSET, writesOf } from "./graph/primitives.js";
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
// How many rules are broken, said as rules; the words a rule's line is drawn with are `@graview/core/lines`', fetched by what draws one.
export { brokenWords } from "./invariants/broken.js";
export type { RuleLine, RulePart, RulePartAs } from "./invariants/line.js";
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
  FieldFormat,
  RuleShapeSource,
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
// The matcher itself is `@graview/core/search`: a page fetches it when somebody first searches (FR-179).
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
export { argumentsTaken, compileMutation, defineMutation, seatMark, takesAnId } from "./mutations/define-mutation.js";
export type { CompiledMutation } from "./mutations/define-mutation.js";
export {
  deriveArchiveMutations,
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
export { nodeRef, nodeRefArgs, nodeRefKinds } from "./mutations/node-ref.js";
export type { NodeRefArg } from "./mutations/node-ref.js";
// What an argument asks for (`argShape`, `describeArg`) is `@graview/core/words`', fetched with what asks (FR-179).
export type { ArgShape } from "./mutations/arg-shape.js";
// Records named the way people name them: a node argument takes a label (FR-33).
export { nameKey } from "./labels.js";
export type { RefCandidate, RefResolution } from "./labels.js";
export type {
  AnyMutationDefinition,
  MutationCall,
  DerivedAct,
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
export { LINEAGE_BASIS_LIMIT, LINEAGE_MODEL_LIMIT, lineageOf, type Lineage } from "./ops/lineage.js";
// What a link was based on, and whether a person has kept it, are `@graview/core/provenance`'s, fetched with what draws them (FR-172).
export type { HasLog, LinkProvenance, LinkRef } from "./ops/provenance.js";
export { KEEP_LINK } from "./mutations/keep-link.js";
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
  colorsIn,
  composite,
  contrast,
  luminance,
} from "./theme/contrast.js";
export type { ContrastFinding, Rgba } from "./theme/contrast.js";
export { DARK, LIGHT, SCHEMES } from "./theme/palettes.js";
export {
  DISPLAY_TRACKING,
  GRAVIEW_COLORS,
  GRAVIEW_FACE,
  graviewSymbol,
  LOGO_RULES,
  PLAIN_WEIGHTS,
  symbolCut,
  WEIGHTS,
} from "./theme/identity.js";
export type { SymbolOptions } from "./theme/identity.js";
export { isoShade, SHAPE, shapeOf, TYPOGRAPHY, typographyOf } from "./theme/look.js";
export { faviconHref, isInlineSvg, markHref, markProblem, MAX_INLINE_SVG, svgProblem } from "./theme/marks.js";
export { DOCUMENT_FONTS, familiesIn, fontProblem, isSystemFamily, stackOf, SYSTEM_FONTS, SYSTEM_STACKS } from "./theme/fonts.js";
export type { SystemStack } from "./theme/fonts.js";
export { accentProblem, documentSchemes, passingShade } from "./theme/accent.js";
export type { AccentRefusal } from "./theme/accent.js";
export type { IsoFace, IsoShade, IsoWash, ResolvedShape, ResolvedTypography } from "./theme/look.js";
// Two-way sync (the engine, its mappings and transports) is `@graview/core/sync`'s: a page draws without it.
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
export { excerpt } from "./excerpt.js";
export { actTitle, article, counted, pluralLabel, pluralOf, edgeWords, fieldWords, humanizeField, nounOf, summarize, valueWords, withArticle } from "./schema/define-node.js";
// Days, times and numbers as a person reads them, in the reader's or the app's locale (FR-178).
export {
  DEFAULT_LOCALE,
  dayAsRead,
  dayOfMonthAsRead,
  daysAsRead,
  localeFor,
  minutesAsRead,
  momentAsRead,
  monthAsRead,
  numberAsRead,
  sayIn,
  timeAsRead,
  weekdayAsRead,
  weekdayName,
  whenAsRead,
} from "./days.js";
export type { FieldSection } from "./schema/reading.js";
export type { ReadableField } from "./schema/define-node.js";
export { TEXT_PAIRS } from "./theme/types.js";
export { checkKitContrast, connectorHueColor, connectorKitFor, DEFAULT_KIT, kitVariables, resolveKit } from "./theme/kit.js";
export type { KitContrastFinding } from "./theme/kit.js";
export type { ConnectorKit, ConnectorRoute, Kit, KitEndCap, KitOverrides, KitStrokePattern } from "./theme/types.js";
export { layer, layerProperty, layerVariables, LAYERS, LOCAL_LAYERS, SCENE_LAYERS } from "./theme/layers.js";
export type { Layer } from "./theme/layers.js";
export type { Brand, Scheme, TextPair, ThemeTokens } from "./theme/types.js";
export type { Grant, Policy, Principal, Refusal, Sight } from "./permissions/types.js";
export { recordsOf, sees, sightedKinds } from "./permissions/sight.js";
export { writersOf, type Writers } from "./ops/writers.js";
export type { RecordedLog, Records } from "./permissions/sight.js";
export { hidesFrom, logSeenBy, seatLens, seenBy, seesId } from "./seen.js";
export { walkKinds } from "./schema/path.js";
export { tellTheWatchWhatIsUnseen } from "./watched.js";

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
export { MODULES_AUTHOR, PREVIEW_BATCH, problemsMoved, ReceiveError, shapedRules, Store, UnknownMutationError, violationKey } from "./store.js";
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
// The day turning (FR-176): a store ticked at each midnight. What reads the clock is `@graview/core/check`'s (`clockReaders`).
export { dayOf, tickEachDay, untilTheDayTurns } from "./clock.js";
export type { Tick } from "./clock.js";

// Views — the cardinality x fidelity matrix.
export { createViewRegistry, FIDELITIES, kindPath, onePerPicture, placeLabel, placePath, placeSlug, recordPath, samePicture, sharesItsName } from "./views/types.js";
// Declared lenses that draw (FR-79), the arrangement (FR-80) and every place an app has.
export {
  SHIPPED_LENSES,
  SHIPPED_LENS_NAMES,
  bindsOf,
  declaredLenses,
  isShippedLens,
  MOST_STANDING,
  openingOf,
  primaryOf,
  supportingKinds,
  orderKinds,
  OVERVIEW_PATH,
  OVERVIEW_SLUG,
  pagesTitle,
  sceneTitle,
  requiredRolesOf,
} from "./places.js";
// A place's address under a host's base path, and back (FR-106).
export { addressOf, basePathOf, pathWithin } from "./address.js";
// Every place an app has (`placesOf`, `placesFrom`) is `@graview/core/seat`'s, and judging the arrangement (`arrangementFindings`) `@graview/core/check`'s (FR-179).
export type { DeclaredLenses, DrawnLens, Opening, PlaceFinding, ShippedLensName, UndrawnLens } from "./places.js";
export type { AppPlace } from "./app-places.js";
export type {
  Cardinality,
  PagesArrangement,
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
export { InvalidArguments } from "./mutations/invalid-arguments.js";
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
export { motion, readerSettings, textSize } from "./settings.js";
export { AI_BRIDGE_PATH, DECISION_BRIDGE_PATH, LOCAL_BRIDGE_PATH } from "./intelligence-bridge.js";
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
  AiBridgeAnswer,
  AiBridgeAsk,
  AiBridgeStatus,
  DecisionBridgeAnswer,
  DecisionBridgeAsk,
  DecisionBridgeStatus,
  LocalBridgeAnswer,
  LocalBridgeAsk,
  LocalBridgeStatus,
} from "./intelligence-bridge.js";
// The order things are made in is `@graview/core/seat`'s, fetched with the seeding and the scene that read it (FR-179).
export type { Beginning, KindBeginning } from "./beginning.js";
export { defineApp } from "./app.js";
export type { EntityBinding, GraviewApp, LensDeclaration } from "./app.js";
export { foldPresence, nextExpiry, parseParticipant, participantKey, PRESENCE_TTL_MS, presenceName, presenceStands, REMOTE_PRESENCE_TTL_MS, samePresence, VISITOR_PRESENCE_TTL_MS } from "./presence.js";
export type { Participant, Presence, PresenceChannel, PresenceRobot } from "./presence.js";
