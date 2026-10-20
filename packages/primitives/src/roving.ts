import { useCallback, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from "react";

/*
 * A GROUP THAT IS ONE STOP FOR TAB (a roving tab stop).
 *
 * A chosen card's acts were two Tab stops each — the act and its pin — so
 * the eleventh act of a menu was twenty-one Tabs from the key that opened it,
 * where the pointer pressed it once; an ask's twenty choices were twenty
 * Tabs (walks XI and XII, `pnpm verify journeys`). A group of this kind is
 * one stop: Tab enters it on the item the keyboard last stood on, the arrows
 * move between its items, Home and End to the first and the last, and —
 * where the group says it takes letters — a letter moves to the next item
 * whose words begin with it, as a menu's type-ahead does. Tab leaves it.
 *
 * The group says what it is (`data-graview-roving`, "letters" when it takes
 * them) and its items say they are its (`data-graview-roving-item`), so a
 * person's way through it can be read off the page: the journeys walk it
 * with the arrows, not with Tab. Which item holds the stop is kept in the
 * page, not in React: the group's items come and go as it draws, and after
 * each draw exactly one of them — the one the keyboard is on, else the one it
 * was last on, else the first — takes Tab.
 */

/** The attribute a group says it is one Tab stop with: "letters" when a letter moves to an item, else "". */
export const ROVING = "data-graview-roving";
/** The attribute each of its items carries. */
export const ROVING_ITEM = "data-graview-roving-item";

/** Which way the arrows move: down a column only, or along a row that wraps too. */
export type RovingFlow = "column" | "both";

const STEPS: Readonly<Record<string, Readonly<Record<RovingFlow, number>>>> = {
  ArrowDown: { column: 1, both: 1 },
  ArrowUp: { column: -1, both: -1 },
  ArrowRight: { column: 0, both: 1 },
  ArrowLeft: { column: 0, both: -1 },
};

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && !["button", "checkbox", "radio", "submit"].includes(target.type)));

/** The group's own items, in the order they are drawn, leaving out what is disabled or in a group inside it. */
export function rovingItems(group: HTMLElement): HTMLElement[] {
  return [...group.querySelectorAll<HTMLElement>(`[${ROVING_ITEM}]`)].filter(
    (item) => item.closest(`[${ROVING}]`) === group && !(item as HTMLButtonElement).disabled && item.getAttribute("aria-hidden") !== "true",
  );
}

/** The words an item begins with, as a person reads it: its own text, else its name. */
const wordsOf = (item: HTMLElement) => (item.textContent?.trim() || item.getAttribute("aria-label") || "").toLowerCase();

/**
 * One Tab stop for the group `ref` holds. Spread `onKeyDown` on the group
 * (and `data-graview-roving`), and mark each item `data-graview-roving-item`.
 */
export function useRoving<T extends HTMLElement>({ flow = "column", letters = false }: { readonly flow?: RovingFlow; readonly letters?: boolean } = {}): {
  readonly ref: RefObject<T | null>;
  readonly onKeyDown: (event: KeyboardEvent<T>) => void;
  readonly onFocus: (event: FocusEvent<T>) => void;
  readonly [ROVING]: string;
} {
  const ref = useRef<T | null>(null);
  // The item the keyboard was last on, while it is still drawn.
  const last = useRef<HTMLElement | null>(null);
  const settle = useCallback(() => {
    const group = ref.current;
    if (!group) return;
    const items = rovingItems(group);
    if (items.length === 0) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    const on = items.find((item) => item === active) ?? (last.current && items.includes(last.current) ? last.current : items[0]!);
    for (const item of items) {
      const want = item === on ? "0" : "-1";
      if (item.getAttribute("tabindex") !== want) item.setAttribute("tabindex", want);
    }
  }, []);
  // After every draw: the items it drew are what hold the stop now.
  useLayoutEffect(settle);
  const move = (to: HTMLElement | undefined) => {
    if (!to) return;
    last.current = to;
    to.focus();
    settle();
  };
  return {
    ref,
    [ROVING]: letters ? "letters" : "",
    onFocus: (event) => {
      const item = (event.target as HTMLElement).closest?.<HTMLElement>(`[${ROVING_ITEM}]`);
      if (item && item.closest(`[${ROVING}]`) === ref.current && last.current !== item) {
        last.current = item;
        settle();
      }
    },
    onKeyDown: (event) => {
      const group = ref.current;
      if (!group || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      const items = rovingItems(group);
      const from = items.findIndex((item) => item === event.target || item.contains(event.target as Node));
      if (from < 0) return;
      const step = STEPS[event.key]?.[flow];
      if (step) {
        event.preventDefault();
        event.stopPropagation();
        move(items[Math.max(0, Math.min(items.length - 1, from + step))]);
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        move(event.key === "Home" ? items[0] : items[items.length - 1]);
        return;
      }
      if (letters && event.key.length === 1 && event.key.trim() !== "") {
        const letter = event.key.toLowerCase();
        // The next one after this that begins with it, round to the start.
        const after = [...items.slice(from + 1), ...items.slice(0, from + 1)].find((item) => wordsOf(item).startsWith(letter));
        if (!after) return;
        event.preventDefault();
        event.stopPropagation();
        move(after);
      }
    },
  };
}
