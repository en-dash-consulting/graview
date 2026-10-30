// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type HostFiles } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobsApp, jobsSeed, sam } from "../../../../scripts/fixtures/jobs-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { guestView } from "../../src/host/react.js";
import { workerView, type WorkerViewDefinition } from "../../src/host/worker-react.js";

/**
 * A VIEW THE FRAMEWORK MOUNTS FETCHES A RECORD'S FILES WHERE THE HOST SERVES
 * THEM (0.1.36). The host says where once, for the whole page
 * (`HostFiles.src`, which `filesAt(base + "/graview/files")` derives); a
 * worker or frame view drawn as a kind's view is handed that as its `file`
 * unless its definition says otherwise — so a host under a base passes
 * nothing per view.
 */
const mounted = vi.hoisted(() => ({ worker: [] as { file?: (href: string) => string | undefined }[], frame: [] as { file?: (href: string) => string | undefined }[] }));
vi.mock("../../src/host/worker.js", () => ({
  mountWorkerView: (_element: HTMLElement, options: { file?: (href: string) => string | undefined }) => (mounted.worker.push(options), { update() {}, dispose() {} }),
  // What the view's place lends a revision (Roadmap f-make-this-section-better): made with the worker's host, nothing to these claims.
  viewPlaceHandle: () => ({}),
}));
vi.mock("../../src/host/frame.js", () => ({
  mountGuestView: (_element: HTMLElement, options: { file?: (href: string) => string | undefined }) => (mounted.frame.push(options), { iframe: document.createElement("iframe"), update() {}, dispose() {} }),
}));
afterEach(() => {
  mounted.worker.length = 0;
  mounted.frame.length = 0;
});

const photos: WorkerViewManifest = { name: "job-photos", title: "Job photos", attach: "job", cardinality: "many", pictures: true };
const cloud: HostFiles = { maxBytes: 1, kinds: ["image/*"], upload: async () => ({ href: "", name: "", type: "", bytes: 0 }), src: (href) => `/a/jobs${href}` };

async function draw(View: ViewComponent<AnySchema>, files?: HostFiles) {
  const store = new Store({ schema: jobsApp.schema, mutations: [], policy: jobsApp.policy!, snapshot: structuredClone(jobsSeed) as never }) as unknown as Store<AnySchema>;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} principal={sam} views={createViews(store.schema)} initialView={EMPTY_VIEW} {...(files ? { files } : {})}>
        <View nodes={store.graph.allNodes().filter((node) => node.kind === "job") as never} cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
      </GraviewProvider>,
    ),
  );
  for (let tries = 0; tries < 50 && mounted.worker.length + mounted.frame.length === 0; tries++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  return async () => {
    await act(async () => root.unmount());
    host.remove();
  };
}
const definition = (more: Partial<WorkerViewDefinition> = {}): WorkerViewDefinition => ({ manifest: photos, worker: { source: "graview.onProps(() => graview.render('now'));" }, ...more });

describe("a view the framework mounts", () => {
  it("as a worker view, fetches a record's file where the page's host serves it", async () => {
    const done = await draw(workerView(definition()), cloud);
    expect(mounted.worker[0]?.file?.("/graview/files/porch.png")).toBe("/a/jobs/graview/files/porch.png");
    await done();
  });

  it("as a worker view, takes the file its definition says over the page's", async () => {
    const done = await draw(workerView(definition({ file: (href) => `/elsewhere${href}` })), cloud);
    expect(mounted.worker[0]?.file?.("/graview/files/porch.png")).toBe("/elsewhere/graview/files/porch.png");
    await done();
  });

  it("as a worker view, is told nothing where the page's host says nothing", async () => {
    const done = await draw(workerView(definition()));
    expect(mounted.worker[0]).toBeDefined();
    expect(mounted.worker[0]?.file).toBeUndefined();
    await done();
  });

  it("as a frame view, fetches a record's file where the page's host serves it", async () => {
    const done = await draw(guestView({ url: "https://guest.example/view.html", name: "photos", pictures: true }), cloud);
    expect(mounted.frame[0]?.file?.("/graview/files/porch.png")).toBe("/a/jobs/graview/files/porch.png");
    await done();
  });
});
