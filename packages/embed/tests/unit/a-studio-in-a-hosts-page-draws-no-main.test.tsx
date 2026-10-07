// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocumentWithoutCheck, type GraviewDocument } from "@graview/core/document";
import axe from "axe-core";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * FR-58: A STUDIO IN A HOST'S PAGE DRAWS NO MAIN OF ITS OWN.
 *
 * Graview Cloud's builder mounts the studio through the embed's
 * `studio: { onApply }` into a `<div>` inside its page's own `<main>`. The
 * studio drew a `<main>` of its own inside the embed's labeled section, so
 * axe failed the host on `landmark-main-is-top-level` and
 * `landmark-no-duplicate-main` whatever the host did. Here the host's page
 * is built the way Cloud's is (a header, a nav, its main, a footer) and axe
 * is run over the whole document with the studio open.
 */
const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/vendors.gdd.json"), "utf8")) as GraviewDocument;

function builder(): { app: GraviewApp<AnySchema>; store: Store<AnySchema> } {
  const compiled = compileDocumentWithoutCheck(vendors);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  // As Cloud's builder does: a store with no policy, because the host judged who may build.
  return { app, store: new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [] }) };
}

/** The landmark rules, and `region`: what a page that mounts the studio is judged on. */
const LANDMARK_RULES = axe
  .getRules()
  .map((rule) => rule.ruleId)
  .filter((id) => id.startsWith("landmark") || id === "region");

const handles: EmbedHandle[] = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await act(async () => handle.unmount());
  document.body.innerHTML = "";
});

async function hostPage(studio: EmbedOptions["studio"]): Promise<HTMLElement> {
  document.body.innerHTML = `<header><nav aria-label="Account"><a href="/apps">Apps</a></nav></header><main><h1>Build Wedding vendors</h1><div id="graview-builder" style="position:relative;height:700px"></div></main><footer><a href="/privacy">Privacy</a></footer>`;
  const element = document.getElementById("graview-builder")!;
  const { app, store } = builder();
  await act(async () => {
    handles.push(
      mount(element, {
        app,
        store,
        principal: { kind: "human", id: "builder" },
        studio,
        stop: "#overview=1&in.studio=open",
        face: "graview",
        heading: false,
        label: "Wedding vendors: studio",
        fonts: false,
      } as EmbedOptions<AnySchema>),
    );
  });
  // The studio's chunk arrives, then the studio draws.
  for (let tries = 0; tries < 50 && !element.querySelector('[data-testid="studio"]'); tries += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
  }
  return element;
}

const violations = async () => {
  const result = await axe.run(document, { runOnly: { type: "rule", values: LANDMARK_RULES }, resultTypes: ["violations"] });
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
};

describe("a studio mounted into a host's page", () => {
  it("draws no main of its own, and axe finds no landmark violation on the host's page", async () => {
    const element = await hostPage({ onApply: () => {} });
    const studio = element.querySelector('[data-testid="studio"]');
    expect(studio, "the studio opened").not.toBeNull();
    expect(element.querySelector("main"), "no main inside the embed").toBeNull();
    expect(document.querySelectorAll("main")).toHaveLength(1);
    // The picture is still a landmark a reader can reach, named for what it is.
    expect(studio!.querySelector('section[aria-label$="The declaration"]')).not.toBeNull();
    expect(await violations()).toEqual([]);
  });

  it("keeps its main when the host says so, which axe then holds against a host that has one", async () => {
    const element = await hostPage({ onApply: () => {}, landmark: "main" });
    expect(element.querySelector('[data-testid="studio"] main')).not.toBeNull();
    // The very failure Cloud reported: what the default above is free of.
    const said = (await violations()).map((line) => line.split(":")[0]);
    expect(said).toEqual(expect.arrayContaining(["landmark-main-is-top-level", "landmark-no-duplicate-main"]));
  });
});
