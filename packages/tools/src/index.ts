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
// Acting on several records at once: the acts a selection shares, run as one batch with one undo.
export { actOnSeveral, actsForSeveral } from "./several.js";
export type { ActOnSeveralOptions, SeveralAct, SeveralActs, SeveralCall, SeveralOptions, SeveralOutcome, SeveralRefusal, SeveralWithheld } from "./several.js";
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
export { DISMISS_SUGGESTION, withNotNow } from "./agent/not-now.js";
export { READ_CHARS, READ_HITS, READ_LINKS, READ_PAGE, READ_PROBLEMS, READ_TEXT } from "./agent/bounds.js";
export type {
  DraftTools,
  KeptLensEdit,
  Resolved,
  ToolDefinitionsOptions,
  ToolResult,
  ToolRuntime,
  ToolRuntimeOptions,
  ToolCall,
} from "./agent/tools.js";
export type { ToolAnnotations, ToolDefinition } from "./agent/tool-definition.js";
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
export type { Completion, CompletionImage, CompletionReply, CompletionRequest, Intelligence, ProposedCall } from "./intelligence.js";
export { graphResponder, llmResponder } from "./conversation.js";
export type { ChatContext, ChatReply, Responder } from "./conversation.js";
// Where an ask takes the app (`resolveAsk` is `@graview/tools/go`'s, fetched with the seat that asks).
export type { AskAbout, AskAnswer, AskContext, SeatMove, SeatOffer } from "./go.js";
export { completionFor, decideFor, localCompletion, openAiCompatibleCompletion, seatResponder, WEBLLM_URL, xaiCompletion } from "./local.js";
export type { LocalStatus } from "./local.js";
// The AI the host gave a seat: decided once, in code, never chosen by a reader.
export { aiOff, aiTalks, ANSWERED_WITH_AI, fastGiven, HOVER_CHIP_CONFIDENCE, hoverChipsOn, inlineAiOn, NO_AI, NO_AI_SAID, suggestsOnOpen } from "./ai.js";
export { aiVia } from "./local.js";
export type { AiInteractionHost, AiPrice, AnswerProvider, AnswerReply, AnswerRequest, FastProvider, HostAi, HostTurn, ThinkingProvider, ThinkingReply, ThinkingRequest, TurnMessage } from "./ai.js";
// The tool loop a host's `turn` runs over one Messages API request at a time (FR-160).
export { TURN_STEPS, turnThroughMessages } from "./turn.js";
export type { MessagesBlock, MessagesStepReply, MessagesStepRequest } from "./turn.js";
export { aiThroughDevServer } from "./dev-ai.js";
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
export type { Answer, ChoiceAnswer, Decide, Decided, NoulAnswer, ScoreAnswer, Usage } from "./fast.js";
export type { JevFailure, JevOptions } from "./providers/jev.js";

// A run: a sequence of typed asks over the graph, declared not scripted.
export { describeRun, landRun, offerOf, readRun, replyFromRun, runFrom, valueOf } from "./run.js";
export type { Answered, RunDeclaration, RunOptions, RunReading, RunResult, RunStep, StepOutcome } from "./run.js";

// A loop: act, re-judge, act again, and know when to stop.
export { replyFromLoop, runLoop } from "./loop.js";
export type { LoopDeclaration, LoopOptions, LoopResult, LoopTurn, StopWhy, Stopped } from "./loop.js";
