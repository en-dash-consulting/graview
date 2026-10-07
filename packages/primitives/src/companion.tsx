import { labelOf, layer, placeSlug, type AnySchema } from "@graview/core";
import { withFocus } from "@graview/layout/view";
import { aggregateId, bandAggregateWords, kindOfCard, kindsOfAggregate } from "@graview/layout";
import { useGraview, useSeatWork, useSelection, type ReaderMemory } from "@graview/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatPanel } from "./chat.js";
import { QuickRelations } from "./quick-relations.js";
import { RelationKey } from "./relation-key.js";
import { Inspector } from "./workbench/index.js";
import { VISUALLY_HIDDEN } from "./primitives/index.js";

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
     * and while the scene is still traveling, the question is not asked.
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
    const kind = kindOfCard(id);
    if (kind) return store.schema.tryDefinition(kind)?.plural ?? kind;
    /* A group of several kinds is its plurals together, as the scene's own label says: "Blocks and Runs", never "block+duty". */
    const kinds = kindsOfAggregate(id);
    if (kinds.length > 0) {
      const plurals = kinds.map((one) => store.schema.tryDefinition(one)?.plural ?? one);
      return plurals.length === 1 ? plurals[0]! : `${plurals.slice(0, -1).join(", ")} and ${plurals.at(-1)}`;
    }
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

/**
 * The key a card answers with its acts. A letter, and only on the card that
 * has the keyboard — a character key bound to focus is not one a voice
 * user's dictation sets off by accident (WCAG 2.1.4).
 */
export const ACTS_KEY = "A";

const RULE = "1px solid var(--graview-edge)";

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
  /**
   * HOW IT STARTS (FR-78): `"open"`, `"collapsed"` to a slim tab at the
   * picture's edge, or `"hidden"` — no seat drawn at all. The reader's own
   * choice, once they have made one, is remembered and wins over the
   * start, except over `"hidden"`, which is the host's to make.
   */
  readonly start?: CompanionMode;
  /** The name the reader's choice is kept under — the app's, so two apps on one page each keep their own. */
  readonly rememberAs?: string;
}

/** Open, put away to a slim tab, or not drawn at all (FR-78). */
export type CompanionMode = "open" | "collapsed" | "hidden";

/** The slim tab the seat is put away to, in pixels: the picture has everything else. */
export const COMPANION_TAB = 36;

/** Narrower than this the open seat is laid over the picture rather than taking a column of it. */
export const COMPANION_OVERLAY_BELOW = 960;

const COMPANION_KEY = (app: string) => `graview:companion:${app}`;

/** What the reader chose last time for this app, if their browser lets the page remember. */
function remembered(memory: ReaderMemory | undefined, app: string | undefined): CompanionMode | null {
  if (!app) return null;
  try {
    const kept = (memory ?? localStorage).getItem(COMPANION_KEY(app));
    return kept === "open" || kept === "collapsed" ? kept : null;
  } catch {
    // A private window, a sandboxed frame: the start stands.
    return null;
  }
}

function remember(memory: ReaderMemory | undefined, app: string | undefined, mode: CompanionMode): void {
  if (!app) return;
  try {
    (memory ?? localStorage).setItem(COMPANION_KEY(app), mode);
  } catch {
    // Put away for this visit only.
  }
}

export function Companion<S extends AnySchema>({ respond, onCall, onPick, chat = true, framed = false, start, rememberAs }: CompanionProps<S> = {}) {
  const { seatWho, robots, session, store, setView: setViewOf, registerActsDoor, registerRail, memory } = useGraview<S>();
  const { set: chooseOf } = useSelection();
  const subject = useSubject<S>();
  /*
   * THE SEAT CAN BE PUT AWAY (FR-78). The rail took a fifth of the picture
   * on every screen whether anybody was talking to it or not. Put away, it
   * is a slim tab at the picture's edge and the city has the rest; the
   * reader's choice is remembered for this app. On a phone it is the sheet
   * along the bottom, which starts shut, as it always has.
   */
  const [mode, setModeState] = useState<CompanionMode>(() => (start === "hidden" ? "hidden" : (remembered(memory, rememberAs) ?? start ?? "open")));
  const [sheetOpen, setSheetOpen] = useState(false);
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
  /*
   * AND BELOW A LAPTOP'S WIDTH IT IS LAID OVER THE PICTURE rather than
   * taking a column of it: a column of 22% of a tablet's picture is a
   * column the city never gets back. The tab keeps its place at the edge.
   */
  const [shape, setShape] = useState<"column" | "overlay" | "sheet">("column");
  const narrow = shape === "sheet";
  const frame = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (framed) return;
    const element = frame.current?.parentElement;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      setShape(width < 640 ? "sheet" : width < COMPANION_OVERLAY_BELOW ? "overlay" : "column");
    };
    const watch = new ResizeObserver(measure);
    watch.observe(element);
    measure();
    return () => watch.disconnect();
  }, [mode === "hidden"]);
  const open = framed ? true : narrow ? sheetOpen : mode === "open";
  /** Opens or puts it away; a choice the reader made is kept for this app. */
  const setOpen = (next: boolean, kept = true) => {
    if (narrow) {
      setSheetOpen(next);
      return;
    }
    const to: CompanionMode = next ? "open" : "collapsed";
    setModeState(to);
    if (kept) remember(memory, rememberAs, to);
  };
  const tabbed = !framed && !narrow && mode !== "hidden" && (mode === "collapsed" || shape === "overlay");
  /*
   * WHAT THE SEAT TAKES OF THE PICTURE. As a column, the scene keeps its
   * proportional rail; as a tab, an overlay or nothing, the picture's own
   * box gives up only the tab (below) and the city lays out into the rest.
   */
  useEffect(() => {
    if (framed || narrow) return;
    registerRail(mode === "hidden" || tabbed ? 8 : null);
    return () => registerRail(null);
  }, [framed, narrow, mode, tabbed, registerRail]);
  useLayoutEffect(() => {
    const parent = frame.current?.parentElement;
    if (!parent || !tabbed) return;
    const before = parent.style.paddingLeft;
    parent.style.paddingLeft = `${COMPANION_TAB}px`;
    return () => {
      parent.style.paddingLeft = before;
    };
  }, [tabbed]);
  const tab = useRef<HTMLButtonElement | null>(null);
  /* The keyboard follows the control: put away from the header, it lands on the tab; opened from the tab, on the header. */
  const followTo = useRef<"tab" | "dock" | null>(null);
  useLayoutEffect(() => {
    const to = followTo.current;
    followTo.current = null;
    if (to === "tab") tab.current?.focus({ preventScroll: true });
    else if (to === "dock") dock.current?.focus({ preventScroll: true });
  });
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
  /*
   * AND THE KEYBOARD GETS THERE IN ONE KEY. Folded, the sheet's toggle sat a
   * dozen Tabs from the card the keyboard was on — past every other card
   * and the controls inside them — so every act from the keyboard on a
   * phone began with that walk. The scene's cards answer A instead, the way
   * a right-click is answered: the card chosen, the seat opened, and the
   * keyboard put on its first act. Put away again from the keyboard, the
   * keyboard goes back to the card it came from. The rail does the same
   * where it is already open, so a laptop's keyboard gets the short way too.
   */
  const cameFrom = useRef<HTMLElement | null>(null);
  const dock = useRef<HTMLButtonElement | null>(null);
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    // Hidden by the host, there is no seat to open: a card's acts stay at the pointer.
    if (framed || mode === "hidden") return;
    registerActsDoor({
      key: ACTS_KEY,
      open: (from) => {
        cameFrom.current = from;
        setOpen(true, false);
        setAsked((count) => count + 1);
      },
    });
    return () => registerActsDoor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framed, registerActsDoor, narrow, mode === "hidden"]);
  /* Whether the keyboard stands on a card, so the seat can say the key where it is seen. */
  const [onACard, setOnACard] = useState(false);
  useEffect(() => {
    if (framed || typeof document === "undefined") return;
    const watch = () => {
      const active = document.activeElement;
      setOnACard(active instanceof HTMLElement && active.closest("[data-graview-view][aria-keyshortcuts]") !== null);
    };
    document.addEventListener("focusin", watch);
    document.addEventListener("focusout", watch);
    return () => {
      document.removeEventListener("focusin", watch);
      document.removeEventListener("focusout", watch);
    };
  }, [framed]);
  const anything = store.graph.allEdges().length > 0;
  const docked = !narrow && !framed;
  const overlaid = docked && shape === "overlay";
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
  useEffect(() => {
    if (asked === 0) return;
    /*
     * The acts are derived after the choice the key made, so the first one
     * may be a frame or two behind the press: asked for a little while, and
     * only while the keyboard has not gone somewhere else meanwhile.
     */
    let tries = 12;
    let frame = 0;
    const land = () => {
      const active = document.activeElement;
      const stillThere = active === document.body || active === null || (active instanceof Node && cameFrom.current?.closest("[data-graview-view]")?.contains(active));
      if (!stillThere) return;
      const pane = column.current;
      const act = pane?.querySelector<HTMLElement>('[data-testid="affordances"] button:not([disabled])');
      if (act) {
        act.focus();
        return;
      }
      if (tries-- > 0) {
        frame = requestAnimationFrame(land);
        return;
      }
      // Nothing to do here: the first thing the seat holds, so the keyboard is in what opened.
      (pane?.querySelector<HTMLElement>("button:not([disabled]), input, select, textarea, summary") ?? dock.current)?.focus();
    };
    frame = requestAnimationFrame(land);
    return () => cancelAnimationFrame(frame);
  }, [asked]);

  /*
   * A REGION, NOT A LANDMARK INSIDE ONE (FR-40). The seat was an `<aside>`,
   * a complementary landmark, drawn inside the Shell's main and inside an
   * embed's own region, so axe's `landmark-complementary-is-top-level`
   * failed on every hosted app at every size. It lives in the picture it is
   * about, so it is a labeled region there, and what it holds are groups.
   */
  if (mode === "hidden" && !framed) return null;
  if (tabbed && !open) {
    /*
     * PUT AWAY: a slim tab at the picture's edge, the whole height of it,
     * and one control that opens the seat again.
     */
    return (
      <section
        ref={frame}
        aria-label={`The seat — about ${subject.name}`}
        data-testid="companion"
        data-graview-companion="shut"
        data-graview-companion-mode="collapsed"
        data-graview-subject={subject.id ?? ""}
        data-graview-offstage=""
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          zIndex: layer("rail"),
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: COMPANION_TAB,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 8,
          borderRight: RULE,
          background: "var(--graview-bar)",
        }}
      >
        <button
          type="button"
          ref={tab}
          data-testid="companion-tab"
          aria-expanded={false}
          aria-label={`Open the seat — about ${subject.name}`}
          title={`Open the seat — about ${subject.name}`}
          onClick={() => {
            followTo.current = "dock";
            setOpen(true);
          }}
          style={{ display: "grid", justifyItems: "center", gap: 8, width: 28, minHeight: 28, padding: "6px 0", borderRadius: 8, fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}
        >
          <span aria-hidden="true">◆</span>
          <span aria-hidden="true" style={{ writingMode: "vertical-rl", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.6875rem" }}>
            The seat
          </span>
        </button>
      </section>
    );
  }
  return (
    <section
      ref={frame}
      aria-label={`The seat — about ${subject.name}`}
      data-testid="companion"
      data-graview-companion={open ? "open" : "shut"}
      data-graview-companion-mode={narrow ? (open ? "open" : "collapsed") : mode}
      data-graview-companion-shape={framed ? "framed" : shape}
      data-graview-subject={subject.id ?? ""}
      data-graview-because={subject.because}
      // Chrome, not scene: no line is ever anchored to what this repeats.
      data-graview-offstage=""
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        zIndex: layer("rail"),
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: "var(--graview-radius, 12px)",
        /* Each side by itself: docking takes three away, and React warns when a shorthand and its longhands trade places. */
        borderTop: RULE,
        borderRight: RULE,
        borderBottom: RULE,
        borderLeft: RULE,
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
        ...(framed
          ? { position: "static" as const, width: "auto", maxHeight: "100%", padding: "10px 12px" }
          : narrow
          ? { position: "absolute" as const, left: 10, right: 10, bottom: 10, maxHeight: open ? "min(58cqh, 420px)" : undefined, padding: open ? "10px 12px" : "6px 10px" }
          : overlaid
          ? {
              /*
               * LAID OVER THE PICTURE, from the tab's edge: the floating
               * panel's look, the high lift, and the picture underneath
               * keeps its whole width.
               */
              position: "absolute" as const,
              left: 0,
              top: 0,
              bottom: 0,
              width: "min(300px, calc(100% - 48px))",
              padding: "12px 12px 10px",
              borderRadius: 0,
              borderTop: "none",
              borderBottom: "none",
              borderLeft: "none",
              display: "grid" as const,
              gridTemplateRows: "auto minmax(0, 1fr) auto",
            }
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
              borderTop: "none",
              borderBottom: "none",
              borderLeft: "none",
              boxShadow: "none",
              background: "var(--graview-bar)",
              ...(open ? { display: "grid" as const, gridTemplateRows: "auto minmax(0, 1fr) auto" } : {}),
            }),
        overflow: "hidden",
      }}
    >
      {/* A HEADING FOR THE REGION (FR-25): a reader moving by headings finds the seat, named as its landmark is. Out of the grid's flow. */}
      <h2 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>The seat — about {subject.name}</h2>
      {/* THE SUBJECT, said in the header: what "this" means right now, and what the seat is doing about it. */}
      <button
        type="button"
        ref={dock}
        data-testid="companion-dock"
        aria-expanded={open}
        onClick={(event) => {
          // Put away from the header where there is a tab to put it away to, the keyboard lands on the tab.
          if (open && !narrow) followTo.current = "tab";
          setOpen(!open);
          /*
           * Put away from the keyboard (a click no pointer made), the
           * keyboard goes back to the card the key brought it from rather
           * than staying on a toggle at the foot of the screen.
           */
          const back = cameFrom.current;
          cameFrom.current = null;
          if (open && narrow && event.detail === 0 && back?.isConnected) back.focus({ preventScroll: true });
        }}
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
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
          {/*
            * THE KEY, said where it can be seen, beside the toggle it saves
            * the walk to — only while the keyboard stands on a card, the one
            * place it works, and on the header's own line, so saying it never
            * makes the sheet taller and the picture move.
            */}
          {onACard ? (
            <span data-testid="companion-acts-key" style={{ color: "var(--graview-ink-muted)", whiteSpace: "nowrap" }}>
              <kbd style={{ font: "inherit", fontWeight: 600, padding: "0 4px", border: "1px solid var(--graview-edge)", borderRadius: 4 }}>{ACTS_KEY}</kbd> its acts
            </span>
          ) : null}
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
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
    </section>
  );
}
