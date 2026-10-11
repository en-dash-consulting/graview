import type { HostAi, HostTurn } from "./ai.js";

/** One content block of a Messages API message, as far as a turn reads it; any other block is passed back as it came. */
export interface MessagesBlock {
  readonly type: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly [key: string]: unknown;
}

/** One Messages API request a turn makes: the host adds its model, its token limit and its key. */
export interface MessagesStepRequest {
  /** Absent when the turn has none: a route that forwards the request as it is would be refused an empty one. */
  readonly system?: string;
  readonly messages: readonly { readonly role: "user" | "assistant"; readonly content: string | readonly MessagesBlock[] }[];
  readonly tools?: readonly { readonly name: string; readonly description: string; readonly input_schema: unknown }[];
  /** `{ type: "none" }` on the last step a turn may take, so the model answers from what it read. */
  readonly tool_choice?: { readonly type: "none" };
}

/** What one Messages API request answered: its content and why it stopped. */
export interface MessagesStepReply {
  readonly content: readonly MessagesBlock[];
  readonly stop_reason?: string | null;
}

/** The most model requests one turn makes; the last is asked to answer, with no tool. */
export const TURN_STEPS = 8;

/**
 * A HOST'S `turn` OVER THE MESSAGES API (FR-160), the tool loop written
 * once: hand it how to make ONE request — through a server that holds the
 * key and adds the model, as the dev server's door and a host's own route
 * do — and it asks, runs each `tool_use` the model asks for through the
 * seat's `call`, hands the results back, and asks again, until the model
 * answers in words. The loop runs where the seat is, so every read is the
 * person's own; the server sees one stateless request at a time.
 *
 * At most `steps` requests (`TURN_STEPS`): the last offers no tool, so a
 * model that would read forever answers from what it has.
 */
export function turnThroughMessages(
  step: (request: MessagesStepRequest) => Promise<MessagesStepReply>,
  options: { readonly steps?: number } = {},
): NonNullable<HostAi["turn"]> {
  const steps = Math.max(1, options.steps ?? TURN_STEPS);
  return async (turn: HostTurn) => {
    const tools = turn.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema }));
    const messages: MessagesStepRequest["messages"][number][] = turn.messages.map((message) => ({ role: message.role, content: message.content }));
    for (let at = 1; ; at += 1) {
      const last = at >= steps;
      const reply = await step({ ...(turn.system ? { system: turn.system } : {}), messages, ...(tools.length > 0 ? { tools, ...(last ? { tool_choice: { type: "none" as const } } : {}) } : {}) });
      const uses = reply.content.filter((block) => block.type === "tool_use");
      if (last || reply.stop_reason !== "tool_use" || uses.length === 0) {
        return reply.content.flatMap((block) => (block.type === "text" && typeof block.text === "string" ? [block.text] : [])).join("");
      }
      messages.push({ role: "assistant", content: reply.content });
      messages.push({
        role: "user",
        content: await Promise.all(
          uses.map(async (use) => {
            const read = await turn.call(String(use.name), (use.input ?? {}) as Record<string, unknown>);
            const failed = typeof read === "object" && read !== null && "error" in read && Object.keys(read).length === 1;
            return { type: "tool_result", tool_use_id: String(use.id), content: JSON.stringify(read) ?? "null", ...(failed ? { is_error: true } : {}) };
          }),
        ),
      });
    }
  };
}
