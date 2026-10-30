import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { compareViewRevision } from "@graview/core/revisions";
import { composeSection, locateSection } from "@graview/tools/section";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../packages/guest/src/headless/index.js";
import { nodeIsolate } from "../packages/guest/src/headless/node.js";

/**
 * A SECTION MADE BETTER RUNS, AND LOSES NO STYLE (Roadmap
 * f-make-this-section-better). Homeflow's home lost "This week"'s layout
 * when a chat rewrote the view whole. "Make this better" revises only the
 * section: here "This week" is revised as a model would answer it, composed
 * whole, run headless as Cloud runs a proposed view, and compared with the
 * view it replaces — every class it draws still styled, Dinner still drawn —
 * while a revision that drops the section's rules is caught by the same
 * comparison the card judges a draft by.
 */
const fixtures = new URL("../packages/core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const before = readFileSync(new URL("../packages/guest/tests/fixtures/revisions/home-before.js", import.meta.url), "utf8");
const run = nodeIsolate();

async function drawn(source: string): Promise<HeadlessDescribed> {
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
  const result = await runWorkerViewHeadless({ store, principal: owner, run, manifest: { name: "home", attach: "home", cardinality: "many" }, source, audit: true, drawing: true });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result;
}

const MARKUP = `<section class="hf-week" aria-labelledby="wk"><h2 id="wk">This week</h2>
      <ol class="hf-days">\${days.map((day) => graview.html\`<li class="hf-wk-day js-pick" data-key="\${day}"><h3>\${day}</h3></li>\`)}</ol>
    </section>`;

describe("a section made better, run headless beside the view it replaces", () => {
  it("draws every class it uses styled, and every section the view drew", async () => {
    const located = locateSection(before, "This week")!;
    const after = composeSection(before, located, {
      markup: MARKUP,
      css: ".hf-week { display: grid; gap: 12px; }\n.hf-days { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; padding: 0; list-style: none; }\n.hf-wk-day { padding: 8px; background: var(--graview-panel); }\n.hf-wk-day h3 { margin: 0; }",
    });
    const [was, now] = [await drawn(before), await drawn(after)];
    const revision = compareViewRevision({ source: before, css: was.css, drawing: was.drawing!.root }, { source: after, css: now.css, drawing: now.drawing!.root });
    expect(revision.unstyled).toEqual([]);
    expect(revision.sectionsMissing).toEqual([]);
    expect(now.css).toContain(".hf-days");
    expect(now.css).toContain(".hf-dinner");
  });

  it("says what a revision that dropped the section's rules left unstyled", async () => {
    const located = locateSection(before, "This week")!;
    const after = composeSection(before, located, { markup: MARKUP, css: ".hf-days { display: grid; }" });
    const [was, now] = [await drawn(before), await drawn(after)];
    const revision = compareViewRevision({ source: before, css: was.css, drawing: was.drawing!.root }, { source: after, css: now.css, drawing: now.drawing!.root });
    expect(revision.unstyled.map((one) => one.class).sort()).toEqual(["hf-week", "hf-wk-day"]);
  });
});
