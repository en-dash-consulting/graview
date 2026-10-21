// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { codeOf } from "../../src/host/code-of.js";
import { mountWorkerView, type WorkerViewCode } from "../../src/host/view.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW'S CODE IS FETCHED ONLY WHEN IT IS DRAWN (Roadmap f-heavy-apps-fast).
 *
 * Measured on Graview Cloud on a phone: every custom view's source was
 * fetched before the page mounted, seven of them, though the home drew one.
 * A host registers each view by its manifest — the places, the place menu
 * and the catalog read manifests — and hands its code as a function
 * (`worker: () => fetch(…).then(…)`), which the framework asks only when
 * the view is first drawn, once however often it is drawn, and again after
 * it rejected. Code that arrives is judged as handed code is; code that
 * never arrives is refused `source` in words, and the plain face drawn.
 */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage() {}
  terminate() {}
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (done: () => boolean, ms = 3_000) => {
  for (const start = performance.now(); !done() && performance.now() - start < ms; ) await wait(10);
};
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never }) as unknown as Store<AnySchema>;
const packages = { name: "packages", title: "The packages", attach: "package", cardinality: "many" } as const;
const offers = { name: "offers", title: "The offers", attach: "offer", cardinality: "many" } as const;

/** A load that counts how often it is asked, answering `code` (or refusing with `refuse`). */
function counted(code: WorkerViewCode, refuse?: string) {
  const load = Object.assign(
    async () => {
      load.asked++;
      if (refuse) throw new Error(refuse);
      return code;
    },
    { asked: 0 },
  );
  return load;
}

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

describe("a worker view's code handed as a function", () => {
  it("is registered as a place from its manifest without its code being asked", () => {
    const one = counted({ script: "/* packages */" });
    const two = counted({ script: "/* offers */" });
    const schema = offersApp.schema as AnySchema;
    const views = registerWorkerView(registerWorkerView(registerDefaultViews(schema, createViews(schema)), { manifest: packages, worker: one }), { manifest: offers, worker: two });
    expect(views.places().map((place) => place.title)).toEqual(expect.arrayContaining(["The packages", "The offers"]));
    expect([one.asked, two.asked]).toEqual([0, 0]);
  });

  it("is asked when the view is drawn, once however often, and the worker starts on what it answered", async () => {
    const load = counted({ script: "/* the view */" });
    for (let n = 0; n < 2; n++) {
      const element = document.createElement("div");
      document.body.append(element);
      live.push(mountWorkerView(element, { manifest: packages, worker: load, store: store(), principal: lin }));
    }
    await until(() => FakeWorker.made.length === 2);
    expect(FakeWorker.made).toHaveLength(2);
    expect(load.asked).toBe(1);
  });

  it("is judged as handed code is once it arrives: too long, it is refused source and its plain face drawn", async () => {
    const element = document.createElement("div");
    document.body.append(element);
    const failures: { reason: string; detail?: string }[] = [];
    const view = mountWorkerView(element, { manifest: packages, worker: counted({ script: "x".repeat(20) }), store: store(), principal: lin, limits: { maxSourceBytes: 10 }, onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}) }) });
    live.push(view);
    await until(() => failures.length > 0);
    expect(failures[0]).toMatchObject({ reason: "source", detail: "Its code is longer than the 10 bytes a view may be." });
    expect(FakeWorker.made).toHaveLength(0);
    expect(view.element.getAttribute("data-worker-view-failed")).toBe("source");
  });

  it("that never arrives is refused source in words, and asked again by the next drawing", async () => {
    const load = counted({ script: "/* never */" }, "404 Not Found");
    const element = document.createElement("div");
    document.body.append(element);
    const failures: { reason: string; detail?: string }[] = [];
    const view = mountWorkerView(element, { manifest: packages, worker: load, store: store(), principal: lin, onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}) }) });
    live.push(view);
    await until(() => failures.length > 0);
    expect(failures[0]).toEqual({ reason: "source", detail: "Its code did not arrive: 404 Not Found." });
    expect(view.element.getAttribute("data-worker-view-failed")).toBe("source");
    expect(view.shadow.querySelector("[data-graview-fallback]")).not.toBeNull();
    await codeOf(load).catch(() => undefined);
    expect(load.asked).toBe(2);
  });

  it("is asked by a view the face draws, and not by a view registered beside it that is not drawn", async () => {
    const drawnLoad = counted({ script: "/* packages */" });
    const otherLoad = counted({ script: "/* offers */" });
    const graph = store();
    const views = registerWorkerView(registerWorkerView(registerDefaultViews(graph.schema, createViews(graph.schema)), { manifest: packages, worker: drawnLoad }), { manifest: offers, worker: otherLoad });
    const View = views.lookup("package", { cardinality: "many", fidelity: "full" }) as ViewComponent<AnySchema>;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={graph} principal={lin} views={views} initialView={EMPTY_VIEW}>
          <View nodes={graph.graph.allNodes().filter((node) => node.kind === "package") as never} cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
        </GraviewProvider>,
      ),
    );
    await until(() => FakeWorker.made.length > 0);
    expect(drawnLoad.asked).toBe(1);
    expect(otherLoad.asked).toBe(0);
    await act(async () => root.unmount());
  });
});
