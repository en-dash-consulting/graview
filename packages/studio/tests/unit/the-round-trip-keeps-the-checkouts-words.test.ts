import { bindSchema, createSchema, defineApp, defineInvariant, defineMutation, defineNode, isoDate, nodeRef } from "@graview/core";
import { checkApp } from "@graview/core/check";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/*
 * THE ROUND TRIP KEEPS WHAT THE CHECKOUT WROTE. A discography opened in
 * the studio and written straight back: every label lost its `.max(60)`
 * (the checker then said `label-unbounded` of all five kinds, before
 * anything had changed), a track number its `.int().min(1).max(99)`, a
 * release date its `isoDate`; an optional note gained a `.min(1)`; both
 * files imported `z` from "zod", which a product does not have; "Add a
 * song" gained `explicit` and `status` arguments it never took and "Add a
 * release" lost `released`; and the history's sentences were replaced by
 * the studio's. And the skill's own example addressed `kind:plot`, which
 * is the layout's id, so its first line threw.
 */
const song = defineNode("song", {
  description: "A recorded song.",
  fields: z.object({
    label: z.string().min(1).max(60),
    track: z.number().int().min(1).max(99).optional(),
    explicit: z.boolean(),
    status: z.enum(["released", "demo"]),
    notes: z.string().max(2000).optional(),
  }),
  plural: "Songs",
  label: (node) => node.label,
});
const album = defineNode("album", {
  description: "A release.",
  fields: z.object({ label: z.string().min(1).max(60), released: isoDate.optional(), type: z.enum(["album", "single"]) }),
  edges: { tracks: { to: ["song"], description: "the songs on it", inverse: "the releases it is on" } },
  plural: "Albums",
  label: (node) => node.label,
});
const schema = createSchema([song, album]);
const bound = bindSchema(schema);
const addSong = bound.defineMutation("add-song", {
  title: "Add a song",
  description: "A demo, until it is released.",
  creates: ["song"],
  input: z.object({ label: z.string().min(1).max(60) }),
  describe: (args) => `Add ${args.label}`,
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "song"), kind: "song", label: args.label, explicit: false, status: "demo" } as never),
});
const addAlbum = bound.defineMutation("add-album", {
  title: "Add a release",
  description: "An album or a single.",
  creates: ["album"],
  input: z.object({ label: z.string().min(1).max(60), type: z.enum(["album", "single"]), released: isoDate.optional() }),
  describe: (args) => `Add ${args.label}`,
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "album"), kind: "album", ...args } as never),
});
const putOn = bound.defineMutation("put-on", {
  title: "Put it on a release",
  fromTheOtherEnd: "Add a song to the tracklist",
  description: "Put a song on a release.",
  subject: { kinds: ["song"], arg: "songId" },
  connects: ["tracks"],
  input: z.object({ songId: nodeRef(["song"]), albumId: nodeRef(["album"]) }),
  describe: (args) => `Put ${args.songId} on ${args.albumId}`,
  apply: (ctx, args) => ctx.addEdge({ kind: "tracks", from: args.albumId, to: args.songId }),
});
// A rule whose repair is an act the framework derives: there is no act node to point an edge at.
const renumber = defineInvariant("tracks-in-order", {
  label: "One song per track number",
  scope: { kind: "album" },
  repairs: ["edit-song", "put-on"],
  evaluate: () => [],
});
const app = defineApp({
  name: "Discography",
  schema,
  mutations: [addSong, addAlbum, putOn],
  invariants: [renumber as never],
  intelligence: [{ name: "starter", kind: "graph", description: "Seeds.", may: ["add-song", "add-album"] }],
});

describe("the studio's round trip, on a checkout with bounds", () => {
  const files = () => createStudio(app).files({ schemaVar: "discographySchema" });
  const file = (path: string) => files().find((one) => one.path === path)!.contents;

  it("writes the checkout's own field schemas back, bounds and all", () => {
    const schemaTs = file("src/domain/schema.ts");
    expect(schemaTs).toContain("label: z.string().min(1).max(60),");
    expect(schemaTs).toContain("track: z.number().int().min(1).max(99).optional(),");
    expect(schemaTs).toContain("released: isoDate.optional(),");
    expect(schemaTs).toContain("notes: z.string().max(2000).optional(),");
  });

  it("imports z from the framework, never from zod", () => {
    for (const one of files()) expect(one.contents).not.toContain('from "zod"');
    expect(file("src/domain/schema.ts")).toContain('import { createSchema, defineNode, isoDate, z } from "@graview/core";');
  });

  it("keeps a checkout act's own arguments, and says where its sentence belongs", () => {
    const acts = file("src/domain/mutations.ts");
    expect(acts).toContain("input: z.object({ label: z.string().min(1).max(60) }),");
    expect(acts).not.toContain("explicit: z.boolean().optional()");
    expect(acts).toContain('input: z.object({ label: z.string().min(1).max(60), type: z.enum(["album", "single"]), released: isoDate.optional() }),');
    expect(acts).toContain("input: z.object({ songId: nodeRef([\"song\"]), albumId: nodeRef([\"album\"]) }),");
    expect(acts).not.toContain("Add a song: ${args.label}");
    expect(acts).toContain("// describe: the checkout's own sentence");
  });

  it("applies an app that validates what the checkout validated, and checks as clean", () => {
    const studio = createStudio(app);
    expect(studio.check().findings.map((finding) => finding.code)).not.toContain("label-unbounded");
    const applied = studio.apply();
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const fields = applied.app.schema.tryDefinition("song")!.fields as z.ZodType;
    expect(fields.safeParse({ label: "x".repeat(61), explicit: false, status: "demo" }).success).toBe(false);
    expect(checkApp(applied.app).findings.map((finding) => finding.code)).not.toContain("label-unbounded");
  });

  it("follows the skill's own example to the letter", () => {
    const skill = readFileSync(new URL("../../../skills/skills/graview-studio/SKILL.md", import.meta.url), "utf8");
    const plot = defineNode("plot", { fields: z.object({ label: z.string().min(1), size: z.number() }), plural: "Plots" });
    const garden = defineApp({ name: "Garden", schema: createSchema([plot]), mutations: [] });
    const studio = createStudio(garden);
    const june = { kind: "human" as const, id: "june", roles: [] };
    const calls = [...skill.matchAll(/studio\.store\.apply\((\{[^\n]*?\})(?:, \{[^\n]*\})?\);/g)].map((match) => match[1]!);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const call of calls) {
      const parsed = new Function(`return (${call});`)() as { name: string; args: Record<string, unknown> };
      expect(() => studio.store.apply(parsed, { author: june }), call).not.toThrow();
    }
  });

  it("keeps a rule's repair that names a derived act (W-117)", () => {
    expect(file("src/domain/invariants.ts")).toContain('repairs: ["put-on", "edit-song"],');
    const applied = createStudio(app).apply();
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect([...(applied.app.invariants?.[0]?.repairs ?? [])].sort()).toEqual(["edit-song", "put-on"]);
  });
});

describe("the studio's round trip keeps what one of a kind is called", () => {
  it("writes a declared noun back", () => {
    const staff = defineNode("staff", {
      fields: z.object({ label: z.string().min(1).max(60) }),
      plural: "Staff",
      noun: "staff member",
      label: (node) => node.label,
    });
    const hire = defineMutation("hire", {
      title: "Hire somebody",
      creates: ["staff"],
      input: z.object({ label: z.string().min(1).max(60) }),
      apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "staff"), kind: "staff", label: args.label } as never),
    });
    const people = defineApp({ name: "People", schema: createSchema([staff]), mutations: [hire as never] });
    const schemaTs = createStudio(people).files().find((one) => one.path === "src/domain/schema.ts")!.contents;
    expect(schemaTs).toContain('noun: "staff member",');
  });
});

describe("the studio's round trip keeps a name built from fields, and a refusal's words", () => {
  const car = defineNode("car", {
    fields: z.object({ vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "a 17-character VIN"), year: z.number(), make: z.string() }),
    plural: "Cars",
    label: (node) => `${node.year} ${node.make}`,
  });
  const lot = defineApp({ name: "Lot", schema: createSchema([car]), mutations: [] });

  it("writes a regex's message back", () => {
    const schemaTs = createStudio(lot).files().find((one) => one.path === "src/domain/schema.ts")!.contents;
    expect(schemaTs).toContain('.regex(/^[A-HJ-NPR-Z0-9]{17}$/, "a 17-character VIN")');
  });

  it("says loudly that a label function must be carried over, and lists it as kept", () => {
    const written = createStudio(lot).files().find((one) => one.path === "src/domain/schema.ts")!;
      expect(written.contents).toContain('names "car" with a function the studio cannot write');
    expect(written.kept).toContain("car (label)");
  });

  it("keeps the checkout's name in the app it applies", () => {
    const studio = createStudio(lot);
    const applied = studio.apply();
    expect(applied.ok).toBe(true);
    const definition = applied.ok ? applied.app.schema.tryDefinition("car") : undefined;
    expect(typeof definition?.label).toBe("function");
    expect(definition?.label?.({ id: "c1", vin: "X", year: 2027, make: "Subaru" } as never)).toBe("2027 Subaru");
  });
});
