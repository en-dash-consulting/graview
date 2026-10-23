import type { AnySchema, DismissalStore } from "@graview/core";
import { isDismissed } from "@graview/core/tidying";
import type { ToolDefinition } from "./tool-definition.js";
import {
  surfaceHash,
  type ToolCall,
  type ToolResult,
  type ToolRuntime,
} from "./tools.js";

/*
 * "NOT NOW", FOR THE PERSON A SEAT SITS WITH: a waiting suggestion put out
 * of their sight until tomorrow, kept where the host keeps their own state
 * (`DismissalStore`) — nothing in the log, nobody else told, the app's own
 * actor bound to nothing. Decline is the answer for everyone; this is one
 * person's.
 *
 * A runtime this wraps lists `dismiss_suggestion`, and its
 * `list_suggestions` leaves out what the person said not now to. It wraps
 * the runtime rather than living in it, so a host that keeps no person's
 * state (a server's seat, a worker) carries none of it.
 */

/** How long "not now" hides a suggestion: a day. */
const A_DAY_MS = 86_400_000;

export const DISMISS_SUGGESTION: ToolDefinition = {
  name: "dismiss_suggestion",
  title: "Not now",
  description:
    "Hide a waiting suggestion from the person you act for until tomorrow (or `until`, an ISO time). Unlike decline_suggestion, nothing is kept in the log, it still waits for everyone else, and it may be suggested again.",
  inputSchema: {
    type: "object",
    properties: {
      suggestion: {
        type: "string",
        description: "The suggestion's id, from list_suggestions.",
      },
      until: {
        type: "string",
        description:
          "When it shows again, as an ISO time; tomorrow at this time when unsaid.",
      },
    },
    required: ["suggestion"],
    additionalProperties: false,
  },
  mutating: false,
  annotations: {
    title: "Not now",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

/** What list_suggestions answers, as far as this reads it. */
type Listed = {
  readonly suggestions: readonly {
    readonly id: string;
    readonly about: readonly string[];
  }[];
};

/**
 * A seat that keeps its person's "not now" in `dismissals`: `runtime` with
 * `dismiss_suggestion` listed, and `list_suggestions` leaving out what the
 * person put out of sight. Only a suggestion waiting for this seat can be
 * dismissed; `now` is the clock "tomorrow" is read from.
 */
export function withNotNow<S extends AnySchema>(
  runtime: ToolRuntime<S>,
  dismissals: DismissalStore,
  now: () => number = Date.now,
): ToolRuntime<S> {
  const definitions = [...runtime.definitions, DISMISS_SUGGESTION];
  const watchers = new Set<(call: ToolCall) => void>();
  /** The suggestions waiting for this seat and this person, as list_suggestions answers them. */
  const listed = async (): Promise<ToolResult<S>> => {
    const answer = await runtime.call("list_suggestions", {});
    if (!answer.ok) return answer;
    const at = new Date(now()).toISOString();
    const waiting = (answer.data as Listed).suggestions.filter(
      (one) => !isDismissed(dismissals.list(), one.id, at),
    );
    return {
      ...answer,
      data: { ...(answer.data as object), suggestions: waiting },
      reads: [...new Set(waiting.flatMap((one) => one.about))],
    };
  };
  const dismiss = async (
    args: Record<string, unknown>,
  ): Promise<ToolResult<S>> => {
    const id = String(args["suggestion"] ?? "");
    const until =
      args["until"] === undefined
        ? new Date(now() + A_DAY_MS).toISOString()
        : String(args["until"]);
    if (Number.isNaN(Date.parse(until)))
      return {
        ok: false,
        error: `"${until}" is not a time: say one as an ISO time, like 2026-10-23T09:00:00Z.`,
        reason: "invalid",
        argument: "until",
      };
    const answer = await listed();
    if (!answer.ok) return answer;
    if (!(answer.data as Listed).suggestions.some((one) => one.id === id)) {
      return {
        ok: false,
        error:
          "That suggestion is not waiting for this person: it was accepted, declined or put out of sight already, or it is not one you can see.",
        reason: "missing",
        argument: "suggestion",
      };
    }
    await dismissals.dismiss({
      suggestion: id,
      at: new Date(now()).toISOString(),
      until,
    });
    return { ok: true, data: { suggestion: id, until } };
  };
  return {
    ...runtime,
    definitions,
    hash: surfaceHash(definitions),
    async call(name, args) {
      if (name === "list_suggestions") return listed();
      if (name !== DISMISS_SUGGESTION.name) return runtime.call(name, args);
      const told = (
        call: Omit<ToolCall, "name" | "args" | "mutating" | "at">,
      ) => {
        for (const watcher of watchers)
          watcher({
            name,
            args,
            mutating: false,
            at: new Date().toISOString(),
            ...call,
          });
      };
      told({ phase: "running" });
      const result = await dismiss(args);
      told(
        result.ok ? { phase: "ok" } : { phase: "failed", error: result.error },
      );
      return result;
    },
    onDiff: (listener) => runtime.onDiff(listener),
    onCall(listener) {
      watchers.add(listener);
      const inner = runtime.onCall(listener);
      return () => {
        watchers.delete(listener);
        inner();
      };
    },
  };
}
