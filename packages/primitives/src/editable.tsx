import { humaniseField as humanise, readableFields, type AnySchema } from "@graview/core";
import { useEditableFields, useGraview, useNode } from "@graview/react";
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
  const input = useRef<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null>(null);
  /*
   * THE VALUE IS THE CONTROL, AND THE KEYBOARD COMES BACK TO IT.
   *
   * The editor is a field mounted in place of the value; committing or
   * abandoning it unmounts the field, and a removed element takes focus to
   * <body> with it — so a rename made from the keyboard ended six tabs from
   * where it started, or on whatever ELSE was waiting for a stray focus
   * (the actions pane reclaimed it once). The value's own button is the
   * honest home, so it is remembered across the edit and focused again —
   * but only when the editor still held the keyboard as it closed. A blur
   * is somebody leaving on purpose, and is never undone.
   */
  const opener = useRef<HTMLButtonElement | null>(null);
  const comeBack = useRef(false);
  const close = (keepTheKeyboard: boolean) => {
    comeBack.current = keepTheKeyboard;
    setEditing(false);
  };

  // The graph can change underneath an open editor — an agent turn, an undo —
  // and the draft must not silently overwrite it on blur.
  useEffect(() => setDraft(value), [value, editing]);
  useEffect(() => {
    if (editing) input.current?.focus();
    else if (comeBack.current) {
      comeBack.current = false;
      opener.current?.focus();
    }
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
        ref={opener}
        type="button"
        data-graview-field={field}
        data-graview-editable={editable.mutation}
        title={`${editable.title} — changes "${field}" through a mutation, so it can be undone`}
        onClick={() => setEditing(true)}
        style={{
          all: "unset",
          cursor: "text",
          /*
           * Editing in place means the VALUE is the control, so the value has
           * to be one. A dashed underline under a line of 13px text is a
           * 21-pixel target — under every guideline there is, and the sort of
           * thing you notice by missing it twice.
           */
          display: "inline-flex",
          alignItems: "flex-end",
          minHeight: 24,
          // And at least as wide: a two-letter value ("No") that became a
          // control when its field gained a writer is still a target.
          minWidth: 24,
          paddingBottom: 1,
          borderBottom: "1px dashed var(--graview-edge-bright)",
          color: "var(--graview-ink)",
        }}
      >
        {value}
      </button>
    );
  }

  /** Commit the draft. `left` says the person already moved the keyboard elsewhere. */
  const done = (next: unknown, { left = false } = {}) => {
    close(!left);
    if (next === value || next === "" || next === undefined) return;
    commit(editable, next);
  };

  /*
   * A WRITER THAT TAKES NO VALUE is an act, not a box. `done` is written by
   * "Mark it done" and "Put it back", neither of which asks anything — so
   * the value opens onto the acts that would change it, by their own
   * titles, and choosing one runs it. Escape or a click away leaves it.
   */
  if (!editable.takesValue) {
    const acts = [editable, ...editable.alternatives];
    return (
      <span
        role="group"
        aria-label={`Change ${humanise(field).toLowerCase()}`}
        data-graview-field={field}
        style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
        onKeyDown={(event) => {
          if (event.key === "Escape") close(true);
        }}
      >
        {acts.map((act, index) => (
          <button
            key={act.mutation}
            type="button"
            ref={index === 0 ? (input as { current: HTMLButtonElement | null }) : undefined}
            data-graview-act={act.mutation}
            onClick={() => {
              close(true);
              commit(act, undefined);
            }}
            onBlur={(event) => {
              // Leaving the group, not moving within it, closes it.
              const next = event.relatedTarget as Node | null;
              if (!next || !event.currentTarget.parentElement?.contains(next)) close(false);
            }}
            style={{ padding: "2px 9px", fontSize: "0.75rem", borderRadius: 999 }}
          >
            {act.title}
          </button>
        ))}
      </span>
    );
  }

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
          aria-label={humanise(field)}
          data-graview-field={field}
          value={draft}
          onChange={(event) => done(event.target.value)}
          onBlur={() => close(false)}
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
          aria-label={humanise(field)}
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
          onBlur={() => done(coerce(editable, draft), { left: true })}
          onKeyDown={(event) => {
            // Escape abandons the edit. Without it the only way out of a
            // field you opened by accident is to commit it.
            if (event.key === "Escape") close(true);
          }}
          style={{
            font: "inherit",
            fontSize: "inherit",
            width: `${Math.max(6, draft.length + 1)}ch`,
            // Editing in place means the value IS the control, so it has to
            // be one: a 21-pixel target is not.
            minHeight: 24,
            display: "inline-flex",
            alignItems: "center",
            padding: "0 3px",
          }}
        />
      )}
      {/*
        * An edit needing a second answer is still worth offering, but it
        * cannot be completed here — the strip's own argument walker is where
        * that happens, and there must not be two renderings of an action.
        */}
      {editable.open.length > 0 ? (
        <span style={{ fontSize: "0.6875rem", color: "var(--graview-ink-faint)" }}>
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
 * A field name, in words. Re-exported from the framework so a view that wants
 * only this does not have to reach past the primitive that uses it.
 */
export { humanise };

/**
 * A node's own fields, shown as a definition list and editable in place.
 *
 * One component per view rather than per field: an app says "show this node's
 * fields here" and every value that some mutation writes becomes changeable,
 * without the app knowing which mutation or naming a single field. A kind that
 * gains a mutation gains editable fields the same day.
 *
 * WHICH fields and HOW they read is `readableFields`, in the framework —
 * because the summary card asks exactly the same question, and the two used to
 * answer it separately and diverge.
 */
export function Fields<S extends AnySchema>({
  id,
  hide = [],
  limit = 10,
  labels = {},
  /**
   * What the surrounding view has already put on screen. Values matching any
   * of these are dropped, so a caller says what it drew rather than which
   * fields to suppress.
   */
  shown = [],
}: {
  readonly id: string;
  /** Fields to drop by NAME, where a value comparison would not catch it. */
  readonly hide?: readonly string[];
  readonly limit?: number;
  /** Overrides for the humanised default, by field name. */
  readonly labels?: Readonly<Record<string, string>>;
  readonly shown?: readonly (string | undefined)[];
}) {
  const { store } = useGraview<S>();
  const node = useNode<S>(id) as (Record<string, unknown> & { id: string }) | undefined;
  if (!node) return null;
  const definition = store.schema.tryDefinition(node["kind"] as string);
  const rows = readableFields(node, definition, { limit, said: shown }).filter(
    (field) => !hide.includes(field.key),
  );
  if (rows.length === 0) return null;

  return (
    <dl
      data-graview-fields={node.id}
      style={{
        margin: 0,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "5px 16px",
        fontSize: "0.8125rem",
        alignContent: "start",
      }}
    >
      {rows.map((field) => (
        <div key={field.key} style={{ display: "contents" }}>
          <dt
            style={{
              color: "var(--graview-ink-faint)",
              whiteSpace: "nowrap",
              // A field name is a label, not a heading: it should read as
              // quieter than its value rather than competing with it.
              fontSize: "0.75rem",
            }}
          >
            {labels[field.key] ?? field.label}
          </dt>
          <dd style={{ margin: 0, minWidth: 0 }}>
            <EditableValue<S> nodeId={node.id} field={field.key} value={field.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A heading you can change by clicking it.
 *
 * Dropping a field because the heading already said it is right — a record
 * that lists its own title reads as a debug dump — but it took the rename
 * control with it, because the field the heading came from was usually the
 * only editable one. Two things wanted the same row.
 *
 * So the HEADING becomes the control. That is better than either: the thing
 * you click to rename something is its name, and there is no second copy of
 * it anywhere on the page. Falls back to plain text when nothing writes the
 * field, which is the same honesty `EditableValue` gives a read-only value.
 */
export function EditableTitle<S extends AnySchema>({
  nodeId,
  children,
}: {
  readonly nodeId: string;
  /** What the view decided the heading is. Matched against the node's fields. */
  readonly children: string;
}) {
  const { fields } = useEditableFields<S>(nodeId);
  const node = useNode<S>(nodeId) as (Record<string, unknown> & { id: string }) | undefined;
  if (!node) return <>{children}</>;

  const writable = fields.find((field) => {
    const value = node[field.field];
    return typeof value === "string" && value === children;
  });
  if (!writable) return <>{children}</>;
  return <EditableValue<S> nodeId={nodeId} field={writable.field} value={children} />;
}
