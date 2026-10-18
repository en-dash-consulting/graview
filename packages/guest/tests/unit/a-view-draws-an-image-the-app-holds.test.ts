// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Store, type AnySchema } from "@graview/core";
import { ana, jobsApp, jobsSeed } from "../../../../scripts/fixtures/jobs-app.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { imageRefusedWords } from "../../src/host/open-judge.js";
import { createOpenRenderer } from "../../src/host/open-render.js";

/*
 * AN IMAGE THE APP HOLDS. A view draws `data:` images and the page's own
 * `blob:`, and — where its host says where they live — the images the app
 * itself holds, by the content address `add_image` answers:
 * `/graview/assets/<sha256>.<ext>`. The host turns the path into its own
 * address for it; nothing else under the app, and no other origin, is drawn.
 */
const INSERT = 0;
let ids = 0;
const img = (src: string) => ({ id: `i${(ids += 1)}`, type: 1, element: "img", attributes: { src, alt: "" }, children: [] });
const SHA = "6918b1a956864fdf23aa0210d4d7e3af3017ad01eff32f7cde8a4af93b903be2";

function draw(asset: ((path: string) => string | undefined) | undefined, ...srcs: string[]) {
  const into = document.createElement("div");
  const renderer = createOpenRenderer(into, { origin: "https://app.example", ...(asset ? { asset } : {}) });
  renderer.apply(srcs.map((src, index) => [INSERT, "~", img(src), index]));
  return { srcs: [...into.querySelectorAll("img")].map((one) => one.getAttribute("src")), renderer };
}

describe("a view draws an image the app holds", () => {
  const under = (path: string) => `/a/discography${path}`;

  it("draws it at the address its host gives for the path", () => {
    const { srcs } = draw(under, `/graview/assets/${SHA}.jpg`, `/graview/assets/${SHA}.svg`);
    expect(srcs).toEqual([`/a/discography/graview/assets/${SHA}.jpg`, `/a/discography/graview/assets/${SHA}.svg`]);
  });

  it("refuses it where the host says nothing of where it lives", () => {
    const { srcs, renderer } = draw(undefined, `/graview/assets/${SHA}.jpg`);
    expect(srcs).toEqual([null]);
    expect(renderer.refused).toContainEqual(expect.objectContaining({ reason: "url", name: "src" }));
  });

  it("refuses it where the host answers nothing for that path", () => {
    expect(draw(() => undefined, `/graview/assets/${SHA}.png`).srcs).toEqual([null]);
  });

  it("refuses anything else under the app, or anywhere else, resolver or not", () => {
    const { srcs } = draw(
      under,
      "/graview/document",
      "/graview/assets/../wire",
      `/graview/assets/${SHA}.html`,
      "/graview/assets/short.jpg",
      `https://attacker.example/graview/assets/${SHA}.jpg`,
      `//attacker.example/graview/assets/${SHA}.jpg`,
      `graview/assets/${SHA}.jpg`,
    );
    expect(srcs).toEqual([null, null, null, null, null, null, null]);
  });
});

/*
 * IN EVERY FORM A VIEW IS LIKELY TO WRITE IT (Roadmap, 2026-10-18, a photo
 * gallery on Graview Cloud: "views refuse the app's own /graview/assets/
 * images that add_image stored"). `add_image` answers the path; a view
 * that wrote it under the app's base, or as the app's full address, was
 * refused too, and a headless run (Cloud's `propose_view`) refused every
 * one, since the run had no way to hear where the app's images live. Each
 * form is the same image, drawn from the host's address for its path; and
 * the sentence a refusal says never offers what the host refuses.
 */
describe("the app's own image, as add_image answered it", () => {
  const under = (path: string) => `/a/maryland${path}`;
  const PATH = `/graview/assets/${SHA}.webp`;

  it("is drawn by its path, under the app's base, and by the app's full address on the page's own origin", () => {
    const { srcs } = draw(under, PATH, `/a/maryland${PATH}`, `https://app.example/a/maryland${PATH}`, `https://app.example${PATH}`);
    expect(srcs).toEqual([under(PATH), under(PATH), under(PATH), under(PATH)]);
  });

  it("is refused by an address on another origin, or one that climbs, a query or a path the host did not give", () => {
    const { srcs } = draw(under, `https://canyon-zm.graview.app/a/maryland${PATH}`, `/a/../graview/assets/${SHA}.webp`, `${PATH}?x=1`, `/a/maryland/graview/assets/${SHA}.webp/`, `/a%2f..${PATH}`);
    expect(srcs).toEqual([null, null, null, null, null]);
  });

  it("is said, when refused, in words that offer only what this host draws", () => {
    const without = imageRefusedWords(PATH);
    expect(without).not.toContain("the app's own image (/graview/assets/");
    expect(without).toContain("This host has not said where the app's own images live (asset, on the view's definition)");
    expect(imageRefusedWords("https://elsewhere.example/x.png")).not.toContain("/graview/assets/");
    const withAssets = imageRefusedWords("https://elsewhere.example/x.png", { assets: true });
    expect(withAssets).toContain("the app's own image by the path add_image answered (/graview/assets/<sha256>.<ext>)");
    expect(imageRefusedWords(`https://canyon-zm.graview.app${PATH}`, { assets: true })).toContain(`write it as its path, ${PATH}`);
  });

  it("is drawn in a headless run whose host says where the app's images live, in all three forms; refused, with why, where it does not", async () => {
    const live = new Store({ schema: jobsApp.schema, mutations: [], policy: jobsApp.policy!, snapshot: structuredClone(jobsSeed) as never }) as unknown as Store<AnySchema>;
    const source = `graview.onProps(() => graview.render(graview.html\`<img src="${PATH}" alt="one"><img src="/a/maryland${PATH}" alt="two"><img src="https://endash.graview.app/a/maryland${PATH}" alt="three">\`));`;
    const manifest = { name: "gallery", attach: "job", cardinality: "many" } as const;
    const drawn = await runWorkerViewHeadless({ manifest, source, store: live, principal: ana, run: nodeIsolate(), asset: under, origin: "https://endash.graview.app" });
    if (!drawn.ok) throw new Error(`${drawn.reason}: ${drawn.detail}`);
    expect(drawn.description.problems).toEqual([]);
    expect(drawn.description.text).toContain("one");
    expect(drawn.description.text).toContain("three");
    const refused = await runWorkerViewHeadless({ manifest, source, store: live, principal: ana, run: nodeIsolate() });
    if (!refused.ok) throw new Error(`${refused.reason}: ${refused.detail}`);
    expect(refused.description.problems.length).toBe(3);
    for (const problem of refused.description.problems) expect(problem.says).not.toContain("the app's own image (/graview/assets/");
    expect(refused.description.problems[0]!.says).toContain("asset, on the view's definition");
  });
});
