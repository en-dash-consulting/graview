/*
 * A LISTENER CROSSES AS AN ID, AND IS LET GO (FR-68).
 *
 * A function cannot be cloned into a message, so each listener a worker
 * guest puts on a kit element goes to the host as `{ listener: id }`, and
 * the host hands the id back when the viewer raises the event. Remote DOM
 * makes one function per element and event, so a view that keeps adding
 * and removing elements would hold every one of them, and every element
 * they close over, for as long as the worker lives — and a press already
 * in flight when an element went would still reach it.
 *
 * So the runtime keeps, beside the records it sends, the outline of what
 * the host has drawn: each node's children and the listener ids on it. A
 * node that leaves the tree — removed, inside a removed subtree, or
 * replaced — and a listener taken away or changed give their ids back, and
 * an id given back reaches nothing. Ids only count up, so one never names
 * a second listener.
 */

/** Remote DOM's record format (`@remote-dom/core` constants, held to these by a test). */
const INSERT_CHILD = 0;
const REMOVE_CHILD = 1;
const UPDATE_PROPERTY = 3;
const EVENT_LISTENER = 3;
const ROOT_ID = "~";

export type Listener = (...args: unknown[]) => unknown;

/** A record as it goes to the host: plain data, each listener an id. */
export type Plain = string | number | boolean | null | undefined | { readonly listener: number } | readonly Plain[] | { readonly [key: string]: Plain };

interface Outline {
  readonly children: string[];
  readonly listeners: Map<string, number>;
}

export interface ListenerLedger {
  /** One batch of Remote DOM mutation records, as plain data for the host; what left the tree is let go. */
  encode(records: readonly unknown[]): Plain[];
  /** The listener an id names, while what it was on is drawn. */
  listener(id: number): Listener | undefined;
  /** How many listener ids are held. */
  readonly listening: number;
  /** How many nodes the host has drawn, as the runtime knows it. */
  readonly nodes: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Plain data, for anything but a listener's place: a function anywhere else
 * is no value the kit declares, and goes as nothing rather than as an id
 * nobody would ever let go.
 */
const plain = (value: unknown, depth = 0): Plain => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === undefined) return value;
  if (depth > 64 || typeof value !== "object") return undefined;
  if (Array.isArray(value)) return value.map((one) => plain(one, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, plain(one, depth + 1)]));
};

export function createListenerLedger(): ListenerLedger {
  const held = new Map<number, { readonly listener: Listener; count: number }>();
  const ids = new Map<Listener, number>();
  const outline = new Map<string, Outline>([[ROOT_ID, { children: [], listeners: new Map() }]]);
  let next = 0;

  const take = (listener: Listener): number => {
    let id = ids.get(listener);
    if (id === undefined) {
      id = next += 1;
      ids.set(listener, id);
      held.set(id, { listener, count: 0 });
    }
    held.get(id)!.count += 1;
    return id;
  };
  const give = (id: number) => {
    const one = held.get(id);
    if (!one) return;
    one.count -= 1;
    if (one.count > 0) return;
    held.delete(id);
    ids.delete(one.listener);
  };
  const forget = (id: string) => {
    const node = outline.get(id);
    if (!node) return;
    outline.delete(id);
    for (const listener of node.listeners.values()) give(listener);
    for (const child of node.children) forget(child);
  };

  /** A serialized node, kept in the outline when its parent is, with its listeners as ids. */
  const node = (raw: unknown, kept: boolean, depth = 0): Plain => {
    if (!isRecord(raw) || depth > 64) return plain(raw);
    const id = typeof raw["id"] === "string" ? raw["id"] : undefined;
    const keep = kept && id !== undefined && id !== ROOT_ID;
    if (keep) forget(id);
    const mine: Outline = { children: [], listeners: new Map() };
    if (keep) outline.set(id, mine);
    const out: Record<string, Plain> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key === "children" && Array.isArray(value)) {
        out[key] = value.map((child) => {
          const drawn = node(child, keep, depth + 1);
          if (keep && isRecord(child) && typeof child["id"] === "string") mine.children.push(child["id"]);
          return drawn;
        });
      } else if (key === "eventListeners" && isRecord(value)) {
        out[key] = Object.fromEntries(
          Object.entries(value).map(([event, listener]) => {
            if (typeof listener !== "function" || !keep) return [event, undefined];
            const taken = take(listener as Listener);
            mine.listeners.set(event, taken);
            return [event, { listener: taken }];
          }),
        );
      } else out[key] = plain(value, depth + 1);
    }
    return out;
  };

  const one = (record: unknown): Plain => {
    if (!Array.isArray(record)) return plain(record);
    const [type, id] = record as [unknown, unknown];
    const at = typeof id === "string" ? outline.get(id) : undefined;
    if (type === INSERT_CHILD) {
      const drawn = node(record[2], at !== undefined);
      const child = isRecord(record[2]) ? record[2]["id"] : undefined;
      if (at && typeof child === "string" && outline.has(child)) {
        const index = Number(record[3]);
        at.children.splice(Number.isInteger(index) && index >= 0 && index <= at.children.length ? index : at.children.length, 0, child);
      }
      return [type, plain(id), drawn, plain(record[3])];
    }
    if (type === REMOVE_CHILD) {
      const index = Number(record[2]);
      if (at && Number.isInteger(index) && index >= 0 && index < at.children.length) forget(at.children.splice(index, 1)[0]!);
      return plain(record);
    }
    if (type === UPDATE_PROPERTY && record[4] === EVENT_LISTENER) {
      const name = String(record[2]);
      const listener = record[3];
      /* Take the new one before giving back the old, so the same function keeps its id. */
      const taken = at && typeof listener === "function" ? take(listener as Listener) : undefined;
      const before = at?.listeners.get(name);
      if (before !== undefined) give(before);
      if (taken === undefined) at?.listeners.delete(name);
      else at!.listeners.set(name, taken);
      return [type, plain(id), name, taken === undefined ? undefined : { listener: taken }, EVENT_LISTENER];
    }
    return plain(record);
  };

  return {
    encode: (records) => records.map(one),
    listener: (id) => held.get(id)?.listener,
    get listening() {
      return held.size;
    },
    get nodes() {
      return outline.size - 1;
    },
  };
}
