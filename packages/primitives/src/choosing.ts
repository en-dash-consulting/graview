import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from "react";

/*
 * CHOOSING SEVERAL RECORDS ON A LIST.
 *
 * A list's rows are each the way to one record; acting on six of them was
 * six rounds. Choosing is how a person says "these": a box at the start of
 * each row (on a desk, shown as the pointer or the keyboard reaches the row,
 * and always once one is chosen), Shift with a press to choose everything
 * between, Cmd/Ctrl-A for the whole list, Escape to put the choice down —
 * and on a phone, a long press on a row, after which a tap chooses rather
 * than opens. The boxes are ONE stop for Tab, wherever the keyboard last
 * was among them (a roving tab stop): the arrows move between the rows'
 * boxes, Home and End to the first and the last, Space chooses the row it
 * is on, and Shift with an arrow chooses every row from where the choosing
 * began to the one it moves to — three records are a Tab, Space, two
 * arrows and two Spaces. What is done with the chosen is the selection bar's
 * (`several-bar.tsx`), fetched with the first one chosen: a list nobody
 * chooses from carries this and nothing more.
 *
 * Each row says which record it is with `data-graview-choose`, and the list
 * hands its events to `listProps`: one set of listeners for every row.
 */

/** How long a finger rests on a row before it is chosen: shorter than a phone's own menu, longer than a scroll's start. */
export const LONG_PRESS_MS = 450;
/** How far a finger may wander and still be resting. */
const LONG_PRESS_SLOP = 10;

export interface Choosing {
  /** The chosen records, in the list's order. */
  readonly chosen: readonly string[];
  readonly has: (id: string) => boolean;
  /** Chooses or puts down one record; with `range`, everything from the last one pressed to this one, as it now is. */
  readonly toggle: (id: string, range?: boolean) => void;
  /** Chooses exactly these. */
  readonly choose: (ids: readonly string[]) => void;
  readonly clear: () => void;
  /** What the list's own element takes: the keys, the long press, and a tap that chooses while choosing. */
  readonly listProps: {
    readonly ref: RefObject<HTMLElement | null>;
    readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
    readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    readonly onPointerUp: () => void;
    readonly onPointerCancel: () => void;
    readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void;
    readonly onContextMenu: (event: MouseEvent<HTMLElement>) => void;
    readonly "data-graview-choosing"?: "";
  };
  /** A row's box: checked, named for its record, Shift-click a range. */
  readonly boxProps: (id: string, label: string) => InputHTMLAttributes<HTMLInputElement> & { readonly "data-graview-choose-box": string };
  /** The list, to give the keyboard back to once an act has run. */
  readonly list: RefObject<HTMLElement | null>;
}

/** The record a row's box chooses, when the target is one. */
const boxOf = (target: EventTarget | null): string | undefined => (target instanceof HTMLInputElement ? (target.dataset["graviewChooseBox"] ?? undefined) : undefined);
/** The arrows' moves along the list, by key. */
const STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: -Infinity, End: Infinity };

const rowOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>("[data-graview-choose]") : null);
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || (target instanceof HTMLInputElement && target.type !== "checkbox") || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement);

/** A list's choice of records: `order` is the records as the list shows them, which a range and Cmd/Ctrl-A read. */
export function useChoosing(order: readonly string[]): Choosing {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const anchor = useRef<string | null>(null);
  const list = useRef<HTMLElement | null>(null);
  // The one box Tab stops at: the last the keyboard was on, else the first row's.
  const [at, setAt] = useState<string | null>(null);
  const stopAt = at !== null && order.includes(at) ? at : order[0];
  // Only what is still on the list is chosen: a record arranged away or gone is put down.
  const chosen = useMemo(() => order.filter((id) => picked.has(id)), [order, picked]);
  const shown = useMemo(() => new Set(order), [order]);
  useEffect(() => {
    if ([...picked].some((id) => !shown.has(id))) setPicked((now) => new Set([...now].filter((id) => shown.has(id))));
  }, [shown, picked]);
  const toggle = useCallback(
    (id: string, range = false) => {
      // Read now: the update below runs as the list draws again, by when the last press is this one.
      const last = anchor.current;
      setPicked((now) => {
        const next = new Set(now);
        const from = last === null ? -1 : order.indexOf(last);
        const to = order.indexOf(id);
        if (range && from >= 0 && to >= 0) {
          // A range takes the state the last press gave: from a chosen row, everything between is chosen.
          const on = now.has(last!);
          for (const one of order.slice(Math.min(from, to), Math.max(from, to) + 1)) on ? next.add(one) : next.delete(one);
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      anchor.current = id;
    },
    [order],
  );
  const choose = useCallback((ids: readonly string[]) => setPicked(new Set(ids)), []);
  const clear = useCallback(() => {
    anchor.current = null;
    setPicked(new Set());
  }, []);

  /* THE LONG PRESS: a finger resting on a row chooses it; a tap after that chooses, and the press that chose opens nothing. */
  const press = useRef<{ id: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const swallow = useRef(false);
  const choosing = chosen.length > 0;
  const stop = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => stop, []);
  const listProps: Choosing["listProps"] = {
    ref: list,
    onKeyDown: (event) => {
      if (typing(event.target)) return;
      // The arrows move between the rows' boxes; with Shift, the rows passed are chosen.
      const on = boxOf(event.target);
      /*
       * TAB FROM A BOX GOES TO WHAT IS DONE WITH THE CHOSEN (the eleventh
       * walk). The bar is a notice in the top layer, after the list in the
       * document, so three animals chosen from the keyboard took 49 Tabs
       * through every row after them to reach "Put on hold" (the gauntlet's
       * talks, 64) where the pointer took one press. The boxes are one Tab
       * stop; while something is chosen, the next stop is the bar's first act.
       */
      if (event.key === "Tab" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && on !== undefined && choosing) {
        const bar = document.querySelector<HTMLElement>('[data-testid="several-bar"]');
        const first = bar?.querySelector<HTMLElement>("[data-mutation]:not([disabled])") ?? bar?.querySelector<HTMLElement>("button:not([disabled])");
        if (first) {
          event.preventDefault();
          event.stopPropagation();
          first.focus();
          return;
        }
      }
      const step = STEPS[event.key];
      if (on !== undefined && step !== undefined && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const from = order.indexOf(on);
        const to = order[Math.max(0, Math.min(order.length - 1, from + (Number.isFinite(step) ? step : step > 0 ? order.length : -order.length)))];
        event.preventDefault();
        event.stopPropagation();
        if (to === undefined || to === on) return;
        if (event.shiftKey) {
          const start = anchor.current !== null && order.includes(anchor.current) ? anchor.current : on;
          const [a, b] = [order.indexOf(start), order.indexOf(to)].sort((x, y) => x - y);
          setPicked((now) => new Set([...now, ...order.slice(a, b! + 1)]));
          anchor.current = start;
        }
        setAt(to);
        list.current?.querySelector<HTMLInputElement>(`[data-graview-choose-box="${CSS.escape(to)}"]`)?.focus();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        event.stopPropagation();
        choose(order);
        return;
      }
      // Space on a row's own control chooses it, where it is not the control's own key.
      if (event.key === " " && !event.metaKey && !event.ctrlKey) {
        const row = rowOf(event.target);
        const own = event.target instanceof HTMLButtonElement || (event.target instanceof HTMLInputElement && event.target.type === "checkbox");
        if (!row || own) return;
        event.preventDefault();
        toggle(row.dataset["graviewChoose"]!, event.shiftKey);
      }
    },
    onFocus: (event) => {
      const on = boxOf(event.target);
      if (on !== undefined) setAt(on);
    },
    onPointerDown: (event) => {
      swallow.current = false;
      if (event.pointerType === "mouse" || event.button > 0) return;
      const row = rowOf(event.target);
      if (!row || (event.target instanceof HTMLInputElement && event.target.type === "checkbox")) return;
      const id = row.dataset["graviewChoose"]!;
      stop();
      press.current = {
        id,
        x: event.clientX,
        y: event.clientY,
        timer: setTimeout(() => {
          press.current = null;
          swallow.current = true;
          toggle(id);
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove: (event) => {
      const at = press.current;
      if (at && Math.hypot(event.clientX - at.x, event.clientY - at.y) > LONG_PRESS_SLOP) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onClickCapture: (event) => {
      const row = rowOf(event.target);
      if (!row) return;
      const box = event.target instanceof HTMLInputElement && event.target.type === "checkbox" && event.target.hasAttribute("data-graview-choose-box");
      // The box's own press is the box's (it stops there, so neither the row nor the scene hears it).
      if (box) return;
      if (swallow.current) {
        // The press that chose by resting opens nothing.
        swallow.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const id = row.dataset["graviewChoose"]!;
      if (event.shiftKey && (choosing || anchor.current !== null)) {
        event.preventDefault();
        event.stopPropagation();
        toggle(id, true);
        return;
      }
      // While choosing on a phone, a tap chooses rather than opens.
      if (choosing && matchMedia?.("(pointer: coarse)").matches) {
        event.preventDefault();
        event.stopPropagation();
        toggle(id);
      }
    },
    onContextMenu: (event) => {
      // A finger resting on a row chooses it; the phone's own menu, and the scene's, are not opened by the same press.
      if (swallow.current || press.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    ...(choosing ? { "data-graview-choosing": "" as const } : {}),
  };
  const has = useCallback((id: string) => picked.has(id), [picked]);
  const boxProps: Choosing["boxProps"] = (id, label) => ({
    type: "checkbox",
    className: "graview-choose-box",
    "data-graview-choose-box": id,
    "aria-label": `Choose ${label}`,
    // One stop for Tab among the boxes: the arrows go from it to the rest.
    tabIndex: id === stopAt ? 0 : -1,
    checked: picked.has(id),
    onChange: () => undefined,
    onClick: (event) => {
      event.stopPropagation();
      toggle(id, event.shiftKey);
    },
  });
  return { chosen, has, toggle, choose, clear, listProps, boxProps, list };
}

/*
 * THE BOXES' LOOK, shared by every list that chooses. On a desk the box
 * stands in a column of its own at each row's start, shown as the pointer
 * or the keyboard reaches its row and always once anything is chosen; on a
 * phone the column opens only once a long press has chosen something.
 */
export const CHOOSING_CSS = `
.graview-choose-box{width:24px;height:24px;margin:0;accent-color:var(--graview-accent);cursor:pointer;opacity:0}
[data-graview-choose]:hover .graview-choose-box,[data-graview-choose]:focus-within .graview-choose-box,.graview-choose-box:focus-visible,.graview-choose-box:checked,[data-graview-choosing] .graview-choose-box{opacity:1}
[data-graview-choose]{-webkit-touch-callout:none}
[data-graview-choosing] [data-graview-choose]{-webkit-user-select:none;user-select:none}
`;
