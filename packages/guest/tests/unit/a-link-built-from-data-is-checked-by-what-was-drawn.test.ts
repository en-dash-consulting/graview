import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { placesOf } from "@graview/core/seat";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { runWorkerViewHeadless, type RunWorkerViewHeadlessOptions } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";

/**
 * A LINK BUILT FROM DATA IS CHECKED BY WHAT WAS DRAWN (Roadmap
 * f-check-view-template-expr).
 *
 * AI Atlas drew its nav strip from a list, `<a data-place="${n[0]}">` inside
 * `graview.html`, and `propose_view` answered "Flagged: "${n[0]}" is no
 * place of this app": a pass over the view's source text read the
 * expression as the slug. A view's links are judged by what its run drew —
 * the value each expression came to — so a strip whose every drawn value is
 * a real place, record or list is no problem, whatever its source says; one
 * whose drawn value goes nowhere is said by that value; and a literal slug
 * that is no place is said as it always was.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("beatles.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the Beatles fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("beatles.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const home: WorkerViewManifest = { name: "home", title: "Home", attach: "home", cardinality: "many" };
const live: WorkerViewManifest = { name: "live", title: "Live songs", attach: "song", cardinality: "many" };

/** A nav strip drawn from a list of [slug, words], each link's slug a template expression in the source. */
const strip = (pairs: readonly (readonly [string, string])[]) =>
  `const nav = ${JSON.stringify(pairs)};
graview.onProps(() => graview.render(graview.html\`<nav>\${nav.map((n) => graview.html\`<a data-place="\${n[0]}">\${n[1]}</a>\`)}</nav>\`));`;

const ran = async (given: Partial<RunWorkerViewHeadlessOptions<AnySchema>> & Pick<RunWorkerViewHeadlessOptions<AnySchema>, "source">) => {
  const result = await runWorkerViewHeadless({ store: store(), principal: owner, run: nodeIsolate(), manifest: home, places: placesOf(app), views: [live], ...given });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result;
};
const said = async (given: Parameters<typeof ran>[0]) => (await ran(given)).description.problems.map((problem) => problem.says);

describe("a link a view builds from data", () => {
  it("is not flagged for its template expression when every value drawn is a place, a list or a titled view's place", async () => {
    expect(await said({ source: strip([["songs", "Songs"], ["live-songs", "Live"], ["home", "Home"]]) })).toEqual([]);
  });

  it("is not flagged when a data-record or a navigate is built from a template expression that comes to a real record or place", async () => {
    const source = `graview.onProps((props) => {
  const shown = (props.nodes ?? []).slice(0, 3);
  graview.render(graview.html\`<ul>\${shown.map((n) => graview.html\`<li><a data-record="\${n.id}">\${n.label ?? n.id}</a></li>\`)}</ul>\`);
  const where = "live";
  graview.navigate(\`\${where}-songs\`);
});`;
    expect(source).toContain('data-record="${n.id}"');
    const result = await ran({ source, manifest: live });
    expect(result.description.problems).toEqual([]);
    // The records were drawn, by their ids: the check judged real values, not none.
    const drawn = result.description.parts.flatMap((part) => (part.t === "list" ? part.groups.flatMap((group) => group.items.map((one) => one.kind)) : []));
    expect(drawn).toEqual(["song", "song", "song"]);
  });

  it("is still flagged when a value it drew goes nowhere, by that value and not the expression", async () => {
    const problems = await said({ source: strip([["songs", "Songs"], ["songs-by-hue", "By hue"]]) });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('It names the place "songs-by-hue", which this app does not have.');
    expect(problems.join("\n")).not.toContain("${");
  });

  it("is still flagged when a navigate built from data goes nowhere, by the value it came to", async () => {
    const problems = await said({ source: `graview.onProps(() => { const hue = "teal"; graview.render(graview.html\`<p>Songs</p>\`); graview.navigate({ place: \`songs-in-\${hue}\` }); });` });
    expect(problems).toEqual([expect.stringContaining('It goes to the place "songs-in-teal", which this app does not have.')]);
  });
});

describe("a literal link", () => {
  it("that names no place is still flagged", async () => {
    const problems = await said({ source: 'graview.onProps(() => graview.render(graview.html`<nav><a data-place="songs">Songs</a><a data-place="setlists">Setlists</a></nav>`));' });
    expect(problems).toEqual([expect.stringContaining('It names the place "setlists", which this app does not have.')]);
  });

  it("that names no record is still flagged", async () => {
    const problems = await said({ source: 'graview.onProps(() => graview.render(graview.html`<a data-record="song:nowhere">Nowhere</a>`));' });
    expect(problems).toEqual([expect.stringContaining('It names "song:nowhere", which this seat was not shown and is no place of this app')]);
  });
});
