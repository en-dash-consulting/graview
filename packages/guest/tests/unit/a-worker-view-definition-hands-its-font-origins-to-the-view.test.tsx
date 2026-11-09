// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AnySchema, Brand } from "@graview/core";
import { createViews, GraviewProvider } from "@graview/react/provider";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workerView, type WorkerViewDefinition } from "../../src/host/worker-react.js";
import { GUEST_PROTOCOL } from "../../src/protocol.js";
import { bethan, schema, showroom } from "./showroom.js";

/*
 * A WORKER VIEW'S DEFINITION HANDS ITS FONT ORIGINS TO THE VIEW (Graview HQ
 * f-view-font-origins-apart-from-images). A host registering a view through
 * `workerView` (as `registerWorkerView`, `workerHome` and an embed's draft
 * view do) says `fonts: { origins }` on the definition; the view mounted in
 * a provider dressed in a brand that lends a face from that origin loads it
 * into the page. Without the list on the definition the face is refused.
 */
const FREDOKA = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka.woff2" };
const BRAND = { name: "Cars", schemes: {}, views: { fonts: [FREDOKA] } } as unknown as Brand;

let fonts: Set<unknown>;
class FakeFontFace {
  readonly status = "unloaded";
  constructor(readonly family: string) {}
  load() {
    return Promise.resolve(this);
  }
}
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
beforeEach(() => {
  fonts = new Set();
  FakeWorker.made = [];
  Object.assign(window, { FontFace: FakeFontFace, Worker: FakeWorker });
  Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
  Object.defineProperty(document, "fonts", { value: { add: (face: unknown) => fonts.add(face), delete: (face: unknown) => fonts.delete(face) }, configurable: true });
});
afterEach(() => {
  document.body.replaceChildren();
});

async function drawn(extra: Partial<WorkerViewDefinition>) {
  const problems: string[] = [];
  const View = workerView({ manifest: { name: "card", attach: "car", cardinality: "one" }, worker: { source: "graview.onProps(() => graview.render('drawn'));" }, onProblem: (said) => problems.push(said), ...extra });
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider<AnySchema> store={showroom() as never} views={createViews(schema) as never} principal={bethan} brand={BRAND}>
        <View node={{ id: "car:golf", kind: "car", label: "Golf" } as never} fidelity="full" cardinality="one" mode="scene" selected={false} />
      </GraviewProvider>,
    ),
  );
  await vi.waitFor(() => expect(FakeWorker.made.length).toBeGreaterThan(0));
  await act(async () => FakeWorker.made.at(-1)!.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL }));
  await vi.waitFor(() => expect(fonts.size > 0 || problems.some((said) => said.includes("Fredoka"))).toBe(true));
  const said = { faces: fonts.size, problems };
  await act(async () => root.unmount());
  return said;
}

describe("a worker view registered with fonts on its definition", () => {
  it("loads the face its brand lends from an origin the definition lists in fonts.origins", async () => {
    const { faces, problems } = await drawn({ fonts: { origins: ["https://fonts.gstatic.com"] } });
    expect(faces).toBe(1);
    expect(problems.filter((said) => said.includes("Fredoka"))).toEqual([]);
  });

  it("refuses it where the definition lists the origin only for images", async () => {
    const { faces, problems } = await drawn({ images: { origins: ["https://fonts.gstatic.com"] } });
    expect(faces).toBe(0);
    expect(problems).toContainEqual(expect.stringContaining("`fonts.origins`"));
  });
});
