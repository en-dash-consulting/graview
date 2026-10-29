import { fieldWords, humanizeField, nounOf, pluralLabel, type AnySchema, type Place, type Store } from "@graview/core";
import "@graview/primitives/pages"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).
import type { MenuColumn } from "@graview/react/provider";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * "INSPECT", AT THE FOOT OF THE CONTEXT MENU — what Graview knows about the
 * thing under the cursor. A page cannot open the browser's own developer
 * tools, so Inspect opens this instead: a small sheet saying what the thing
 * is (its kind, by its words and its key), the record and its id, the field,
 * the place and the picture that drew it, the column it stands in, the link
 * to its page — and, for whoever may change the app, how its kind is
 * declared. Keys and ids are written as code: they are named here on
 * purpose, for the person who asked what lies under the words.
 *
 * Fetched the first time somebody asks, so a page nobody inspects carries none of it.
 */

/** What the sheet is opened on: what the menu was. */
export interface Inspected {
  readonly on?: string | undefined;
  readonly kind?: string | undefined;
  readonly field?: string | undefined;
  readonly place?: Place | undefined;
  readonly column?: MenuColumn | undefined;
  /** The absolute address of its page, where it has one. */
  readonly href?: string | undefined;
  /** Whether the reader may change the app itself: the declaration is shown. */
  readonly owner: boolean;
  /** Where the keyboard goes back to. */
  readonly returnTo?: HTMLElement | null | undefined;
}

export interface InspectSheetProps {
  readonly store: Store<AnySchema>;
  readonly inspected: Inspected;
  readonly close: () => void;
}

const QUIET: CSSProperties = { color: "var(--graview-ink-muted)" };
const CODE: CSSProperties = { fontSize: "0.8125rem", padding: "0 4px", borderRadius: 4, background: "var(--graview-sunken, rgba(127,127,127,0.12))", overflowWrap: "anywhere" };

/** A zod field's type, in a word: unwrapped through optional, default and nullable. */
function typeOf(field: unknown): string {
  let at = field as { _zod?: { def?: { type?: string; innerType?: unknown } } } | undefined;
  for (let depth = 0; depth < 6 && at?._zod?.def?.innerType && ["optional", "default", "nullable", "prefault", "readonly"].includes(at._zod.def.type ?? ""); depth++) at = at._zod.def.innerType as typeof at;
  return at?._zod?.def?.type ?? "value";
}

export function InspectSheet({ store, inspected, close }: InspectSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const schema = store.schema;
  const node = inspected.on === undefined ? undefined : store.graph.getNode(inspected.on);
  const kind = node?.kind ?? inspected.kind;
  const definition = kind === undefined ? undefined : schema.tryDefinition(kind);

  useEffect(() => {
    const shown = dialog.current;
    // A document with no modal dialogs (jsdom) shows it open in place.
    if (shown && !shown.open) (typeof shown.showModal === "function" ? shown.showModal() : shown.setAttribute("open", ""));
  }, []);

  /** Gone, and the keyboard back where the menu was opened from — or on the page's title. */
  const done = () => {
    const back = inspected.returnTo;
    close();
    requestAnimationFrame(() => {
      if (back?.isConnected) back.focus();
      else document.querySelector<HTMLElement>("[data-graview-page-title], main h1")?.focus();
    });
  };

  const named = node ? String((node as { label?: unknown }).label ?? nounOf(definition, node.kind)) : inspected.place ? inspected.place.title : kind ? pluralLabel(schema, kind) : "This page";
  const rows: [string, string, ReactNode][] = [];
  if (kind !== undefined) rows.push(["kind", "What it is", <>{humanizeField(nounOf(definition, kind))} <code style={CODE}>{kind}</code></>]);
  if (node) rows.push(["record", "Record", <code style={CODE}>{node.id}</code>]);
  if (inspected.field !== undefined && kind !== undefined) rows.push(["field", "Field", <>{fieldWords(definition, inspected.field)} <code style={CODE}>{inspected.field}</code></>]);
  if (inspected.place) {
    const lens = inspected.place.lens === "view" ? "a view" : inspected.place.lens === "columns" ? "a status board" : inspected.place.lens ? `the ${inspected.place.lens} lens` : "a picture";
    rows.push(["drawn-by", "Drawn by", <>“{inspected.place.title}”, {lens} <code style={CODE}>{inspected.place.name ?? inspected.place.as}</code></>]);
  }
  if (inspected.column) rows.push(["column", "Column", <>{inspected.column.label} <code style={CODE}>{`${inspected.column.field}:${inspected.column.value}`}</code></>]);
  if (inspected.href !== undefined)
    rows.push([
      "link",
      "Link",
      <a href={inspected.href} data-testid="inspect-link">
        <code style={CODE}>{inspected.href}</code>
      </a>,
    ]);
  const shape = (definition as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      data-testid="inspect-sheet"
      onClose={done}
      onClick={(event) => {
        // A press on the dimmed page around the sheet puts it away.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      style={{ width: "min(92vw, 440px)", padding: 0, border: "1px solid var(--graview-edge)", borderRadius: "var(--graview-radius, 12px)", background: "var(--graview-panel)", color: "var(--graview-ink)", boxShadow: "var(--graview-lift-high)" }}
    >
      <div style={{ display: "grid", gap: 12, padding: 18 }}>
        <h2 id={heading} style={{ margin: 0, fontSize: "1.0625rem" }}>
          {named}
        </h2>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", gap: "6px 12px", fontSize: "0.875rem" }}>
          {rows.map(([id, term, said]) => (
            <div key={id} data-inspect={id} style={{ display: "contents" }}>
              <dt style={QUIET}>{term}</dt>
              <dd style={{ margin: 0, minWidth: 0 }}>{said}</dd>
            </div>
          ))}
        </dl>
        {inspected.owner && kind !== undefined && shape ? (
          <section aria-labelledby={`${heading}-declared`} data-inspect="declared" style={{ display: "grid", gap: 6 }}>
            <h3 id={`${heading}-declared`} style={{ margin: 0, fontSize: "0.8125rem", ...QUIET }}>
              How {pluralLabel(schema, kind).toLowerCase()} are declared
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2, fontSize: "0.8125rem" }}>
              {Object.entries(shape).map(([key, field]) => (
                <li key={key}>
                  <code style={CODE}>{key}</code> <span style={QUIET}>{typeOf(field)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" autoFocus onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
