/**
 * WHERE A DRAWING ANOTHER HAND MADE SHOWS ITS RECORDS (Graview HQ
 * feature:f-one-face-lines-from-frame-views).
 *
 * The one face draws a line from each record a page shows to that record's
 * building, read off the page's own marks. A view drawn somewhere the page
 * cannot read — a worker view's shadow root, a frame guest's document —
 * says which records it shows, and where, through the element it is drawn
 * in instead: that element wears `data-graview-record-boxes`, holds what
 * it says under `RECORD_BOXES`, and raises `RECORD_BOXES_MOVED` when the
 * records it shows change. What it answers its host has already judged.
 */

/** The key what an element says is held under: one symbol for every copy of the framework on a page. */
export const RECORD_BOXES: unique symbol = Symbol.for("graview.record-boxes") as never;

/** The event the element raises (bubbling, composed) when the records it shows change: a list of them is read again. */
export const RECORD_BOXES_MOVED = "graview-record-boxes";

/** The attribute the element wears while it holds one: what a page finds them by. */
export const RECORD_BOXES_ATTRIBUTE = "data-graview-record-boxes";

/** One record a view drew, in sight, in the element's own CSS pixels from its border box's top left, before any transform of the page. */
export interface RecordBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What an element answers. */
export interface RecordBoxesHeld {
  /** The records it shows that are in sight now, each where it is, in the order it drew them. */
  boxes(): readonly RecordBox[];
  /** Every record it shows, in sight or not: what a list beside it need not say again. */
  shows(): readonly string[];
}

/** An element, as far as holding one takes: core is read where there is no DOM. */
export interface RecordBoxesHolder {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  dispatchEvent(event: never): boolean;
  readonly ownerDocument: { readonly defaultView: { readonly Event: new (type: string, init?: { bubbles?: boolean; composed?: boolean }) => unknown } | null } | null;
}

/** What an element holds, if it holds anything. */
export function recordBoxesOf(element: object): RecordBoxesHeld | undefined {
  const held = (element as unknown as Record<symbol, unknown>)[RECORD_BOXES] as Partial<RecordBoxesHeld> | undefined;
  return held && typeof held.boxes === "function" && typeof held.shows === "function" ? (held as RecordBoxesHeld) : undefined;
}

/** Give an element what it says, or take it away (`undefined`). */
export function holdRecordBoxes(element: RecordBoxesHolder, held: RecordBoxesHeld | undefined): void {
  const holder = element as unknown as Record<symbol, unknown>;
  if (held) {
    Object.defineProperty(holder, RECORD_BOXES, { value: held, configurable: true, enumerable: false, writable: true });
    element.setAttribute(RECORD_BOXES_ATTRIBUTE, "");
  } else {
    delete holder[RECORD_BOXES];
    element.removeAttribute(RECORD_BOXES_ATTRIBUTE);
  }
}

/** Say the records an element shows changed. */
export function recordBoxesMoved(element: RecordBoxesHolder): void {
  const Event = element.ownerDocument?.defaultView?.Event;
  if (Event) element.dispatchEvent(new Event(RECORD_BOXES_MOVED, { bubbles: true, composed: true }) as never);
}

/** The most boxes an element is believed: past it, the rest are not read. */
export const MOST_RECORD_BOXES = 200;

export interface JudgeRecordBoxesInput {
  /** The element's size now, in its own CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Whether a record is one the view may name here. */
  readonly sees: (id: string) => boolean;
  /** The most kept. `MOST_RECORD_BOXES` by default. */
  readonly most?: number;
}

const idOk = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 200;

/**
 * WHAT A VIEW SAID OF ITS RECORDS, JUDGED: plain boxes inside the element,
 * of records it may name, no more than the most, and nothing else of what
 * it said.
 */
export function judgeRecordBoxes(said: unknown, input: JudgeRecordBoxesInput): readonly RecordBox[] {
  if (!Array.isArray(said)) return [];
  const most = Math.max(0, Math.min(input.most ?? MOST_RECORD_BOXES, MOST_RECORD_BOXES));
  const width = Number.isFinite(input.width) ? Math.max(0, input.width) : 0;
  const height = Number.isFinite(input.height) ? Math.max(0, input.height) : 0;
  const kept: RecordBox[] = [];
  const read = Math.min(said.length, most * 2);
  for (let at = 0; at < read && kept.length < most; at++) {
    const one: unknown = said[at];
    if (!one || typeof one !== "object" || Array.isArray(one)) continue;
    const { id, x, y, width: w, height: h } = one as Record<string, unknown>;
    if (!idOk(id)) continue;
    if (typeof x !== "number" || typeof y !== "number" || typeof w !== "number" || typeof h !== "number") continue;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    const left = Math.max(0, Math.min(width, x));
    const top = Math.max(0, Math.min(height, y));
    const right = Math.max(0, Math.min(width, x + w));
    const bottom = Math.max(0, Math.min(height, y + h));
    if (right - left < 1 || bottom - top < 1) continue;
    if (!input.sees(id)) continue;
    kept.push({ id, x: left, y: top, width: right - left, height: bottom - top });
  }
  return kept;
}

/** The records a view said it shows, judged as its boxes are: ids it may name, each once, no more than the most. */
export function judgeRecordIds(said: unknown, sees: (id: string) => boolean, most = MOST_RECORD_BOXES): readonly string[] {
  if (!Array.isArray(said)) return [];
  const kept = new Set<string>();
  const cap = Math.max(0, Math.min(most, MOST_RECORD_BOXES));
  const read = Math.min(said.length, cap * 2);
  for (let at = 0; at < read && kept.size < cap; at++) {
    const id: unknown = said[at];
    if (idOk(id) && !kept.has(id) && sees(id)) kept.add(id);
  }
  return [...kept];
}
