import "@graview/core"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).
import { checkPresses } from "./presses.js";
import { browserIsolate } from "./browser.js";
import type { AnySchema } from "@graview/core";
import { runWorkerViewHeadless, type RunWorkerViewHeadlessOptions } from "./index.js";

/*
 * `@graview/guest/headless/pressed-here` — A DRAFT'S CONTROLS PRESSED IN THE
 * PAGE (Roadmap f-make-any-page-better): the door the embed lends a view's
 * place (`@graview/guest/host/pressing`), fetched the first time a draft is
 * pressed — the headless run, the press check and a worker of the page's
 * own, in one chunk, so a page that never asks carries none of it.
 */
export function pressedHere<S extends AnySchema>(options: Omit<RunWorkerViewHeadlessOptions<S>, "run" | "presses">) {
  return runWorkerViewHeadless({ ...options, run: browserIsolate(), presses: checkPresses });
}
