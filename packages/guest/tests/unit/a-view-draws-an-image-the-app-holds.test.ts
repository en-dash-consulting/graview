// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
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
