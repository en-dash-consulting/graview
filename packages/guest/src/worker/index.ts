/*
 * A GUEST VIEW IN A WORKER (FR-68): `@graview/guest/worker`.
 *
 * Where a frame cannot be nested — a chat's widget, whose own sandbox will
 * not frame another origin — a view somebody else wrote runs in a classic
 * Web Worker the host starts from a `blob:` URL. This entry is the guest's
 * whole runtime there, and it must be the first thing the worker runs:
 *
 *   1. it keeps, for itself, how to hear the host and say ready (natives.ts);
 *   2. it boots Remote DOM's DOM polyfill, so the guest has a `document`;
 *   3. it defines the component kit as remote elements (kit.ts, elements.ts);
 *   4. it hardens the worker's global before guest code runs (harden.ts);
 *   5. it offers the guest the same API a frame guest has — props in,
 *      `act`, `navigate`, `size` — and a `root` to draw the kit into.
 *
 * The protocol is FR-04's (protocol.ts): ready, a hello with a nonce and a
 * port, and everything after over the port. What the guest draws goes to
 * the host as Remote DOM mutation records, and the host draws only the kit.
 */
import { natives } from "./natives.js";
import "@remote-dom/core/polyfill";
import { RemoteRootElement } from "@remote-dom/core/elements";
import { openGuest, type Guest } from "../channel.js";
import { GUEST_KIT } from "../kit.js";
import { defineKit } from "./elements.js";

/** The element a worker guest draws into; the host's container stands for it. */
export const GUEST_ROOT = "graview-root";

defineKit(GUEST_KIT);
customElements.define(GUEST_ROOT, RemoteRootElement as unknown as CustomElementConstructor);

/** A guest in a worker: a frame guest's channel, and the root its kit elements go in. */
export interface WorkerGuest extends Guest {
  /** Append kit elements here (`document.createElement("gv-card")`, …); the host draws them. */
  readonly root: Element;
}

type Listener = (...args: unknown[]) => unknown;
type Plain = string | number | boolean | null | undefined | { readonly listener: number } | readonly Plain[] | { readonly [key: string]: Plain };

let shared: WorkerGuest | undefined;

/**
 * Connect a worker guest to its host: say ready to the worker's owner,
 * take its hello, and draw from then on through the port. One connection
 * per worker; asking again returns it.
 */
export function connectGuest(): WorkerGuest {
  if (shared) return shared;

  /*
   * A listener cannot be cloned into a message, so it crosses as an id the
   * host hands back when the viewer raises the event. The same function is
   * always the same id.
   */
  const byId = new Map<number, Listener>();
  const ids = new WeakMap<Listener, number>();
  let nextListener = 0;
  const plain = (value: unknown, depth = 0): Plain => {
    if (typeof value === "function") {
      let id = ids.get(value as Listener);
      if (id === undefined) {
        id = nextListener += 1;
        ids.set(value as Listener, id);
        byId.set(id, value as Listener);
      }
      return { listener: id };
    }
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === undefined) return value;
    if (depth > 64 || typeof value !== "object") return undefined;
    if (Array.isArray(value)) return value.map((one) => plain(one, depth + 1));
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, plain(one, depth + 1)]));
  };

  const opened = openGuest(
    {
      listen(heard) {
        natives.listen(heard);
        return () => natives.unlisten(heard);
      },
      /* A dedicated worker hears only its owner: whoever posts to it is the host that started it. */
      fromHost: () => true,
      ready: (message) => natives.post(message),
    },
    { onEvent: (event) => void byId.get(event.listener)?.(event.detail) },
  );

  /* A microtask's mutations go as one message: building a card is one render, not one per node. */
  let pending: unknown[] | undefined;
  const connection = {
    mutate(records: readonly unknown[]) {
      if (!pending) {
        pending = [];
        natives.microtask(() => {
          const records = pending ?? [];
          pending = undefined;
          opened.send({ type: "render", records: plain(records) as readonly unknown[] });
        });
      }
      pending.push(...records);
    },
    /* The kit declares no methods, so there is nothing of the host's to call. */
    call: () => undefined,
  };
  const root = document.createElement(GUEST_ROOT) as unknown as RemoteRootElement;
  root.connect(connection as never);

  shared = Object.defineProperty(opened.guest, "root", { value: root as unknown as Element, enumerable: true }) as WorkerGuest;
  return shared;
}

export { GUEST_KIT, KIT_TONES } from "../kit.js";
export type { GuestKitElement, Kit, KitComponent, KitEvent, KitProperty, KitPropertyType, KitTone } from "../kit.js";
export type { Guest } from "../channel.js";
export type { GuestAct, GuestAnswer, GuestEdge, GuestNode, GuestProps, GuestRefusal } from "../protocol.js";
