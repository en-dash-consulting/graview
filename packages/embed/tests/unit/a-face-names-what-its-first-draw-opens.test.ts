import { describe, expect, it } from "vitest";
import { FIRST_DRAW_DOORS, firstDrawChunks, type FirstDrawMetafile } from "../../src/first-draw.js";

/*
 * A FACE NAMES WHAT ITS FIRST DRAW OPENS (FR-194). Graview Cloud names in
 * its page's head every chunk its shell's startup doors open, but a face
 * opens doors of its own as it draws — the home's lenses, a list's
 * arranging, the scene's ribbons — each a round trip after the face's own
 * chunk on a phone. `firstDrawChunks` finds them in a host's own build.
 */
const statement = (path: string) => ({ path, kind: "import-statement" });
const dynamic = (path: string) => ({ path, kind: "dynamic-import" });

/** A build as a stranger's bundler writes it from node_modules: each door a chunk, a chunk shared under two of them, and what each opens later only when asked. */
const installed: FirstDrawMetafile = {
  outputs: {
    "out/page.js": { entryPoint: "<stdin>", imports: [statement("out/chunk.SHARED.js"), dynamic("out/chunk.PAGES.js"), dynamic("out/chunk.SCENE.js")] },
    "out/chunk.SHARED.js": { imports: [] },
    "out/chunk.PAGES.js": { entryPoint: "node_modules/.pnpm/@graview+embed@0.1.40/node_modules/@graview/embed/dist/pages-content.js", imports: [statement("out/chunk.SHARED.js"), statement("out/chunk.ROUTER.js"), dynamic("out/chunk.LENSES.js")] },
    "out/chunk.ROUTER.js": { imports: [] },
    "out/chunk.LENSES.js": { entryPoint: "node_modules/@graview/primitives/dist/declared-lenses.js", imports: [statement("out/chunk.FACTORIES.js")] },
    "out/chunk.FACTORIES.js": { imports: [statement("out/chunk.SHARED.js")] },
    "out/chunk.LISTS.js": { entryPoint: "node_modules/@graview/primitives/dist/arrange-lists.js", imports: [] },
    "out/chunk.SCENE.js": { entryPoint: "node_modules/@graview/embed/dist/scene-face.js", imports: [statement("out/chunk.SHARED.js"), dynamic("out/chunk.RIBBONS.js")] },
    "out/chunk.RIBBONS.js": { entryPoint: "node_modules/@graview/react/dist/ribbons-layer.js", imports: [] },
    "out/chunk.STUDIO.js": { entryPoint: "node_modules/@graview/studio/dist/index.js", imports: [] },
  },
};

describe("a face's first draw, named for a host's build", () => {
  it("names the face's own chunk and every door the face opens as it first draws, with what each imports outright, each once", () => {
    const pages = firstDrawChunks(installed, "pages");
    expect(new Set(pages)).toEqual(new Set(["out/chunk.PAGES.js", "out/chunk.SHARED.js", "out/chunk.ROUTER.js", "out/chunk.LENSES.js", "out/chunk.FACTORIES.js", "out/chunk.LISTS.js"]));
    expect(pages.length).toBe(new Set(pages).size);
  });

  it("names nothing of the other face, nor of a door only a press opens", () => {
    const pages = firstDrawChunks(installed, "pages");
    expect(pages).not.toContain("out/chunk.SCENE.js");
    expect(pages).not.toContain("out/chunk.RIBBONS.js");
    expect(pages).not.toContain("out/chunk.STUDIO.js");
    expect(firstDrawChunks(installed, "graview")).toEqual(firstDrawChunks(installed, "scene"));
    expect(new Set(firstDrawChunks(installed, "scene"))).toEqual(new Set(["out/chunk.SCENE.js", "out/chunk.SHARED.js", "out/chunk.RIBBONS.js"]));
  });

  it("finds a door built from the workspace's sources as well as from a package's build", () => {
    const sources: FirstDrawMetafile = {
      outputs: {
        "out/chunk.A.js": { entryPoint: "../../packages/primitives/src/declared-lenses.tsx", imports: [] },
        "out/chunk.B.js": { entryPoint: "packages/embed/src/pages-content.tsx", imports: [] },
        "out/chunk.C.js": { entryPoint: "C:\\app\\node_modules\\@graview\\primitives\\dist\\arrange-lists.js", imports: [] },
      },
    };
    expect(new Set(firstDrawChunks(sources, "pages"))).toEqual(new Set(["out/chunk.A.js", "out/chunk.B.js", "out/chunk.C.js"]));
  });

  it("says each face's doors by package and module, the face's own first", () => {
    expect(FIRST_DRAW_DOORS.pages[0]).toEqual({ package: "@graview/embed", module: "pages-content" });
    expect(FIRST_DRAW_DOORS.scene[0]).toEqual({ package: "@graview/embed", module: "scene-face" });
    expect(FIRST_DRAW_DOORS.picture[0]).toEqual({ package: "@graview/embed", module: "picture-face" });
    for (const doors of Object.values(FIRST_DRAW_DOORS)) for (const one of doors) expect(one.package).toMatch(/^@graview\/[a-z]+$/);
  });
});
