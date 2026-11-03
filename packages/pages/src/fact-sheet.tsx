import { defOf, type AnySchema, type ReadableField } from "@graview/core";
import { pageSections, failureWords } from "@graview/core/words";
import { linkProvenance } from "@graview/core/provenance";
import { lazy, Suspense, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { RecordFacts } from "./facts.js";
import type { RelationFact } from "./fact-sheet-model.js";
import type { PageContext } from "./page-context.js";
import { ProvisionalMark } from "./page-provisional.js";
import { KindMark, h2, link, Onward, onward, pluralOf, quiet } from "./page-typography.js";
import { RecordField } from "./record-field.js";
import { pluralSlug, recordPath } from "./registry.js";

/*
 * THE FACTS AS A SHEET (Roadmap f-facts-by-type).
 *
 * Labels in a column on the left, each value or its control on the right —
 * a switch for a yes or no, a day with its weekday and how far off it is, a
 * choice's options, a relation's records as chips that open them — and on
 * a phone each label over its value. Nothing boxed but a chip; spacing
 * where there were borders. Every change is still the act the framework
 * found, so it is judged, kept in the history, and can be taken back.
 */

const RelationPicker = lazy(() => import("./relation-picker.js"));

export interface FactSheetProps<S extends AnySchema> {
  readonly context: PageContext<S>;
  readonly id: string;
  readonly facts: RecordFacts;
  /** The facts drawn: the record's, less what a view above already said. */
  readonly fields: readonly ReadableField[];
  /** The relations drawn as rows (`relationFacts`). */
  readonly relations: readonly RelationFact[];
  /** Whether values are changed where they stand (a face handed the store its edits run through). */
  readonly inPlace: boolean;
  /** The sheet's heading; "The facts", in the page's heading style, unless a design says its own. */
  readonly heading?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Rows drawn after the facts and before the relations: a file field still to be filled. */
  readonly children?: ReactNode;
}

export function FactSheet<S extends AnySchema>({ context, id, facts, fields, relations, inPlace, heading, className, style, children }: FactSheetProps<S>) {
  const { store } = context;
  const node = store.graph.getNode(id) as Record<string, unknown> | undefined;
  const definition = store.schema.tryDefinition(facts.kind);
  const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  /*
   * LATE IS A RULE'S WORD, NOT THE CALENDAR'S: a date is drawn in the
   * warning color where a problem with this record asks for that field
   * again ("Give it a new date"), never merely for being past.
   */
  const late = new Set(
    facts.violations.flatMap((violation) =>
      violation.repairs.filter((repair) => Object.values(repair.args ?? {}).includes(id)).flatMap((repair) => repair.missing ?? []),
    ),
  );
  if (fields.length === 0 && relations.length === 0 && !children) return null;
  return (
    <section data-testid="record-fields" data-graview-fact-sheet="" className={className} style={{ display: "grid", gap: 16, minWidth: 0, ...style }}>
      <style>{SHEET_CSS}</style>
      {heading ?? <h2 style={h2}>The facts</h2>}
      {/*
        * IN THE SECTIONS THE KIND'S PAGE DECLARES (FR-148) — its first
        * fields, each group under its title, the rest under "Details" — or,
        * unsaid, in declared order.
        */}
      {pageSections(definition, fields).map((section, index) => (
        <div key={index} style={{ display: "grid", gap: 8, minWidth: 0 }}>
          {section.title ? (
            <h3 data-graview-field-group={section.title} style={GROUP}>
              {section.title}
            </h3>
          ) : null}
          <dl data-graview-sheet="">
            {section.fields.map((field) => (
              <RecordField<S>
                key={field.key}
                nodeId={id}
                node={node}
                field={field}
                inPlace={inPlace}
                labelStyle={LABEL}
                late={late.has(field.key)}
                required={field.blank === true && isRequired(shape[field.key])}
              />
            ))}
          </dl>
        </div>
      ))}
      {children ? <dl data-graview-sheet="">{children}</dl> : null}
      {relations.length > 0 ? (
        <dl data-graview-sheet="" data-graview-relations="">
          {relations.map((relation) => (
            <RelationRow key={relation.key} context={context} id={id} relation={relation} inPlace={inPlace} />
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/** Whether a declared field must hold a value: not optional, nullable or defaulted. */
function isRequired(schema: unknown): boolean {
  const type = (defOf(schema) as { type?: string } | undefined)?.type;
  return type !== undefined && type !== "optional" && type !== "nullable" && type !== "default";
}

/**
 * ONE RELATION, AS A ROW: its records as chips, each opening its record;
 * one held alone changed from its chip ("Someday ▾"), several added to and
 * removed from — each through the act the declaration says makes or breaks
 * the tie, run with the record picked.
 */
function RelationRow<S extends AnySchema>({ context, id, relation, inPlace }: { context: PageContext<S>; id: string; relation: RelationFact; inPlace: boolean }) {
  const { store, brand, principal } = context;
  const [picking, setPicking] = useState(false);
  const [refused, setRefused] = useState<string | undefined>(undefined);
  const row = useRef<HTMLDivElement | null>(null);
  const set = inPlace ? relation.set : undefined;
  const remove = inPlace ? relation.remove : undefined;
  /** Where the keyboard goes once the row has changed: the press that changes it again, else its first record. */
  const settle = () =>
    requestAnimationFrame(() => {
      const here = row.current;
      (here?.querySelector<HTMLElement>("[data-graview-relation-set]") ?? here?.querySelector<HTMLElement>("a, button"))?.focus();
    });
  const run = (call: { name: string; args: Record<string, unknown> }) => {
    try {
      store.apply(call, principal ? { author: principal } : {});
      setRefused(undefined);
    } catch (error) {
      setRefused(failureWords(store.schema, store.allMutations(), error));
    }
  };
  const empty = relation.targets.length === 0;
  const opener = (text: string, aria: string) => (
    <button
      type="button"
      data-graview-relation-set={set!.affordance.mutation}
      aria-label={aria}
      aria-expanded={picking}
      title={`${set!.affordance.label} — an act, so it is in the history and can be taken back`}
      onClick={() => {
        setRefused(undefined);
        setPicking(!picking);
      }}
      style={ADD}
    >
      {text}
    </button>
  );
  return (
    <div ref={row} data-graview-relation={relation.edgeKind} data-graview-direction={relation.direction} {...(relation.one ? { "data-graview-one": "" } : {})}>
      <dt style={LABEL}>{relation.label}</dt>
      <dd style={{ margin: 0, minWidth: 0 }}>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {relation.targets.map((target) => {
            // A link made less than sure and not yet kept by a person is marked as such (FR-172).
            const provenance = linkProvenance(store, relation.direction === "in" ? { kind: relation.edgeKind, from: target.id, to: id } : { kind: relation.edgeKind, from: id, to: target.id });
            return (
              <span key={target.id} data-graview-chip={target.id} style={CHIP}>
                <KindMark kind={target.kind} {...(brand ? { brand } : {})} schema={store.schema} size={6} />
                <Link to={recordPath(store.schema, target.kind, target.id)} style={CHIP_LINK}>
                  {target.label}
                  {target.apart ? <span style={{ color: "var(--graview-ink-muted)" }}> · {target.apart}</span> : null}
                </Link>
                {provenance?.provisional ? <ProvisionalMark store={store} link={provenance} {...(principal ? { principal } : {})} /> : null}
                {/* One held alone is changed from its chip. */}
                {relation.one && set ? (
                  <button
                    type="button"
                    data-graview-relation-set={set.affordance.mutation}
                    aria-label={set.affordance.label}
                    aria-expanded={picking}
                    title={`${set.affordance.label} — an act, so it is in the history and can be taken back`}
                    onClick={() => {
                      setRefused(undefined);
                      setPicking(!picking);
                    }}
                    style={CARET}
                  >
                    <span aria-hidden="true">▾</span>
                  </button>
                ) : null}
                {/* One of several is taken off by the act that unties it, named for it. */}
                {!relation.one && remove ? (
                  <button
                    type="button"
                    data-graview-relation-remove={remove.affordance.mutation}
                    aria-label={`${remove.affordance.label}: ${target.label}`}
                    title={`${remove.affordance.label} — an act, so it is in the history and can be taken back`}
                    onClick={() => {
                      run({ name: remove.affordance.mutation, args: { ...remove.affordance.args, [remove.arg]: target.id } });
                      settle();
                    }}
                    style={CARET}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                ) : null}
              </span>
            );
          })}
          {/* None yet, or room for another: the way to add one, quiet beside what is there. */}
          {set && (empty || !relation.one) ? opener(empty ? (relation.one ? "Choose…" : "Add one") : "Add", empty ? `${set.affordance.label}: ${relation.one ? "choose" : "add one"}` : `${set.affordance.label}: add`) : null}
          {empty && !set ? <span style={{ color: "var(--graview-ink-faint)" }}>None</span> : null}
          {refused ? (
            <span role="status" data-graview-refused={relation.edgeKind} style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
              {refused}
            </span>
          ) : null}
        </span>
        {picking && set ? (
          <Suspense fallback={null}>
            <RelationPicker
              store={store}
              label={set.affordance.label}
              candidates={set.candidates}
              tied={relation.targets.map((target) => target.id)}
              onPick={(picked) => {
                setPicking(false);
                run({ name: set.affordance.mutation, args: { ...set.affordance.args, [set.arg]: picked } });
                settle();
              }}
              onClose={() => {
                setPicking(false);
                settle();
              }}
            />
          </Suspense>
        ) : null}
        {/* THE OTHER WAY ROUND: the far kind's list, narrowed to this record — not for a relation that holds one. */}
        {!relation.one && relation.targets.length > 0
          ? [...new Set(relation.targets.map((target) => target.kind))].map((farKind) => (
              <Link
                key={farKind}
                to={`/${pluralSlug(store.schema, farKind)}?${encodeURIComponent(relation.edgeKind)}=${encodeURIComponent(id)}`}
                style={{ ...onward, ...quiet, display: "inline-flex", marginTop: 4 }}
                data-testid="related-all"
              >
                <Onward>
                  Sort and filter {relation.description ?? `these ${pluralOf(store, farKind).toLowerCase()}`}
                  {relation.targets.some((target) => target.kind !== farKind) ? ` (${pluralOf(store, farKind).toLowerCase()})` : ""}
                </Onward>
              </Link>
            ))
          : null}
      </dd>
    </div>
  );
}

/* A label: quieter than its value, sentence case, in the left column. */
export const LABEL: CSSProperties = { margin: 0, color: "var(--graview-ink-muted)", fontSize: "var(--graview-text-small)", lineHeight: 1.5, paddingTop: 2 };
const GROUP: CSSProperties = { margin: 0, fontSize: "var(--graview-text-small)", color: "var(--graview-ink)", fontWeight: "var(--graview-weight-label)" as never };
const CHIP: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", minHeight: 28, padding: "0 4px 0 10px", borderRadius: 999, background: "var(--graview-panel)", color: "var(--graview-ink)" };
const CHIP_LINK: CSSProperties = { ...link, color: "var(--graview-ink)", textDecoration: "none", overflowWrap: "anywhere", minHeight: 24, display: "inline-flex", alignItems: "center", paddingRight: 6 };
const CARET: CSSProperties = { all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, minHeight: 24, borderRadius: 999, color: "var(--graview-ink-muted)" };
const ADD: CSSProperties = { all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", minHeight: 28, padding: 0, color: "var(--graview-ink-muted)", borderBottom: "1px dashed var(--graview-edge-bright)" };
/* "Notify me when this changes": a quiet press beside "In the scene", not a second button under the name. */
export const QUIET_PRESS: CSSProperties = { font: "inherit", fontSize: "inherit", color: "inherit", background: "none", border: 0, padding: 0, minHeight: 24, cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--graview-edge-bright)", textUnderlineOffset: "0.2em" };
/* One act under "What can be done": its words, a target as tall as a line, no box — the list is quiet and the facts above it are the page. */
export const ACT: CSSProperties = { font: "inherit", fontSize: "var(--graview-text-body)", color: "var(--graview-ink)", background: "none", border: 0, borderRadius: "var(--graview-radius-sm, 8px)", padding: "4px 0", minHeight: 32, cursor: "pointer", textAlign: "start", textDecoration: "underline", textDecorationColor: "var(--graview-edge)", textUnderlineOffset: "0.25em" };

/*
 * The sheet's columns: one label column every section shares, so the
 * labels line up down the page; each row's label and value sit on the same
 * line (a subgrid of the sheet), prose and files the value column's width.
 * A phone stacks each label over its value.
 */
const SHEET_CSS = `[data-graview-sheet]{margin:0;display:grid;grid-template-columns:minmax(0,10rem) minmax(0,1fr);column-gap:28px;row-gap:12px;align-items:baseline;min-width:0}
[data-graview-sheet]>*{display:grid!important;grid-column:1/-1!important;grid-template-columns:subgrid;column-gap:28px!important;row-gap:4px!important;align-items:baseline;min-width:0}
[data-graview-sheet]>*>dt{grid-column:1}[data-graview-sheet]>*>dd{grid-column:2;margin:0}
[data-graview-chip] a:hover{text-decoration:underline}[data-graview-chip] button:hover,[data-graview-relation-set]:hover{color:var(--graview-ink)}
@media (max-width:560px){[data-graview-sheet]{grid-template-columns:minmax(0,1fr)}[data-graview-sheet]>*>dt,[data-graview-sheet]>*>dd{grid-column:1}}`;
