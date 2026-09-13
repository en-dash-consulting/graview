// Derived affordances: actions found in the graph, not authored per selection.
export {
  applyAffordance,
  defaultProviders,
  deriveAffordances,
  previewAffordance,
} from "./derive.js";
export type { WithheldAffordance } from "./types.js";
export type { DeriveOptions } from "./derive.js";
export type {
  Affordance,
  AffordanceProvider,
  AffordanceSet,
  DeriveContext,
  Observation,
  OpenParameter,
  ProviderName,
} from "./types.js";

// The providers, individually, so an app can replace or reorder them.
export { editableFields } from "./edit.js";
export type { EditableField } from "./edit.js";
export { invariantProvider } from "./providers/invariant.js";
export { schemaProvider } from "./providers/schema.js";
export { structureProvider } from "./providers/structure.js";
export { lensProvider } from "./providers/lens.js";
export type { LensAction } from "./providers/lens.js";
export { deriveWithLlm } from "./providers/llm.js";
export type { LlmProposal, LlmProvider } from "./providers/llm.js";

// One tool surface, two transports.
export { createToolRuntime } from "./agent/tools.js";
export type {
  ToolDefinition,
  ToolResult,
  ToolRuntime,
  ToolRuntimeOptions,
  ToolCall,
} from "./agent/tools.js";
export { createInAppAdapter, createMcpAdapter } from "./agent/adapters.js";
export type { InAppAgent, McpContent, McpTool, McpToolResult } from "./agent/adapters.js";
export { insightProvider } from "./providers/insight.js";
export { usageBoost, usageWeights } from "./usage.js";
export { loadPins, savePins, togglePin, NO_PINS } from "./pins.js";
export type { PinOverrides } from "./pins.js";
export {
  describeProposal,
  intelligenceProvider,
  llmIntelligence,
  toCall,
  templateIntelligence,
  validateProposals,
} from "./intelligence.js";
export type { Completion, Intelligence, ProposedCall } from "./intelligence.js";
export { graphResponder, llmResponder } from "./conversation.js";
export type { ChatContext, ChatReply, Responder } from "./conversation.js";
export {
  configuredResponder,
  DEFAULT_INTELLIGENCE,
  describeIntelligence,
  loadIntelligenceConfig,
  localCompletion,
  openAiCompatibleCompletion,
  saveIntelligenceConfig,
  xaiCompletion,
} from "./local.js";
export type { IntelligenceConfig, LocalStatus } from "./local.js";
export { drawFigure, FIGURE_STYLE, nearestFigure, onlyTheSvg } from "./figure.js";
export type { DrawnFigure } from "./figure.js";
