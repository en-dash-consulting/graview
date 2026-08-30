// Schema — the single declaration everything else derives from.
export { defineNode, labelOf, describeNode } from "./schema/define-node.js";
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
export { invert, writesOf } from "./graph/primitives.js";
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
export { createViewRegistry, FIDELITIES } from "./views/types.js";
export type {
  Cardinality,
  Fidelity,
  ViewCell,
  ViewRegistration,
  ViewRegistry,
} from "./views/types.js";

// Persistence — pluggable underneath the framework-owned graph.
export { createMemoryAdapter } from "./persistence/memory.js";
export type { PersistenceAdapter } from "./persistence/types.js";

// Extending a schema without rewriting what was written against the base.
export { extendInvariants, extendMutations } from "./extend.js";

// Schema binding — infers mutation and invariant types from one schema.
export { bindSchema } from "./bind.js";
export type { SchemaBinding } from "./bind.js";

// App bundle, checks and generated agent docs.
export { defineApp } from "./app.js";
export type { GraviewApp } from "./app.js";
export { checkApp, formatFindings } from "./cli/check.js";
export type { CheckResult, Finding, Severity } from "./cli/check.js";
export { generateAgentsMd, generateLlmsTxt } from "./cli/docs.js";
