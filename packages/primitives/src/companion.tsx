import { labelOf, placeSlug, type AnySchema } from "@graview/core";
import { withFocus } from "@graview/layout";
import { aggregateId, bandAggregateWords, isAggregateId, kindOfCard } from "@graview/layout";
import { useGraview, useSeatWork, useSelection } from "@graview/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatPanel } from "./chat.js";
import { QuickRelations } from "./quick-relations.js";
import { RelationKey } from "./relation-key.js";
import { Inspector } from "./workbench/index.js";

/**
 * THE SEAT IS A COMPANION ATTACHED TO THE VIEWFRAME.
 *
 * The scene used to say the current subject four times over: the inspector
 * listed its acts (and was the context menu at the pointer), the quick
 * relations offered its relations, the relation key named the lines, and a
 * robot figure walked the ground with the chat panel anchored beside it as
 * a bubble. Four panels, one subject — and the figure had no place at all
 * inside a full-screen lens, where there is no ground to walk on.
 *
 * One construct instead, on the left, where the scene already reserves a
 * rail: a subject header, the acts, the relations, the conversation, and
 * the key at the foot. It is fixed to the frame, so it is the same at
 * altitude, on the ground, flying closer and inside a lens. Right-click
 * still opens the acts at the pointer — the same pane, from the same
 * derivation — so the context menu and the assistant are one thing.
 */

/** What the companion is about, and how it came to be about it. */
export interface Subject {
  readonly id: string | null;
  readonly name: string;
  /** Chosen, pointed at, or simply where you are. */
  readonly because: "selection" | "hover" | "place";
}

/*
 * A dwell, so a pointer crossing the picture on its way somewhere does not
 * rename the panel six times. Long enough to be a look, short enough that
 * asking "what's wrong with this?" about the thing under the pointer works
 * the moment you stop moving.
 */
const DWELL_MS = 220;

/**
 * The pick target under a scene point, read from the DOM the way a click
 * would. The point is in the scene's own coordinates — the space the layout
 * places things in — so the stage's box is what turns it into the window's.
 */
function pickAt(stage: HTMLElement | null, point: { readonly x: number; readonly y: number } | null): string | null {
  if (!stage || !point || typeof document === "undefined") return null;
  const box = stage.getBoundingClientRect();
  const element = document.elementFromPoint(box.left + point.x, box.top + point.y);
  const picked = element?.closest("[data-graview-pick]")?.getAttribute("data-graview-pick");
  if (picked) return picked;
  const view = element?.closest("[data-graview-view]")?.getAttribute("data-graview-view");
  return view ?? null;
}

/**
 * WHAT "THIS" MEANS, without a gesture to turn it on.
 *
 * The selection when there is one — something chosen outranks something
 * glanced at. Otherwise what the pointer has settled on. Otherwise where
 * you are: the focused place, district or record, or the whole thing.
 */
export function useSubject<S extends AnySchema>(): Subject {
  const { store, view, views, pointer } = useGraview<S>();
  const { selection } = useSelection();
  const [dwelt, setDwelt] = useState<string | null>(null);
  /*
   * THE POINTER IS WATCHED, NOT SUBSCRIBED TO.
   *
   * Reading it the ordinary way — `useScenePointer`, a store subscription
   * React re-renders on — re-rendered this whole rail on every pointer
   * move: the acts, the relations, the conversation and the key, sixty
   * times a second, for a subject that changes when you stop rather than
   * while you move. The moves are taken here without a render; only what
   * the pointer SETTLED on is state, and only when it is a different
   * thing from last time.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let handOn = false;
    /*
     * AND NOT WHILE THE PICTURE IS MOVING UNDER THE POINTER.
     *
     * Dragging the city slides one district after another past a pointer
     * that never moved, and the subject chased every one of them: the
     * rail's header, its acts and its relations flickered through the
     * whole map on the way. The pointer says what you are looking at when
     * YOU move it over a picture that is still — so while a hand is down,
     * and while the scene is still travelling, the question is not asked.
     */
    const stillMoving = () =>
      typeof document !== "undefined" && document.querySelector("[data-graview-reach]") !== null
        ? document.querySelector("[data-graview-settled]") === null
        : false;
    const settle = () => {
      if (timer) clearTimeout(timer);
      if (handOn) return;
      const at = pointer.snapshot();
      if (!at) {
        setDwelt((was) => (was === null ? was : null));
        return;
      }
      timer = setTimeout(() => {
        if (handOn || stillMoving()) {
          settle();
          return;
        }
        const stage = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("[data-graview-stage]");
        const on = pickAt(stage, at);
        setDwelt((was) => (was === on ? was : on));
      }, DWELL_MS);
    };
    const down = () => {
      handOn = true;
      if (timer) clearTimeout(timer);
    };
    const up = () => {
      handOn = false;
      settle();
    };
    const stop = pointer.subscribe(settle);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    settle();
    return () => {
      stop();
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      if (timer) clearTimeout(timer);
    };
  }, [pointer]);

  const name = (id: string): string | null => {
    const node = store.graph.getNode(id);
    if (node) return labelOf(store.schema.tryDefinition(node.kind), node);
    const band = bandAggregateWords(id, store.schema);
    if (band) return band;
    const kind = kindOfCard(id) ?? (isAggregateId(id) ? id.slice("aggregate:".length) : null);
    if (kind) return store.schema.tryDefinition(kind)?.plural ?? kind;
    return null;
  };

  const chosen = selection[selection.length - 1];
  if (chosen !== undefined) {
    const said = name(chosen);
    if (said) {
      return {
        id: chosen,
        name: selection.length > 1 ? `${said} and ${selection.length - 1} more` : said,
        because: "selection",
      };
    }
  }
  if (dwelt !== null && dwelt !== undefined) {
    const said = name(dwelt);
    if (said) return { id: dwelt, name: said, because: "hover" };
  }
  /* Where you are: the picture being shown, else the district in focus, else the whole thing. */
  const showing = view.within?.["view"];
  const place = showing ? views.places().find((one) => one.as === showing || placeSlug(one.title) === showing) : undefined;
  if (place) return { id: null, name: place.title, because: "place" };
  if (view.focusId) {
    const said = name(view.focusId);
    if (said) return { id: view.focusId, name: said, because: "place" };
  }
  return { id: null, name: "the whole thing", because: "place" };
}

/** What the seat is doing, in one word, from the state it already reports. */
function seatSays(mode: string | undefined): { readonly word: string; readonly tone: string } {
  switch (mode) {
    case "reading":
      return { word: "reading", tone: "var(--graview-ink-muted)" };
    case "writing":
      return { word: "working", tone: "var(--graview-accent)" };
    case "asking":
      return { word: "asked you something", tone: "var(--graview-accent)" };
    case "refused":
      return { word: "refused", tone: "var(--graview-warn)" };
    default:
      return { word: "listening", tone: "var(--graview-ink-faint)" };
  }
}

export interface CompanionProps<S extends AnySchema> {
  /** How the seat answers; passed through to the conversation. */
  readonly respond?: Parameters<typeof ChatPanel<S>>[0]["respond"];
  readonly onCall?: Parameters<typeof ChatPanel<S>>[0]["onCall"];
  /** Where a pick in the conversation goes; the scene's own travel when unsaid. */
  readonly onPick?: Parameters<typeof ChatPanel<S>>[0]["onPick"];
  /** Whether a conversation is offered at all. An app with no seat still gets the acts and the relations. */
  readonly chat?: boolean;
  /**
   * Already given a box of its own — a drawer on the routed face — rather
   * than floating over a picture. Framed, it fills what it was given,
   * stays open, and never collapses itself for want of room: the host
   * decided how much room there is before it mounted.
   */
  readonly framed?: boolean;
}

export function Companion<S extends AnySchema>({ respond, onCall, onPick, chat = true, framed = false }: CompanionProps<S> = {}) {
  const { seatWho, robots, session, store, setView: setViewOf } = useGraview<S>();
  const { set: chooseOf } = useSelection();
  const subject = useSubject<S>();
  const [open, setOpen] = useState(true);
  const robot = robots.get(`agent:${seatWho ?? "chat"}:${session}`);
  const state = seatSays(robot?.mode);
  const said = robot?.say ?? null;
  const name = seatWho ?? "the seat";
  /*
   * A NARROW SCENE HAS NO RAIL. The same argument the inspector makes: a
   * rail down the side of a 390-wide picture covers the picture. There it
   * is a sheet along the bottom, which is where a phone has always put
   * this, and it starts closed so the picture is the first thing.
   */
  const [narrow, setNarrow] = useState(false);
  const frame = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (framed) return;
    const element = frame.current?.parentElement;
    if (!element || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => setNarrow(element.getBoundingClientRect().width < 640));
    watch.observe(element);
    setNarrow(element.getBoundingClientRect().width < 640);
    return () => watch.disconnect();
  }, []);
  useEffect(() => {
    if (narrow && !framed) setOpen(false);
  }, [narrow, framed]);
  /*
   * AND THE PICTURE MAKES ROOM FOR THE SHEET. Laid over a 390-wide scene,
   * an open sheet covers the districts and the control that opens one —
   * the very thing it is about. The same trade the actions strip makes: the
   * scene's box loses the sheet's height while it is there, and the layout
   * runs again into what is left.
   */
  useLayoutEffect(() => {
    const parent = frame.current?.offsetParent as HTMLElement | null;
    if (!parent || !narrow || framed) return;
    const room = `${Math.round(frame.current?.getBoundingClientRect().height ?? 0) + 20}px`;
    if (parent.style.paddingBottom === room) return;
    const before = parent.style.paddingBottom;
    parent.style.paddingBottom = room;
    return () => {
      parent.style.paddingBottom = before;
    };
  });
  const anything = store.graph.allEdges().length > 0;
  const docked = !narrow && !framed;
  /* The conversation, rendered once and placed by the pane's shape. */
  const conversation = (
    <ChatPanel<S>
      inside
      {...(onPick ? { onPick } : {})}
      /* What the graph can answer about THIS, offered before anybody types. */
      offer={[
        "What's wrong?",
        ...(subject.id && store.graph.getNode(subject.id) ? [`Tell me about ${subject.name}`] : []),
        "What is here?",
      ]}
      {...(respond ? { respond } : {})}
      {...(onCall ? { onCall } : {})}
    />
  );
  const work = useSeatWork<S>();
  /* Questions back, from every seat in this tab: they wait for an answer, so they are listed until answered. */
  const asking = [...robots.values()].filter((one) => one.mode === "asking" && one.say);
  const { setView, choose } = { setView: setViewOf, choose: chooseOf };
  /*
   * THE WAY BACK TO WHAT IT DID. Where you are decides what "show me"
   * means: from altitude the district the thing lives in, since a single
   * task is a building up there; on the ground the thing itself, chosen
   * and focused, which is what a person would have clicked.
   */
  const showMe = (id: string) => {
    const node = store.graph.getNode(id);
    choose([id]);
    setView((current) =>
      current.overview && node
        ? withFocus(current, aggregateId(node.kind as string))
        : withFocus(current, id),
    );
  };
  /*
   * AN ASK COMES TO THE TOP. Answering an act's open question is a
   * conversation of its own, and in a scrolling column it can open below
   * the fold — the pane asking a question nobody can see.
   */
  const column = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const scroller = column.current;
    if (!scroller || typeof MutationObserver === "undefined") return;
    const bring = () => {
      const ask = scroller.querySelector("[data-graview-asking]");
      ask?.scrollIntoView?.({ block: "nearest" });
    };
    const watch = new MutationObserver(bring);
    watch.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-graview-asking"] });
    return () => watch.disconnect();
  }, [open]);

  return (
    <aside
      ref={frame}
      aria-label={`The seat — about ${subject.name}`}
      data-testid="companion"
      data-graview-companion={open ? "open" : "shut"}
      data-graview-subject={subject.id ?? ""}
      data-graview-because={subject.because}
      // Chrome, not scene: no line is ever anchored to what this repeats.
      data-graview-offstage=""
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        zIndex: 40,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: "var(--graview-radius, 12px)",
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
        ...(framed
          ? { position: "static" as const, width: "auto", maxHeight: "100%", padding: "10px 12px" }
          : narrow
          ? { position: "absolute" as const, left: 10, right: 10, bottom: 10, maxHeight: open ? "min(58cqh, 420px)" : undefined, padding: open ? "10px 12px" : "6px 10px" }
          : {
              /*
               * DOCKED, NOT FLOATING. The layout keeps this rail clear of the
               * picture in every mode (see railInset), so the pane stands in
               * it as a column of the interface — the scene's height, a rule
               * down its right edge, no shadow — rather than as a card
               * dropped over the corner of the picture. The width is the
               * rail's share, so the two can never disagree.
               */
              position: "absolute" as const,
              left: 0,
              top: 0,
              bottom: 0,
              width: "min(264px, 22cqw)",
              padding: open ? "12px 12px 10px" : "10px 12px",
              borderRadius: 0,
              border: "none",
              borderRight: "1px solid var(--graview-edge)",
              boxShadow: "none",
              background: "var(--graview-bar)",
              ...(open ? { display: "grid" as const, gridTemplateRows: "auto minmax(0, 1fr) auto" } : {}),
            }),
        overflow: "hidden",
      }}
    >
      {/* THE SUBJECT, said in the header: what "this" means right now, and what the seat is doing about it. */}
      <button
        type="button"
        data-testid="companion-dock"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title={open ? "Put the seat away" : `Talk to the seat about ${subject.name}`}
        style={{
          all: "unset",
          outline: "revert-layer",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 8,
          minHeight: 32,
        }}
      >
        {/*
          * WHAT THIS IS ABOUT, said as a title with a word above it for why:
          * the thing you selected, the thing under the pointer, or the place
          * you are in. The seat's own state — "starter · listening" — was the
          * second line of every header and true of nothing a person needed;
          * it shows only while the seat is doing something.
          */}
        <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: subject.because === "selection" ? "var(--graview-accent)" : "var(--graview-ink-faint)" }}>
            {subject.because === "selection" ? "Selected" : subject.because === "hover" ? "Under the pointer" : "In view"}
          </span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--graview-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span data-testid="companion-subject">{subject.name}</span>
          </span>
          <span
            data-testid="companion-state"
            style={
              state.word === "listening"
                ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }
                : { fontSize: "0.75rem", color: state.tone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }
          >
            {name} · {state.word}
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && said && (robot?.mode === "refused" || robot?.mode === "asking") ? (
        <p data-testid="companion-said" style={{ margin: 0, fontSize: "0.8125rem", color: state.tone }}>
          {said}
        </p>
      ) : null}
      {open ? (
        <div
          ref={column}
          style={{
            display: "grid",
            /*
             * EVERY SECTION IS AS TALL AS ITS CONTENT, and the column
             * scrolls. Left to itself a grid with a definite height hands
             * each row a share of the space — and a row whose item has no
             * automatic minimum is compressed below what is in it, which
             * paints the conversation's chips and field straight over the
             * relations underneath. Rows sized by their content, packed at
             * the top, cannot do that: what does not fit is scrolled to.
             */
            gridAutoRows: "min-content",
            alignContent: "start",
            gap: 10,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {/* WHAT CAN BE DONE HERE — the same derivation the pointer menu reads. */}
          <Inspector placement="rail" />
          {/* WHAT IT RELATES TO. */}
          <QuickRelations<S> inside />
          {/* WHAT THE SEAT SAYS, with "this" meaning the subject above — in the column where the pane is a sheet; pinned at the foot where it is a rail. */}
          {chat && !docked ? conversation : null}
          {/*
            * WHAT THE SEAT DID, and the way back to it. The figure used to
            * walk to what it wrote and stand there; the marks say the same
            * thing where the change is, and this says it in words with a
            * press that takes the camera there — at altitude the district,
            * on the ground the thing itself.
            */}
          {/*
            * WHAT IT ASKED, listed where the answer will be given. The
            * question stands at its own node in the picture too; this is
            * the way back to it when the picture has moved on.
            */}
          {asking.length > 0 ? (
            <section data-testid="companion-asking" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-accent)" }}>
                {asking.length === 1 ? "It asked" : `It asked ${asking.length} things`}
              </span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                {asking.map((one) => (
                  <li key={one.participant} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 6, alignItems: "baseline" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={one.say}>
                      {one.say}
                    </span>
                    {one.at ? (
                      <button
                        type="button"
                        data-testid="companion-show-me"
                        data-graview-show={one.at}
                        aria-label={`Show me what ${one.who} is asking about`}
                        title="Show me what it is asking about"
                        onClick={() => showMe(one.at!)}
                        style={{ font: "inherit", fontSize: "0.75rem", minHeight: 24, padding: "0 8px", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {(() => {
                          const about = store.graph.getNode(one.at!);
                          return about ? labelOf(store.schema.tryDefinition(about.kind), about) : "Show me";
                        })()}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {work.acts.length > 0 ? (
            <section data-testid="companion-log" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)" }}>
                What it did
              </span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                {work.acts.slice(0, 4).map((act) => {
                  const first = act.wrote[0];
                  const node = first ? store.graph.getNode(first) : undefined;
                  return (
                    <li key={act.batch} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 6, alignItems: "baseline" }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={act.intent}>
                        {act.intent}
                      </span>
                      {node ? (
                        /* Named, not "Show me" three times: a row of identical labels is a list nobody can read. */
                        <button
                          type="button"
                          data-testid="companion-show-me"
                          data-graview-show={first}
                          aria-label={`Show me ${labelOf(store.schema.tryDefinition(node.kind), node)}`}
                          title={`Show me ${labelOf(store.schema.tryDefinition(node.kind), node)}`}
                          onClick={() => showMe(first!)}
                          style={{ font: "inherit", fontSize: "0.75rem", minHeight: 24, padding: "0 8px", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {labelOf(store.schema.tryDefinition(node.kind), node)}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {/* WHAT THE LINES MEAN, at the foot, where a map keeps its key. */}
          {anything ? (
            <details data-testid="companion-key">
              <summary style={{ cursor: "pointer", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)", minHeight: 24 }}>
                What the lines mean
              </summary>
              <RelationKey<S> inside />
            </details>
          ) : null}
        </div>
      ) : null}
      {open && chat && docked ? (
        <div style={{ paddingTop: 8, borderTop: "1px solid var(--graview-edge)", minWidth: 0 }}>{conversation}</div>
      ) : null}
    </aside>
  );
}
