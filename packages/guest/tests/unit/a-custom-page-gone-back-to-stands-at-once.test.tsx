// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, z, type AnySchema, type Principal, type Store } from "@graview/core";
import { createViews, GraviewProvider, PageOfItsOwn, type ReactViewRegistry, type ViewComponent } from "@graview/react/provider";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMine } from "../../src/host/mine.js";
import { registerWorkerView } from "../../src/host/worker-react.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, schema, showroom, staff } from "./showroom.js";

/**
 * A CUSTOM PAGE GONE BACK TO STANDS AT ONCE (Graview HQ
 * f-custom-pages-do-not-flash): what a worker view drew is kept as its page
 * is left and put back in it, in the same commit, as it stood — for exactly
 * the same view, store and seat, and let go of otherwise. What it is kept
 * by, and within what bounds, is `packages/react`'s kept-drawings test; on
 * the page, frame by frame in three engines, `verify-view-return`.
 */
const { defineMutation } = bindSchema(schema);
const repaint = defineMutation("repaint", { title: "Repaint", subject: { kinds: ["car"], arg: "carId" }, input: z.object({ carId: z.string(), label: z.string() }), apply: (ctx, args) => void ctx.patchNode(args.carId, { label: args.label } as never) });
/** Hands Bethan's record to Freya: what was Bethan's to see is not, with the record still there. */
const handOver = defineMutation("hand-over", {
  title: "Hand over",
  input: z.object({ enquiryId: z.string(), was: z.string(), to: z.string() }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "from", from: args.enquiryId, to: args.was } as never);
    ctx.addEdge({ kind: "from", from: args.enquiryId, to: args.to } as never);
  },
});

/** A stand-in worker: says it is ready, draws the label of each record it is handed, and answers each push. */
class FakeWorker {
  static made: FakeWorker[] = [];
  static holding = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  terminated = false;
  port: MessagePort | undefined;
  nonce = "";
  pushes: { push: number; labels: string[] }[] = [];
  answers: { ok: boolean; message?: string }[] = [];
  constructor() {
    FakeWorker.made.push(this);
    setTimeout(() => !this.terminated && this.onmessage?.({ data: { graview: "guest-ready", protocol: GUEST_PROTOCOL } } as MessageEvent), 0);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    const hello = message as HostHello;
    this.nonce = hello.nonce;
    this.port = transfer[0] as MessagePort;
    let drawn = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "heartbeat") this.say({ type: "heartbeat", beat: data.beat });
      if (data.type === "answer" || data.type === "mine-answer") this.answers.push(data);
      if (data.type !== "props") return;
      const labels = (data.props.nodes ?? [data.props.node]).map((node: { label: string }) => node.label);
      this.pushes.push({ push: data.push, labels });
      const paragraph = { id: `p${data.push}`, type: 1, element: "p", attributes: {}, children: [{ id: `t${data.push}`, type: 3, data: labels.join(",") }] };
      const field = { id: "field", type: 1, element: "input", attributes: { name: "words" }, children: [] };
      this.say({ type: "render", records: drawn === 0 ? [[0, "~", paragraph, 0], [0, "~", field, 1]] : [[1, "~", 0], [0, "~", paragraph, 0]] });
      drawn += 1;
      this.say({ type: "pushed", push: data.push, ms: 1 });
    };
  }
  say(message: object) {
    this.port?.postMessage({ nonce: this.nonce, ...message });
  }
  terminate() {
    this.terminated = true;
    this.port?.close();
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });

const manifest: WorkerViewManifest = { name: "cars", title: "The cars", attach: "car", cardinality: "many" };
const roots: { root: Root; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  FakeWorker.made = [];
});

async function mounted(given: Partial<{ manifest: WorkerViewManifest; principal: Principal }> = {}) {
  const store = showroom([repaint, handOver] as never) as unknown as Store<AnySchema>;
  const kind = (given.manifest ?? manifest).attach;
  if (kind === "enquiry") store.applyAll([{ name: "ask", args: { shopperId: "shopper:bethan", label: "Mine" } }], { author: staff });
  const definition = { manifest: given.manifest ?? manifest, worker: { script: "/* the view */" }, onFailure: vi.fn() };
  const registry = () => registerWorkerView(createViews(schema as never) as unknown as ReactViewRegistry<AnySchema>, definition);
  const at = { page: "cars" as string, aPage: true, principal: given.principal ?? staff, views: registry(), draw: async () => undefined as void };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push({ root, host });
  at.draw = async () => {
    const View = at.views.lookup(kind as never, { cardinality: "many", fidelity: "full" }) as ViewComponent<AnySchema> | undefined;
    await act(async () => {
      root.render(
        <GraviewProvider<AnySchema> store={store} views={at.views} principal={at.principal}>
          <PageOfItsOwn.Provider value={at.aPage ? "place cars" : null}>
            {at.page === "cars" && View ? <View nodes={store.seenBy(at.principal).graph.nodesOfKind(kind as never) as never} fidelity="full" cardinality="many" mode="fullscreen" selected={false} /> : <p>Elsewhere</p>}
          </PageOfItsOwn.Provider>
        </GraviewProvider>,
      );
    });
  };
  const settled = async () => {
    await act(async () => {
      await vi.waitFor(() => expect(host.querySelector("[data-worker-view-drawn]")).not.toBeNull());
    });
  };
  await at.draw();
  await settled();
  const go = async (page: string) => {
    at.page = page;
    await at.draw();
  };
  const region = () => host.querySelector("[data-worker-view]") as HTMLElement | null;
  const words = () => region()?.shadowRoot?.querySelector("p")?.textContent;
  return { store, at, host, go, region, words, settled, definition, registry };
}
const later = (ms = 30) => act(async () => new Promise<void>((done) => setTimeout(done, ms)));

describe("a custom page left and gone back to", () => {
  it("stands in the commit that draws its page, the same drawing from the same worker, with what was typed", async () => {
    const { go, region, words } = await mounted();
    const was = region()!;
    const field = was.shadowRoot!.querySelector("input")!;
    field.value = "half a thought";
    await go("elsewhere");
    expect(region()).toBeNull();
    await go("cars");
    expect(region()).toBe(was);
    expect(words()).toBe("Golf");
    expect(was.shadowRoot!.querySelector("input")!.value).toBe("half a thought");
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0]!.terminated).toBe(false);
  });

  it("is brought up to date in place where a record changed meanwhile, handed nothing while away", async () => {
    const { store, go, region, words } = await mounted();
    const was = region();
    await go("elsewhere");
    const pushes = FakeWorker.made[0]!.pushes.length;
    await act(async () => void store.applyAll([{ name: "repaint", args: { carId: "car:golf", label: "Golf, red" } }], { author: staff }));
    await later();
    expect(FakeWorker.made[0]!.pushes).toHaveLength(pushes);
    await go("cars");
    expect(region()).toBe(was);
    await vi.waitFor(() => expect(words()).toBe("Golf, red"));
    expect(FakeWorker.made).toHaveLength(1);
  });

  it("is let go of at once where a record it shows is gone", async () => {
    const { store, go } = await mounted();
    await go("elsewhere");
    await act(async () => void store.applyAll([{ name: "retire-car", args: { carId: "car:golf" } }], { author: staff }));
    await later();
    expect(FakeWorker.made[0]!.terminated).toBe(true);
  });

  it("is let go of at once where a record it shows is no longer its seat's to see", async () => {
    const { store, go, words } = await mounted({ principal: bethan, manifest: { ...manifest, attach: "enquiry" } });
    expect(words()).toBe("Mine");
    await go("elsewhere");
    const mine = store.seenBy(bethan).graph.nodesOfKind("enquiry" as never).map((node) => (node as { id: string }).id)[0]!;
    await act(async () => void store.applyAll([{ name: "hand-over", args: { enquiryId: mine, was: "shopper:bethan", to: "shopper:freya" } }], { author: staff }));
    await later();
    expect(store.graph.has(mine)).toBe(true);
    expect(FakeWorker.made[0]!.terminated).toBe(true);
  });

  it("is let go of as the seat changes, and drawn anew for the next one", async () => {
    const { at, go, region, settled } = await mounted();
    const was = region();
    await go("elsewhere");
    at.principal = { kind: "human", id: "staff:owen", roles: ["staff"] };
    await at.draw();
    expect(FakeWorker.made[0]!.terminated).toBe(true);
    await go("cars");
    expect(region()).not.toBe(was);
    await settled();
    expect(FakeWorker.made).toHaveLength(2);
  });

  it("is let go of as the registry changes: a view hidden, taken away or handed anew", async () => {
    const { at, go, registry } = await mounted();
    await go("elsewhere");
    at.views = registry();
    await at.draw();
    expect(FakeWorker.made[0]!.terminated).toBe(true);
  });

  it("is not kept where the seat changed while it stood: the one before is taken down", async () => {
    const { at } = await mounted();
    at.principal = { kind: "human", id: "staff:owen", roles: ["staff"] };
    await at.draw();
    expect(FakeWorker.made[0]!.terminated).toBe(true);
  });

  it("asks for an act while away and is refused, and goes nowhere", async () => {
    const { store, go } = await mounted({ manifest: { ...manifest, acts: ["retire-car"] } });
    await go("elsewhere");
    const worker = FakeWorker.made[0]!;
    worker.say({ type: "act", id: 1, name: "retire-car", args: { carId: "car:golf" } });
    worker.say({ type: "navigate", to: "car:golf" });
    await later();
    expect(worker.answers).toEqual([expect.objectContaining({ ok: false, reason: "refused" })]);
    expect(store.graph.has("car:golf")).toBe(true);
  });

  it("whose pictures, stylesheet or faces moved while away is handed them: it is pushed as it stands again, whatever its records", async () => {
    const { go } = await mounted();
    await go("elsewhere");
    const pushes = FakeWorker.made[0]!.pushes.length;
    await go("cars");
    await vi.waitFor(() => expect(FakeWorker.made[0]!.pushes.length).toBeGreaterThan(pushes));
  });

  it("keeps nothing for its viewer while away", async () => {
    const { go } = await mounted();
    await go("elsewhere");
    const worker = FakeWorker.made[0]!;
    worker.say({ type: "mine", id: 7, op: "set", key: "k", value: "v" });
    await later();
    expect(worker.answers).toEqual([expect.objectContaining({ ok: false })]);
  });

  it("that fails while away is let go of, and says nothing to the host of a page nobody is on", async () => {
    const { go, definition, settled, region } = await mounted();
    await go("elsewhere");
    const worker = FakeWorker.made[0]!;
    for (let one = 0; one < 200; one++) worker.say({ type: "style", sheets: [] });
    await later(60);
    expect(worker.terminated).toBe(true);
    expect(definition.onFailure).not.toHaveBeenCalled();
    await go("cars");
    await settled();
    expect(region()!.hasAttribute("data-worker-view-failed")).toBe(false);
  });

  it("is never kept where it is drawn as a row, a card or a preview, which no face says is a page", async () => {
    const { at, go, settled } = await mounted();
    at.aPage = false;
    await at.draw();
    await go("elsewhere");
    expect(FakeWorker.made[0]!.terminated).toBe(true);
    await go("cars");
    await settled();
    expect(FakeWorker.made).toHaveLength(2);
  });

  it("is never kept where it is a draft", async () => {
    const { host, go, at, settled } = await mounted();
    await go("elsewhere");
    at.views = registerWorkerView(createViews(schema as never) as unknown as ReactViewRegistry<AnySchema>, { manifest, worker: { script: "/* the draft */" }, draft: true });
    await go("cars");
    await settled();
    expect(host.querySelector("[data-graview-draft-view]")).not.toBeNull();
    const draft = FakeWorker.made.at(-1)!;
    await go("elsewhere");
    expect(draft.terminated).toBe(true);
  });
});

describe("a view drawn again", () => {
  it("starts with what it was last known to keep, and is pushed what the host says instead", async () => {
    let answer: (values: Record<string, string>) => void = () => undefined;
    const state = { read: () => new Promise<Record<string, string>>((resolve) => (answer = resolve)), write: async () => ({ ok: true as const }) };
    const first = createMine({ view: "v", viewer: "a", state });
    answer({ filter: "open" });
    await first.ready;
    await first.set("filter", "mine");
    first.dispose();
    let late = 0;
    const again = createMine({ view: "v", viewer: "a", state, onLate: () => (late += 1) });
    await again.ready;
    expect(again.values()).toEqual({ filter: "mine" });
    // What it asks by key waits for the host, which says otherwise.
    const asked = again.get("filter");
    answer({ filter: "theirs" });
    await expect(asked).resolves.toEqual({ ok: true, value: "theirs" });
    expect(late).toBe(1);
    expect(again.values()).toEqual({ filter: "theirs" });
    const another = createMine({ view: "v", viewer: "b", state });
    expect(another.values()).toEqual({});
    // A read by a drawing gone since never stands over what was written after it.
    const slow = createMine({ view: "v", viewer: "a", state });
    const slowAnswers = answer;
    slow.dispose();
    const next = createMine({ view: "v", viewer: "a", state });
    answer({ filter: "newest" });
    await next.get("filter");
    slowAnswers({ filter: "oldest" });
    await new Promise((done) => setTimeout(done, 0));
    expect(createMine({ view: "v", viewer: "a", state }).values()).toEqual({ filter: "newest" });
  });
});
