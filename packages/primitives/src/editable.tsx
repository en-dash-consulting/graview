import { fieldWords, humanizeField as humanize, pageSections, readableFields, type AnySchema } from "@graview/core";
import { useEditableFields } from "@graview/react/drawing";
import { useGraview, useGraviewIfAny, useNode } from "@graview/react/provider";
import type { EditableField } from "@graview/tools";
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { TextBody } from "./text-body.js";

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
  // The field as the declaration says it: a tooltip read "changes "plannedAt"".
  const { store } = useGraview<S>();
  const kind = store.graph.getNode(nodeId)?.kind as string | undefined;
  const words = fieldWords(store.schema.definitions.find((definition) => definition.kind === kind), field).toLowerCase();
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
        title={`Read-only — nothing this app declares changes the ${words}`}
        // An address, a VIN, a URL has nowhere to break: it breaks anywhere rather than run into the next column.
        style={{ color: "var(--graview-ink)", cursor: "default", overflowWrap: "anywhere" }}
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
        title={`${editable.title} — changes the ${words}, and can be undone`}
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
          /*
           * NEVER WIDER THAN ITS CELL. A value with nowhere to break — an
           * email address, a VIN, a URL — made the button as wide as the
           * word and ran it under the next column of the card: a staff
           * member's address sat beneath the chips of her appointments.
           */
          maxWidth: "100%",
          overflowWrap: "anywhere",
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
        aria-label={`Change ${humanize(field).toLowerCase()}`}
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
            style={{ padding: "2px 9px", fontSize: "0.8125rem", borderRadius: 999 }}
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
          aria-label={humanize(field)}
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
          aria-label={humanize(field)}
          data-graview-field={field}
          type={
            editable.shape.type === "number"
              ? "number"
              : editable.shape.type === "date"
                ? editable.shape.time
                  ? "datetime-local"
                  : "date"
                : "text"
          }
          // The field's range, as every form asks for it (FR-114).
          {...(editable.shape.type === "number" && editable.shape.min !== undefined ? { min: editable.shape.min } : {})}
          {...(editable.shape.type === "number" && editable.shape.max !== undefined ? { max: editable.shape.max } : {})}
          {...(editable.shape.type === "number" && editable.shape.step !== undefined ? { step: editable.shape.step } : {})}
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
        <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
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
export { humanize };

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
  /** Overrides for the humanized default, by field name. */
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

  /*
   * IN THE SECTIONS THE KIND'S PAGE DECLARES (FR-148): its first fields,
   * then each group under its title, the rest under "Details" — or, unsaid,
   * one run in declared order. Each section is its own list, so its labels
   * line up with each other and not with a group's below.
   */
  return (
    <div data-graview-fields={node.id} style={{ display: "grid", gap: 14, alignContent: "start", minWidth: 0, fontSize: "0.875rem" }}>
      {pageSections(definition, rows).map((section, index) => {
        const list = (
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 16px", alignContent: "start", minWidth: 0 }}>
            {section.fields.map((field) =>
              field.long ? (
                <LongValue<S> key={field.key} nodeId={node.id} field={field.key} label={labels[field.key] ?? field.label} value={field.value} labelStyle={LABEL} style={{ gridColumn: "1 / -1", marginTop: 6 }} />
              ) : (
                <div key={field.key} style={{ display: "contents" }}>
                  <dt style={{ ...LABEL, whiteSpace: "nowrap" }}>{labels[field.key] ?? field.label}</dt>
                  <dd style={{ margin: 0, minWidth: 0 }}>
                    <EditableValue<S> nodeId={node.id} field={field.key} value={field.value} />
                  </dd>
                </div>
              ),
            )}
          </dl>
        );
        if (!section.title) return <div key={index}>{list}</div>;
        const titleId = `graview-field-group-${node.id}-${index}`;
        return (
          <div key={index} role="group" aria-labelledby={titleId} style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <p id={titleId} data-graview-field-group={section.title} style={GROUP_TITLE}>
              {section.title}
            </p>
            {list}
          </div>
        );
      })}
    </div>
  );
}

/* A field name is a label, not a heading: it should read as quieter than its value rather than competing with it. */
const LABEL = { color: "var(--graview-ink-faint)", fontSize: "0.8125rem" } as const;
/* A group's title: one step above its labels, a step below the record's heading. */
const GROUP_TITLE = { margin: 0, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--graview-ink-muted)", fontWeight: 560 } as const;

/**
 * A FIELD THAT IS PROSE (FR-146, FR-147): the width of the record with its
 * label above it, its paragraphs and lists kept, and changed in a text area
 * that keeps every line break.
 *
 * A row of the definition list (`<dt>` and `<dd>` in a `<div>`), so it sits
 * among the short facts in their order. A `text` field in a value column a
 * third of the page wide was a tall narrow wall with "Summary" and "Due"
 * crammed above it in the same style; here it reads like what it is.
 *
 * Changing it: the label carries an "Edit" button — the keyboard's way in,
 * named for the field — and a click on the words opens it too. The text
 * area is as tall as what it holds (`field-sizing: content`, measured where
 * an engine lacks it), Enter is a new line, Ctrl or ⌘ with Enter saves, as
 * does leaving it; Escape puts it back. Saving runs the mutation the
 * framework found, like every edit in place.
 *
 * Drawn where no store is provided — a routed face handed no views — it is
 * read, not changed: the same row, without the "Edit".
 */
export function LongValue<S extends AnySchema>(props: LongValueProps) {
  return useGraviewIfAny<S>() ? <EditableProse<S> {...props} /> : <ReadProse {...props} />;
}

interface LongValueProps {
  readonly nodeId: string;
  readonly field: string;
  readonly label: string;
  readonly value: string;
  readonly labelStyle?: CSSProperties;
  readonly valueStyle?: CSSProperties;
  readonly style?: CSSProperties;
}

function ReadProse({ field, label, value, labelStyle, valueStyle, style }: LongValueProps) {
  return (
    <div data-graview-long={field} style={{ display: "grid", gap: 6, minWidth: 0, ...style }}>
      <dt style={labelStyle}>{label}</dt>
      <dd style={{ margin: 0, minWidth: 0, ...valueStyle }}>
        <div data-graview-field={field}>
          <TextBody text={value} />
        </div>
      </dd>
    </div>
  );
}

function EditableProse<S extends AnySchema>({ nodeId, field, label, value, labelStyle, valueStyle, style }: LongValueProps) {
  const { fields, commit } = useEditableFields<S>(nodeId);
  const editable = fields.find((candidate) => candidate.field === field && candidate.takesValue);
  const [editing, setEditing] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const comeBack = useRef(false);
  useEffect(() => {
    if (!editing && comeBack.current) {
      comeBack.current = false;
      opener.current?.focus();
    }
  }, [editing]);
  const close = (keepTheKeyboard: boolean) => {
    comeBack.current = keepTheKeyboard;
    setEditing(false);
  };
  const words = label.toLowerCase();
  const drawn = <TextBody text={value} />;

  return (
    <div data-graview-long={field} style={{ display: "grid", gap: 6, minWidth: 0, ...style }}>
      <dt style={{ display: "flex", alignItems: "baseline", gap: 10, ...labelStyle }}>
        <span>{label}</span>
        {editable && !editing ? (
          <button
            ref={opener}
            type="button"
            data-graview-editable={editable.mutation}
            aria-label={`Edit the ${words}`}
            title={`${editable.title} — changes the ${words}, and can be undone`}
            onClick={() => setEditing(true)}
            style={EDIT_BUTTON}
          >
            Edit
          </button>
        ) : null}
      </dt>
      <dd style={{ margin: 0, minWidth: 0, ...valueStyle }}>
        {editing && editable ? (
          <Suspense fallback={drawn}>
            <ProseEditor
              field={field}
              label={label}
              value={value}
              onCancel={() => close(true)}
              onSave={(draft, left) => {
                close(!left);
                if (draft !== value) commit(editable, draft);
              }}
            />
          </Suspense>
        ) : (
          <div
            data-graview-field={field}
            {...(editable ? {} : { "data-graview-readonly": "", title: `Read-only — nothing this app declares changes the ${words}` })}
            // The words open it too, for a pointer; the keyboard's way in is the button by the label.
            {...(editable ? { onClick: () => setEditing(true) } : {})}
            style={{ cursor: editable ? "text" : "default", minWidth: 0 }}
          >
            {drawn}
          </div>
        )}
      </dd>
    </div>
  );
}

/* The text area, fetched the first time somebody opens one (FR-57's way: a page's first load carries what it draws). */
const ProseEditor = lazy(() => import("./prose-editor.js"));

const EDIT_BUTTON: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  fontSize: "0.75rem",
  letterSpacing: "normal",
  textTransform: "none",
  color: "var(--graview-accent)",
  borderBottom: "1px dashed currentColor",
  minHeight: 24,
  minWidth: 24,
  display: "inline-flex",
  alignItems: "flex-end",
};

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
