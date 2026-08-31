import type { AnySchema } from "@graview/core";
import { useEditableFields, useNode } from "@graview/react";
import type { EditableField } from "@graview/tools";
import { useEffect, useRef, useState } from "react";

/**
 * One field's value, changeable where it is shown when something can change
 * it — and visibly read-only when nothing can.
 *
 * Read-only is stated rather than implied. A value that simply does not
 * respond to a click is indistinguishable from one that is broken, and "no
 * mutation declares this field" is a real answer — the same honesty the
 * actions strip gives when a kind has no verbs.
 *
 * The edit runs the mutation the framework found. That is not ceremony: the
 * mutation is what puts the change in the op log with an author, what makes
 * it undoable, and what the invariants judge. Writing the graph here would
 * create the one class of change nobody could take back.
 */
export function EditableValue<S extends AnySchema>({
  nodeId,
  field,
  value,
}: {
  readonly nodeId: string;
  readonly field: string;
  readonly value: string;
}) {
  const { fields, commit } = useEditableFields<S>(nodeId);
  const editable = fields.find((candidate) => candidate.field === field);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // The graph can change underneath an open editor — an agent turn, an undo —
  // and the draft must not silently overwrite it on blur.
  useEffect(() => setDraft(value), [value, editing]);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  if (!editable) {
    return (
      <span
        data-graview-field={field}
        data-graview-readonly=""
        // Said, not merely implied: a value that ignores a click looks broken.
        title={`Read-only — no mutation declares "${field}" as something it writes`}
        style={{ color: "var(--graview-ink)", cursor: "default" }}
      >
        {value}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        data-graview-field={field}
        data-graview-editable={editable.mutation}
        title={`${editable.title} — changes "${field}" through a mutation, so it can be undone`}
        onClick={() => setEditing(true)}
        style={{
          all: "unset",
          cursor: "text",
          borderBottom: "1px dashed var(--graview-edge-bright)",
          color: "var(--graview-ink)",
        }}
      >
        {value}
      </button>
    );
  }

  const done = (next: unknown) => {
    setEditing(false);
    if (next === value || next === "" || next === undefined) return;
    commit(editable, next);
  };

  return (
    <form
      style={{ display: "inline-flex", gap: 4 }}
      onSubmit={(event) => {
        event.preventDefault();
        done(coerce(editable, draft));
      }}
    >
      {editable.shape.type === "choice" ? (
        <select
          ref={input as { current: HTMLSelectElement | null }}
          aria-label={field}
          data-graview-field={field}
          value={draft}
          onChange={(event) => done(event.target.value)}
          onBlur={() => setEditing(false)}
          style={{ font: "inherit", fontSize: "inherit" }}
        >
          {editable.shape.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={input as { current: HTMLInputElement | null }}
          aria-label={field}
          data-graview-field={field}
          type={
            editable.shape.type === "number"
              ? "number"
              : editable.shape.type === "date"
                ? "date"
                : "text"
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => done(coerce(editable, draft))}
          onKeyDown={(event) => {
            // Escape abandons the edit. Without it the only way out of a
            // field you opened by accident is to commit it.
            if (event.key === "Escape") setEditing(false);
          }}
          style={{
            font: "inherit",
            fontSize: "inherit",
            width: `${Math.max(6, draft.length + 1)}ch`,
            padding: "0 2px",
          }}
        />
      )}
      {/*
        * An edit needing a second answer is still worth offering, but it
        * cannot be completed here — the strip's own argument walker is where
        * that happens, and there must not be two renderings of an action.
        */}
      {editable.open.length > 0 ? (
        <span style={{ fontSize: 11, color: "var(--graview-ink-faint)" }}>
          also needs {editable.open.map((parameter) => parameter.name).join(", ")}
        </span>
      ) : null}
    </form>
  );
}

/** The typed value the mutation's input asked for, not the string it was typed as. */
function coerce(field: EditableField, draft: string): unknown {
  return field.shape.type === "number" ? Number(draft) : draft;
}

/**
 * A node's own fields, shown as a definition list and editable in place.
 *
 * One component per view rather than per field: an app says "show this
 * node's fields here" and every value that some mutation writes becomes
 * changeable, without the app knowing which mutation or naming a single
 * field. A kind that gains a mutation gains editable fields the same day.
 */
export function Fields<S extends AnySchema>({
  id,
  hide = [],
  limit = 8,
}: {
  readonly id: string;
  /** Fields already shown elsewhere in the view — a title, a subtitle. */
  readonly hide?: readonly string[];
  readonly limit?: number;
}) {
  const node = useNode<S>(id) as (Record<string, unknown> & { id: string }) | undefined;
  if (!node) return null;
  const skip = new Set(["id", "kind", ...hide]);
  const shown: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (skip.has(key) || value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) continue;
    shown.push({ key, value: Array.isArray(value) ? value.join(", ") : String(value) });
    if (shown.length >= limit) break;
  }
  if (shown.length === 0) return null;

  return (
    <dl
      data-graview-fields={node.id}
      style={{
        margin: 0,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "4px 14px",
        fontSize: 13,
        alignContent: "start",
      }}
    >
      {shown.map((field) => (
        <div key={field.key} style={{ display: "contents" }}>
          <dt style={{ color: "var(--graview-ink-faint)" }}>{field.key}</dt>
          <dd style={{ margin: 0, minWidth: 0 }}>
            <EditableValue<S> nodeId={node.id} field={field.key} value={field.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
