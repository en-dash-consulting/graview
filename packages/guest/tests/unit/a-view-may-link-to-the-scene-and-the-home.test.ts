// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store, type AnySchema, type GraviewApp, type Place, type Principal } from "@graview/core";
import { placeNamesOf } from "@graview/core/navigate";
import { placesOf } from "@graview/core/seat";
import { compileDocument } from "@graview/core/check";
import { afterEach, describe, expect, it } from "vitest";
import { judgeDestination, listsOf, placeVocabulary, type Arrival } from "../../src/host/links.js";
import { runWorkerViewHeadless, type HeadlessDescribed, type RunWorkerViewHeadlessOptions } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { mountWorkerView } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/**
 * A VIEW MAY LINK TO THE SCENE AND THE HOME, AND THE CHECK AND THE PAGE
 * AGREE ON WHICH NAMES EXIST (FR-235, Roadmap f-view-links-to-scene).
 *
 * Graview Public's home view linked `<a data-place="overview">`: the
 * headless check (`propose_view`) read it as "It opens the place overview"
 * — Cloud hands the check the app's places, the Scene among them — and on
 * the page it did nothing, and the owner was told the place "overview" was
 * no place of this app, since the live host judged the link by the
 * registry's pictures alone. `graview.navigate("overview")` the same. One
 * vocabulary now (`placeNamesFrom`): the check and the live host read the
 * same names — `overview`, `home`, each kind's list, each titled place —
 * and a name outside it is refused with the names that exist.
 */
/* By path, not URL: under jsdom `new URL` is the page's, which Node's fs will not read. */
const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "../../../core/tests/document/fixtures");
const compiled = compileDocument(JSON.parse(readFileSync(join(fixtures, "beatles.gdd.json"), "utf8")));
if (!compiled.ok) throw new Error("the Beatles fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const schema = app.schema as AnySchema;
const seed = JSON.parse(readFileSync(join(fixtures, "beatles.seed.json"), "utf8"));
const store = () => new Store<AnySchema>({ schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
/** The registry's places, as the live page holds them: each declared lens over its kind, and nothing else. */
const registry: readonly Place[] = placesOf(app).flatMap((place) => (place.kind === null || !place.address.startsWith("/places/") ? [] : [{ kind: place.kind, title: place.title, as: place.slug }]));

const linking = (links: readonly string[], going?: string) =>
  `graview.onProps(() => { graview.render(graview.html\`<nav>${links.map((place) => `<a data-place="${place}">${place}</a>`).join("")}</nav>\`);${going ? ` graview.navigate(${JSON.stringify(going)});` : ""} });`;
const run = async (given: Partial<RunWorkerViewHeadlessOptions<AnySchema>> & Pick<RunWorkerViewHeadlessOptions<AnySchema>, "source">): Promise<HeadlessDescribed> => {
  const result = await runWorkerViewHeadless({ store: store(), principal: owner, run: nodeIsolate(), manifest: { name: "home", title: "Home", attach: "home", cardinality: "many" }, views: [], ...given });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result;
};
const problems = async (given: Parameters<typeof run>[0]) => (await run(given)).description.problems.map((problem) => problem.says);

describe("the headless check", () => {
  it("accepts the Scene, the home, a list and a lens by name, handed the app's places as Cloud hands them", async () => {
    expect(await problems({ source: linking(["overview", "home", "songs", "song", "songs-by-writer", "Scene", "Home"], "overview"), places: placesOf(app) })).toEqual([]);
  });

  it("accepts the same handed the registry's places alone, as the page holds them, and handed none", async () => {
    expect(await problems({ source: linking(["overview", "home", "songs", "songs-by-writer"], "home"), places: registry })).toEqual([]);
    expect(await problems({ source: linking(["overview", "home", "songs"], "overview") })).toEqual([]);
  });

  it("says a press on a link to the Scene opens the place overview, and one to the home the place home", async () => {
    const scene = await run({ source: linking(["overview", "home"]), places: placesOf(app), press: 'a[data-place="overview"]' });
    expect(scene.pressed?.opens).toEqual({ place: "overview" });
    expect(scene.pressed?.lost).toBeUndefined();
    const home = await run({ source: linking(["overview", "home"]), places: registry, press: 'a[data-place="home"]' });
    expect(home.pressed?.opens).toEqual({ place: "home" });
  });

  it("refuses a name outside the vocabulary with the names that exist, the Scene and the home among them", async () => {
    const [said, ...rest] = await problems({ source: linking(["the-map"]), places: placesOf(app) });
    expect(rest).toEqual([]);
    expect(said).toContain('It names the place "the-map", which this app does not have.');
    expect(said).toContain('"overview" (Scene)');
    expect(said).toContain('"home" (Home)');
    expect(said).toContain('"songs-by-writer" (Songs by writer)');
  });
});

describe("the live host", () => {
  it("accepts exactly the names the headless check accepts: one vocabulary", () => {
    const live = placeVocabulary(schema, registry);
    const checked = placeNamesOf(app);
    expect(live.map((one) => one.as)).toEqual(checked.map((one) => one.as));
    const lists = listsOf(schema);
    for (const name of checked) {
      const judged = judgeDestination({ place: name.as }, { sees: () => false, places: live, lists, schema });
      expect(judged, name.as).toEqual({ ok: true, arrival: name.is === "list" ? { list: name.kind } : { place: name.as } });
    }
    const refused = judgeDestination({ place: "the-map" }, { sees: () => false, places: live, lists, schema });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.says).toContain('"overview" (Scene)');
  });

  it("goes to the Scene by its title too, and refuses to narrow it: there is no kind to narrow by", () => {
    const live = placeVocabulary(schema, registry, { pages: { scene: "The map" } });
    expect(judgeDestination({ place: "The map" }, { sees: () => false, places: live, lists: [], schema })).toEqual({ ok: true, arrival: { place: "overview" } });
    const narrowed = judgeDestination({ place: "overview", where: { title: "x" } }, { sees: () => false, places: live, lists: [], schema });
    expect(narrowed).toEqual({ ok: false, says: 'The place "overview" cannot be narrowed here: it goes nowhere.' });
  });

  it("leaves out the list of a kind the viewer is kept from, and every place over it, on the page as in the check", () => {
    const kept = new Set(["song"]);
    expect(placeVocabulary(schema, registry, { kept }).map((one) => one.as)).toEqual(placeNamesOf(app, { kept }).map((one) => one.as));
  });
});

/* ── a worker view's navigate("overview"), live ───────────────────────── */

class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  terminated = false;
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.posted.push({ message, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

describe("a worker view on the page", () => {
  it("arrives at the Scene by graview.navigate(\"overview\") and at the home by \"home\", with nothing said as a problem", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const went: Arrival[] = [];
    const problems: string[] = [];
    const view = mountWorkerView(element, {
      manifest: { name: "home", title: "Home", attach: "home", cardinality: "many" },
      worker: { script: "/* the view */" },
      store: store(),
      principal: owner,
      places: () => registry.map((place) => ({ as: place.as, title: place.title, kind: place.kind })),
      onNavigate: (to) => went.push(to),
      onProblem: (said) => problems.push(said),
    });
    live.push(view);
    const worker = FakeWorker.made.at(-1)!;
    worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
    const hello = worker.posted[0]!.message as HostHello;
    const port = worker.posted[0]!.transfer[0] as MessagePort;
    port.onmessage = (event) => {
      const data = event.data as { type?: string; beat?: number; push?: number };
      if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
      if (data.type === "props" && typeof data.push === "number") port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 3 });
    };
    port.postMessage({ type: "navigate", place: "overview", nonce: hello.nonce });
    port.postMessage({ type: "navigate", to: "home", nonce: hello.nonce });
    port.postMessage({ type: "navigate", place: "the-map", nonce: hello.nonce });
    await wait(50);
    expect(went).toEqual([{ place: "overview" }, { place: "home" }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^The place "the-map" is no place of this app: it goes nowhere\. Its places: "home" \(Home\), "overview" \(Scene\), /);
  });
});
