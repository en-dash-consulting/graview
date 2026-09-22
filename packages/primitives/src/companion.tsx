import { labelOf, placeSlug, type AnySchema } from "@graview/core";
import { isAggregateId, kindOfCard } from "@graview/layout";
import { useGraview, useScenePointer, useSelection } from "@graview/react";
import { useEffect, useRef, useState } from "react";
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
  const { store, view, views } = useGraview<S>();
  const { selection } = useSelection();
  const point = useScenePointer();
  const [dwelt, setDwelt] = useState<string | null>(null);
  useEffect(() => {
    if (!point) {
      setDwelt(null);
      return;
    }
    const stage = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("[data-graview-stage]");
    const timer = setTimeout(() => setDwelt(pickAt(stage, point)), DWELL_MS);
    return () => clearTimeout(timer);
  }, [point]);

  const name = (id: string): string | null => {
    const node = store.graph.getNode(id);
    if (node) return labelOf(store.schema.tryDefinition(node.kind), node as never);
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
  /** Whether a conversation is offered at all. An app with no seat still gets the acts and the relations. */
  readonly chat?: boolean;
}

export function Companion<S extends AnySchema>({ respond, onCall, chat = true }: CompanionProps<S> = {}) {
  const { seatWho, robots, session, store } = useGraview<S>();
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
    const element = frame.current?.parentElement;
    if (!element || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => setNarrow(element.getBoundingClientRect().width < 640));
    watch.observe(element);
    setNarrow(element.getBoundingClientRect().width < 640);
    return () => watch.disconnect();
  }, []);
  useEffect(() => {
    if (narrow) setOpen(false);
  }, [narrow]);
  const anything = store.graph.allEdges().length > 0;
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
        position: "absolute",
        zIndex: 40,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: "var(--graview-radius, 12px)",
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
        ...(narrow
          ? { left: 10, right: 10, bottom: 10, maxHeight: open ? "min(58cqh, 420px)" : undefined, padding: open ? "10px 12px" : "6px 10px" }
          : {
              left: 14,
              top: 14,
              width: 264,
              maxHeight: "calc(100% - 28px)",
              padding: open ? "10px 12px" : "6px 10px",
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
        <span aria-hidden="true" style={{ fontSize: "0.9375rem", color: state.tone }}>
          ◆
        </span>
        <span style={{ display: "grid", gap: 0, minWidth: 0 }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span data-testid="companion-subject">{subject.name}</span>
          </span>
          <span data-testid="companion-state" style={{ fontSize: "0.6875rem", color: state.tone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name} · {state.word}
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: "0.6875rem", color: "var(--graview-ink-faint)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && said && (robot?.mode === "refused" || robot?.mode === "asking") ? (
        <p data-testid="companion-said" style={{ margin: 0, fontSize: "0.75rem", color: state.tone }}>
          {said}
        </p>
      ) : null}
      {open ? (
        <div ref={column} style={{ display: "grid", gap: 10, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
          {/* WHAT CAN BE DONE HERE — the same derivation the pointer menu reads. */}
          <Inspector placement="rail" />
          {/* WHAT IT RELATES TO. */}
          <QuickRelations<S> inside />
          {/* WHAT THE SEAT SAYS, with "this" meaning the subject above. */}
          {chat ? (
            <ChatPanel<S>
              inside
              {...(respond ? { respond } : {})}
              {...(onCall ? { onCall } : {})}
            />
          ) : null}
          {/* WHAT THE LINES MEAN, at the foot, where a map keeps its key. */}
          {anything ? (
            <details data-testid="companion-key">
              <summary style={{ cursor: "pointer", fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)", minHeight: 24 }}>
                What the lines mean
              </summary>
              <RelationKey<S> inside />
            </details>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
