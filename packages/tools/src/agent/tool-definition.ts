import type { JsonSchema } from "@graview/core/json-schema";

/*
 * A TOOL AS A MODEL IS TOLD OF IT: its name, its words, its input and what
 * it does. A module of their own, so a group of tools the surface lists
 * (`subscription-tools.ts`) declares its own without importing the
 * surface that lists it.
 */

/**
 * WHAT A TOOL DOES, in the words every MCP directory asks for (FR-10).
 *
 * Derived from the declaration, never written per tool: a read is
 * read-only; an act that removes or severs loses something; an act whose
 * second run changes nothing the first did not is idempotent. Nothing a
 * Graview tool does reaches outside the graph it was derived from.
 */
export interface ToolAnnotations {
  readonly title: string;
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: false;
}

export interface ToolDefinition {
  /**
   * The name a model calls. MCP-safe — letters, digits, `_` and `-`, at
   * most 64, starting with a letter or `_` — so every client's tool layer
   * takes it. An act whose own name is already safe keeps it.
   */
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  /** False for the read tools, true for anything that changes the graph. */
  readonly mutating: boolean;
  readonly annotations: ToolAnnotations;
  /** The declared name of the act this tool runs; absent on the read tools. */
  readonly act?: string;
}
