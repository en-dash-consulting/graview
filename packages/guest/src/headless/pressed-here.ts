import "@graview/core"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).
import { labelOf, Store, type AnySchema } from "@graview/core";
import { checkPresses, type PressCheck, type PressFinding } from "./presses.js";
import { browserIsolate } from "./browser.js";
import { runWorkerViewHeadless, type HeadlessResult, type RunWorkerViewHeadlessOptions } from "./index.js";
import { judgePress } from "../host/press.js";
import { manifestActs } from "../host/manifest.js";
import type { TreeElement } from "./tree.js";

/*
 * `@graview/guest/headless/pressed-here` — A DRAFT'S CONTROLS PRESSED IN THE
 * PAGE (Roadmap f-make-any-page-better): the door the embed lends a view's
 * place (`@graview/guest/host/pressing`), fetched the first time a draft is
 * pressed — the headless run, the press check and a worker of the page's
 * own, in one chunk, so a page that never asks carries none of it.
 *
 * A PRESS SHOWS WHAT IT DID. A bound press the host accepts is not enough:
 * a "Mark done" that leaves its row as it was reads to a person as a button
 * that does nothing. So each act the draft binds is applied — once for
 * each state its records are in, in a copy of the store nobody sees — and
 * the draft is drawn again from the changed records: the record it was
 * pressed on must be drawn differently after (its words, or its control),
 * and a press that changes nothing where it stands (finishing a task that
 * is finished) is a finding naming the act that would.
 */

/** The most acts applied and drawn again, each in a copy of its own. */
const MOST_LANDINGS = 6;

type Options<S extends AnySchema> = Omit<RunWorkerViewHeadlessOptions<S>, "run" | "presses">;

const elementsBelow = function* (element: TreeElement): Generator<TreeElement> {
  for (const child of element.childNodes) {
    if ((child as { nodeType?: number }).nodeType !== 1) continue;
    yield child as TreeElement;
    yield* elementsBelow(child as TreeElement);
  }
};
const holds = (outer: TreeElement, inner: TreeElement) => {
  for (let at: TreeElement | null = inner; at; at = at.parentElement) if (at === outer) return true;
  return false;
};
/** What a record is drawn as: the smallest part holding everything bound to it, its words and the acts its presses ask for. Null where it is not drawn. */
export function drawnRecord(root: TreeElement, id: string): string | null {
  const bound = [...elementsBelow(root)].filter((one) => one.getAttribute("data-record") === id);
  if (bound.length === 0) return null;
  let part: TreeElement | null = bound[0]!;
  while (part && !bound.every((one) => holds(part!, one))) part = part.parentElement;
  const at = part ?? root;
  const acts = [at, ...elementsBelow(at)].flatMap((one) => (one.getAttribute("data-act") ? [one.getAttribute("data-act")!] : []));
  const pressed = [at, ...elementsBelow(at)].flatMap((one) => (one.getAttribute("aria-pressed") || one.getAttribute("aria-checked") ? [`${one.getAttribute("aria-pressed") ?? ""}${one.getAttribute("aria-checked") ?? ""}`] : []));
  return `${at.textContent.replace(/\s+/g, " ").trim()}|${acts.join(",")}|${pressed.join(",")}`;
}

const attribute = (element: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(element)?.[1];

/** A copy of a store's records and rules, for an act nobody sees. */
function copyOf<S extends AnySchema>(store: Store<S>): Store<S> {
  return new Store<S>({
    schema: store.schema,
    mutations: store.allMutations() as never,
    invariants: store.allInvariants() as never,
    ...(store.policy ? { policy: store.policy } : {}),
    snapshot: store.graph.snapshot() as never,
  } as never);
}

/** What the records a press is bound to are in: their yes-or-no fields, so a finished task and an open one are pressed apart. */
const stateOf = (node: Record<string, unknown> | undefined) =>
  JSON.stringify(Object.entries(node ?? {}).filter(([, value]) => typeof value === "boolean").sort(([a], [b]) => a.localeCompare(b)));

export async function pressedHere<S extends AnySchema>(options: Options<S>): Promise<HeadlessResult> {
  const run = browserIsolate();
  const ran = await runWorkerViewHeadless({ ...options, run, presses: checkPresses, audit: true, drawing: true });
  if (!ran.ok || !ran.presses || !ran.drawing) return ran;
  const landed = await landings(options, ran.presses, ran.drawing.root, run);
  if (landed.length === 0) return ran;
  const problems = [...ran.presses.problems, ...landed];
  return { ...ran, presses: { ...ran.presses, ok: false, controls: [...ran.presses.controls, ...landed], problems, text: `${ran.presses.text}${landed.map((one) => `  FAILS ${one.says}\n`).join("")}` } satisfies PressCheck };
}

/** Each act the draft binds, applied in a copy for each state its records are in, and the draft drawn again: what did not show it landed. */
async function landings<S extends AnySchema>(options: Options<S>, presses: PressCheck, before: TreeElement, run: ReturnType<typeof browserIsolate>): Promise<PressFinding[]> {
  const { store, principal, manifest } = options;
  const shown = new Set(store.graph.allNodes().map((node) => node.id));
  const tried = new Set<string>();
  const found: PressFinding[] = [];
  for (const control of presses.controls) {
    if (tried.size >= MOST_LANDINGS) break;
    if (control.does !== "act" || !control.ok) continue;
    const as = attribute(control.element, "data-act");
    const record = attribute(control.element, "data-record");
    if (!as || !record) continue;
    const node = store.graph.getNode(record) as (Record<string, unknown> & { id: string; kind: string }) | undefined;
    const key = `${as}|${stateOf(node)}`;
    if (tried.has(key)) continue;
    tried.add(key);
    const judged = judgePress(store, manifest, shown, { as, record, fields: [] });
    if (!judged.ok) continue;
    const call = { name: judged.name, args: judged.args };
    const label = node ? `“${labelOf(store.schema.tryDefinition(node.kind) as never, node)}”` : `“${record}”`;
    if (!store.wouldChange(call, principal)) {
      /* Where it stands, the press changes nothing: the act that would — one that writes what this one writes — bound there instead. */
      const writesOf = (name: string) => new Set((store.allMutations().find((one) => one.name === name) as { writes?: readonly string[] } | undefined)?.writes ?? []);
      const writes = writesOf(judged.name);
      const others = manifestActs(manifest)
        .filter((one) => one.act !== judged.name && writes.size > 0 && [...writesOf(one.act)].some((field) => writes.has(field)))
        .filter((one) => {
          const other = judgePress(store, manifest, shown, { as: one.as ?? one.act, record, fields: [] });
          return other.ok && store.wouldChange({ name: other.name, args: other.args }, principal);
        })
        .map((one) => `“${one.as ?? one.act}”`);
      found.push({ control: control.control, element: control.element, does: "act", ok: false, says: `On ${label} it asks for “${as}”, which changes nothing there: it is so already.${others.length > 0 ? ` Bind its press there to ${others.join(" or ")} instead, as the page did, so a person can take it back.` : ""}` });
      continue;
    }
    const copy = copyOf(store);
    try {
      copy.apply(call, { author: principal });
    } catch {
      continue;
    }
    const again = await runWorkerViewHeadless({ ...options, store: copy, run, audit: true, drawing: true });
    if (!again.ok || !again.drawing) continue;
    if (drawnRecord(again.drawing.root, record) === drawnRecord(before, record))
      found.push({ control: control.control, element: control.element, does: "act", ok: false, says: `Pressed on ${label}, it lands, and the design draws ${label} just as before it: show what it changed — its words or its control (a finished task says so and offers the act that takes it back).` });
  }
  return found;
}
