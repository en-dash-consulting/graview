import { search, type AnySchema, type Hit } from "@graview/core";
import { aggregateId, withFocus, withOverview, withQuery, withSelection, withWithin } from "@graview/layout";
import { useFound, useGraview, useKit, useViolations } from "@graview/react";
import { hueFor } from "@graview/render";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { VISUALLY_HIDDEN } from "./primitives/index.js";

/**
 * THE FIND BOX. The graph is the result list.
 *
 * Typing writes `#q=` — an adjustment of the stop, so the address follows
 * each keystroke without piling up history — and every picture lights what
 * the words find and dims the rest, through the emphasis it already reads.
 * The strip under the box names the hits for the keyboard and the screen
 * reader: grouped by kind, each with why it matched, a place as "Go to …",
 * and, under a highlighted record, what can be done about it. Enter travels.
 *
 * `/` or ⌘K reaches it from anywhere; Escape clears the words; Back returns
 * to a search the way it returns to any stop. There is no palette over a
 * greyed-out app: the picture is the answer and the strip is its index.
 */

/** One row of the strip: a hit, and the id the listbox knows it by. */
interface Row {
  readonly id: string;
  readonly hit: Hit;
}

/** The kind a hit belongs with in the strip; rules have a group of their own. */
const groupOf = (hit: Hit): string => (hit.about === "rule" ? "rule:" : hit.about === "act" ? "act:" : hit.kind);

export function FindBox<S extends AnySchema>({ compact = false }: { readonly compact?: boolean }) {
  const { store, view, setView, principal, hiddenKinds, setMenuAt, brand } = useGraview<S>();
  const found = useFound();
  const violations = useViolations<S>();
  const flag = useKit().marks.flag;
  const input = useRef<HTMLInputElement>(null);
  const strip = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  // The record whose acts are shown: the one highlighted, kept while the keys move into its acts.
  const [anchor, setAnchor] = useState<string | null>(null);
  const q = view.q ?? "";

  /*
   * `/` OR ⌘K, FROM ANYWHERE. ⌘K is a chord nobody types into a field, so
   * it works from one; `/` is a character, so it only reaches the box when
   * the keys are not already somewhere writing.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const chord = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!chord && !slash) return;
      const at = document.activeElement;
      const writing =
        at instanceof HTMLInputElement ||
        at instanceof HTMLTextAreaElement ||
        at instanceof HTMLSelectElement ||
        (at instanceof HTMLElement && at.isContentEditable);
      if (slash && writing) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /*
   * WHAT CAN BE DONE ABOUT IT: the acts on the highlighted record, from the
   * same matcher asked with that record as the subject — never subjectless.
   */
  const acts = useMemo(() => {
    if (!anchor || !q.trim()) return [];
    return search(store, q, {
      principal,
      subject: anchor,
      kinds: (store.schema.kinds as readonly string[]).filter((kind) => !hiddenKinds.has(kind)),
      limit: 0,
    }).hits
      .filter((hit) => hit.about === "act")
      .slice(0, 4);
  }, [store, q, anchor, principal, hiddenKinds]);

  const groups = useMemo(() => {
    const held = new Map<string, Row[]>();
    for (const [index, hit] of (found?.hits ?? []).entries()) {
      if (hit.about === "act") continue;
      const key = groupOf(hit);
      const rows = held.get(key) ?? [];
      rows.push({ id: `${strip}-${index}`, hit });
      held.set(key, rows);
      if (hit.about === "node" && hit.id === anchor) {
        for (const [at, act] of acts.entries()) rows.push({ id: `${strip}-${index}-act-${at}`, hit: act });
      }
    }
    return [...held.entries()];
  }, [found, acts, anchor, strip]);
  const rows = useMemo(() => groups.flatMap(([, entries]) => entries), [groups]);
  const current = rows.find((row) => row.id === active) ?? rows[0];

  // A new answer starts at its first row, as a list does.
  useEffect(() => {
    setActive(null);
    setAnchor(null);
  }, [q]);

  const highlight = (row: Row | undefined) => {
    if (!row) return;
    setActive(row.id);
    if (row.hit.about === "node") setAnchor(row.hit.id);
    else if (row.hit.about !== "act") setAnchor(null);
  };

  const travel = (row: Row | undefined) => {
    if (!row) return;
    const hit = row.hit;
    switch (hit.about) {
      case "node":
        setView((stop) => withSelection(withFocus(withOverview(stop, false), hit.id), [hit.id]));
        break;
      case "kind":
        // Into the district, narrowed by the same words: search hands off to the arrangement.
        setView((stop) => withWithin(withFocus(withOverview(stop, false), aggregateId(hit.kind)), "q", stop.q ?? ""));
        break;
      case "place":
        setView((stop) => withWithin(withOverview(withFocus(stop, aggregateId(hit.kind)), false), "view", hit.as));
        break;
      case "rule": {
        const named = violations.filter((violation) => violation.invariant === hit.name).flatMap((violation) => violation.nodeIds);
        setView((stop) => withSelection(stop, [...new Set(named)]));
        break;
      }
      case "act": {
        // The act lives in the menu on its subject, with its form and its preview.
        setView((stop) => withSelection(stop, [hit.subject]));
        const box = input.current?.getBoundingClientRect();
        setMenuAt({ x: box?.left ?? 0, y: (box?.bottom ?? 0) + 6, on: hit.subject });
        break;
      }
    }
    setOpen(false);
    input.current?.blur();
  };

  const announce = found ? spoken(found.byKind, found.hits, store.schema) : "";
  const expanded = open && q.trim().length > 0;

  return (
    <div style={{ position: "relative", minWidth: 0, flex: "1 1 auto" }} data-testid="find">
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Find anything"
        aria-expanded={expanded}
        aria-controls={strip}
        aria-autocomplete="list"
        {...(expanded && current ? { "aria-activedescendant": current.id } : {})}
        data-testid="find-box"
        placeholder="Find…  /"
        value={q}
        onChange={(event) => {
          const words = event.target.value;
          setOpen(true);
          setView((stop) => withQuery(stop, words.length > 0 ? words : null));
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          // Nothing highlighted yet: the first ↓ lands on the first row, not the second.
          const at = active !== null && current ? rows.indexOf(current) : -1;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            highlight(rows[Math.min(rows.length - 1, at + 1)]);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            highlight(rows[Math.max(0, at - 1)]);
          } else if (event.key === "Enter") {
            event.preventDefault();
            travel(current);
          } else if (event.key === "Escape") {
            event.preventDefault();
            // The words first; an empty box lets go of the keys.
            if (q) setView((stop) => withQuery(stop, null));
            else input.current?.blur();
          }
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          minWidth: 0,
          minHeight: 32,
          padding: "4px 10px",
          font: "inherit",
          fontSize: "0.875rem",
          color: "var(--graview-ink)",
          background: "var(--graview-panel)",
          border: `1px solid ${q ? "var(--graview-accent)" : "var(--graview-edge)"}`,
          borderRadius: 8,
        }}
      />
      {/* The count, said as it changes — the strip is the list, this is the sentence. */}
      <span role="status" aria-live="polite" style={VISUALLY_HIDDEN} data-testid="find-count">
        {q.trim() ? announce : ""}
      </span>
      <div
        id={strip}
        role="listbox"
        aria-label={q ? `What “${q}” finds` : "What the words find"}
        data-testid="find-strip"
        hidden={!expanded}
        // Mousedown on a row must not blur the box before the click lands.
        onMouseDown={(event) => event.preventDefault()}
        style={compact ? { ...STRIP, ...SHEET } : STRIP}
      >
        {rows.length === 0 ? (
          <p role="presentation" style={{ margin: 0, padding: "10px 12px", color: "var(--graview-ink-muted)", fontSize: "0.875rem" }} data-testid="find-nothing">
            Nothing here is called “{found?.words || q}”.
          </p>
        ) : (
          groups.map(([key, entries]) => (
            <div key={key} role="group" aria-label={headingOf(key, store.schema)}>
              <div role="presentation" style={HEADING}>
                {key !== "rule:" ? <Mark kind={key} accents={brand?.accents} /> : null}
                {headingOf(key, store.schema)}
              </div>
              {entries.map((row) => (
                <div
                  key={row.id}
                  id={row.id}
                  role="option"
                  aria-selected={row === current}
                  data-testid="find-hit"
                  data-about={row.hit.about}
                  onMouseEnter={() => highlight(row)}
                  onClick={() => travel(row)}
                  style={{
                    ...OPTION,
                    ...(row.hit.about === "act" ? { paddingLeft: 30 } : {}),
                    background: row === current ? "var(--graview-panel-muted)" : "transparent",
                  }}
                >
                  <HitLine hit={row.hit} flag={flag} />
                </div>
              ))}
            </div>
          ))
        )}
        {found && found.searched.past === false && found.searched.kinds.some((kind) => store.schema.tryDefinition(kind)?.lifecycle) ? (
          <p role="presentation" style={{ margin: 0, padding: "6px 12px 8px", color: "var(--graview-ink-faint)", fontSize: "0.75rem" }}>
            Current ones; add is:any for the past.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HitLine({ hit, flag }: { hit: Hit; flag: string }) {
  switch (hit.about) {
    case "node":
      return (
        <>
          <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
            {hit.flagged ? <span style={{ color: "var(--graview-warn)" }}>{flag} </span> : null}
            {hit.label}
            {hit.current ? null : <span style={MUTED}> · past</span>}
          </span>
          {hit.why.field !== "label" ? (
            <span style={MUTED}>
              {hit.why.reading.toLowerCase()}: {hit.why.fragment}
            </span>
          ) : null}
        </>
      );
    case "kind":
      return (
        <span>
          {hit.label}
          <span style={MUTED}> · {hit.count} match</span>
        </span>
      );
    case "place":
      return <span>Go to {hit.title}</span>;
    case "rule":
      return <span>The rule “{hit.label}”</span>;
    case "act":
      return (
        <span style={hit.destructive ? { color: "var(--graview-warn)" } : undefined}>
          {hit.title}
          <span style={MUTED}> · {hit.why.field === "title" ? "act" : `on ${hit.why.fragment}`}</span>
        </span>
      );
  }
}

function Mark({ kind, accents }: { kind: string; accents?: Readonly<Record<string, number>> | undefined }) {
  const hue = Math.round(hueFor(kind, accents));
  return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, flex: "0 0 auto", background: `hsl(${hue} 55% 52%)` }} />;
}

function headingOf(key: string, schema: AnySchema): string {
  if (key === "rule:") return "Rules";
  if (key === "act:") return "Acts";
  const definition = schema.tryDefinition(key);
  return definition?.plural ?? `${key}s`;
}

/** "3 tasks, 1 list" — what a screen reader hears as the count changes. */
function spoken(byKind: Readonly<Record<string, number>>, hits: readonly Hit[], schema: AnySchema): string {
  const parts = Object.entries(byKind).map(([kind, count]) => {
    const plural = (schema.tryDefinition(kind)?.plural ?? `${kind}s`).toLowerCase();
    return `${count} ${count === 1 ? kind.replace(/-/g, " ") : plural}`;
  });
  const others = hits.filter((hit) => hit.about === "kind" || hit.about === "place" || hit.about === "rule").length;
  if (others > 0) parts.push(`${others} ${others === 1 ? "place or rule" : "places and rules"}`);
  return parts.length === 0 ? "Nothing found" : `${parts.join(", ")} found`;
}

const STRIP: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  width: "min(26rem, calc(100vw - 24px))",
  maxHeight: "min(60vh, 28rem)",
  overflowY: "auto",
  boxSizing: "border-box",
  background: "var(--graview-panel)",
  border: "1px solid var(--graview-edge)",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgb(0 0 0 / 0.18)",
  zIndex: 40,
  padding: "4px 0",
};

/** On a phone the strip is a sheet under the bar, the screen's full width. */
const SHEET: CSSProperties = {
  position: "fixed",
  top: "auto",
  left: 0,
  right: 0,
  width: "100vw",
  maxHeight: "55vh",
  borderRadius: 0,
  borderLeft: "none",
  borderRight: "none",
};

const HEADING: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px 2px",
  fontSize: "0.6875rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--graview-ink-muted)",
};

const OPTION: CSSProperties = {
  display: "grid",
  gap: 1,
  minHeight: 32,
  padding: "5px 12px",
  alignContent: "center",
  cursor: "pointer",
  fontSize: "0.875rem",
  lineHeight: 1.35,
  color: "var(--graview-ink)",
};

const MUTED: CSSProperties = { color: "var(--graview-ink-muted)", fontSize: "0.8125rem", fontWeight: 400 };
