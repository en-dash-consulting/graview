import { counted, isCurrent, labelOf, layer, nounOf, numberAsRead, pluralLabel, type AnySchema, type NodeOfSchema } from "@graview/core";
import { edgeWords } from "@graview/core/words";
import { aggregateId, kindCardId, withFocus, withOverview, withPicture, withWithin, type ViewState } from "@graview/layout/view";
// Drawn only with the scene, whose face has fetched `@graview/react` already.
import { pickedFrom, ribbonsOf, ribbonSentence } from "@graview/react";
import { useKit, ViewBoundary } from "@graview/react/drawing";
import type { MapPanelShowing } from "./map-panel-door.js";
import { NamedAbove } from "./primitives/index.js";
import { isDefaultView, useGraph, useGraview, useNavigation, useViolations, ViewModeProvider, type ViewComponent } from "@graview/react/provider";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { barPanes } from "./bar-panes-door.js";
import { problemsNamed } from "./problem-count.js";
import { problemsAsked, putDownProblemsAsked, subscribeToProblemsAsked } from "./map-asks.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

// The problems' rows are the bar's own (`ProblemRows`), fetched with its panes: one set of words, one set of repairs.
type RowsProps = Parameters<typeof import("./bar-panes.js").ProblemRows>[0];
const ProblemRows = barPanes.part((panes, props: RowsProps) => <panes.ProblemRows {...props} />, { what: "The problems", as: "li" });

/*
 * BESIDE THE MAP, AT A SIZE A PERSON READS.
 *
 * Two things used to float over the city at its own scale. A lens pressed on
 * a district's marquee stood on the plot as a billboard — the lens drawn at
 * a seventeenth of its size, eight-pixel text over the districts, unreadable
 * until it was opened. And a district opened to say which record was which
 * became a card of chips floating over its neighbors: "1 of 14 tied",
 * "close", "+10 more — double-click to go in".
 *
 * Both are a panel now, docked beside the map on a desk — the city lays
 * itself out in the room that is left — and a sheet from the foot on a
 * phone. What it holds follows what is chosen from altitude:
 *
 * - a LENS pressed on a district's marquee (the same stop as before: the
 *   kind's group in focus, `in.view`): the lens itself, at full size, with
 *   the way into its own place; the map recedes but for its district;
 * - a RECORD: its links, a list per relation in its kind's words, each
 *   record a press that chooses it — the list the floating card was;
 * - a DISTRICT: its relations, with how many each joins, and every record
 *   in it, none of them "+10 more".
 */

/** How far the panel floats in from the edges of the picture and from the map: the app's gap. */
const PANEL_GAP = "var(--graview-gap, 8px)";

/** Narrower than this, the panel is a sheet from the foot rather than a column beside the map. */
const MAP_PANEL_SHEET_BELOW = 720;

/** The panel for what is chosen, drawn by `MapPanel` (map-panel-door.tsx) once it has decided there is one. */
export function MapPanelFor<S extends AnySchema>({ showing }: { readonly showing: MapPanelShowing }) {
  if (showing.what === "lens") return <LensPanel<S> key={`lens:${showing.kind}`} kind={showing.kind} />;
  if (showing.what === "record") return <RecordPanel<S> key={`record:${showing.id}`} id={showing.id} />;
  return <DistrictPanel<S> key={`district:${showing.kind}`} kind={showing.kind} />;
}

/* ------------------------------------------------------------- the frame */

function PanelFrame({
  label,
  wide,
  testId,
  head,
  onClose,
  children,
  sheetHeight,
}: {
  readonly label: string;
  /** How wide it docks on a desk: a CSS length. */
  readonly wide: string;
  readonly testId: string;
  readonly head: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** How tall it stands as a sheet on a phone, as a share of the picture. */
  readonly sheetHeight: string;
}) {
  const region = useRef<HTMLElement | null>(null);
  const [sheet, setSheet] = useState(false);
  /* A PHONE'S PANEL is a sheet, decided by the box it is drawn in, not the window. */
  useLayoutEffect(() => {
    const box = region.current?.parentElement;
    if (!box) return;
    const measure = () => setSheet(box.getBoundingClientRect().width < MAP_PANEL_SHEET_BELOW);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    return () => watch.disconnect();
  }, []);
  /* ESCAPE CLOSES IT: it is the outermost thing over the picture, so the scene's ladder waits (`data-graview-overlay`). */
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      // A popover over the panel closes first.
      if (document.querySelector("[data-graview-popover]:popover-open")) return;
      // Following somebody, the press stops following first: their stop is what the panel is showing.
      if (following) return;
      close.current();
    };
    /*
     * Whether somebody was being followed WHEN the key went down: the
     * following's own listener may have put it down already, and React
     * drawn that, by the time this one hears the same press.
     */
    let following = false;
    const before = () => {
      following = document.querySelector('[data-testid="following-who"]') !== null;
    };
    window.addEventListener("keydown", before, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", before, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <section
      ref={region}
      aria-label={label}
      data-testid={testId}
      data-graview-map-panel={sheet ? "sheet" : "dock"}
      data-graview-overlay=""
      data-graview-offstage=""
      className="graview-map-panel"
      style={{
        position: "absolute",
        // On the rail's rung, drawn after the ask field: a sheet stands over the field rather than being cut through by it.
        zIndex: layer("rail"),
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: "var(--graview-panel)",
        color: "var(--graview-ink)",
        /*
         * A SURFACE OVER THE SCENE, NOT A COLUMN BESIDE IT: inset from the
         * right, the top (under the bar) and the foot by the app's gap, with
         * the app's own radius on every corner, its own edge and the real
         * elevation, so it reads as lying on the map. What it holds is
         * clipped to the radius, its scrollbar inside the box.
         */
        overflow: "hidden",
        border: "1px solid var(--graview-edge)",
        borderRadius: "var(--graview-radius, 12px)",
        boxShadow: "var(--graview-lift-high)",
        ...(sheet
          ? { left: PANEL_GAP, right: PANEL_GAP, bottom: `calc(${PANEL_GAP} + env(safe-area-inset-bottom, 0px))`, height: sheetHeight }
          : { top: PANEL_GAP, right: PANEL_GAP, bottom: PANEL_GAP, width: wide }),
      }}
    >
      {/*
        * THE CITY TAKES THE ROOM THAT IS LEFT: the picture the panel stands in
        * says how wide it is (`--graview-dock`), the ground is laid out in
        * the rest, and Up, the Key and the ask field keep clear of it. A
        * sheet on a phone says how tall it is (`--graview-sheet`) and the
        * city is laid out above it: what was chosen stays in sight, where a
        * finger can still press it and open its acts, rather than under the
        * sheet it opened.
        */}
      {/* The room it takes is its width and the gap on each side of it: the map side's, and the inset from the right edge. */}
      {sheet ? (
        <style>{`:has(> [data-graview-map-panel="sheet"]) { --graview-sheet: calc(${sheetHeight} + 2 * ${PANEL_GAP} + env(safe-area-inset-bottom, 0px)); }`}</style>
      ) : (
        <style>{`:has(> [data-graview-map-panel="dock"]) { --graview-dock: calc(${wide} + 2 * ${PANEL_GAP}); }`}</style>
      )}
      <header style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 14px 10px 18px", borderBottom: "1px solid var(--graview-edge)" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>{head}</div>
        <button type="button" data-testid="map-panel-close" aria-label="Close" title="Close (Escape)" onClick={onClose} style={{ flex: "0 0 auto", minWidth: 32, height: 32, borderRadius: 8, fontSize: "1.1rem", lineHeight: 1 }}>
          ×
        </button>
      </header>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>{children}</div>
    </section>
  );
}

const eyebrow = { fontSize: "0.75rem", letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--graview-ink-faint)" } as const;
const title = { margin: "2px 0 0", fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.3, overflowWrap: "anywhere" } as const;
const quiet = { margin: "4px 0 0", fontSize: "0.875rem", color: "var(--graview-ink-muted)" } as const;
const heading = { margin: "14px 18px 6px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--graview-ink-muted)" } as const;
const listStyle = { listStyle: "none", margin: 0, padding: "0 10px 6px" } as const;
const rowStyle = { all: "unset", outline: "revert-layer", boxSizing: "border-box", display: "flex", alignItems: "baseline", gap: 8, width: "100%", padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" } as const;
const pressStyle = { minHeight: 30, padding: "0 12px", borderRadius: 8, fontSize: "0.8125rem" } as const;

/** A record's acts, at the pointer: it is chosen, and the menu a right-click opens on the map opens here about it. */
function useActsAt() {
  const { setSelection, setMenuAt } = useGraview();
  return (event: { preventDefault(): void; clientX: number; clientY: number }, id: string) => {
    event.preventDefault();
    setSelection([id]);
    setMenuAt({ x: event.clientX, y: event.clientY, on: id });
  };
}

/*
 * ITS ACTS, A PRESS AWAY (the ninth walk, W-195). On a phone the panel is a
 * sheet over the foot of the map, standing on the district or the record it
 * is about, so the right-click that opened their menu had nothing left to
 * land on, and a finger has no right button: "Add a hive" was on no screen
 * of a phone. The panel's head says it in a button that opens the same menu,
 * under the button, about what the panel is about.
 */
function ActsButton({ on, about }: { readonly on: string; readonly about: string }) {
  const { setSelection, setMenuAt } = useGraview();
  return (
    <button
      type="button"
      data-testid="map-panel-acts"
      aria-label={`What can be done with ${about}`}
      aria-haspopup="menu"
      style={pressStyle}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setSelection([on]);
        setMenuAt({ x: Math.round(box.left), y: Math.round(box.bottom + 4), on });
      }}
    >
      Acts…
    </button>
  );
}

/** Going to a record from the panel: the same stop a double-click on it in the scene makes, on the ground. */
const travelTo = (view: ViewState, id: string): ViewState => ({ ...withFocus(withOverview(view, false), id), relation: null });

/* -------------------------------------------------------------- the lens */

/**
 * A LENS, AT FULL SIZE, BESIDE THE MAP. The same component the place draws,
 * over the kind's current members, in the mode a lens already draws a
 * page in — nothing here is a copy of a lens. A press on a record in it
 * chooses that record; a double press goes to it.
 */
function LensPanel<S extends AnySchema>({ kind }: { readonly kind: string }) {
  const actsAt = useActsAt();
  const { store, views, view, selection, setSelection } = useGraview<S>();
  const { go } = useNavigation();
  const graph = useGraph<S>();
  const asked = view.within?.["view"];
  const places = views.places().filter((place) => place.kind === kind);
  const place = (asked !== undefined ? places.find((one) => one.as === asked) : undefined) ?? places.at(-1);
  const registration = views.resolve(kind, { cardinality: "many", fidelity: "full" }, place?.as ?? asked);
  const View = registration?.view as ViewComponent<S> | undefined;
  const definition = store.schema.tryDefinition(kind);
  const members = useMemo(
    () => store.graph.nodesOfKind(kind).filter((node) => view.past === true || isCurrent(definition, node)) as NodeOfSchema<S>[],
    [store, kind, graph, view.past, definition],
  );
  const named = registration?.title ?? place?.title ?? pluralLabel(store.schema, kind);
  // A kind with no picture of its own draws its stop here, which heads itself: the panel says nothing over it.
  const derived = View !== undefined && isDefaultView(View);
  const chosen = selection.filter((id) => store.graph.getNode(id) !== undefined);
  const close = () => go(withWithin(withFocus(view, null), "view", null));
  return (
    <PanelFrame
      label={named}
      testId="lens-panel"
      wide="min(max(440px, 46%), 760px)"
      sheetHeight="60%"
      onClose={close}
      head={
        derived ? null : <>
          <div style={eyebrow}>{pluralLabel(store.schema, kind)}</div>
          <h2 style={title} data-testid="lens-panel-title">{named}</h2>
          <p style={quiet}>
            {counted(store.schema, kind, members.length)}
            {definition?.description ? ` · ${definition.description}` : ""}
          </p>
          {place ? (
            <div style={{ marginTop: 10 }}>
              <button type="button" data-testid="lens-panel-open" style={pressStyle} title={`Open ${named} on its own`} onClick={() => go(withPicture(view, kind, place.as))}>
                Open ↗
              </button>
            </div>
          ) : null}
        </>
      }
    >
      {/* The map recedes behind an open lens, but for the district it is of. */}
      <style>{`.graview-ground[data-graview-altitude] .graview-plot:not([data-graview-plot="${kindCardId(kind)}"]) { opacity: 0.35; }
.graview-ground[data-graview-altitude] [data-graview-view^="kind:"]:not([data-graview-view="${kindCardId(kind)}"]) { opacity: 0.4; }`}</style>
      <div
        data-graview-lens={place?.as ?? ""}
        /*
         * THE LENS TAKES THE PANEL'S REMAINING HEIGHT. A grid whose one row
         * is the room left under the head, and grows past it with what it
         * holds: a lens that fills its box (the week, a timetable) is given
         * a box as tall as the panel, rather than a height of "auto" its
         * percentages came to nothing against; a lens taller than that grows
         * and the panel's own body scrolls — never a second scroll inside it.
         * One column no wider than the panel, so nothing pushes it sideways.
         */
        style={{ padding: "8px 12px 16px", minHeight: "100%", boxSizing: "border-box", display: "grid", gridTemplateRows: "1fr", gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start" }}
        onClick={(event) => {
          const id = pickedFrom(event.target);
          if (!id || store.graph.getNode(id) === undefined) return;
          const control = (event.target as HTMLElement).closest("button, a, input, select, textarea, [contenteditable='true']");
          if (control && !control.hasAttribute("data-graview-pick")) return;
          setSelection([id]);
        }}
        onDoubleClick={(event) => {
          const id = pickedFrom(event.target);
          if (!id || store.graph.getNode(id) === undefined) return;
          go(travelTo(view, id));
        }}
        // A right-click on a record in it opens that record's acts, as it does on the map.
        onContextMenu={(event) => {
          const id = pickedFrom(event.target);
          if (!id || store.graph.getNode(id) === undefined) return;
          actsAt(event, id);
        }}
      >
        {View ? (
          /* The head names it; the lens's own panel does not say it again under it. */
          <NamedAbove.Provider value={named}>
            {/*
              * DRAWN AS A PAGE, as its own place draws it: the panel is the
              * page here, so the lens's panel is no card inside it with a
              * scroll box of its own — the mode its props say, said to the
              * primitives too.
              */}
            <ViewModeProvider mode="fullscreen">
              <ViewBoundary kind={kind} {...(registration?.title ? { view: registration.title } : {})}>
                <View nodes={members} label={named} fidelity="full" cardinality="many" mode="fullscreen" selected={false} {...(chosen.length > 0 ? { implicated: chosen } : {})} />
              </ViewBoundary>
            </ViewModeProvider>
          </NamedAbove.Provider>
        ) : null}
      </div>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------ a record */

/** A record's links, a group per relation and direction, each in the words of the record's kind. */
function linkGroups(
  schema: AnySchema,
  edges: Iterable<{ readonly kind: string; readonly from: string; readonly to: string }>,
  id: string,
  kindOf: (id: string) => string | undefined,
): { key: string; edge: string; words: string; kind: string; others: string[] }[] {
  const self = kindOf(id);
  const groups = new Map<string, { key: string; edge: string; words: string; kind: string; others: string[] }>();
  for (const edge of edges) {
    const out = edge.from === id;
    if (!out && edge.to !== id) continue;
    const other = out ? edge.to : edge.from;
    const kind = kindOf(other);
    if (kind === undefined || self === undefined) continue;
    const key = `${edge.kind}|${out ? "out" : "in"}|${kind}`;
    const held = groups.get(key);
    if (held) {
      if (!held.others.includes(other)) held.others.push(other);
      continue;
    }
    groups.set(key, { key, edge: edge.kind, words: edgeWords(schema, out ? self : kind, edge.kind, out ? "out" : "in"), kind, others: [other] });
  }
  return [...groups.values()];
}

function RecordPanel<S extends AnySchema>({ id }: { readonly id: string }) {
  const actsAt = useActsAt();
  const { store, view, setSelection } = useGraview<S>();
  const { go } = useNavigation();
  const graph = useGraph<S>();
  const node = store.graph.getNode(id);
  const kindOf = (other: string) => store.graph.getNode(other)?.kind as string | undefined;
  const groups = useMemo(() => linkGroups(store.schema, store.graph.allEdges(), id, kindOf), [store, id, graph]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!node) return null;
  const kind = node.kind as string;
  const name = (of: string) => {
    const other = store.graph.getNode(of);
    return other ? labelOf(store.schema.tryDefinition(other.kind), other as never) : of;
  };
  const noun = nounOf(store.schema.tryDefinition(kind), kind);
  return (
    <PanelFrame
      label={`${name(id)}: its links`}
      testId="record-panel"
      wide="min(360px, 40%)"
      sheetHeight="52%"
      onClose={() => setSelection([])}
      head={
        <>
          <div style={eyebrow}>{noun}</div>
          <h2 style={title} data-testid="record-panel-title">{name(id)}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" data-testid="record-panel-go" style={pressStyle} onClick={() => go(travelTo(view, id))}>
              Go to it
            </button>
            <ActsButton on={id} about={name(id)} />
            <button type="button" data-testid="record-panel-district" style={pressStyle} onClick={() => setSelection([kindCardId(kind)])}>
              All {pluralLabel(store.schema, kind).toLowerCase()}
            </button>
          </div>
        </>
      }
    >
      {groups.length === 0 ? <p style={{ ...quiet, margin: "14px 18px" }}>No links yet.</p> : null}
      {groups.map((group) => (
        <section key={group.key} aria-label={group.words} data-graview-links={group.edge}>
          <h3 style={heading}>
            {group.words.charAt(0).toUpperCase() + group.words.slice(1)} <span style={{ fontWeight: 400, color: "var(--graview-ink-faint)" }}>· {group.others.length}</span>
          </h3>
          <ul style={listStyle}>
            {group.others.map((other) => (
              <li key={other}>
                <button
                  type="button"
                  className="graview-map-panel-row"
                  data-graview-record={other}
                  style={rowStyle}
                    onClick={() => setSelection([other])}
                  // Its acts, as on the map: a right-click (or a long press) opens the menu about it, here.
                  onContextMenu={(event) => actsAt(event, other)}
                >
                  <span style={{ flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>{name(other)}</span>
                  {group.kind !== kind ? null : <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>{noun}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PanelFrame>
  );
}

/* ----------------------------------------------------------- a district */

/** Past this many, a district's list carries a field to narrow it by name. */
const NARROW_PAST = 24;

function DistrictPanel<S extends AnySchema>({ kind }: { readonly kind: string }) {
  const actsAt = useActsAt();
  const { store, view, setSelection, setEmphasis } = useGraview<S>();
  const { go } = useNavigation();
  const graph = useGraph<S>();
  const [narrow, setNarrow] = useState("");
  const definition = store.schema.tryDefinition(kind);
  const members = useMemo(
    () =>
      store.graph
        .nodesOfKind(kind)
        .filter((node) => view.past === true || isCurrent(definition, node))
        .map((node) => ({ id: node.id, name: labelOf(definition, node as never) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [store, kind, graph, view.past, definition],
  );
  /*
   * Counted over the records the district counts (W-198): its head says
   * "280 hives", the ones on this side of the horizon, so its relations do
   * not say "299 hives → 14 apiaries" of the same district.
   */
  const relations = useMemo(() => {
    const current = (id: string): boolean => {
      const node = store.graph.getNode(id);
      return node !== undefined && (view.past === true || isCurrent(store.schema.tryDefinition(node.kind as string), node));
    };
    const edges = store.graph.allEdges().filter((edge) => current(edge.from) && current(edge.to));
    return ribbonsOf(edges, (id) => store.graph.getNode(id)?.kind as string | undefined).filter((ribbon) => ribbon.from === kind || ribbon.to === kind);
  }, [store, kind, graph, view.past]);
  // A district that stops being asked about takes its question with it.
  useEffect(() => () => setEmphasis(null), [setEmphasis]);
  /*
   * ITS PROBLEMS, the same rows the bar's problems list draws: the broken
   * rules that name one of this district's records. The "⚠ N" on its name
   * counts these, and presses to here.
   */
  const everyProblem = useViolations<S>();
  const flag = useKit().marks.flag;
  const problems = useMemo(() => {
    const ids = new Set(members.map((member) => member.id));
    return everyProblem.filter((violation) => violation.nodeIds.some((id) => ids.has(id)));
  }, [everyProblem, members]);
  const lit = useMemo(() => [...new Set(problems.flatMap((violation) => violation.nodeIds))].filter((id) => store.graph.getNode(id)?.kind === kind).slice(0, 300), [problems, store, kind]);
  const problemsHead = useRef<HTMLHeadingElement | null>(null);
  const asked = useSyncExternalStore(subscribeToProblemsAsked, problemsAsked, problemsAsked);
  // Asked for from the district's name: brought into view, and the keyboard moved to it.
  useEffect(() => {
    if (asked?.kind !== kind || problems.length === 0) return;
    problemsHead.current?.scrollIntoView?.({ block: "start" });
    problemsHead.current?.focus({ preventScroll: true });
  }, [asked?.n, asked?.kind, kind, problems.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Closed, the keyboard goes back to what opened it — the problem count if there is one, else the district — never to the page. */
  useEffect(
    () => () => {
      putDownProblemsAsked();
      setTimeout(() => {
        const active = document.activeElement;
        if (active && active !== document.body) return;
        const escaped = CSS.escape(kind);
        document.querySelector<HTMLElement>(`[data-testid="district-problems-${escaped}"]`)?.focus({ preventScroll: true }) ??
          document.querySelector<HTMLElement>(`[data-graview-view="${kindCardId(kind).replace(/["\\]/g, "\\$&")}"]`)?.focus({ preventScroll: true });
      }, 0);
    },
    [kind],
  );
  const plural = pluralLabel(store.schema, kind);
  const words = narrow.trim().toLowerCase();
  const shown = words ? members.filter((member) => member.name.toLowerCase().includes(words)) : members;
  return (
    <PanelFrame
      label={plural}
      testId="district-panel"
      wide="min(360px, 40%)"
      sheetHeight="52%"
      onClose={() => setSelection([])}
      head={
        <>
          <div style={eyebrow}>District</div>
          <h2 style={title} data-testid="district-panel-title">{plural}</h2>
          <p style={quiet}>
            {counted(store.schema, kind, members.length)}
            {definition?.description ? ` · ${definition.description}` : ""}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" data-testid="district-panel-go" style={pressStyle} onClick={() => go({ ...withFocus(withOverview(view, false), aggregateId(kind)), relation: null })}>
              Go in
            </button>
            <ActsButton on={kindCardId(kind)} about={`the ${plural.toLowerCase()}`} />
          </div>
        </>
      }
    >
      {problems.length > 0 ? (
        <section aria-label="Problems" data-testid="district-problems" data-graview-problems={problems.length}>
          {/* The records that are broken stand out on the map while this is open. */}
          <style>{`${lit.map((id) => `.graview-ground[data-graview-altitude] .graview-building[data-graview-building="${CSS.escape(id)}"] polygon`).join(",\n")} { stroke: var(--graview-accent); stroke-width: 2.2; stroke-opacity: 1; }`}</style>
          <h3
            ref={problemsHead}
            tabIndex={-1}
            data-testid="district-problems-heading"
            style={{ display: "flex", alignItems: "baseline", gap: 8, margin: 0, padding: "14px 18px 8px", fontSize: "0.9375rem", fontWeight: 600, color: "var(--graview-warn)", borderTop: "1px solid var(--graview-edge)", scrollMarginTop: 0, outlineOffset: -2 }}
          >
            <span aria-hidden="true">{flag}</span>
            <span style={{ color: "var(--graview-ink)" }}>{problemsNamed(problems.length, plural)}</span>
          </h3>
          <ol style={listStyle} data-testid="district-problem-rows">
            <Suspense fallback={null}>
              <ProblemRows
                violations={problems}
                pick={(violation) => {
                  const id = violation.subjectId ?? violation.nodeIds[0];
                  if (id !== undefined) setSelection([id]);
                }}
              />
            </Suspense>
          </ol>
        </section>
      ) : null}
      {relations.length > 0 ? (
        <section aria-label="Relations">
          <h3 style={heading}>Relations</h3>
          <ul style={listStyle}>
            {relations.map((ribbon) => (
              <li key={ribbon.key}>
                <div
                  data-graview-relation-said={ribbon.edge}
                  tabIndex={0}
                  style={{ ...rowStyle, cursor: "default" }}
                  onPointerEnter={() => setEmphasis(ribbon.edge)}
                  onPointerLeave={() => setEmphasis(null)}
                  onFocus={() => setEmphasis(ribbon.edge)}
                  onBlur={() => setEmphasis(null)}
                >
                  <span style={{ flex: "1 1 auto", minWidth: 0 }}>{ribbonSentence(store.schema, ribbon)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)", fontVariantNumeric: "tabular-nums" }} title={`${numberAsRead(ribbon.links)} links`}>
                    {numberAsRead(ribbon.links)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-label={plural}>
        <h3 style={heading}>
          {plural} <span style={{ fontWeight: 400, color: "var(--graview-ink-faint)" }}>· {members.length}</span>
        </h3>
        {members.length > NARROW_PAST ? (
          <div style={{ padding: "0 18px 6px" }}>
            <input
              type="search"
              data-testid="district-panel-narrow"
              aria-label={`Narrow the ${plural.toLowerCase()} by name`}
              placeholder="Narrow by name"
              value={narrow}
              onChange={(event) => setNarrow(event.target.value)}
              style={{ width: "100%", boxSizing: "border-box", minHeight: 32 }}
            />
          </div>
        ) : null}
        <ul style={listStyle}>
          {shown.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="graview-map-panel-row"
                data-graview-record={member.id}
                style={rowStyle}
                onClick={() => setSelection([member.id])}
                  // Its acts, as on the map: a right-click (or a long press) opens the menu about it, here.
                  onContextMenu={(event) => actsAt(event, member.id)}
              >
                <span style={{ flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>{member.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </PanelFrame>
  );
}
