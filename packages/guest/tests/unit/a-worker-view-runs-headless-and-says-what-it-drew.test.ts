import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { describePlace, type DescribedPart, type PlaceDescription } from "@graview/core/describe";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it, vi } from "vitest";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { headlessScript, runWorkerViewHeadless, type HeadlessPayload, type HeadlessResult, type RunWorkerViewHeadlessOptions } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";

/**
 * A WORKER VIEW RUNS HEADLESS, AND SAYS WHAT IT DREW (FR-95). Graview
 * Cloud checks a chat's view before it applies it: run once against the
 * proposer's own view of the app, with no network, in an isolate the host
 * picked and never in the host's own context, and told what it drew in the
 * words `describePlace` says a place in (FR-89) — or why it will not do.
 *
 * LifeLogics' four lenses are declared as blocks; here each is written
 * again as a worker view (tests/fixtures/lifelogics), run headless for the
 * owner and for the partner, and held to what `describePlace` says the
 * declared lens shows the same seat: the same records, by the same titles,
 * under the same headings. The isolate is `@graview/guest/headless/node`'s
 * — a worker thread and a context made from nothing. That it runs in
 * workerd with no outbound network is tests/a-worker-view-runs-headless-in-workerd.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const partner: Principal = { kind: "agent", id: "keel-agent", roles: ["partner"], onBehalfOf: { kind: "human", id: "party-delivery", roles: ["partner"] } };
const view = (name: string) => readFileSync(new URL(`../fixtures/lifelogics/${name}.js`, import.meta.url), "utf8");
const run = nodeIsolate();

const LENSES: readonly { readonly place: string; readonly manifest: WorkerViewManifest; readonly source: string }[] = [
  { place: "the-offers", manifest: { name: "offers", title: "The offers", attach: "offer", cardinality: "many", reads: { kinds: ["party"] } }, source: view("offers") },
  { place: "the-packages", manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } }, source: view("packages") },
  { place: "what-we-heard", manifest: { name: "heard", title: "What we heard", attach: "signal", cardinality: "many" }, source: view("heard") },
  { place: "open-questions", manifest: { name: "questions", title: "Open questions", attach: "question", cardinality: "many" }, source: view("questions") },
];

const headless = (given: Partial<RunWorkerViewHeadlessOptions<AnySchema>> & Pick<RunWorkerViewHeadlessOptions<AnySchema>, "manifest" | "source">) =>
  runWorkerViewHeadless({ store: store(), principal: owner, run, ...given });

/** Each list's records, top-level only, under the heading its group carries or the heading just before it. */
function sections(parts: readonly DescribedPart[]): { heading: string | null; items: { id: string; title: string }[] }[] {
  const out: { heading: string | null; items: { id: string; title: string }[] }[] = [];
  let before: string | null = null;
  for (const part of parts) {
    if (part.t === "heading") before = part.text;
    if (part.t !== "list") {
      if (part.t !== "heading") before = null;
      continue;
    }
    for (const group of part.groups) out.push({ heading: group.heading ?? before, items: group.items.map(({ id, title }) => ({ id, title })) });
    before = null;
  }
  return out;
}
const described = (result: HeadlessResult): PlaceDescription => {
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result.description;
};

describe("LifeLogics' lenses, written as worker views and run headless", () => {
  for (const lens of LENSES) {
    for (const [seat, principal] of [["the owner", owner], ["the partner", partner]] as const) {
      it(`${lens.manifest.title} shows ${seat} the records, titles and headings the declared lens shows them`, async () => {
        const declared = describePlace(store(), principal, lens.place, { app });
        if (!declared.ok) throw new Error(declared.error);
        const drawn = described(await headless({ manifest: lens.manifest, source: lens.source, principal }));
        const expected = sections(declared.description.parts);
        expect(expected.flatMap((section) => section.items).length).toBeGreaterThan(0);
        expect(sections(drawn.parts)).toEqual(expected);
        expect(drawn.problems).toEqual([]);
      });
    }
  }

  it("says the place it is, the seat, and that a view drew it, as text a chat can quote", async () => {
    const drawn = described(await headless({ ...LENSES[1]!, principal: partner, width: 390 }));
    expect(drawn.place).toEqual({ slug: "the-packages", title: "The packages", kind: "package", address: "/places/the-packages" });
    expect(drawn).toMatchObject({ seat: "partner", width: 390, variant: "phone", drawnBy: "view:packages" });
    expect(drawn.text).toContain("The same offers in three sets, compared on price.");
    expect(drawn.text).toContain("[Recommended]");
    expect(drawn.text).toMatch(/- The small start\n/);
  });

  it("is handed the seat's sight and no more: the partner's packages hold only the offers the partner may see", async () => {
    const asOwner = await headless({ ...LENSES[1]!, principal: owner });
    const asPartner = await headless({ ...LENSES[1]!, principal: partner });
    if (!asOwner.ok || !asPartner.ok) throw new Error("refused");
    const offers = (result: typeof asOwner) => JSON.stringify(result.transcript.renders).match(/offer-[a-z]+/g)?.sort() ?? [];
    expect(new Set(offers(asOwner))).toEqual(new Set(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]));
    expect(new Set(offers(asPartner))).toEqual(new Set(["offer-analysis", "offer-suite"]));
    expect(JSON.stringify(asPartner)).not.toContain("Two-day workshop");
  });

  it("runs the skill's own examples too", async () => {
    const examples = new URL("../../../skills/skills/graview-worker-view/examples/", import.meta.url);
    const list = await headless({ manifest: { name: "offers", title: "The offers", attach: "offer", cardinality: "many", reads: { kinds: ["package"], edges: ["includes"] }, acts: ["add-note"] }, source: readFileSync(new URL("offers-list.js", examples), "utf8") });
    expect(sections(described(list).parts)[0]!.items.map((item) => item.id)).toEqual(["offer-workshop", "offer-analysis", "offer-advice", "offer-suite"]);
    const front = await headless({
      manifest: { name: "front", title: "Offers", attach: "home", cardinality: "many", reads: { kinds: ["package", "offer"], edges: ["includes"] } },
      source: readFileSync(new URL("front-page.js", examples), "utf8"),
      places: [{ as: "the-packages", title: "The packages", kind: "package" }],
    });
    const home = described(front);
    expect(home.place).toMatchObject({ slug: "home", kind: null, address: "/" });
    expect(home.parts).toContainEqual({ t: "heading", level: 1, text: "The small start" });
    expect(home.problems).toEqual([]);
  });
});

describe("a view that will not do is a failure naming why", () => {
  const manifest: WorkerViewManifest = { name: "probe", title: "Probe", attach: "offer", cardinality: "many", acts: ["add-note"] };
  const failure = async (source: string, given: Partial<RunWorkerViewHeadlessOptions<AnySchema>> = {}) => {
    const result = await headless({ manifest, source, ...given });
    if (result.ok) throw new Error(`it ran: ${result.description.text}`);
    return result;
  };

  it("throws at its top line: error, with what it threw", async () => {
    expect(await failure(`throw new Error("no props yet");`)).toMatchObject({ reason: "error", detail: expect.stringContaining("no props yet") });
  });

  it("throws over what it is shown: error, with what it threw", async () => {
    expect(await failure(`graview.onProps((props) => graview.render(props.nodes.nope.length));`)).toMatchObject({ reason: "error", detail: expect.stringContaining("TypeError") });
  });

  it("draws more than it may: nodes", async () => {
    expect(await failure(`graview.onProps((props) => graview.render(graview.html\`<ul>\${Array.from({ length: 80 }, (_, i) => graview.html\`<li>\${i}</li>\`)}</ul>\`));`, { limits: { maxNodes: 50 } })).toMatchObject({ reason: "nodes", detail: expect.stringContaining("50") });
  });

  it("sends more messages than it may: flood", async () => {
    expect(await failure(`graview.onProps(() => { for (let i = 0; i < 200; i += 1) graview.navigate({ place: "nowhere" }); });`)).toMatchObject({ reason: "flood", detail: expect.stringContaining("120") });
  });

  it("is longer than it may be: source, before anything runs", async () => {
    const calls: HeadlessPayload[] = [];
    const big = `graview.render("${"x".repeat(2_000)}");`;
    const result = await runWorkerViewHeadless({ store: store(), principal: owner, manifest, source: big, run: async (payload) => (calls.push(payload), ""), limits: { maxSourceBytes: 1_000 } });
    expect(result).toMatchObject({ ok: false, reason: "source", detail: expect.stringContaining("1,000 bytes") });
    expect(calls).toEqual([]);
  });

  it("spins at its top line: slow, the isolate stopped at its deadline", async () => {
    expect(await failure(`for (;;) {}`, { limits: { runMs: 300 } })).toMatchObject({ reason: "slow" });
  });

  it("spins in a promise's turns: slow, the isolate stopped at its deadline", async () => {
    expect(await failure(`graview.onProps(async () => { for (;;) await 0; });`, { limits: { runMs: 300 } })).toMatchObject({ reason: "slow" });
  });

  it("takes longer over a push than it may: slow", async () => {
    expect(await failure(`graview.onProps(() => { const end = Date.now() + 120; while (Date.now() < end) {} graview.render("done"); });`, { limits: { pushMs: 50 } })).toMatchObject({ reason: "slow", detail: expect.stringContaining("50 ms") });
  });

  it("asks from its code for an act its manifest does not name: act, naming it", async () => {
    expect(await failure(`graview.onProps(() => { graview.act("add-offer", { name: "x" }); graview.render("asked"); });`)).toMatchObject({ reason: "act", detail: expect.stringContaining('"add-offer"') });
    expect(await failure(`graview.onProps(() => { graview.act("buy-everything"); });`)).toMatchObject({ reason: "act", detail: expect.stringContaining('"buy-everything"') });
  });

  it("binds a press to an act its manifest does not name: act, naming it", async () => {
    expect(await failure(`graview.onProps(() => graview.render('<button data-act="remove-offer">Gone</button>'));`)).toMatchObject({ reason: "act", detail: expect.stringContaining('"remove-offer"') });
  });

  it("names a kind, an edge or an act the app does not declare: manifest, naming each, before anything runs", async () => {
    const result = await headless({ manifest: { name: "probe", attach: "offre", cardinality: "many", reads: { kinds: ["packet"], edges: ["holds"] }, acts: ["buy"] }, source: `graview.render("x");` });
    expect(result).toMatchObject({ ok: false, reason: "manifest" });
    if (result.ok) return;
    for (const name of ["offre", "packet", "holds", "buy"]) expect(result.detail).toContain(`"${name}"`);
  });

  it("asks for an act it names, and nothing is applied", async () => {
    const before = store();
    const result = await runWorkerViewHeadless({ store: before, principal: owner, run, manifest, source: `graview.onProps(async () => { const answer = await graview.act("add-note", { name: "x", type: "fact", source: "our-read" }); graview.render(graview.html\`<p>\${answer.message}</p>\`); });` });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript.asked).toEqual([{ name: "add-note", args: { name: "x", type: "fact", source: "our-read" } }]);
    expect(result.description.text).toContain("Nothing is applied in a headless run.");
    expect(before.graph.nodesOfKind("signal" as never)).toHaveLength(6);
  });

  it("says what the open kit would not draw, as problems, and draws the rest", async () => {
    const result = await headless({ manifest, source: `graview.style("@im" + "port url(https://attacker.example/x.css); p { color: red }"); graview.onProps(() => graview.render('<p>kept</p><iframe src="https://attacker.example/"></iframe><a data-record="offer-nope">gone</a>'));` });
    const drawn = described(result);
    expect(drawn.parts).toContainEqual({ t: "text", text: "kept" });
    const said = drawn.problems.map((problem) => problem.says).join(" ");
    expect(said).toMatch(/<iframe> is not in the open kit/);
    expect(said).toMatch(/CSS the open kit leaves out/);
    expect(said).toMatch(/"offer-nope", which this seat was not shown/);
  });
});

describe("never in the host's own context", () => {
  it("refuses to run at all without an isolate the host supplies", async () => {
    await expect(runWorkerViewHeadless({ store: store(), principal: owner, manifest: LENSES[0]!.manifest, source: LENSES[0]!.source } as never)).rejects.toThrow(/never runs one in the host's own context/);
  });

  it("hands the isolate text and nothing else, and takes text back", async () => {
    const seen: HeadlessPayload[] = [];
    await runWorkerViewHeadless({ store: store(), principal: owner, ...LENSES[0]!, run: (payload) => (seen.push(payload), run(payload)) });
    expect(Object.keys(seen[0]!).sort()).toEqual(["entry", "input", "script", "timeoutMs"]);
    expect(typeof seen[0]!.script).toBe("string");
    expect(typeof seen[0]!.input).toBe("string");
    expect(seen[0]!.script).toBe(headlessScript(LENSES[0]!.source));
  });

  it("leaves the host's global as it was, and reaches nothing of the host's from the isolate", async () => {
    const result = await headless({
      manifest: { name: "probe", attach: "offer", cardinality: "many" },
      source: `try { globalThis.leaked = "yes"; } catch (error) {} graview.onProps(() => graview.render(graview.html\`<p>\${["process", "require", "fetch", "WebSocket", "XMLHttpRequest", "im" + "portScripts", "eval", "Buffer", "setImmediate"].map((name) => name + ":" + typeof globalThis[name]).join(" ")}</p>\`));`,
    });
    expect((globalThis as { leaked?: unknown }).leaked).toBeUndefined();
    expect(described(result).text).toContain("process:undefined require:undefined fetch:undefined WebSocket:undefined XMLHttpRequest:undefined importScripts:undefined eval:undefined Buffer:undefined setImmediate:undefined");
  });

  it("is an entry whose module graph a browser bundles, with no way to run code in the page", async () => {
    const esbuild = await import("esbuild");
    const built = await esbuild.build({
      entryPoints: [new URL("../../src/headless/index.ts", import.meta.url).pathname],
      bundle: true,
      format: "esm",
      platform: "browser",
      external: ["@graview/core", "@graview/core/describe"],
      write: false,
      logLevel: "silent",
    });
    const code = built.outputFiles[0]!.text;
    /* The runtime the isolate runs is a string here, never code: what is outside it is what the page would run. */
    const outside = code.replace(/HEADLESS_RUNTIME = (["'])(?:(?!\1)[^\\]|\\.)*\1/, 'HEADLESS_RUNTIME = ""');
    expect(outside).toContain('HEADLESS_RUNTIME = ""');
    expect(outside).not.toMatch(/\bnew Function\b|\beval\(|["']node:|worker_threads|\bimport\(\s*[^"'`\s]/);
  });
});

describe("graview view check", () => {
  const args = (file: string, ...more: string[]) => [
    "check",
    new URL(`../fixtures/lifelogics/${file}`, import.meta.url).pathname,
    "--app",
    new URL("lifelogics.gdd.json", fixtures).pathname,
    "--manifest",
    new URL("../fixtures/lifelogics/packages.manifest.json", import.meta.url).pathname,
    "--seed",
    new URL("lifelogics.seed.json", fixtures).pathname,
    ...more,
  ];
  const said = async (argv: readonly string[]) => {
    const { view: check } = await import("../../src/cli.js");
    const written: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
    try {
      return { code: await check(argv), text: written.join("") };
    } finally {
      write.mockRestore();
    }
  };

  it("runs a view headless for the seat it is given and prints what it drew", async () => {
    const { code, text } = await said(args("packages.js", "--as", "party-delivery", "--roles", "partner"));
    expect(code).toBe(0);
    expect(text).toContain("The packages (/places/the-packages) — as partner");
    expect(text).toContain("  - Codebase analysis");
    expect(text).not.toContain("Two-day workshop");
  });

  it("says why a view will not do, and exits 1", async () => {
    const { code, text } = await said(args("throws.js"));
    expect(code).toBe(1);
    expect(text).toMatch(/throws\.js will not do \(error\): It threw: Error: no package drawn: 7 records were shown/);
  });
});
