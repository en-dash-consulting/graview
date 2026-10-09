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
export { BY_NAME, createToolRuntime, surfaceHash, toolDefinitions } from "./agent/tools.js";
export type {
  Resolved,
  ToolAnnotations,
  ToolDefinition,
  ToolDefinitionsOptions,
  ToolResult,
  ToolRuntime,
  ToolRuntimeOptions,
  ToolCall,
} from "./agent/tools.js";
export type { UntrustedText } from "./agent/untrusted.js";
export { createInAppAdapter, createMcpAdapter } from "./agent/adapters.js";
export type { InAppAgent, McpContent, McpTool, McpToolResult } from "./agent/adapters.js";
// MCP for remote hosts: Streamable HTTP, stateless, behind the host's auth hook (FR-10).
export { createMcpHttpHandler } from "./mcp-http.js";
export type { McpCall, McpHttpOptions } from "./mcp-http.js";
export { MCP_PROTOCOL_VERSION } from "./mcp-protocol.js";
export { insightProvider } from "./providers/insight.js";
export { usageBoost, usageWeights } from "./usage.js";
export { loadPins, savePins, togglePin, NO_PINS } from "./pins.js";
export type { PinOverrides } from "./pins.js";
export {
  describeProposal,
  droppedProposals,
  firstJsonObject,
  resolveProposal,
  stillNeeded,
  intelligenceProvider,
  llmIntelligence,
  toCall,
  templateIntelligence,
  validateProposals,
} from "./intelligence.js";
export type { Completion, Intelligence, ProposedCall } from "./intelligence.js";
export { graphResponder, llmResponder } from "./conversation.js";
// What the seat offers before anybody asks: one line, a few questions, at most three acts.
export { offeredActs, SEAT_OFFERS, sayAct, suggestionsFor, whereLine } from "./suggest.js";
export type { OfferedAct, SeatSubject, SuggestInput, Suggestion, SuggestionWhy } from "./suggest.js";
export type { ChatContext, ChatReply, Responder } from "./conversation.js";
export {
  completionFor,
  configuredResponder,
  decideFor,
  DEFAULT_INTELLIGENCE,
  describeIntelligence,
  loadIntelligenceConfig,
  localCompletion,
  openAiCompatibleCompletion,
  RUNGS,
  rungFor,
  rungHonesty,
  saveIntelligenceConfig,
  xaiCompletion,
} from "./local.js";
export type { IntelligenceConfig, IntelligenceSource, LocalStatus } from "./local.js";
export { completionDecide, graphDecide } from "./decide.js";
export type { PartlyDecided } from "./decide.js";
export { drawFigure, FIGURE_STYLE, nearestFigure, onlyTheSvg } from "./figure.js";
export type { DrawnFigure } from "./figure.js";

export { applyPlan, dependentsOf, describePlan, isPlanReference, planFrom, without } from "./plan.js";
export type { AppliedPlan, Plan, PlanEntry, PlanOptions, PlannedCall, PlanReference } from "./plan.js";
export { across, inside, within } from "./space.js";
export type { Ring, SpacePoint } from "./space.js";

// The questions a declaration already types, derived rather than authored.
export {
  allQuestions,
  nodeState,
  pairQuestion,
  questionsForInvariant,
  questionsForKind,
  questionsForMutation,
  scoreToValue,
} from "./questions.js";
export type { ChoiceQuestion, DerivedQuestion, NoulQuestion, OfferedQuestion, Question, QuestionAbout, ScoreQuestion } from "./questions.js";

// The decision provider: one call, many questions, honest about failure.
export { JEV_ENDPOINT, JEV_INPUT_USD_PER_MILLION, JEV_MODEL, JevError, jevCostUsd, jevDecide, jevKeyFromEnvironment } from "./providers/jev.js";
export type { Answer, ChoiceAnswer, Decide, Decided, JevFailure, JevOptions, NoulAnswer, ScoreAnswer, Usage } from "./providers/jev.js";

// A run: a sequence of typed asks over the graph, declared not scripted.
export { describeRun, landRun, offerOf, readRun, replyFromRun, runFrom, valueOf } from "./run.js";
export type { Answered, RunDeclaration, RunOptions, RunReading, RunResult, RunStep, StepOutcome } from "./run.js";

// A loop: act, re-judge, act again, and know when to stop.
export { replyFromLoop, runLoop } from "./loop.js";
export type { LoopDeclaration, LoopOptions, LoopResult, LoopTurn, StopWhy, Stopped } from "./loop.js";
