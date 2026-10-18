import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  COMPILER_MODULES,
  HOSTED_PAGE_BASE,
  HOSTED_PAGE_BUDGET,
  HOSTED_PAGE_COMPILED_BASE,
  HOSTED_PAGE_COMPILED_BUDGET,
  HOSTED_PAGE_COMPILED_ENTRY,
  HOSTED_RAISES,
  hostedRaises,
  keepingSubscriptions,
  measureHostedPage,
  packageOf,
  withHostedRaises,
  // @ts-expect-error — a plain .mjs module, without types.
} from "../scripts/lib/hosted-page.mjs";
// @ts-expect-error — a plain .mjs module, without types.
import { hostedPageMarkdown } from "../scripts/lib/hosted-page-notes.mjs";

/**
 * A HOSTED PAGE KEEPS TO ITS BUDGET (FR-57). Graview Cloud's shell —
 * `openRemote` plus the embed over a document-compiled app — carried
 * 1.11 MB of framework before the app drew. Built the way Cloud builds it,
 * over the vendors document, it is measured from esbuild's metafile
 * (`pnpm hosted` writes the same as docs/hosted-page.json).
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Measured = {
  upFront: { minified: number; gzipped: number; zod: number; packages: Record<string, number>; modules: Record<string, number> };
  whenAsked: { minified: number; packages: Record<string, number>; doors: { module: string; minified: number }[] };
  beforeDrawn: Record<"scene" | "pages", { minified: number; fetched: number; packages: Record<string, number> }>;
  over: boolean;
};

let measured: Measured;
let handed: Measured;
beforeAll(async () => {
  [measured, handed] = (await Promise.all([measureHostedPage(repo), measureHostedPage(repo, HOSTED_PAGE_COMPILED_ENTRY)])) as [Measured, Measured];
}, 120_000);

describe("a hosted page", () => {
  it("is measured as Cloud's shell is built: React, zod and the framework that draws the app are in what it loads up front", () => {
    for (const name of ["react-dom", "zod", "@graview/core", "@graview/embed", "@graview/ship"]) expect(Object.keys(measured.upFront.packages)).toContain(name);
  });

  it("carries at most its budget up front, minified and gzipped: 537.5 KB and 186.4 KB since the headroom after 0.1.29, and only a raise that names its changeset adds to either", () => {
    expect(measured.upFront.minified, `${(measured.upFront.minified / 1024).toFixed(1)} KB`).toBeLessThanOrEqual(HOSTED_PAGE_BUDGET.minified);
    expect(measured.upFront.gzipped, `${(measured.upFront.gzipped / 1024).toFixed(1)} KB gzipped`).toBeLessThanOrEqual(HOSTED_PAGE_BUDGET.gzipped);
    expect(measured.over).toBe(false);
  });

  it("carries at most 150 KB of zod up front", () => {
    expect(measured.upFront.zod, `${Math.round(measured.upFront.zod / 1024)} KB`).toBeLessThanOrEqual(HOSTED_PAGE_BUDGET.zod);
  });

  it("draws either face without loading the other: the scene carries no routed face, the pages no scene", () => {
    const scene = Object.keys(measured.beforeDrawn.scene.packages);
    const pages = Object.keys(measured.beforeDrawn.pages.packages);
    expect(scene).not.toContain("@graview/pages");
    expect(scene).not.toContain("react-router");
    // The scene itself is @graview/react's; the pages draw with its provider alone.
    expect(measured.beforeDrawn.pages.packages["@graview/react"] ?? 0).toBeLessThan(measured.beforeDrawn.scene.packages["@graview/react"]! / 2);
    expect(pages).toContain("@graview/pages");
  });

  it("is smaller before either face draws than it was up front before the faces were fetched as drawn", () => {
    // 1,075 KB up front, measured this way before FR-57: the face fetched as it is drawn does not hide the bytes, it leaves them out.
    // Raised from 800 KB when the home and a view came to be written from blocks (FR-81, FR-82): the scene before it draws measured
    // 817_424 bytes before them and 836_810 with them (the pages 785_745 and 804_522) — the blocks' renderer, their vocabulary and the landing.
    // 860 KB since FR-110–FR-116 together: the scene face measured 870_479 B before it draws (it was 860_295 at 850).
    // 865 KB since a brand's mark is read element by element before it is drawn (the review after 0.1.15): the scene face measured 883_431 B.
    // 867 KB since the switch and the place list (FR-137, FR-138) and the home view first (FR-136): the scene face measured 886_469 B, 2_209 more than before them.
    // 870 KB since the bar fits its box: the scene face measured 889_834 B, 2_612 more than before it (887_222).
    // 873 KB since a lazy part tries again after it failed to arrive (FR-139), over the bar that fits its box: the scene face measured 893_470 B, 3_636 more.
    // 877 KB since a selected record is drawn once (FR-141–FR-143), over FR-139: the scene face measured 897_697 B, 4_227 more.
    // 878 KB since a lens double-clicked from Up opens it: the scene face measured 898_844 B over the security review before 0.1.18.
    // 891 KB since views beside editing, long text on a record page and the places in the bar landed together (FR-144–FR-151), over a lens double-clicked from Up: the scene face measured 911_396 B, 12_552 more.
    // 892 KB since the seat takes you where you ask: the conversation's glue for moves, the resolver itself fetched with the first ask: the scene face measured 912_858 B, 1_462 more.
    // 893 KB since a seat's tools may draw a view and keep it as a lens (draft_view, keep_lens): their two definitions ride with the seat, the engine behind a door; the scene face measured 913_473 B, 1_813 more than before them (911_660).
    // 880 KB since the host decides the AI once: the reader's picker of rungs and the ⚙ left the seat and the person's menu,
    // and the margin the budget had kept was taken back: the scene face measured 900_495 B, 2_041 fewer than main (902_536).
    // 881 KB since a rule says its shape: the standing counts rules broken (`brokenWords`) and a document's rule keeps what its line is said from, the words themselves fetched with what draws a problem (`@graview/core/lines`): the scene face measured 901_567 B with FR-157's scene from a page that held nothing.
    // 883 KB since the bar ranks its places and a list arranges on one quiet line (its lists behind a door), over a rule saying its shape and FR-157: the scene face measured 903_581 B.
    // 884 KB since a broken rule says its values to a host (FR-159, the engine's hook), a showing's name a fingertip as drawn and the overview's address alone (FR-154), together: the scene face measured 904_192 B.
    // Still 884 KB when the inspector's pane and the seat's tools came to be fetched when an act is first wanted: the scene face measured 856_430 B, 46_530 under main's 902_960.
    // 887 KB since the second half of the 0.1.30 wave landed together: graview.dev's fixes to the scene (an edge sign clear of the corner, a tie taking the kit's route), a screen reader told each stop (named controls, focus after a move, another seat's change said) and a kind's list in its declared order: the scene face measured 906_948 B, 1_732 over 884.
    // 888 KB since a change came to be said in words, said with nobody shown here, and asked from what the record holds in the scene's ask too: the scene face measured 909_040 B, 2_092 more than before them (906_948).
    // 889 KB since the GPU path holds past 128 live views (the scene hands a view the GPU cannot follow to the DOM in place): the scene face measured 909_597 B, 285 over 888.
    // 893 KB since the scene's cards and ties were fixed together (2026-10-15): a card says there is more at its edge, its "+N more" opens the rest, and a chosen record's ties keep their words until reached, placed clear of the cards' titles: the scene face measured 913_594 B, 4_554 more than before them (909_040).
    // 894 KB with both landed: the scene's cards and ties over the GPU path's hand-off to the DOM.
    // 891 KB since 2026-10-15, when a template came to say records by their labels and take `capital`, a card to say its glance exactly and its prose on a line, and the bar to name a place once and read `pages.first` once a visit: the scene face measured 911_198 B, 2_158 more than before them (909_040).
    // 897 KB with the templates' fixes over the scene's cards and the GPU hand-off.
    // 891 KB since blocks came to lay out as written (2026-10-15, fix/blocks-layout: a nested headline a section's, row groups, rows, badges, a large figure, a rule's sentence first, a place without its form): the scene face measured 911_746 B, 2_706 more than before them (909_040).
    // 900 KB with the blocks' layout over the templates' fixes, the scene's cards and the GPU hand-off.
    // 906 KB since the Beatles' discography's fixes (2026-10-15, fix/lenses-and-views): a list that shows its next page and groups by a linked record, a coverage that says it has nothing to cross and orders its rows, a career calendar spanning its records, a place known by its title and an image from an origin the host lists: the scene face measured 926_488 B, 6_044 more than main (920_444).
    // 889 KB since the tenth walk's carried dead ends (W-217 to W-225): Find going into a kind whole and landing the keys on its line, a raised kind's way in, the past on the arranging line, the trail's headroom and the scene's foot clear of the ask field: the scene face measured 909_930 B, 1_642 over 887.
    // 908 KB with the tenth walk's carried dead ends over the Beatles' fixes and the rest of the 0.1.30 wave.
    // 910 KB since nothing came to stand over a control the watch found covered (W-224) and Pages came to honor the Ask box setting: the scene face measured 931_431 B, 1_966 more than before them (929_465).
    // 911 KB since the first load came to wait on less (Roadmap f-perf-first-load): the switch fetches the scene before it draws it, the other face is fetched when a desk's page is idle or a hand reaches for it, and a remote store opens on a handed state: the scene face measured 932_473 B, 1_042 more than before them (931_431).
    // 919 KB since the scene draws on the GPU by default where it can (Roadmap f-gpu-default, f-plane-blur): the choice of path, the blur's preferences and budget, the one treatment both paths draw, and the door to the capture path — whose modules shared with the scene (the plane model, the connectors) now sit in a chunk the scene fetches: the scene face measured 940_163 B, 7_690 more than before it (932_473). Nothing up front changed.
    // 922 KB since the inline AI came (Roadmap f-ai-candidate-catalog, f-activity-ai-entries): the scene draws the menu's AI section and the ghost through their doors, and Activity reads the AI's entries, whose rows are fetched with the first: the scene face measured 943_677 B, 3_514 more than before it (940_163).
    // 926 KB since Notify me came (Roadmap f-notify-subscriptions): the menu's row on both faces, a record's and an act's press, and Activity's count, the sheet and the list behind their doors: the scene face measured 947_611 B, 3_934 more than before it (943_677).
    // 933 KB since dates came to be typed as people say them (Roadmap f-date-inputs): a record's date changed in place with its end moved alongside, a calendar placing an instant on the reader's clock, the door to the editor (the editor, its month and the reader of what is typed are fetched when first asked for), and the wall-time helpers on @graview/core/words, whose barrel also places the reader in a chunk the scene fetches: the scene face measured 954_856 B, 7_245 more than before it (947_611). Up front, 42 bytes more (569_696 to 569_738): the instant check `describeArg` reads.
    // 934 KB since a record came to hold a video (0.1.37): a video field's schema up front, and the guest host's half of a view's `<graview-video>` and `data-lightbox` beside the faces' views: the scene face measured 956_303 B, 1_025 more than before it (955_278).
    for (const face of Object.values(measured.beforeDrawn)) expect(face.minified).toBeLessThan(934 * 1024);
  });

  it("fetches the inspector's pane, and the seat's tools behind it, when an act is first wanted or the page is idle, not with the scene", () => {
    expect(measured.whenAsked.doors.map((door) => door.module)).toContain("primitives/src/workbench/inspector.tsx");
    const inputs = (measured as unknown as { metafile: { inputs: Record<string, { imports: { path: string; kind: string }[] }> } }).metafile.inputs;
    const affordances = Object.entries(inputs).find(([input]) => input.endsWith("react/src/affordances.ts"))![1];
    expect(affordances.imports.map((one) => one.path).filter((path) => path.endsWith("tools/src/index.ts"))).toEqual([]);
    const sceneDoor = (measured.whenAsked.doors as { module: string; packages: Record<string, number> }[]).find((door) => door.module === "embed/src/scene-face.tsx")!;
    expect(sceneDoor.packages["@graview/tools"] ?? 0).toBeLessThan(20 * 1024);
  });

  it("carries no studio, up front or when asked: the shell stubs it out", () => {
    expect(Object.keys(measured.upFront.packages)).not.toContain("@graview/studio");
    expect(Object.keys(measured.whenAsked.packages)).not.toContain("@graview/studio");
  });

  it("loads no classic zod: the framework builds a document's schemas in zod/mini", () => {
    const modules = Object.keys(measured.upFront.modules);
    expect(modules.filter((module) => module.startsWith("zod/v4/classic/"))).toEqual([]);
  });

  it("carries no checker: the page compiles with compileDocumentWithoutCheck, and graview check stays in Node", () => {
    expect(Object.keys(measured.upFront.modules).filter((module) => module.startsWith("core/src/cli/"))).toEqual([]);
  });

  it("names the package each input of the metafile belongs to", () => {
    expect(packageOf("packages/core/src/store.ts")).toBe("@graview/core");
    expect(packageOf("../../node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/schemas.js")).toBe("zod");
    expect(packageOf("zod-locales:/x/zod/v4/locales/index.js")).toBe("zod");
    expect(packageOf("../../node_modules/.pnpm/react-dom@19.2.0/node_modules/react-dom/cjs/react-dom-client.production.js")).toBe("react-dom");
    expect(packageOf("<stdin>")).toBe("(the page)");
  });

  it("holds its bases' numbers, never edited upward: 537.5 KB (186.4 gzipped) up front, 150 KB of it zod's, and 496.0 KB (172.0 gzipped) handed a compiled app (the headroom after 0.1.29)", () => {
    expect(HOSTED_PAGE_BASE).toEqual({ minified: 537.5 * 1024, gzipped: 186.4 * 1024, zod: 150 * 1024 });
    expect(HOSTED_PAGE_COMPILED_BASE).toEqual({ minified: 496.0 * 1024, gzipped: 172.0 * 1024 });
    // Both well under what 0.1.28 was held to (579.7 and 535.2 KB), and under what FR-179 left (554.0 and 513.5 KB): the room given back stays given back.
    expect(HOSTED_PAGE_BASE.minified).toBeLessThanOrEqual(579.7 * 1024 - 40 * 1024);
    expect(HOSTED_PAGE_COMPILED_BASE.minified).toBeLessThanOrEqual(535.2 * 1024 - 35 * 1024);
    expect(HOSTED_PAGE_BASE.gzipped).toBeLessThan(188.0 * 1024);
    expect(HOSTED_PAGE_COMPILED_BASE.gzipped).toBeLessThan(173.5 * 1024);
  });

  /*
   * TIED DOORS (the headroom after 0.1.29, again). A bundler splits what a
   * page loads first by which of its doors reach each file, and the page
   * loaded 23 chunks before it drew, each compressed alone with its own
   * names in and out. Each door imports the barrel the page drew first, so
   * the files every door reaches are one set (`primitives/src/frame.ts`).
   */
  it("loads at most 13 chunks before it draws, handed a compiled app or not: every door is tied to what the page drew first", () => {
    for (const page of [measured, handed] as unknown as { upFront: { chunks: number } }[]) expect(page.upFront.chunks).toBeLessThanOrEqual(13);
  });

  it("fetches what draws a notice with the first, and carries none of what only a fetched face says or moves: @graview/core/words, @graview/layout/view-moves", () => {
    for (const page of [measured, handed]) {
      for (const module of ["primitives/src/notice-stacks.tsx", "primitives/src/notice-place.ts", "core/src/schema/value-words.ts", "layout/src/view-moves.ts"]) {
        expect(Object.keys(page.upFront.modules), module).not.toContain(module);
      }
      expect(page.whenAsked.doors.map((door) => door.module)).toContain("primitives/src/notice-stacks.tsx");
    }
  });

  /*
   * ZOD'S JSON-SCHEMA WRITER IS ON NO PAGE (the headroom after 0.1.29). Every
   * zod barrel the page imports to build an app's fields reaches it, so the
   * moment anything on the page — the seat, fetched when first asked —
   * called `z.toJSONSchema`, its 20 KB rode in the first chunk. A tool's
   * schema is graview's own (`core/src/schema/to-json-schema.ts`), written
   * when the seat first lists its tools.
   */
  it("carries none of zod's JSON-Schema writer, up front or when asked: a tool's schema is written by graview's own walker, fetched with the seat", () => {
    const writer = ["zod/v4/core/json-schema-processors.js", "zod/v4/core/to-json-schema.js", "zod/v4/core/json-schema-generator.js"];
    for (const page of [measured, handed]) {
      expect(Object.keys(page.upFront.modules).filter((module) => writer.includes(module))).toEqual([]);
      expect(Object.keys(page.upFront.modules)).not.toContain("core/src/schema/to-json-schema.ts");
      const outputs = (page as unknown as { metafile: { outputs: Record<string, { inputs: Record<string, { bytesInOutput: number }> }> } }).metafile.outputs;
      const anywhere = Object.values(outputs).flatMap((output) => Object.entries(output.inputs).filter(([, input]) => input.bytesInOutput > 0).map(([input]) => input.replace(/^.*node_modules\//, "")));
      expect(anywhere.filter((module) => writer.includes(module))).toEqual([]);
      expect(anywhere.some((module) => module.endsWith("core/src/schema/to-json-schema.ts"))).toBe(true);
    }
  });

  it("is held to its base plus the raises filed for it, each of which names a changeset that says what it adds", () => {
    const sum = (name: string, size: "minified" | "gzipped") => (HOSTED_RAISES as { budget: string; minified: number; gzipped: number }[]).filter((raise) => raise.budget === name).reduce((total, raise) => total + raise[size], 0);
    expect(HOSTED_PAGE_BUDGET.minified).toBe(HOSTED_PAGE_BASE.minified + sum("a hosted page", "minified"));
    expect(HOSTED_PAGE_BUDGET.gzipped).toBe(HOSTED_PAGE_BASE.gzipped + sum("a hosted page", "gzipped"));
    expect(HOSTED_PAGE_COMPILED_BUDGET.minified).toBe(HOSTED_PAGE_COMPILED_BASE.minified + sum("a hosted page handed a compiled app", "minified"));
    for (const raise of HOSTED_RAISES as { changeset: string }[]) expect(raise.changeset).toMatch(/^[\w.-]+\.md$/);
  });

  /*
   * WHAT ONLY A FETCHED FACE USES IS NOT REACHABLE FROM WHAT THE PAGE
   * IMPORTS UP FRONT. esbuild places a whole module in every chunk that can
   * reach it, so a name exported from a barrel the page imports (`@graview/core`,
   * `@graview/core/document`) rides in the first chunk as soon as anything
   * lazy uses it. These left for subpaths of their own; none may come back.
   */
  it("carries no block resolver, city, figure or checker up front: they are @graview/core/blocks, /scene, /figures and /check, reached only by what is fetched", () => {
    const modules = Object.keys(measured.upFront.modules);
    for (const module of ["core/src/document/blocks.ts", "core/src/document/computed-values.ts", "core/src/city.ts", "core/src/scene-districts.ts", "core/src/document/thumbnail.ts", "core/src/schema/figures.ts"]) {
      expect(modules).not.toContain(module);
    }
    expect(modules.filter((module) => module.startsWith("core/src/cli/"))).toEqual([]);
  });

  it("carries nothing up front that only a drawn view uses: those are @graview/react/drawing, /tools/edit and /core/arrange, reached only by what is fetched", () => {
    const modules = Object.keys(measured.upFront.modules);
    for (const module of [
      "react/src/drawn.ts",
      "react/src/kit.ts",
      "react/src/view-boundary.tsx",
      "react/src/emphasis.ts",
      "react/src/editable-fields.ts",
      "react/src/placement.ts",
      "react/src/attention.ts",
      "react/src/picking.ts",
      "tools/src/edit.ts",
      "tools/src/pins.ts",
      "layout/src/label-fit.ts",
      "core/src/arranging.ts",
    ]) {
      expect(modules).not.toContain(module);
    }
    expect(Object.keys(measured.upFront.packages)).not.toContain("@graview/render");
  });

  it("carries no drafting engine up front: @graview/tools/draft is a door, fetched when the seat is first asked to draw a view", () => {
    expect(Object.keys(measured.upFront.modules)).not.toContain("tools/src/draft.ts");
    expect(measured.whenAsked.doors.map((door) => door.module)).toContain("tools/src/draft.ts");
  });

  it("fetches where an ask goes and the frame a drawn view stands in when asked, never up front: @graview/tools/go and the draft frame are doors", () => {
    for (const module of ["tools/src/go.ts", "primitives/src/draft-frame.tsx", "tools/src/draft.ts"]) {
      expect(Object.keys(measured.upFront.modules), module).not.toContain(module);
      expect(measured.whenAsked.doors.map((door) => door.module), module).toContain(module);
    }
  });

  it("fetches the seat's model — its framing, a host's turn with the read tools and the reading of its answer — with the first ask a model answers, never up front (FR-160)", () => {
    expect(Object.keys(measured.upFront.modules)).not.toContain("tools/src/seat-model.ts");
    expect(measured.whenAsked.doors.map((door) => door.module)).toContain("tools/src/seat-model.ts");
    expect(Object.keys(handed.upFront.modules)).not.toContain("tools/src/seat-model.ts");
  });

  it("never carries the keeping of a lens: @graview/tools/keep (the edit vocabulary and the checker) is the host's, up front or when asked", () => {
    const inputs = Object.keys((measured as unknown as { metafile: { inputs: Record<string, unknown> } }).metafile.inputs);
    expect(inputs.filter((input) => input.endsWith("tools/src/keep.ts"))).toEqual([]);
    expect(Object.keys(measured.upFront.modules)).not.toContain("tools/src/keep.ts");
  });

  it("fetches the describer when a place is first asked about, not with the assistant's seat", () => {
    expect(Object.keys(measured.upFront.modules)).not.toContain("core/src/document/describe-place.ts");
    expect(measured.whenAsked.doors.map((door) => door.module)).toContain("core/src/describe.ts");
  });

  it("carries none of the scene's own rules up front: the scene face draws them, and fetches them as it is drawn (FR-104)", () => {
    expect(Object.keys(measured.upFront.modules)).not.toContain("primitives/src/scene-css.ts");
    expect(measured.beforeDrawn.scene.packages["@graview/primitives"]).toBeGreaterThan(measured.upFront.packages["@graview/primitives"]!);
  });

  it("carries the frame's measures without the primitives' index, and its descent without the scene's way back (FR-104)", () => {
    const modules = Object.keys(measured.upFront.modules);
    expect(modules).toContain("primitives/src/primitives/measure.ts");
    expect(modules).not.toContain("primitives/src/primitives/index.tsx");
    expect(modules).not.toContain("primitives/src/workbench/back-out.tsx");
  });

  it("says its weight by package as the release notes carry it: a table that sums to the page, and the headroom (FR-104)", () => {
    const notes = hostedPageMarkdown(measured) as string;
    const rows = [...notes.matchAll(/^\| (?!Package|---|\*\*Total)([^|]+) \| ([\d.]+) \|$/gm)];
    expect(rows.map((row) => row[1])).toEqual(Object.keys(measured.upFront.packages));
    expect(notes).toContain(`**Total** | **${(measured.upFront.minified / 1024).toFixed(1)}**`);
    expect(notes).toContain(`**${((HOSTED_PAGE_BUDGET.minified - measured.upFront.minified) / 1024).toFixed(1)} KB of headroom**`);
  });
});

/**
 * HANDED A COMPILED APP, THE PAGE CARRIES NO COMPILER (FR-123). Graview
 * Cloud compiles a document on its server at every change; its shell then
 * compiled it again in the page. Handed `serializeCompiled(compileDocument(doc))`
 * beside the document, the shell builds the app with `appFromOrCompile` from
 * `@graview/core/compiled`, and fetches the compiler only for a compiled app
 * it cannot read (one cached from another build).
 */
describe("a hosted page handed a compiled app", () => {
  it(`carries at most its budget up front: ${(HOSTED_PAGE_COMPILED_BUDGET.minified / 1024).toFixed(1)} KB minified and ${(HOSTED_PAGE_COMPILED_BUDGET.gzipped / 1024).toFixed(1)} KB gzipped`, () => {
    expect(handed.upFront.minified, `${(handed.upFront.minified / 1024).toFixed(1)} KB`).toBeLessThanOrEqual(HOSTED_PAGE_COMPILED_BUDGET.minified);
    expect(handed.upFront.gzipped, `${(handed.upFront.gzipped / 1024).toFixed(1)} KB gzipped`).toBeLessThanOrEqual(HOSTED_PAGE_COMPILED_BUDGET.gzipped);
  });

  it("carries no compiler up front: no reader, validator, expression or template parser, view checker or document schema", () => {
    const modules = Object.keys(handed.upFront.modules);
    expect(COMPILER_MODULES.filter((module: string) => modules.includes(module))).toEqual([]);
    // What it does carry, to run the app: the builder, the evaluator and the renderer.
    for (const module of ["core/src/document/compiled.ts", "core/src/document/expr/evaluate.ts", "core/src/document/template.ts"]) expect(modules).toContain(module);
  });

  it("fetches the compiler only when it must compile after all", () => {
    expect(handed.whenAsked.doors.map((door) => door.module)).toContain("core/src/document/compile.ts");
  });

  it("is at least 40 KB lighter up front than the page that compiles the document itself", () => {
    expect(measured.upFront.minified - handed.upFront.minified, `${((measured.upFront.minified - handed.upFront.minified) / 1024).toFixed(1)} KB`).toBeGreaterThanOrEqual(40 * 1024);
  });
});

/**
 * NOTIFY ME KEPT ON THE HOST'S STORE (FR-182): the compiled shell handing
 * `mount` a `remoteSubscriptions` store. The route's client half is a module
 * of its own, so the page carries none of the rule language its server half
 * judges a subscription with.
 */
describe("a hosted page that keeps Notify me on its host's store", () => {
  let subscribed: Measured;
  beforeAll(async () => {
    subscribed = (await measureHostedPage(repo, keepingSubscriptions(HOSTED_PAGE_COMPILED_ENTRY))) as Measured;
  }, 120_000);

  it("carries no rule parser up front: no expression or template parser, and none of @graview/core/subscriptions", () => {
    const modules = Object.keys(subscribed.upFront.modules);
    expect([...COMPILER_MODULES, "core/src/subscriptions.ts"].filter((module: string) => modules.includes(module))).toEqual([]);
    expect(modules).toContain("ship/src/remote-subscriptions.ts");
  });

  it("weighs at most 1 KB more up front than the same page keeping them in its memory", () => {
    const more = subscribed.upFront.minified - handed.upFront.minified;
    expect(more, `${more} bytes`).toBeLessThanOrEqual(1024);
  });
});

/**
 * WHAT A FACE DRAWS IS FETCHED WITH THE FACE (FR-179). The studio's door,
 * the quick ask's card, the lenses, a frame guest's host and the matcher are
 * each a door of their own, fetched when the face that draws them is first
 * drawn or asked — never before — and what only they use stays off the
 * barrels a page imports up front.
 */
describe("a hosted page's faces", () => {
  it("fetch the quick ask's card, the declared lenses and a frame guest's host when they are first drawn or asked, and the matcher with the scene that searches, never up front", () => {
    const doors = measured.whenAsked.doors.map((door) => door.module);
    for (const module of ["primitives/src/quick-ask.tsx", "primitives/src/declared-lenses.tsx", "guest/src/host/frame.ts"]) {
      expect(Object.keys(measured.upFront.modules), module).not.toContain(module);
      expect(Object.keys(handed.upFront.modules), module).not.toContain(module);
      expect(doors, module).toContain(module);
    }
    const sceneDoor = (measured.whenAsked.doors as { module: string; packages: Record<string, number> }[]).find((door) => door.module === "embed/src/scene-face.tsx")!;
    expect(sceneDoor.packages["@graview/core"]).toBeGreaterThan(0);
    for (const module of ["core/src/search.ts", "guest/src/host/session.ts", "guest/src/host/theme.ts", "core/src/answer-seen.ts", "core/src/app-places.ts", "core/src/schema/reading.ts", "core/src/mutations/arg-shape.ts", "core/src/mutations/words.ts", "core/src/beginning.ts", "core/src/arrangement.ts", "layout/src/sizes.ts"]) {
      expect(Object.keys(measured.upFront.modules), module).not.toContain(module);
      expect(Object.keys(handed.upFront.modules), module).not.toContain(module);
    }
  });

  it("carry no studio's door up front, even where the studio is not stubbed: the embed fetches @graview/studio as its place is first drawn", () => {
    const inputs = (measured as unknown as { metafile: { inputs: Record<string, { imports: { path: string; kind: string }[] }> } }).metafile.inputs;
    const embed = Object.entries(inputs).find(([input]) => input.endsWith("embed/src/embed.tsx"))![1];
    const studio = embed.imports.filter((one) => one.path.includes("studio"));
    expect(studio.length).toBeGreaterThan(0);
    expect(studio.every((one) => one.kind === "dynamic-import")).toBe(true);
  });
});

/**
 * A RAISE OF A HOSTED PAGE'S BUDGET SAYS ITSELF (FR-179): a file in
 * scripts/budget-raises/ naming the hosted page, the bytes it adds and the
 * changeset that ships it, which says the kilobytes up front it adds.
 */
describe("a raise of a hosted page's budget", () => {
  const note = "Raised when a feature came to need this much more of the page before it draws, measured at so many bytes.";
  const base = { minified: 100_000, gzipped: 40_000 };
  const said = (texts: Record<string, string>) => ({ changesets: (name: string) => texts[name] });

  it("adds what it says to the budget it names, and to no other", () => {
    const raises = hostedRaises([{ file: "a.json", budget: "a hosted page", minified: 1_229, gzipped: 400, changeset: "a.md", note }], said({ "a.md": "Spends 1.2 KB more up front." }));
    expect(withHostedRaises(base, "a hosted page", raises)).toEqual({ ...base, minified: 101_229, gzipped: 40_400, raises: ["a.json"] });
    expect(withHostedRaises(base, "a hosted page handed a compiled app", raises)).toEqual({ ...base, raises: [] });
  });

  it("is refused when it names no changeset, says nothing, or its changeset does not say the kilobytes it adds up front", () => {
    expect(() => hostedRaises([{ file: "b.json", budget: "a hosted page", minified: 1_229, gzipped: 400, note }])).toThrow(/b\.json names no changeset/);
    expect(() => hostedRaises([{ file: "c.json", budget: "a hosted page", minified: 1_229, gzipped: 400, changeset: "c.md" }])).toThrow(/c\.json carries no note/);
    expect(() => hostedRaises([{ file: "d.json", budget: "a hosted page", minified: 0, gzipped: 400, changeset: "d.md", note }])).toThrow(/d\.json must say how many bytes minified/);
    expect(() => hostedRaises([{ file: "e.json", budget: "a hosted page", minified: 1_229, gzipped: 400, changeset: "e.md", note }], said({ "e.md": "A small change." }))).toThrow(/e\.json adds 1\.2 KB to a hosted page up front, and \.changeset\/e\.md does not say so/);
  });

  it("is judged against its changeset while that changeset is pending, and stands once a release has spent it", () => {
    expect(() => hostedRaises([{ file: "f.json", budget: "a hosted page", minified: 1_229, gzipped: 400, changeset: "spent.md", note }], said({}))).not.toThrow();
  });

  it("leaves the embed's budgets alone: a hosted page's raise is not one of theirs", async () => {
    // @ts-expect-error — a plain .mjs module, without types.
    const { BASES, withRaises } = await import("../scripts/lib/bundle-budget.mjs");
    expect(() => withRaises(BASES, [{ file: "g.json", budget: "a hosted page", minified: 1_229, gzipped: 400, changeset: "g.md", note }])).not.toThrow();
  });
});
