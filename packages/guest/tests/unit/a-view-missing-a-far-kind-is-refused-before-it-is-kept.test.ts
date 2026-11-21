// @vitest-environment jsdom
import { createSchema, defineNode, Store, z, type AnySchema, type Principal } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { mountWorkerView } from "../../src/host/view.js";
import { checkManifest, checkProposedManifest, farKindKey, type WorkerViewManifest } from "../../src/host/views.js";
import type { ViewProblem } from "../../src/host/problems.js";

/**
 * A VIEW MISSING A FAR KIND IS REFUSED BEFORE IT IS KEPT (HQ
 * f-view-check-refuses-unread-relation-kind). A view of a plan's steps that
 * read the relation inPhase (chunk to step) without `chunk` in its
 * manifest's reads.kinds was kept, then said at every open that no link of
 * it reached the view — and people filed that once per version of the app.
 * Now it is refused when it is proposed or checked, with the relation and
 * the kind to add; a view already kept is still drawn, and what its page
 * reports carries a key of the view, the relation and the kind that is the
 * same in every version of the app.
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
Object.assign(window.URL, { createObjectURL: () => "blob:http://localhost:3000/1", revokeObjectURL: () => undefined });

const step = defineNode("step", { fields: z.object({ label: z.string() }) });
const chunk = defineNode("chunk", { fields: z.object({ label: z.string() }), edges: { inPhase: { to: ["step"] }, near: { to: "*" } } });
const planOf = (more: readonly ReturnType<typeof defineNode>[] = []) => {
  const schema = createSchema([step, chunk, ...more] as never);
  return new Store<AnySchema>({
    schema: schema as AnySchema,
    mutations: [],
    policy: { grants: [] },
    snapshot: {
      nodes: [
        { id: "step:design", kind: "step", label: "Design" },
        { id: "chunk:sketch", kind: "chunk", label: "Sketch" },
      ],
      edges: [{ kind: "inPhase", from: "chunk:sketch", to: "step:design" }],
    } as never,
  });
};
const planner: Principal = { kind: "human", id: "u:planner" };
const board: WorkerViewManifest = { name: "phase-board", attach: "step", cardinality: "many", reads: { edges: ["inPhase"] } };
const handed: WorkerViewManifest = { ...board, reads: { kinds: ["chunk"], edges: ["inPhase"] } };
const source = `graview.onProps((props) => graview.render(graview.html\`<ul>\${props.nodes.map((one) => graview.html\`<li>\${one.label}</li>\`)}</ul>\`));`;
const says = '"phase-board" reads the relation "inPhase", from chunk to step, and is handed no chunk, so no link of it reaches the view: add "chunk" to its manifest\'s reads.kinds.';

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

describe("a view proposed that reads a relation whose far kind its manifest lacks", () => {
  it("is refused by the proposal's check, naming the relation and the kind to add", () => {
    expect(checkProposedManifest(board, planOf())).toEqual([says]);
  });

  it("is refused by a headless check, before it is kept", async () => {
    const result = await runWorkerViewHeadless({ store: planOf(), principal: planner, manifest: board, source, run: nodeIsolate() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("manifest");
    expect(result.detail).toBe(says);
  });

  it("is refused when it is drawn as a draft, proposed and not kept", async () => {
    const element = document.body.appendChild(document.createElement("div"));
    const failed: string[] = [];
    live.push(mountWorkerView(element, { manifest: board, worker: { source }, store: planOf(), principal: planner, draft: true, onFailure: (_reason, said) => failed.push(said ?? "") }));
    await vi.waitFor(() => expect(failed).toHaveLength(1));
    expect(failed[0]).toContain('add "chunk" to its manifest\'s reads.kinds');
    expect(FakeWorker.made).toHaveLength(0);
  });
});

describe("a view the check passed before", () => {
  it("still passes when its manifest hands the far kind", async () => {
    expect(checkProposedManifest(handed, planOf())).toEqual([]);
    const result = await runWorkerViewHeadless({ store: planOf(), principal: planner, manifest: handed, source, run: nodeIsolate() });
    if (!result.ok) throw new Error(result.detail);
    expect(result.description.problems.filter((one) => one.at === "reads")).toEqual([]);
  });

  it("still passes when it reads a relation to any kind, which names no kind to add: that stays a problem beside the drawing", () => {
    const anyKind: WorkerViewManifest = { name: "sketch", attach: "chunk", cardinality: "one", reads: { edges: ["near"] } };
    expect(checkProposedManifest(anyKind, planOf())).toEqual([]);
  });

  it("is still mounted on a page once kept: the manifest's own check does not refuse it", () => {
    expect(checkManifest(board, planOf())).toEqual([]);
  });
});

describe("a standing view that reads a relation whose far kind its manifest lacks", () => {
  it("is drawn, and its page reports the fault with a key of the view, the relation and the kind", async () => {
    const element = document.body.appendChild(document.createElement("div"));
    const problems: [string, ViewProblem][] = [];
    live.push(mountWorkerView(element, { manifest: board, worker: { source }, store: planOf(), principal: planner, onProblem: (said, problem) => problems.push([said, problem]) }));
    await vi.waitFor(() => expect(problems).toHaveLength(1));
    expect(problems[0]).toEqual([says, { code: "far-kind-not-handed", key: "far-kind-not-handed:phase-board:inPhase:chunk" }]);
    await vi.waitFor(() => expect(FakeWorker.made).toHaveLength(1));
  });

  it("is said with the same key in a later version of the app, whatever else it declares", async () => {
    const later = planOf([defineNode("phase", { fields: z.object({ label: z.string(), due: z.string().optional() }), edges: { holds: { to: ["step"] } } })]);
    const keys: (string | undefined)[] = [];
    for (const store of [planOf(), later]) {
      const element = document.body.appendChild(document.createElement("div"));
      live.push(mountWorkerView(element, { manifest: board, worker: { source }, store, principal: planner, onProblem: (_said, problem) => keys.push(problem.key) }));
    }
    await vi.waitFor(() => expect(keys).toHaveLength(2));
    expect(keys).toEqual([farKindKey("phase-board", "inPhase", ["chunk"]), farKindKey("phase-board", "inPhase", ["chunk"])]);
    /* Kinds any one of which would hand it are one key, in whatever order the relation names them. */
    expect(farKindKey("phase-board", "inPhase", ["task", "chunk"])).toBe(farKindKey("phase-board", "inPhase", ["chunk", "task"]));
    expect(farKindKey("phase-board", "inPhase", ["task", "chunk"])).toBe("far-kind-not-handed:phase-board:inPhase:chunk|task");
  });

  it("is among a headless run's problems with its key when the run is of a view already kept", async () => {
    const result = await runWorkerViewHeadless({ store: planOf(), principal: planner, manifest: board, source, run: nodeIsolate(), standing: true });
    if (!result.ok) throw new Error(result.detail);
    expect(result.description.problems).toContainEqual({ at: "reads", says, key: "far-kind-not-handed:phase-board:inPhase:chunk" });
  });
});
