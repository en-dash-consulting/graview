import { labelOf, placeSlug, type AnySchema } from "@graview/core";
import { bandAggregateWords, kindOfCard, kindsOfAggregate } from "@graview/layout";
import { useGraview, useSelection } from "@graview/react";
import { useEffect, useState } from "react";

/*
 * The seat's subject, on its own so what the seat holds (the conversation,
 * what it offers) can ask what "this" means without importing the seat.
 */

/** What the seat is about, and how it came to be about it. */
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
export function useSubject<S extends AnySchema>({ hover = true }: { readonly hover?: boolean } = {}): Subject {
  const { store, view, views, pointer } = useGraview<S>();
  const { selection } = useSelection();
  const [dwelt, setDwelt] = useState<string | null>(null);
  /*
   * THE POINTER IS WATCHED, NOT SUBSCRIBED TO.
   *
   * Reading it the ordinary way — `useScenePointer`, a store subscription
   * React re-renders on — re-rendered the whole panel on every pointer
   * move: the acts, the relations, the conversation and the key, sixty
   * times a second, for a subject that changes when you stop rather than
   * while you move. The moves are taken here without a render; only what
   * the pointer SETTLED on is state, and only when it is a different
   * thing from last time.
   */
  useEffect(() => {
    // Asked without the pointer: what is chosen, else where you are.
    if (!hover) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let handOn = false;
    /*
     * AND NOT WHILE THE PICTURE IS MOVING UNDER THE POINTER.
     *
     * Dragging the city slides one district after another past a pointer
     * that never moved, and the subject chased every one of them: the
     * panel's header, its acts and its relations flickered through the
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
  }, [pointer, hover]);

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
