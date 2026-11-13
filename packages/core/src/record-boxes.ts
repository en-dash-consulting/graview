/**
 * WHERE A DRAWING ANOTHER HAND MADE SHOWS ITS RECORDS (Graview HQ
 * feature:f-one-face-lines-from-frame-views).
 *
 * The one face draws a line from each record a page shows to that record's
 * building, read off the page's own marks. A view drawn somewhere the page
 * cannot read — a worker view's shadow root, a frame guest's document on
 * another origin — says where its records are through the element it is
 * drawn in instead: that element wears `data-graview-record-boxes`, holds
 * the reader under `RECORD_BOXES`, and raises `RECORD_BOXES_MOVED` when
 * the records it shows change. What the reader answers its host has
 * already judged: records the seat may see, inside the element, a bounded
 * number of them.
 */

/** The key the reader is held under, on the element a view is drawn in: one symbol for every copy of the framework on a page. */
export const RECORD_BOXES: unique symbol = Symbol.for("graview.record-boxes") as never;

/** The event the element raises (bubbling, composed) when the records it shows change: a list of them is read again. */
export const RECORD_BOXES_MOVED = "graview-record-boxes";

/** The attribute the element wears while it holds a reader: what a page finds them by. */
export const RECORD_BOXES_ATTRIBUTE = "data-graview-record-boxes";

/** One record a view drew, in the element's own CSS pixels from its border box's top left, before any transform of the page. */
export interface RecordBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What an element answers: the records it shows now, in the order it drew them. */
export type RecordBoxesReader = () => readonly RecordBox[];

/** An element, as far as holding a reader takes one: core is read where there is no DOM. */
export interface RecordBoxesHolder {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  dispatchEvent(event: never): boolean;
  readonly ownerDocument: { readonly defaultView: { readonly Event: new (type: string, init?: { bubbles?: boolean; composed?: boolean }) => unknown } | null } | null;
}

/** The reader an element holds, if it holds one. */
export function recordBoxesOf(element: object): RecordBoxesReader | undefined {
  const reader = (element as unknown as Record<symbol, unknown>)[RECORD_BOXES];
  return typeof reader === "function" ? (reader as RecordBoxesReader) : undefined;
}

/** Give an element a reader, or take it away (`undefined`). */
export function holdRecordBoxes(element: RecordBoxesHolder, reader: RecordBoxesReader | undefined): void {
  const holder = element as unknown as Record<symbol, unknown>;
  if (reader) {
    Object.defineProperty(holder, RECORD_BOXES, { value: reader, configurable: true, enumerable: false, writable: true });
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
  /** The element's size now, in its own CSS pixels: every box is clamped inside it. */
  readonly width: number;
  readonly height: number;
  /** Whether the seat may see a record. A box naming any other is dropped, said to nobody. */
  readonly sees: (id: string) => boolean;
  /** The most kept. `MOST_RECORD_BOXES` by default. */
  readonly most?: number;
}

/**
 * WHAT A VIEW SAID OF ITS RECORDS, JUDGED: only a list of plain boxes,
 * each a record id of reasonable length the seat may see, with finite
 * numbers, clamped to the element and with some area left; the first
 * `most` kept and no more read. Nothing it said goes further than this:
 * no other key, no other value, and nothing back to the view.
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
    if (typeof id !== "string" || id.length === 0 || id.length > 200) continue;
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
