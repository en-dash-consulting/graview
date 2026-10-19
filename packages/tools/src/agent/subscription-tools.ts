import type { ToolAnnotations, ToolDefinition } from "./tool-definition.js";

/**
 * NOTIFY ME, AS TOOLS (Roadmap f-notify-subscriptions): a chat subscribes
 * its person the way the menu's sheet does — `subscribe`, `unsubscribe`,
 * `list_subscriptions` — listed only for a seat whose host keeps
 * subscriptions (`ToolRuntimeOptions.subscriptions`). None of them changes
 * the graph: a subscription is about the app, not part of it. What they
 * run is fetched with the first call (`./subscribe-run.ts`).
 */

const quiet = (title: string, readOnly: boolean, idempotent: boolean): ToolAnnotations => ({ title, readOnlyHint: readOnly, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false });

export const SUBSCRIBE: ToolDefinition = {
  name: "subscribe",
  title: "Notify me when something happens",
  description:
    'Subscribe the person you act for to be told when something happens in this app — their host delivers it (an email, a push). on is one of: "act" (an act runs; give act, its declared name, and/or record), "created" (a record of kind is added), "changed" (a record of kind, or the one record, changes), "reaches" (a record of kind, or the one record, comes to satisfy condition, an expression in the app\'s rule language such as done == true or amount > 100). They are told only of changes someone else made, unless alsoMine is true, and only of records they may see. Returns the subscription and its sentence. Changes nothing in the app.',
  inputSchema: {
    type: "object",
    properties: {
      on: { type: "string", enum: ["act", "created", "changed", "reaches"], description: "What to be told of." },
      act: { type: "string", description: "An act's declared name, for on: act." },
      kind: { type: "string", description: "A kind, for created, changed and reaches." },
      record: { type: "string", description: "One record, by id or name: for act, changed and reaches." },
      condition: { type: "string", description: "For reaches: what the record should come to satisfy, in the rule language (done == true)." },
      alsoMine: { type: "boolean", description: "Also when the person themselves made the change; false when unsaid." },
    },
    required: ["on"],
    additionalProperties: false,
  },
  mutating: false,
  annotations: quiet("Notify me when something happens", false, false),
};

export const UNSUBSCRIBE: ToolDefinition = {
  name: "unsubscribe",
  title: "Stop notifying me",
  description: "Take away one of the person's subscriptions, by the id list_subscriptions or subscribe answered. Changes nothing in the app.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "The subscription's id." } },
    required: ["id"],
    additionalProperties: false,
  },
  mutating: false,
  annotations: quiet("Stop notifying me", false, true),
};

export const LIST_SUBSCRIPTIONS: ToolDefinition = {
  name: "list_subscriptions",
  title: "What I am notified of",
  description: "List what the person you act for is told of in this app: each subscription's id and its sentence (\"When someone else adds a task\").",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  mutating: false,
  annotations: quiet("What I am notified of", true, true),
};

export const SUBSCRIPTION_TOOLS: readonly ToolDefinition[] = [SUBSCRIBE, UNSUBSCRIBE, LIST_SUBSCRIPTIONS];
