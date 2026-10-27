import type { AnySchema } from "../schema/schema.js";
import type { AnyMutationDefinition } from "./types.js";

/**
 * WHETHER AN ACT WOULD RUN ON A RECORD NOW, writing a field of it: where
 * typing into the field rides the act (`type-text`), and where a page
 * offers to change the field in place (`editableFields`), so an Edit is
 * never offered on a record the act refuses.
 *
 * An act that says its rule about the record (`allowedOn`, a document act's
 * `allowedWhen`) is believed. One whose rule lives in its `apply` — a
 * TypeScript act that throws `ActRefusal` for a published note — is asked:
 * run on the record with the field's own value, against a context that
 * writes nothing, so asking changes nothing and costs one `apply`.
 *
 * Only the act's own rule says no: an `ActRefusal` whose reason is
 * not `invalid`. An `invalid` one ("nothing to change") is about what it was
 * handed, which asking never hands it; an argument it needs and the
 * record does not hold is handed as it is (absent), since its rule about the
 * record comes before its use of them; any other error is no answer, and
 * answers nothing against it. An act whose rule does depend on what it is
 * handed says the rule about the record as `allowedOn`.
 */
export function wouldRun<S extends AnySchema>(mutation: AnyMutationDefinition<S>, schema: S, graph: { getNode(id: string): unknown }, node: unknown, field: unknown, me: string | undefined): boolean {
  if (typeof node !== "string" || typeof field !== "string") return mutation.allowedOn === undefined;
  if (mutation.allowedOn) return mutation.allowedOn(graph as never, node);
  const arg = mutation.subject?.arg ?? "id";
  const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
  const value = (graph.getNode(node) as Record<string, unknown> | undefined)?.[field];
  const given: Record<string, unknown> = { [arg]: node, ...(field !== arg && field in shape && value !== undefined && value !== null ? { [field]: value } : {}) };
  const parsed = (mutation.input as { safeParse?(input: unknown): { success: boolean; data?: unknown } }).safeParse?.(given);
  const args = parsed?.success ? (parsed.data as Record<string, unknown>) : given;
  const nothing = () => undefined;
  const context = {
    graph,
    schema,
    me,
    addNode: nothing,
    removeNode: nothing,
    patchNode: nothing,
    archiveNode: nothing,
    unarchiveNode: nothing,
    mergeNode: nothing,
    addEdge: nothing,
    removeEdge: nothing,
    setSingleSource: nothing,
    freshId: (label: string, prefix?: string) => `${prefix ? `${prefix}:` : ""}${label}`,
    emit: nothing,
  };
  try {
    mutation.apply(context as never, args as never);
  } catch (error) {
    const refusal = error as { readonly name?: unknown; readonly reason?: unknown } | null;
    return !(refusal?.name === "ActRefusal" && refusal.reason !== "invalid");
  }
  return true;
}
