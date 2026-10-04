import {
  argShape,
  fieldsWrittenBy,
  nodeRefArgs,
  type AnySchema,
  type ArgShape,
  type Store,
  defOf,
} from "@graview/core";
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
   * Whether the mutation takes the new value as an argument. `rename` does;
   * `finish` sets `done` without asking — a writer by declaration whose
   * whole meaning is in its title. A control for the second kind offers the
   * act, not a text box.
   */
  readonly takesValue: boolean;
  /**
   * Other declared writers of the same field, for a control that must offer
   * a choice of acts: `done` is written by "Mark it done" AND "Put it back".
   */
  readonly alternatives: readonly EditableField[];
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
 * Two sources, in order of trust. A mutation that DECLARES what it writes
 * (`writes: ["done"]`) is believed, and only about that — which is how
 * `finish` and `reopen` stop being invisible writers of `done`. One that
 * does not is read by name: an input argument named exactly like one of the
 * kind's fields writes that field — `relabelEntity` takes `label`,
 * `rescheduleTrigger` takes `when` — with no app saying anything per field.
 *
 * The derived edit act (`edit-<kind>`, see `deriveEditMutations` in core)
 * arrives here like any other mutation, declaring the fields it covers, so
 * a field you could set at creation is editable where it is shown.
 *
 * The name heuristic's limit is worth being honest about: an argument called
 * `label` that means something other than the subject's own label would be
 * matched wrongly. Nothing here writes anything on its own — the edit runs
 * the mutation, the mutation decides, the invariants judge — so the cost of
 * a wrong guess is an action offered that does not do what its name
 * suggests, not a corrupted graph. Declaring `writes` removes the guess.
 */
export function editableFields<S extends AnySchema>(
  store: Store<S>,
  nodeId: string,
): readonly EditableField[] {
  const node = store.graph.getNode(nodeId) as Record<string, unknown> | undefined;
  if (!node) return [];
  const kind = node["kind"] as string;
  const definition = store.schema.tryDefinition(kind);
  if (!definition) return [];

  const candidates = new Map<string, EditableField[]>();
  for (const mutation of store.allMutations()) {
    const subject = mutation.subject;
    if (!subject) continue;
    const accepts =
      subject.kinds === "*" || (subject.kinds as readonly string[]).includes(kind);
    if (!accepts) continue;

    const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
    for (const name of fieldsWrittenBy(mutation, definition)) {
      const takesValue = name in shape;
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
                      store.graph.nodesOfKind(refKind).map((other2) => other2.id),
                    ),
              }
            : {}),
          shape: argShape(mutation.input, other),
        });
      }
      const field: EditableField = {
        field: name,
        mutation: mutation.name,
        title: mutation.title ?? mutation.name,
        shape: takesValue ? argShape(mutation.input, name) : { type: "unknown" },
        takesValue,
        alternatives: [],
        open,
        call: (value) => ({
          name: mutation.name,
          args: takesValue
            ? { [subject.arg]: nodeId, [name]: value }
            : { [subject.arg]: nodeId },
        }),
      };
      candidates.set(name, [...(candidates.get(name) ?? []), field]);
    }
  }

  /*
   * One control per field. A writer that takes the value is the natural
   * control and comes first; among equals, declaration order holds, so
   * which mutation edits a field is stable rather than registration luck.
   * The rest ride along as alternatives, for a control that offers acts.
   */
  return [...candidates.values()].map((writers) => {
    const ordered = [...writers.filter((w) => w.takesValue), ...writers.filter((w) => !w.takesValue)];
    const [first, ...rest] = ordered;
    return { ...first!, alternatives: rest };
  });
}

/** Whether an argument may be left out, so it does not count as unanswered. */
function optional(schema: unknown): boolean {
  const type = defOf(schema)?.type;
  return type === "optional" || type === "default" || type === "nullable";
}
