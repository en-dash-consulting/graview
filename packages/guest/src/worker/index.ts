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
 *   4. it hardens the worker's global before guest code runs (harden.ts),
 *      and stops if it cannot;
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
import { harden, type Hardening } from "./harden.js";
import { createListenerLedger } from "./listeners.js";

/** The element a worker guest draws into; the host's container stands for it. */
export const GUEST_ROOT = "graview-root";

defineKit(GUEST_KIT);
customElements.define(GUEST_ROOT, RemoteRootElement as unknown as CustomElementConstructor);

/**
 * WHAT HARDENING TOOK (FR-70), before any guest code ran. Should a name
 * outside the allowlist refuse to go, the runtime stops here: no guest
 * code runs in a worker that is not hardened, and the host hears it fail
 * to start rather than a guest that is not held. Outside a worker (a test
 * of the runtime in Node) there is no worker's global to harden, and
 * `worker` says so.
 */
export const hardening: Hardening = "WorkerGlobalScope" in globalThis ? harden() : { removed: [], stuck: [], sealed: false, worker: false };
if (hardening.stuck.length > 0) throw new Error(`The guest's worker could not be hardened: ${hardening.stuck.join(", ")} would not go.`);

/** A guest in a worker: a frame guest's channel, and the root its kit elements go in. */
export interface WorkerGuest extends Guest {
  /** Append kit elements here (`document.createElement("gv-card")`, …); the host draws them. */
  readonly root: Element;
}

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
   * host hands back when the viewer raises the event, and is let go when
   * what it was on leaves the tree (listeners.ts).
   */
  const ledger = createListenerLedger();

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
    { onEvent: (event) => void ledger.listener(event.listener)?.(event.detail) },
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
          opened.send({ type: "render", records: ledger.encode(records) });
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

export { GUEST_GLOBALS, INERT, LANGUAGE, OBJECT_PROTOTYPE, PLATFORM, POLYFILLED_DOM } from "./harden.js";
export type { Hardening } from "./harden.js";
export { GUEST_KIT, KIT_LINK_TARGETS, KIT_TONES } from "../kit.js";
export type { GuestKitElement, Kit, KitComponent, KitEvent, KitProperty, KitPropertyType, KitTone } from "../kit.js";
export type { Guest } from "../channel.js";
export type { GuestAct, GuestAnswer, GuestEdge, GuestNode, GuestProps, GuestRefusal } from "../protocol.js";
