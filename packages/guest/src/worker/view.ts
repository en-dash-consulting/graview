/*
 * A WORKER VIEW'S RUNTIME (FR-90): `@graview/guest/worker/view`.
 *
 * The open kit's half in the worker. Like the kit's guest entry
 * (worker/index.ts) it keeps how to hear the host, boots Remote DOM's
 * polyfill and hardens the worker before a line of the view runs; unlike
 * it, it defines no components. A view draws plain HTML and SVG, and gives
 * one stylesheet, and the host draws what the open kit allows of them
 * (open-kit.ts, host/open-render.ts, host/css.ts).
 *
 * What a view is handed is one global, `graview`, kept through hardening
 * and frozen with the rest (view-global.ts says what it holds):
 *
 *   graview.props            what the host last pushed: the viewer's sight
 *   graview.onProps(fn)      called with every push (and at once, if there is one)
 *   graview.render(markup)   draw: a string of HTML, `graview.html`…`` or nodes
 *   graview.style(css)       the view's one stylesheet
 *   graview.on(type, selector, fn)   hear the viewer: click, input, change, keydown, toggle
 *   graview.act(name, args)  ask for an act; resolves with the host's answer
 *   graview.navigate(to)     go to a record (its id) or a place ({ place: slug })
 *   graview.html``           markup, with every value put in it escaped
 *
 * The same global, over a transcript rather than a port, is what a
 * headless run hands a view (headless/runtime.ts, FR-95).
 */
import { natives } from "./natives.js";
import "@remote-dom/core/polyfill";
import { openGuest } from "../channel.js";
import type { HostMessage } from "../protocol.js";
import { harden, type Hardening } from "./harden.js";
import { createViewRuntime } from "./view-global.js";

let hardened: Hardening = { removed: [], stuck: [], sealed: false, worker: false };

const opened = openGuest(
  {
    listen(hear) {
      natives.listen(hear);
      return () => natives.unlisten(hear);
    },
    /* A dedicated worker hears only its owner: whoever posts to it is the host that started it. */
    fromHost: () => true,
    ready: (message) => natives.post(message),
  },
  { onMessage: (message: HostMessage) => runtime.hear(message) },
);

const runtime = createViewRuntime({
  send: (request) => opened.send(request),
  act: (name, args) => opened.guest.act(name, args),
  navigate: (to) => opened.guest.navigate(to),
  microtask: natives.microtask,
  now: natives.now,
  threw: (error) => console.error(error),
  warn: (text) => console.warn(text),
  hardening: () => hardened,
});
const view = runtime.view;

Object.defineProperty(globalThis, "graview", { value: view, enumerable: true, configurable: true, writable: false });

/**
 * WHAT HARDENING TOOK (FR-70), with `graview` kept. As for the kit's guest:
 * a name that will not go stops the runtime before the view runs, and in a
 * test of the runtime outside a worker nothing is hardened.
 */
export const hardening: Hardening = "WorkerGlobalScope" in globalThis ? harden(globalThis, ["graview"]) : hardened;
hardened = hardening;
if (hardening.stuck.length > 0) throw new Error(`The view's worker could not be hardened: ${hardening.stuck.join(", ")} would not go.`);

export { view as graview };
export { VIEW_ROOT } from "./view-global.js";
export type { Drawable, GraviewView, Html, ViewEvent } from "./view-global.js";
export type { GuestAnswer, GuestPressed, GuestProps, GuestTheme } from "../protocol.js";
