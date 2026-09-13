import { createStudio } from "@graview/studio";
import { checkApp, permits, Store } from "@graview/core";
import { EMPTY_VIEW, kindCardId, layout } from "@graview/layout";
import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterFromSearch } from "../../src/domain/chapters.js";

/**
 * The progression is a claim per chapter, and each claim is checked here
 * against the chapter's own declaration and seed — so a docs page built
 * from these chapters teaches nothing the framework does not do.
 */
const storeOf = (n: number) => {
  const chapter = CHAPTERS[n - 1]!;
  return new Store({
    schema: chapter.app.schema,
    mutations: chapter.app.mutations ?? [],
    invariants: chapter.app.invariants ?? [],
    snapshot: chapter.seed as never,
    ...(chapter.app.policy ? { policy: chapter.app.policy } : {}),
    ...(chapter.app.modules ? { modules: chapter.app.modules } : {}),
    ...(chapter.principal ? { principal: chapter.principal } : {}),
  } as never);
};

describe("the garden, grown a chapter at a time", () => {
  it("passes its own check at every chapter", () => {
    for (const chapter of CHAPTERS) {
      const result = checkApp(chapter.app);
      expect(result.findings.filter((f) => f.severity === "error"), chapter.slug).toEqual([]);
    }
  });

  it("only ever grows: no chapter loses a kind, an act or a rule the last one had", () => {
    for (let i = 1; i < CHAPTERS.length; i++) {
      // The studio is a chapter OVER the garden, not a chapter of it — so it
      // is skipped from BOTH sides. Comparing the chapter after it against
      // the meta-schema asked the garden to keep "kind", "field" and "act".
      if (CHAPTERS[i]!.studioOf) continue;
      const previous = CHAPTERS.slice(0, i).findLast((chapter) => !chapter.studioOf);
      if (!previous) continue;
      const before = previous.app;
      const after = CHAPTERS[i]!.app;
      for (const kind of before.schema.kinds) expect(after.schema.kinds, `${CHAPTERS[i]!.slug} keeps ${kind}`).toContain(kind);
      for (const m of before.mutations ?? []) expect((after.mutations ?? []).map((x) => x.name)).toContain(m.name);
      for (const inv of before.invariants ?? []) expect((after.invariants ?? []).map((x) => x.name)).toContain(inv.name);
    }
    expect(CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("1 · a single kind already has a city, a district and a derived beginning", () => {
    const store = storeOf(1);
    const scene = layout(store.graph, CHAPTERS[0]!.app.schema, { ...EMPTY_VIEW, overview: true });
    expect(scene.nodes.map((n) => n.id)).toContain(kindCardId("plot"));
    expect((CHAPTERS[0]!.app.mutations ?? []).find((m) => m.name === "add-plot")?.creates).toEqual(["plot"]);
  });

  it("2 · the edge is declared once and the act that makes it says so", () => {
    const store = storeOf(2);
    expect(store.graph.out("plot-1", "tended-by").map((n) => n.id)).toEqual(["june"]);
    const tend = (CHAPTERS[1]!.app.mutations ?? []).find((m) => m.name === "tend")!;
    expect(tend.connects).toEqual(["tended-by"]);
    expect(tend.severs).toEqual(["tended-by"]);
  });

  it("3 · the rule lands as data and fires on the untended plot, naming real repairs", () => {
    const store = storeOf(3);
    const violations = store.violations();
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toBe("Nobody tends Plot 2");
    expect(violations[0]?.repairs.map((r) => r.mutation)).toEqual(["tend", "tend"]);
    const repair = violations[0]!.repairs[0]!;
    store.apply({ name: repair.mutation, args: { ...repair.args } });
    expect(store.violations()).toEqual([]);
  });

  it("4 · a harvested planting is behind the horizon, not gone", () => {
    const store = storeOf(4);
    const scene = layout(store.graph, CHAPTERS[3]!.app.schema, { ...EMPTY_VIEW, overview: true });
    const card = scene.nodes.find((n) => n.id === kindCardId("planting"));
    expect(card?.aggregate?.memberIds).toEqual(["beans"]);
    expect(card?.aggregate?.retired).toBe(1);
    expect(store.graph.getNode("tomatoes")).toBeDefined();
    expect(store.violations()).toEqual([]);
  });

  it("5 · the seat is declared on the app, with an allowlist the check can read", () => {
    const seam = CHAPTERS[4]!.app.intelligence?.[0];
    expect(seam?.kind).toBe("graph");
    expect(seam?.may).toContain("add-gardener");
    expect(CHAPTERS[4]!.seat).toBe(true);
    expect(CHAPTERS[3]!.seat).toBe(false);
  });

  it("6 · remembering is a main.tsx decision, not a declaration change", () => {
    expect(CHAPTERS[5]!.app).toBe(CHAPTERS[4]!.app);
    expect(CHAPTERS[5]!.remembers).toBe(true);
    expect(CHAPTERS[4]!.remembers).toBe(false);
  });

  it("7 · a gardener may work the ground and may not redraw the map", () => {
    const { app, principal } = CHAPTERS[6]!;
    expect(permits(app.policy!, principal!, "sow", "planting").ok).toBe(true);
    expect(permits(app.policy!, principal!, "add-plot", "plot").ok).toBe(false);
    const store = storeOf(7);
    expect(() => store.apply({ name: "add-plot", args: { label: "Plot 9", beds: 1 } })).toThrow();
  });

  it("8 · the brand arrives once, and the chapters before it wear the framework's own", () => {
    for (const chapter of CHAPTERS.slice(0, 7)) expect(chapter.app.brand, chapter.slug).toBeUndefined();
    expect(CHAPTERS[7]!.app.brand?.name).toBe("Seedbed");
    expect(checkApp(CHAPTERS[7]!.app).findings.map((f) => f.code)).not.toContain("theme-contrast-below-aa");
  });

  it("9 · the other face is the plot's own page, over the derived defaults", async () => {
    const { PagesApp } = await import("@graview/pages");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { seedbedPages } = await import("../../src/ui/pages.js");
    const chapter = CHAPTERS[8]!;
    expect(chapter.face).toBe("pages");
    const store = storeOf(9);
    const html = renderToStaticMarkup(
      createElement(PagesApp as never, {
        context: { store, brand: chapter.app.brand },
        registry: seedbedPages(store.schema),
        initialPath: "/plots/plot-2",
      } as never),
    );
    expect(html).toContain('data-testid="plot-page"');
    expect(html).toMatch(/looked after by Ravi/);
    // The default face is still there for everything the app did not replace.
    const list = renderToStaticMarkup(
      createElement(PagesApp as never, { context: { store }, registry: seedbedPages(store.schema), initialPath: "/gardeners" } as never),
    );
    expect(list).toContain("June");
  });

  it("10 · the coverage lens, bound by roles, shows the plot nobody tends", () => {
    const { app, seed } = CHAPTERS[9]!;
    expect(app.lenses?.[0]?.bindings).toEqual({ rows: { kind: "gardener" }, columns: { kind: "plot" }, link: { edge: "tended-by" } });
    expect(seed.edges.filter((e) => e.kind === "tended-by")).toHaveLength(1);
    expect(storeOf(10).violations().map((v) => v.message)).toEqual(["Nobody tends Plot 2"]);
  });

  it("11 · the board, written for a seating plan, shows the empty bed", async () => {
    const { buildBoard } = await import("@graview/primitives");
    const { app, seed } = CHAPTERS[10]!;
    expect(app.lenses?.map((l) => l.name)).toEqual(["coverage", "board"]);
    const board = buildBoard(seed.nodes as never, seed.edges as never, { slots: "plot", x: "x", y: "y", fill: "grows-in", fillFrom: "occupant" }, app.schema as never);
    expect(board.slots.map((s) => [s.label, s.occupants.map((o) => o.label)])).toEqual([["Plot 1", ["Beans"]], ["Plot 2", ["Tomatoes"]], ["Plot 3", []]]);
    expect(board.empty).toEqual(["plot-3"]);
  });

  it("12 · a garden stored last season is carried forward by a logged migration", async () => {
    const { migrateSnapshot } = await import("@graview/ship");
    const { app, stored } = CHAPTERS[11]!;
    expect(app.version).toBe(2);
    expect(checkApp(app).findings.map((f) => f.code)).not.toContain("migration-gap");
    const run = migrateSnapshot(app, stored!.snapshot, stored!.version, { now: () => "2026-09-09T00:00:00Z" });
    expect(run.version).toBe(2);
    expect(run.snapshot.nodes.some((n) => n.kind === "rule")).toBe(true);
    expect(run.ops.every((op) => op.author.kind === "system")).toBe(true);
    // Already-migrated data is left alone: the migration is idempotent by construction.
    expect(migrateSnapshot(app, run.snapshot, 1).ops.flatMap((op) => op.primitives ?? [])).toEqual([]);
  });

  it("13 · the garden's own face: every surface replaced, and a lens of its own", async () => {
    const { PagesApp } = await import("@graview/pages");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { seedbedDesign } = await import("../../src/ui/design.js");
    const { seedbedViews } = await import("../../src/ui/views.js");
    const chapter = CHAPTERS[12]!;
    expect(chapter.face).toBe("pages");
    expect(chapter.design).toBe(true);
    const store = storeOf(13);
    const html = renderToStaticMarkup(
      createElement(PagesApp as never, {
        context: { store, brand: chapter.app.brand, principal: chapter.principal },
        registry: seedbedDesign(store.schema),
        initialPath: "/",
      } as never),
    );
    // The garden's shell, home and map — none of the derived face's markup.
    expect(html).toContain('data-testid="seedbed-design"');
    expect(html).toContain('data-testid="seedbed-home"');
    expect(html).toContain('data-testid="garden-map"');
    expect(html).not.toContain('aria-label="Kinds"');
    // Every page is the garden's, over the same store.
    for (const [path, id] of [["/plots", "seedbed-plots"], ["/gardeners/june", "gardener-page"], ["/plantings/beans", "planting-page"], ["/rules/every-plot-tended", "rule-page"], ["/problems", "seedbed-problems"]]) {
      const page = renderToStaticMarkup(
        createElement(PagesApp as never, { context: { store, principal: chapter.principal }, registry: seedbedDesign(store.schema), initialPath: path } as never),
      );
      expect(page, path).toContain(`data-testid="${id}"`);
    }
    /*
     * THE ACTS COME FROM THE DERIVATION, in the worked example the skill
     * points readers at. Picked by name with `store.permits`, a gardener's
     * own page offered "Name a caretaker" beside every untended plot — the
     * plot's words on her page — and a plot with no gardener anywhere
     * offered the same over an empty picker.
     */
    const june = renderToStaticMarkup(
      createElement(PagesApp as never, { context: { store, principal: chapter.principal }, registry: seedbedDesign(store.schema), initialPath: "/gardeners/june" } as never),
    );
    expect(june).toContain("Take on a plot");
    expect(june).not.toContain("Name a caretaker");
    const seed = chapter.seed as { nodes: { id: string; kind: string }[]; edges: { kind: string }[] };
    const nobody = new Store({
      schema: chapter.app.schema,
      mutations: chapter.app.mutations ?? [],
      invariants: chapter.app.invariants ?? [],
      snapshot: { nodes: seed.nodes.filter((node) => node.kind !== "gardener"), edges: seed.edges.filter((edge) => edge.kind !== "tended-by") } as never,
      ...(chapter.app.policy ? { policy: chapter.app.policy } : {}),
      ...(chapter.app.modules ? { modules: chapter.app.modules } : {}),
      ...(chapter.principal ? { principal: chapter.principal } : {}),
    } as never);
    const untended = nobody.graph.nodesOfKind("plot")[0]!;
    const alone = renderToStaticMarkup(
      createElement(PagesApp as never, { context: { store: nobody, principal: chapter.principal }, registry: seedbedDesign(nobody.schema), initialPath: `/plots/${untended.id}` } as never),
    );
    expect(alone).not.toContain("Name a caretaker");
    expect(alone).not.toContain('data-testid="form-tend"');
    // The scene's lens is the garden's own, and it is a named place.
    const views = seedbedViews(store.schema as never, { lens: true, map: true });
    /*
     * In the order the app REGISTERED them, which is what it now is: the
     * old order was the order `registerDefaultViews` happened to fill the
     * cells in, because a titled registration only updated a value already
     * sitting in the map. A kind may have several pictures now, so the list
     * is kept deliberately rather than falling out of a map's insertion
     * order.
     */
    expect(views.places().map((place) => place.title)).toEqual(["The garden map", "Who tends what"]);
  });

  it("14 · the installation is in the graph: drawn for the keeper, refused for the rest, a profile is yours", () => {
    const chapter = CHAPTERS[13]!;
    expect(checkApp(chapter.app).findings.filter((f) => f.severity === "error")).toEqual([]);
    const store = storeOf(14);
    expect(store.mayAdminister("installation", chapter.principal)).toBe(true);
    const ravi = chapter.seats!.find((seat) => seat.principal.id === "user-ravi")!.principal;
    expect(store.mayAdminister("installation", ravi)).toBe(false);
    expect([...store.kindsKeptFrom(ravi)].sort()).toEqual(["invitation", "user"]);
    // The stop shows the installation; the seed has the coordinator, a gardener and one pending invitation.
    expect(chapter.stop).toContain("show=installation");
    expect(store.graph.nodesOfKind("invitation" as never)).toHaveLength(1);
    // Ravi may change his own name and not June's; June may invite and Ravi may not.
    expect(store.permits({ name: "edit-user", args: { id: "user-ravi", label: "R" } }, ravi).ok).toBe(true);
    expect(store.permits({ name: "edit-user", args: { id: "user-june", label: "J" } }, ravi).ok).toBe(false);
    expect(store.permits({ name: "invite", args: { email: "x@y.z", roles: ["gardener"] } }, ravi).ok).toBe(false);
    expect(store.permits({ name: "invite", args: { email: "x@y.z", roles: ["gardener"] } }, chapter.principal).ok).toBe(true);
  });

  it("15 · the studio: chapter fourteen's declaration is a graph, its acts change it, the checker judges it, and it writes back", async () => {
    const chapter = CHAPTERS[14]!;
    expect(chapter.studioOf).toBe(CHAPTERS[13]!.app);
    expect(checkApp(chapter.app).findings.filter((f) => f.severity === "error")).toEqual([]);
    const store = storeOf(15);
    const kinds = store.graph.nodesOfKind("kind" as never).map((node) => (node as { label: string }).label);
    expect(kinds).toEqual(expect.arrayContaining(["gardener", "plot", "planting", "rule", "user", "invitation"]));
    expect(store.graph.getNode("act:tend")).toMatchObject({ title: expect.any(String) });
    expect(store.graph.out("edge:plot.tended-by", "to-kind").map((n) => n.id)).toEqual(["kind:gardener"]);
    // A change is an act with an inverse; the checker judges the result; it writes back.
    const studio = createStudio(chapter.studioOf!);
    studio.store.apply({ name: "add-field", args: { kind: "kind:plot", label: "soil", type: "enum", required: false, options: ["clay", "loam"] } });
    expect(studio.check().errors).toBe(0);
    const applied = studio.apply();
    expect(applied.ok).toBe(true);
    if (applied.ok) expect(applied.app.schema.definition("plot").fields.shape).toHaveProperty("soil");
    expect(studio.files().map((file) => file.path)).toContain("src/domain/schema.ts");
    const { seedbedViews } = await import("../../src/ui/views.js");
    const views = seedbedViews(store.schema as never, { studio: chapter.studioOf! });
    expect(views.places().map((place) => place.title)).toEqual(["What the checker says"]);
  });

  it("16 · the rotation: one binding draws four years, a month per cell, with the span across them", async () => {
    const chapter = CHAPTERS[15]!;
    expect(checkApp(chapter.app).findings.filter((f) => f.severity === "error")).toEqual([]);
    const store = storeOf(16);
    const rotations = store.graph.nodesOfKind("rotation" as never);
    expect(rotations).toHaveLength(8);
    // A bed turns through four families and comes back: plot 1 is on
    // brassicas in 2026 and plot 2 is on them in 2029.
    expect((store.graph.getNode("rot-plot-1-2026") as { family: string }).family).toBe("brassicas");
    expect((store.graph.getNode("rot-plot-2-2029") as { family: string }).family).toBe("brassicas");
    expect(store.graph.out("rot-plot-1-2026", "turns-over").map((node) => node.id)).toEqual(["plot-1"]);

    /*
     * ONE BINDING, EVERY HORIZON. The declaration names the same roles the
     * season already named — a start, an end, a label — and the lens draws
     * four years from it with no second declaration anywhere.
     */
    const calendar = chapter.app.lenses?.find((lens) => lens.name === "calendar");
    expect(calendar?.requiredRoles).toEqual(["start"]);
    expect(calendar?.bindings).toMatchObject({ rotation: { start: "from", end: "to", label: "label" } });

    const { entriesIn, placeOnCalendar, spanOf } = await import("@graview/primitives");
    const entries = rotations.map((node) =>
      placeOnCalendar(node as never, { rotation: { start: "from", end: "to", label: "label" } }, store.schema as never),
    );
    const horizon = spanOf("years", "2026-01-01", { horizon: { years: 4, title: "The rotation" } });
    expect(horizon.cells).toHaveLength(48);
    expect(horizon.years).toEqual(["2026", "2027", "2028", "2029"]);
    // March to October is eight months of cells, not one dot on the day it began.
    const first = entries.find((entry) => entry?.id === "rot-plot-1-2026")!;
    const across = horizon.cells.filter((cell) => entriesIn([first], cell.from, cell.to).length > 0);
    expect(across).toHaveLength(8);
    expect(across[0]?.label).toBe("Mar 26");
    expect(across[7]?.label).toBe("Oct 26");

    const { seedbedViews } = await import("../../src/ui/views.js");
    const views = seedbedViews(store.schema as never, { season: true, rotation: true });
    expect(views.places().map((place) => place.title)).toEqual(expect.arrayContaining(["The year", "The season", "The rotation"]));
  });

  it("is reached by ?chapter=N, and the finished example is the default", () => {
    expect(chapterFromSearch("?chapter=3")?.slug).toBe("the-agreement");
    expect(chapterFromSearch("?chapter=99")).toBeNull();
    expect(chapterFromSearch("")).toBeNull();
  });
});
