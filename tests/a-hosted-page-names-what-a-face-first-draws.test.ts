import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { FIRST_DRAW_DOORS, firstDrawChunks, type FirstDrawFace } from "@graview/embed/first-draw";
// @ts-expect-error — a plain .mjs module, without types.
import { HOSTED_PAGE_COMPILED_ENTRY, measureHostedPage, preloadLinks } from "../scripts/lib/hosted-page.mjs";

/**
 * A HOSTED PAGE NAMES WHAT A FACE FIRST DRAWS (FR-194). Built as Graview
 * Cloud builds its shell, every door `FIRST_DRAW_DOORS` names is a chunk
 * of the build — a door renamed or folded into another is a list that
 * would quietly name nothing — and the chunks `firstDrawChunks` finds are
 * named in the head beside the face's own, never up front.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Output = { entryPoint?: string; imports: { path: string; kind: string }[] };
let metafile: { outputs: Record<string, Output> };
let upFront: Set<string>;

beforeAll(async () => {
  ({ metafile } = (await measureHostedPage(repo, HOSTED_PAGE_COMPILED_ENTRY)) as { metafile: { outputs: Record<string, Output> } });
  const outputs = metafile.outputs;
  const entry = Object.keys(outputs).find((file) => outputs[file]!.entryPoint === "<stdin>")!;
  upFront = new Set([entry]);
  for (const file of upFront) for (const one of outputs[file]!.imports) if (one.kind === "import-statement" && outputs[one.path]) upFront.add(one.path);
}, 120_000);

describe("a hosted page's first draw", () => {
  it("finds every door each face names as a chunk of its own in the build", () => {
    const doorOf = (pkg: string, module: string) => Object.values(metafile.outputs).some((output) => output.entryPoint?.replace(/\.(tsx?|js)$/, "").endsWith(`packages/${pkg.replace("@graview/", "")}/src/${module}`));
    for (const [face, doors] of Object.entries(FIRST_DRAW_DOORS)) for (const one of doors) expect(doorOf(one.package, one.module), `${face}: ${one.package} ${one.module}`).toBe(true);
  });

  it("names the pages' lenses, a list's arranging and the bar's tools, and the scene's ribbons, ground and states, none of them up front", () => {
    const named = (face: FirstDrawFace) => firstDrawChunks(metafile, face).map((file) => metafile.outputs[file]!.entryPoint ?? "").filter(Boolean);
    for (const module of ["pages-content", "declared-lenses", "arrange-lists", "bar-panes"]) expect(named("pages").some((entry) => entry.includes(module)), module).toBe(true);
    for (const module of ["scene-face", "ribbons-layer", "plots", "states-bar", "scene-way-back-door"]) expect(named("graview").some((entry) => entry.includes(module)), module).toBe(true);
    expect(named("pages").some((entry) => entry.includes("scene-face"))).toBe(false);
    // Each door is a chunk of its own, fetched beside the face; what it shares with the first chunk is already there.
    for (const face of ["pages", "graview"] as const) for (const file of firstDrawChunks(metafile, face).filter((one) => metafile.outputs[one]!.entryPoint)) expect(upFront.has(file), file).toBe(false);
  });

  it("is named in the head the preview's page builds, and asked for once the face's own chunks have arrived", () => {
    const head = preloadLinks(metafile, { entry: Object.keys(metafile.outputs).find((file) => metafile.outputs[file]!.entryPoint === "<stdin>")!.split("/").pop(), faces: ["pages"], chunks: firstDrawChunks(metafile, "pages") }) as string;
    for (const file of firstDrawChunks(metafile, "pages")) expect(head).toContain(`"/${file.split("/").pop()}"`);
    // What the face opens is asked for once the face's own chunks have arrived: its links are written by the head's script, not in the head.
    expect(head).toMatch(/<script>.*addEventListener\("load"/);
  });
});
