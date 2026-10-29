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
export { fileAt, fileKindOf, fileSrc, filesOf, isFileValue, isImage, isVideo, safeFileHref, videoWords } from "./schema/files.js";
export type { FileKind, FileValue, HostFiles } from "./schema/files.js";
export { fileField, imageField, videoField } from "./schema/file-field.js";
// A link to another app (FR-171): its address on a record, and the host that says what it is called.
export { isAppAddress, isAppLinkField } from "./schema/app-link.js";
export type { AppResolution, LinkedApp, ResolveApp } from "./schema/app-link.js";
export { appLinkField } from "./schema/app-link-field.js";
// A relation to a kind in another app (FR-171): the link kept on the record, and the host that reads the far record as the viewer.
export { isLinkedTarget, linkedRefOf, linkedRefsOf, linkedRelationOf, linkedRelations, linkedValue, parseLinkedTarget, readLinkedThrough } from "./schema/linked.js";
export type { LinkedRead, LinkedReader, LinkedRecord, LinkedRecordAnswer, LinkedRecordRef, LinkedRecords, LinkedRelation, LinkedSearch, LinkedViewer } from "./schema/linked.js";
export { linkedRecordField } from "./schema/linked-field.js";
export { linkedReads } from "./schema/linked-reads.js";
export type { LinkedReads } from "./schema/linked-reads.js";
// A date that repeats: the rule kept beside it, its occurrences worked out and never stored.
export { dateOn, isRepeat, isRepeatField, nextOccurrence, occurrences, repeatedBy, repeatKey, validRepeat, WEEKDAYS } from "./repeat.js";
export type { Repeat, Weekday } from "./repeat.js";
export { repeatField } from "./schema/repeat-field.js";
export { markdownField } from "./schema/markdown-field.js";
// A phone, a place and a length of time: a tel: link, a link to the reader's maps app, minutes said "1 h 30 min".
export type { TypedField } from "./schema/typed-fields.js";
export { durationField, phoneField, placeField } from "./schema/typed-field-builders.js";
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
export type { Primitive, SpliceTextPrimitive } from "./graph/primitives.js";
export { applySplice, transformCaret } from "./text/splice.js";
export type { TextSplice } from "./text/splice.js";
export { TrackedReader } from "./graph/tracked.js";
export { edgeId } from "./graph/types.js";
export { EDGE_FIELDS } from "./graph/edge-fields.js";
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
export { assertReadable, FORMATS, formatStamp, NewerFormatError, PRIMITIVE_OPS, upgradeOp, upgradeSnapshot, VALUE_TYPES } from "./formats.js";
export { unknownPrimitive } from "./format-error.js";
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
  NearBy,
  NearCandidate,
  NearScore,
  ParsedQuery,
  SearchCondition,
  SearchOptions,
  SearchRanker,
  SearchResult,
  Why,
} from "./search.js";

// Mutations — the only writes.
export { argumentsTaken, compileMutation, defineMutation, numbersSpelled, seatMark, takesAnId } from "./mutations/define-mutation.js";
export { wouldRun } from "./mutations/would-run.js";
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
export type { AmountMark } from "./schema/amount-mark.js";
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
// A record an earlier call of the same change made, named by a later one (FR-193).
export { isMadeRef, made } from "./mutations/made.js";
export type { MadeRef } from "./mutations/made.js";

// Operation log — attribution, causality, selective undo.
export { OperationLog } from "./ops/log.js";
export { bareOp, inverseOf, inverted, withInverse } from "./ops/inverse.js";
export type { Epoch, LogArchive, LogReading } from "./ops/log.js";
export { isWithheld, namesUnseen, redact, touchedBy, touchesUnseen, withhold, WITHHELD_AUTHOR, WITHHELD_INTENT, type SeatLens } from "./ops/withheld.js";
export { FieldRevisions, fieldsWritten, NEVER_WRITTEN, writtenBy } from "./ops/revisions.js";
export type { FieldConflict, FieldRevision } from "./ops/revisions.js";
export { checkUndo, undoPrimitives, UndoBlockedError } from "./ops/undo.js";
export type { UndoBlock, UndoCheck, UndoRefused } from "./ops/undo.js";
export type { Author, AuthorKind, Batch, Operation, SentOut, Via } from "./ops/types.js";
export { AUTHOR_KINDS, authorKindOf } from "./ops/types.js";
export { LINEAGE_BASIS_LIMIT, LINEAGE_EVIDENCE_LIMIT, LINEAGE_LIMIT, LINEAGE_MODEL_LIMIT, lineageOf, type Lineage } from "./ops/lineage.js";
// What a link was based on, and whether a person has kept it, are `@graview/core/provenance`'s, fetched with what draws them (FR-172).
export type { HasLog, LinkProvenance, LinkRef } from "./ops/provenance.js";
export { KEEP_LINK } from "./mutations/keep-link.js";
// A vote on a suggestion (Roadmap f-suggestion-votes): the act every store answers to, what its op keeps, and what the app says of suggestions as a whole.
export { PROPOSE_CHANGES, type ProposeChangesArgs } from "./mutations/propose-changes.js";
export { VOTE_SUGGESTION, type AppTidying, type SuggestionVote, type Vote, type VotesOptions } from "./mutations/vote-suggestion.js";
// Typing into a field typed together (Roadmap f-collab-text): the act every store answers to, and whether a field is one.
export { TYPE_TEXT } from "./text/typing-hook.js";
export type { TypeTextArgs } from "./mutations/type-text.js";
export { markCollaborative } from "./schema/collaborative.js";
// Whether a record is left alone and an author is the app's own actor, which a page draws with; the rest is `@graview/core/tidying`'s.
export { isAutomated, isLeftAlone } from "./ops/tidying.js";
export type { Dismissal, DismissalStore, Suggestion, SuggestionTally } from "./ops/suggestions.js";
export type { ActivityRow } from "./ops/digest.js";
export {
  actingAs,
  isSystem,
  permits,
  permittedMutations,
  proposedMutations,
  proposes,
  rolesOf,
  rolesWhoCould, whyNot,
} from "./permissions/policy.js";
export type { PolicyWords } from "./permissions/policy.js";
export { PermissionDeniedError } from "./permissions/types.js";
export { signInInstead, type SignIn } from "./permissions/sign-in.js";
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
export { emojiMark, emojiOf, emojiProblem, emojiSvg, faviconHref, isInlineSvg, logoFor, logoOf, logoScheme, markHref, markProblem, MAX_INLINE_SVG, svgProblem } from "./theme/marks.js";
export { DOCUMENT_FONTS, familiesIn, fontProblem, isSystemFamily, stackOf, SYSTEM_FONTS, SYSTEM_STACKS } from "./theme/fonts.js";
export type { SystemStack } from "./theme/fonts.js";
export { accentProblem, documentSchemes, passingShade } from "./theme/accent.js";
export type { AccentRefusal } from "./theme/accent.js";
export { darkGroundFor, groundSchemes } from "./theme/ground.js";
export type { Ground } from "./theme/ground.js";
export { groundProblem, groundReads } from "./theme/ground-check.js";
export type { GroundRefusal } from "./theme/ground-check.js";
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
// A grid lens's order and a coverage with nothing to cross, said once for the lens and describePlace (2026-10-15).
export { gridSortOf, gridSortProblem, sortForGrid, type GridSort } from "./grid-sort.js";
export { coverageUnlinkedWords } from "./coverage-words.js";
export { actTitle, allLabel, article, counted, pluralLabel, pluralOf, fieldWords, humanizeField, humanizeValue, nounOf, summarize, withArticle } from "./schema/define-node.js";
// What each option of a kind's choices is called, for a view handed records as they are kept (Roadmap f-option-labels).
export { choiceWords } from "./schema/choice-words.js";
// Days, times and numbers as a person reads them, in the reader's or the app's locale (FR-178), and instants on the person's or the app's clock (Roadmap f-app-time-zone).
export {
  DATE_VALUE,
  DEFAULT_LOCALE,
  PARTIAL_DAY,
  dayAsRead,
  daySpanOf,
  dayOfMoment,
  dayOfMonthAsRead,
  daysAsRead,
  dayZoneFor,
  isoToday,
  localeFor,
  minutesAsRead,
  momentAsRead,
  monthAsRead,
  numberAsRead,
  sayIn,
  sayingIn,
  timeAsRead,
  timeZoneFor,
  timeZoneProblem,
  weekdayAsRead,
  weekdayName,
  whenAsRead,
  zoneFor,
} from "./days.js";
export type { Saying } from "./days.js";
export type { FieldSection } from "./schema/reading.js";
export type { ReadableField } from "./schema/define-node.js";
export { TEXT_PAIRS } from "./theme/types.js";
export { checkKitContrast, connectorHueColor, connectorKitFor, DEFAULT_KIT, kitVariables, resolveKit } from "./theme/kit.js";
export type { KitContrastFinding } from "./theme/kit.js";
export type { ConnectorKit, ConnectorRoute, Kit, KitEndCap, KitOverrides, KitStrokePattern } from "./theme/types.js";
export { layer, layerProperty, layerVariables, LAYERS, LOCAL_LAYERS, SCENE_LAYERS } from "./theme/layers.js";
export type { Layer } from "./theme/layers.js";
export type { Brand, BrandLogo, BrandViews, FaviconSpec, Scheme, TextPair, ThemeTokens } from "./theme/types.js";
export type { Grant, Policy, Principal, Refusal, Sight } from "./permissions/types.js";
export { FIELD_SIGHT, recordsOf, sees, sightedKinds } from "./permissions/sight.js";
export { writersOf, type Writers } from "./ops/writers.js";
export type { FieldsKept, RecordedLog, Records } from "./permissions/sight.js";
export { hidesFrom, logSeenBy, seatLens, seenBy, seesId, servesReaders, type SeenOptions } from "./seen.js";
export { onPublish, PUBLISH, readsPublished, type Publishing } from "./publish.js";
// Notify me (Roadmap f-notify-subscriptions): what a subscription is, and the store a page keeps them in; the matcher and their words are `@graview/core/subscriptions`.
export { keptSubscription, memorySubscriptions, subscriberOf, subscriptionId } from "./subscription-shape.js";
// The one door what somebody could not do is recorded through (Roadmap f-friction-log): kept, counted and said on `@graview/core/friction`.
export { attachFriction, isVisitorAuthor, recordFriction } from "./friction-record.js";
export type { FrictionDraft, FrictionSink } from "./friction-record.js";
export type { MatchedRecord, OnSubscriptionMatch, Subscription, SubscriptionDraft, SubscriptionMatch, SubscriptionStore, SubscriptionWhen } from "./subscription-shape.js";
export { walkKinds } from "./schema/path.js";
export { tellTheWatchOfAPressRefusedByItsInput, tellTheWatchWhatIsUnseen } from "./watched.js";

// Integrity — a fold has a fingerprint, and a store can prove its own (FR-20).
export { sha256Hex, snapshotHash } from "./integrity.js";
export type { VerifyResult } from "./integrity.js";
// Stored data checked against its declaration (FR-21).
export { GRAPH_FINDING_CODES, repairPlan, validateGraph } from "./validate-graph.js";
export type { DerivesDeclaration } from "./keep-linked.js";
export type {
  FindingRepair,
  GraphFinding,
  GraphFindingCode,
  RepairPlan,
  ValidatedApp,
  ValidateGraphOptions,
} from "./validate-graph.js";

// Store — graph + log + mutations + invariants, one object.
export { MODULES_AUTHOR, PastError, PREVIEW_BATCH, problemsMoved, ReceiveError, shapedRules, Store, UnknownMutationError, violationKey } from "./store.js";
export { actSpelledAs, nearestAct, spellingOf } from "./mutations/act-spelling.js";
// One order every form asks in, whatever declared the act: what names the record, what it must be given, the rest (Roadmap f-forms-same-order-everywhere).
export { askedArguments, askedFieldsOf, inAskedOrder } from "./mutations/asked-order.js";
export type {
  Adopt,
  AdoptResult,
  AppendOp,
  ApplyOptions,
  ApplyResult,
  BatchPreview,
  CompactOptions,
  PastDeclaration,
  PastPoint,
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
// The views a person tidies from the place menu (Roadmap f-place-menu-views): the host's seam and a memory keeper; the registry as it leaves it is `useTidiedViews` on `@graview/react`.
export { memoryViews, NO_KEPT_VIEWS, placeTidying, REMOVED_VIEW_DAYS, removedLensName } from "./views/kept.js";
export type { KeptViews, KeptViewsMay, KeptViewsState, LensTidyEdit, MemoryViewsOptions, RemovedView } from "./views/kept.js";
export { createViewRegistry, FIDELITIES, kindPath, offeredPlaces, onePerPicture, placeLabel, placePath, placeSlug, recordPath, samePicture, sharesItsName } from "./views/types.js";
// Declared lenses that draw (FR-79), the arrangement (FR-80) and every place an app has.
export {
  SHIPPED_LENSES,
  SHIPPED_LENS_NAMES,
  SEARCH_UNASKED,
  bindsOf,
  declaredLenses,
  isShippedLens,
  MOST_STANDING,
  openingOf,
  primaryOf,
  supportingKinds,
  orderKinds,
  arrangedEntries,
  viewReference,
  HOME_SLUG,
  OVERVIEW_PATH,
  OVERVIEW_SLUG,
  pagesTitle,
  sceneTitle,
  requiredRolesOf,
} from "./places.js";
// A place's address under a host's base path, and back (FR-106).
export { addressOf, basePathOf, pathWithin } from "./address.js";
// Every place an app has (`placesOf`, `placesFrom`) is `@graview/core/seat`'s, and judging the arrangement (`arrangementFindings`) `@graview/core/check`'s (FR-179).
export type { ArrangedEntry, DeclaredLenses, DrawnLens, Opening, PlaceFinding, ShippedLensName, UndrawnLens } from "./places.js";
export type { AppPlace } from "./app-places.js";
export type {
  Cardinality,
  HostView,
  PagesArrangement,
  KindList,
  KindListGroup,
  KindListSort,
  Fidelity,
  ViewCell,
  HomeRegistration,
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
export type { AppendOptions, PersistenceAdapter } from "./persistence/types.js";
export { assertHead, headOf, LogHeadMovedError } from "./persistence/types.js";

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
export type { VisitorFormDeclaration } from "./visitor-form-shape.js";
export type { AppPurpose, JobDeclaration, JobSort } from "./job-shape.js";
export { foldPresence, nextExpiry, parseParticipant, participantKey, PRESENCE_TTL_MS, presenceName, presenceStands, REMOTE_PRESENCE_TTL_MS, samePresence, VISITOR_PRESENCE_TTL_MS } from "./presence.js";
export type { Participant, Presence, PresenceCaret, PresenceChannel, PresenceRobot } from "./presence.js";
export { FRESH_KEY, freshAddress } from "./fresh.js";
export type { FreshStorage } from "./fresh.js";
