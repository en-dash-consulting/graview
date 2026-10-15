import { LOCAL_LAYERS, linkedValue, safeFileHref, type LinkedRecord, type LinkedRecordAnswer, type LinkedRecordRef, type LinkedRelation, type LinkedViewer } from "@graview/core";
import { useEditableFields } from "@graview/react/drawing";
import { useGraviewIfAny } from "@graview/react/provider";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * A RECORD IN ANOTHER APP, ON A RECORD (FR-171).
 *
 * A relation to another app's kind keeps which record it links; the host's
 * `linkedRecords` says what that record is, as the viewer. Drawn here with
 * its own card — its label, its describe line and a glance at its fields,
 * as its home app words them — and pressing it opens it there: through the
 * host's `open` where it gives one, else its `href`. Where this viewer may
 * not open the far app, "linked record (no access)" and nothing of it. Where
 * an act may change the link, a control beside it picks another record from
 * what the host lists. Fetched with the first one drawn, never in the first
 * paint.
 */

export interface LinkedRecordViewProps {
  readonly relation: LinkedRelation;
  /** The far records the link keeps, in order. */
  readonly refs: readonly LinkedRecordRef[];
  /** `record`: the card — label, describe line, a glance; `chip`: the label alone, on a row or a card. */
  readonly as?: "record" | "chip";
  /** The record and field the link is kept in, where it may be changed in place: the control stands beside the card. */
  readonly nodeId?: string;
  readonly field?: string;
  readonly style?: CSSProperties;
}

const NOBODY: LinkedViewer = { kind: "human" };
const MUTED: CSSProperties = { color: "var(--graview-ink-muted)" };

/** Where a record opens, if a page may follow it: a path on the host or an http(s) address. */
function openable(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) {
    try {
      return new URL(href).href;
    } catch {
      return undefined;
    }
  }
  return safeFileHref(href) ? href : undefined;
}

/** The far record as this viewer is told it: asked once, through the page's reads. */
function useLinkedRecord(ref: LinkedRecordRef): LinkedRecordAnswer | "asking" {
  const context = useGraviewIfAny();
  const reads = context?.linkedReads;
  const [answer, setAnswer] = useState<LinkedRecordAnswer | "asking">(() => (reads ? (reads.answered(ref) ?? "asking") : null));
  useEffect(() => {
    if (!reads) {
      setAnswer(context?.linkedRecords ? "asking" : null);
      return;
    }
    const now = reads.answered(ref);
    setAnswer(now === undefined ? "asking" : now);
    if (now !== undefined) return;
    let live = true;
    void reads.ask(ref).then((found) => live && setAnswer(found));
    return () => {
      live = false;
    };
  }, [reads, context?.linkedRecords, ref.address, ref.kind, ref.id]);
  return answer;
}

function OneLinked({ reference, as }: { readonly reference: LinkedRecordRef; readonly as: "record" | "chip" }): ReactNode {
  const context = useGraviewIfAny();
  const found = useLinkedRecord(reference);
  const base: CSSProperties = { position: "relative", zIndex: LOCAL_LAYERS.raised, overflowWrap: "anywhere", minWidth: 0, maxWidth: "100%" };
  if (found === "asking") {
    return (
      <span data-graview-linked="" data-graview-linked-state="asking" aria-busy="true" style={{ ...MUTED, ...base }}>
        Linked record
      </span>
    );
  }
  if (found && "denied" in found) {
    // Not theirs to open: said, and nothing of the record — not its name, not its fields, not where it is.
    return (
      <span data-graview-linked="" data-graview-linked-state="denied" style={{ ...MUTED, fontStyle: "italic", ...base }}>
        linked record (no access)
      </span>
    );
  }
  if (!found) {
    return (
      <span data-graview-linked="" data-graview-linked-state="missing" style={{ ...MUTED, fontStyle: "italic", ...base }}>
        linked record (not found)
      </span>
    );
  }
  const href = openable(found.href);
  const host = context?.linkedRecords;
  const viewer = context?.principal ?? NOBODY;
  // THE NAVIGATION SEAM: the host opens it in its own app where it says how; else its address is followed.
  const open = host?.open
    ? (event: { preventDefault(): void; metaKey?: boolean; ctrlKey?: boolean }) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        host.open!(reference, viewer);
      }
    : undefined;
  const title = (
    <a
      data-graview-linked-title=""
      {...(href ? { href } : { role: "link", tabIndex: 0 })}
      {...(open ? { onClick: open, onKeyDown: (event: { key: string; preventDefault(): void }) => (!href && (event.key === "Enter" || event.key === " ") ? open(event) : undefined) } : {})}
      style={{ fontWeight: 600, color: "inherit", textUnderlineOffset: 3, cursor: href || open ? "pointer" : "default" }}
    >
      {found.label}
    </a>
  );
  if (as === "chip") {
    return (
      <span data-graview-linked="" data-graview-linked-state="found" title={found.describe} style={{ display: "inline-flex", alignItems: "center", minHeight: 24, ...base }}>
        {title}
      </span>
    );
  }
  return <LinkedCard record={found} title={title} base={base} />;
}

function LinkedCard({ record, title, base }: { readonly record: LinkedRecord; readonly title: ReactNode; readonly base: CSSProperties }): ReactNode {
  return (
    <span
      data-graview-linked=""
      data-graview-linked-state="found"
      style={{ display: "grid", gap: 2, padding: "8px 10px", border: "1px solid var(--graview-line)", borderRadius: "var(--graview-radius-sm, 6px)", background: "var(--graview-surface)", ...base }}
    >
      <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 8px" }}>
        {title}
        {record.app ? (
          <span data-graview-linked-app="" style={{ ...MUTED, fontSize: "0.75rem" }}>
            in {record.app}
          </span>
        ) : null}
      </span>
      {record.describe ? (
        <span data-graview-linked-describe="" style={{ ...MUTED, fontSize: "0.8125rem" }}>
          {record.describe}
        </span>
      ) : null}
      {record.card && record.card.length > 0 ? (
        <span data-graview-linked-card="" style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: "0.8125rem" }}>
          {record.card.map((line) => (
            <span key={line.label}>
              <span style={MUTED}>{line.label}</span> {line.text}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function LinkedRecordView({ relation, refs, as = "record", nodeId, field, style }: LinkedRecordViewProps): ReactNode {
  const drawn = (
    <span data-graview-linked-list="" style={{ display: "grid", gap: 6, minWidth: 0, ...style }}>
      {refs.map((ref) => (
        <OneLinked key={linkedValue(ref)} reference={ref} as={as} />
      ))}
    </span>
  );
  return nodeId && field ? <InPlace nodeId={nodeId} field={field} relation={relation} refs={refs} drawn={drawn} /> : drawn;
}

/** The linked record, and beside it the control that picks another — where an act may write the link. */
function InPlace({ nodeId, field, relation, refs, drawn }: { readonly nodeId: string; readonly field: string; readonly relation: LinkedRelation; readonly refs: readonly LinkedRecordRef[]; readonly drawn: ReactNode }) {
  const { fields, commit } = useEditableFields(nodeId);
  const writable = fields.find((one) => one.field === field);
  const [picking, setPicking] = useState(false);
  if (!writable) return drawn;
  const kept = relation.cardinality === "one" ? (refs[0] ? linkedValue(refs[0]) : undefined) : refs.map(linkedValue);
  return (
    <span style={{ display: "grid", gap: 6, minWidth: 0 }}>
      {drawn}
      {picking ? (
        <LinkedPicker
          relation={relation}
          value={kept}
          label="Link another record"
          onChange={(next) => {
            commit(writable, next);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <button type="button" data-graview-linked-change="" onClick={() => setPicking(true)} style={{ justifySelf: "start", font: "inherit", fontSize: "0.8125rem", background: "none", border: 0, padding: "4px 0", color: "var(--graview-accent)", cursor: "pointer", minHeight: 24 }}>
          Change
        </button>
      )}
    </span>
  );
}

export interface LinkedPickerProps {
  readonly relation: LinkedRelation;
  /** What the link keeps now: `kind:id`, or a list of them. */
  readonly value: unknown;
  readonly onChange: (next: string | readonly string[]) => void;
  readonly onCancel?: () => void;
  /** What the picker asks for, said: "House". */
  readonly label: string;
}

/**
 * PICKING A RECORD IN ANOTHER APP (FR-171): what the host's `find` lists for
 * this viewer, narrowed as they type, each by its label and describe line.
 * A viewer who may not open the app is told so, and offered nothing.
 */
export function LinkedPicker({ relation, value, onChange, onCancel, label }: LinkedPickerProps): ReactNode {
  const context = useGraviewIfAny();
  const host = context?.linkedRecords;
  const viewer = context?.principal ?? NOBODY;
  const id = useId();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<readonly LinkedRecord[] | "denied" | "asking">("asking");
  useEffect(() => {
    if (!host) return;
    let live = true;
    setFound("asking");
    const soon = setTimeout(() => {
      void Promise.resolve()
        .then(() => host.find({ address: relation.address, kinds: relation.kinds, query, limit: 20 }, viewer))
        .then(
          (answer) => live && setFound(Array.isArray(answer) ? answer : "denied"),
          () => live && setFound([]),
        );
    }, 150);
    return () => {
      live = false;
      clearTimeout(soon);
    };
  }, [host, relation.address, relation.kinds.join(","), query, viewer.kind, viewer.id]);
  const kept = new Set([value].flat().filter((one): one is string => typeof one === "string"));
  const pick = (record: LinkedRecord) => {
    const chosen = linkedValue(record);
    if (relation.cardinality === "one") return onChange(chosen);
    onChange(kept.has(chosen) ? [...kept].filter((one) => one !== chosen) : [...kept, chosen]);
  };
  if (!host) {
    return (
      <span data-graview-linked-picker="" data-graview-linked-state="no-host" style={MUTED}>
        This page cannot read {relation.address}, so nothing there can be linked here.
      </span>
    );
  }
  return (
    <span data-graview-linked-picker="" style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <label htmlFor={id} style={{ ...MUTED, fontSize: "0.8125rem" }}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        placeholder={`Find one in ${relation.address}`}
        onChange={(event) => setQuery(event.target.value)}
        style={{ font: "inherit", minHeight: 32, padding: "4px 8px", border: "1px solid var(--graview-line)", borderRadius: 6, background: "var(--graview-surface)", color: "inherit", minWidth: 0 }}
      />
      {found === "asking" ? (
        <span aria-busy="true" style={MUTED}>
          Looking…
        </span>
      ) : found === "denied" ? (
        <span data-graview-linked-state="denied" style={{ ...MUTED, fontStyle: "italic" }}>
          linked record (no access)
        </span>
      ) : found.length === 0 ? (
        <span style={MUTED}>Nothing there matches.</span>
      ) : (
        <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {found.map((record) => {
            const chosen = kept.has(linkedValue(record));
            return (
              <li key={linkedValue(record)}>
                <button
                  type="button"
                  data-graview-linked-candidate={linkedValue(record)}
                  aria-pressed={chosen}
                  onClick={() => pick(record)}
                  style={{ display: "grid", gap: 2, width: "100%", textAlign: "start", font: "inherit", padding: "6px 8px", minHeight: 32, border: "1px solid var(--graview-line)", borderRadius: 6, background: chosen ? "var(--graview-accent-soft, var(--graview-surface))" : "var(--graview-surface)", color: "inherit", cursor: "pointer" }}
                >
                  <span style={{ fontWeight: 600 }}>{record.label}</span>
                  {record.describe ? <span style={{ ...MUTED, fontSize: "0.8125rem" }}>{record.describe}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {onCancel ? (
        <button type="button" onClick={onCancel} style={{ justifySelf: "start", font: "inherit", fontSize: "0.8125rem", background: "none", border: 0, padding: "4px 0", color: "var(--graview-ink-muted)", cursor: "pointer", minHeight: 24 }}>
          Keep it as it is
        </button>
      ) : null}
    </span>
  );
}

/** The parts the door draws. */
export const drawLinkedRecord = (props: LinkedRecordViewProps): ReactNode => <LinkedRecordView {...props} />;
export const drawLinkedPicker = (props: LinkedPickerProps): ReactNode => <LinkedPicker {...props} />;
