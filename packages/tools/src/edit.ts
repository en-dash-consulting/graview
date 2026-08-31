import { argShape, nodeRefArgs, type AnySchema, type ArgShape, type Store } from "@graview/core";
import type { OpenParameter } from "./types.js";

/**
 * A field you can change where it is shown, and the mutation that would do it.
 *
 * Reading a node closely is exactly when you most want to change it, and
 * until now the only way was to find a named mutation in the actions strip
 * and answer its arguments in a form. "Change this word" should be available
 * on the word.
 *
 * It still goes through a mutation. That is not a formality: the mutation is
 * what puts the change in the op log with an author and an intent, what makes
 * it undoable, and what the invariants judge. An in-place edit that wrote the
 * graph directly would be the one kind of change nobody could take back.
 */
export interface EditableField {
  /** The field on the node, as the schema declares it. */
  readonly field: string;
  readonly mutation: string;
  /** The mutation's own title, so the control can say what applying it means. */
  readonly title: string;
  /** What sort of answer the field wants, read off the mutation's input. */
  readonly shape: ArgShape;
  /**
   * Anything else the mutation needs that the edit cannot supply. Present
   * rather than filtered out: a field editable only by answering a second
   * question is still worth offering, and hiding it would be a lie.
   */
  readonly open: readonly OpenParameter[];
  /** The call for a new value. */
  call(value: unknown): { name: string; args: Record<string, unknown> };
}

/**
 * Which of a node's fields can be edited in place, derived from declarations.
 *
 * The rule: a mutation whose subject accepts this kind, with an input
 * argument named exactly like one of the kind's fields, writes that field.
 * Nothing is wired up per field and no app says anything — `relabelEntity`
 * takes `label`, `rescheduleTrigger` takes `when`, `annotateTrigger` takes
 * `note`, and each of those is already the name of the field it sets.
 *
 * The heuristic is name plus shape, and it is worth being honest about its
 * limit: a mutation taking an argument called `label` that means something
 * other than the subject's own label would be matched wrongly. Nothing here
 * writes anything on its own, though — the edit runs the mutation, the
 * mutation decides, and the invariants judge the result — so the cost of a
 * wrong guess is an action offered that does not do what its name suggests,
 * not a corrupted graph.
 */
export function editableFields<S extends AnySchema>(
  store: Store<S>,
  nodeId: string,
): readonly EditableField[] {
  const node = store.graph.getNode(nodeId) as Record<string, unknown> | undefined;
  if (!node) return [];
  const kind = node["kind"] as string;
  const definition = store.schema.tryDefinition(kind);
  const declared = new Set(Object.keys(definition?.fields.shape ?? {}));

  const found = new Map<string, EditableField>();
  for (const mutation of store.allMutations()) {
    const subject = mutation.subject;
    if (!subject) continue;
    const accepts =
      subject.kinds === "*" || (subject.kinds as readonly string[]).includes(kind);
    if (!accepts) continue;

    const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
    const refs = new Set(nodeRefArgs(mutation.input).map((ref) => ref.name));

    for (const name of Object.keys(shape)) {
      if (name === subject.arg) continue;
      // A field, not an argument that happens to name another node.
      if (!declared.has(name) || refs.has(name)) continue;
      // First declaration wins, so which mutation edits a field is stable
      // rather than depending on the order mutations were registered in.
      if (found.has(name)) continue;

      const open: OpenParameter[] = [];
      for (const other of Object.keys(shape)) {
        if (other === subject.arg || other === name) continue;
        if (optional(shape[other])) continue;
        const ref = nodeRefArgs(mutation.input).find((candidate) => candidate.name === other);
        open.push({
          name: other,
          ...(ref ? { kinds: ref.kinds } : {}),
          ...(ref
            ? {
                candidates: ref.kinds.includes("*")
                  ? store.graph.allNodes().map((other2) => other2.id)
                  : ref.kinds.flatMap((refKind) =>
                      store.graph.nodesOfKind(refKind as never).map((other2) => other2.id),
                    ),
              }
            : {}),
          shape: argShape(mutation.input, other),
        });
      }

      found.set(name, {
        field: name,
        mutation: mutation.name,
        title: mutation.title ?? mutation.name,
        shape: argShape(mutation.input, name),
        open,
        call: (value) => ({
          name: mutation.name,
          args: { [subject.arg]: nodeId, [name]: value },
        }),
      });
    }
  }
  return [...found.values()];
}

/** Whether an argument may be left out, so it does not count as unanswered. */
function optional(schema: unknown): boolean {
  const type = (schema as { _def?: { type?: string } })?._def?.type;
  return type === "optional" || type === "default" || type === "nullable";
}
