import type { AnySchema } from "@graview/core";
import { editableFields, type EditableField } from "@graview/tools/edit";
import { useCallback, useMemo } from "react";
import { useGraph, useGraview } from "./context.js";

/**
 * The fields of a node that can be changed where they are shown, and the way
 * to change one.
 *
 * `commit` runs the mutation the framework found, with the author set to a
 * person — so an in-place edit lands in the op log, can be undone, and is
 * judged by the invariants exactly like an edit made from the actions strip.
 * There is no second write path.
 */
export function useEditableFields<S extends AnySchema>(
  id: string | null,
): {
  readonly fields: readonly EditableField[];
  commit: (field: EditableField, value: unknown, rest?: Record<string, unknown>) => void;
} {
  const { store, principal } = useGraview<S>();
  const nodes = useGraph<S>();
  const fields = useMemo(
    () => (id === null ? [] : editableFields(store, id)),
    [store, id, nodes],
  );
  const commit = useCallback(
    (field: EditableField, value: unknown, rest: Record<string, unknown> = {}) => {
      const call = field.call(value);
      store.apply(
        { name: call.name, args: { ...call.args, ...rest } },
        { author: principal },
      );
    },
    [store, principal],
  );
  return { fields, commit };
}
