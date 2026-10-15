// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isFileValue, Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { sayRefusal } from "../../src/headless/judge.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { imageRefusedWords, type OpenRefusal } from "../../src/host/open-judge.js";
import { createOpenRenderer } from "../../src/host/open-render.js";

/*
 * A VIEW SHOWS AN HTTPS IMAGE FROM AN ORIGIN ITS HOST LISTS
 * (2026-10-15, The Beatles).
 *
 * An artwork whose picture was a Wikimedia address drew nothing in a view:
 * a view loads nothing but what the host already holds. The host may now
 * list the `https:` origins a view's images may come from
 * (`images: { origins }`); an image there is drawn as given, asked for with
 * no referrer, and any other address is refused and said — the address,
 * why, and the ways a view may show an image. And a picture that is the
 * app's own (what `add_image` uploads) is held by an image field as the
 * file, not as its bytes in words, and drawn by its path.
 */
const INSERT = 0;
let ids = 0;
const img = (src: string) => ({ id: `i${(ids += 1)}`, type: 1, element: "img", attributes: { src, alt: "" }, children: [] });
const COVER = "https://upload.wikimedia.org/wikipedia/en/4/42/Beatles_-_Abbey_Road.jpg";
const WIKIMEDIA = ["https://upload.wikimedia.org"];

function draw(origins: readonly string[] | undefined, ...srcs: string[]) {
  const into = document.createElement("div");
  const heard: OpenRefusal[] = [];
  const renderer = createOpenRenderer(into, { origin: "https://app.example", ...(origins ? { imageOrigins: origins } : {}), onRefused: (refusal) => heard.push(refusal) });
  renderer.apply(srcs.map((src, index) => [INSERT, "~", img(src), index]));
  const images = [...into.querySelectorAll("img")];
  return { srcs: images.map((one) => one.getAttribute("src")), images, renderer, heard };
}

describe("an https image", () => {
  it("is drawn from an origin the host lists, with no referrer", () => {
    const { srcs, images } = draw(WIKIMEDIA, COVER);
    expect(srcs).toEqual([COVER]);
    expect(images[0]!.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("is refused from an origin the host does not list, or with none listed, and said with its address", () => {
    const { srcs, heard } = draw(WIKIMEDIA, "https://collector.example/c.png?who=ada");
    expect(srcs).toEqual([null]);
    expect(heard).toContainEqual(expect.objectContaining({ reason: "url", element: "img", address: "https://collector.example/c.png?who=ada" }));
    expect(draw(undefined, COVER).srcs).toEqual([null]);
  });

  it("is refused over http:, with a password in it, or on a list entry that is not an https: origin", () => {
    expect(draw(WIKIMEDIA, "http://upload.wikimedia.org/a.jpg", "https://ada:secret@upload.wikimedia.org/a.jpg").srcs).toEqual([null, null]);
    expect(draw(["http://upload.wikimedia.org", "upload.wikimedia.org"], COVER).srcs).toEqual([null]);
  });

  it("says why, naming the origins the host lists, and what a view may show instead", () => {
    const said = imageRefusedWords("https://collector.example/c.png", WIKIMEDIA);
    expect(said).toContain('"https://collector.example/c.png" was not drawn');
    expect(said).toContain("(https://upload.wikimedia.org)");
    expect(said).toContain("images.origins");
    expect(imageRefusedWords(COVER)).toContain("The host lists no origin a view's images may come from.");
    expect(sayRefusal({ reason: "url", element: "img", name: "src", address: COVER }).says).toContain(COVER);
  });

  it("is heard by the drawing as it is refused, for the host to say once", () => {
    const shadow = document.createElement("div").attachShadow({ mode: "open" });
    const heard: OpenRefusal[] = [];
    const drawing = createOpenDrawing(shadow, { origin: "https://app.example", imageOrigins: WIKIMEDIA, send: () => {}, onRefused: (refusal) => heard.push(refusal) });
    drawing.apply([[INSERT, "~", img(COVER), 0], [INSERT, "~", img("https://elsewhere.example/x.png"), 1]]);
    expect([...shadow.querySelectorAll("img")].map((one) => one.getAttribute("src"))).toEqual([COVER, null]);
    expect(heard.map((one) => one.address)).toEqual(["https://elsewhere.example/x.png"]);
  });
});

describe("a picture the app holds, in an image field", () => {
  // Under jsdom a module's own URL is not a file's: the fixtures are read from the checkout, where the tests run.
  const fixtures = join(process.cwd(), "packages/core/tests/document/fixtures");
  const compiled = compileDocument(JSON.parse(readFileSync(join(fixtures, "beatles.gdd.json"), "utf8")));
  if (!compiled.ok) throw new Error("the Beatles fixture compiles");
  const app = compiled.app as GraviewApp<AnySchema>;
  const SHA = "6918b1a956864fdf23aa0210d4d7e3af3017ad01eff32f7cde8a4af93b903be2";
  const uploaded = { href: `/graview/assets/${SHA}.jpg`, name: "abbey-road.jpg", type: "image/jpeg", bytes: 2_400_000, width: 3000, height: 3000 };

  it("holds the uploaded file, whatever its size, where a text field holds at most 20,000 characters", () => {
    expect(isFileValue(uploaded)).toBe(true);
    const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [{ id: "a1", kind: "artwork", name: "Abbey Road", image: uploaded }], edges: [] } as never });
    expect((store.graph.getNode("a1") as Record<string, unknown>)["image"]).toEqual(uploaded);
  });

  it("is drawn by a view by the path the record keeps, where the host says where the app's images live", () => {
    const into = document.createElement("div");
    const renderer = createOpenRenderer(into, { origin: "https://app.example", asset: (path) => `/a/beatles${path}` });
    renderer.apply([[INSERT, "~", img(uploaded.href), 0]]);
    expect(into.querySelector("img")!.getAttribute("src")).toBe(`/a/beatles${uploaded.href}`);
  });
});
