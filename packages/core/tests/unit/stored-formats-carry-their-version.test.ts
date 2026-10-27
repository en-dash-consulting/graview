import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assertReadable, bindSchema, createSchema, defineNode, FORMATS, formatStamp, FRAMEWORK_VERSION, NewerFormatError, Store, upgradeOp, upgradeSnapshot, type Epoch, type Operation, type Principal } from "../../src/index.js";
import "../../src/publishing.js";

/**
 * FR-31. What a version writes says what wrote it; a reader meeting a newer
 * format says so instead of folding it; an older format is brought up.
 */
const fixture = JSON.parse(readFileSync(new URL("../fixtures/formats/format-1.json", import.meta.url), "utf8")) as {
  snapshot: Parameters<typeof upgradeSnapshot>[0];
  ops: Operation[];
};

describe("stored formats carry their version", () => {
  it("a stamp names the framework that wrote it and every format", () => {
    // Snapshot format 2 is stamped only on what begins at a checkpoint past what stood published (`checkpoint-past-a-publish.json`).
    expect(formatStamp()).toEqual({ framework: FRAMEWORK_VERSION, formats: { snapshot: 1, op: FORMATS.op } });
  });

  it("what 0.1.0 wrote, unstamped, reads as format 1 and comes up to this build's", () => {
    expect(() => assertReadable(null)).not.toThrow();
    expect(() => assertReadable({ framework: "0.1.0" })).not.toThrow();
    expect(upgradeSnapshot(fixture.snapshot, 1)).toEqual(fixture.snapshot);
    // Op format 2 keeps no inverse: format 1's, its primitives' own, is dropped and nothing else moves.
    for (const op of fixture.ops) {
      const { inverse, ...rest } = op;
      expect(inverse).toBeDefined();
      expect(upgradeOp(op, 1)).toEqual(rest);
      expect(upgradeOp(upgradeOp(op, 1), 2)).toEqual(rest);
    }
  });

  it("a newer format is reported, not folded", () => {
    const newer = { framework: "9.0.0", formats: { snapshot: FORMATS.snapshot + 1, op: FORMATS.op } };
    expect(() => assertReadable(newer)).toThrow(NewerFormatError);
    expect(() => assertReadable(newer)).toThrow(/newer format \(3, written by @graview 9\.0\.0\).*Refold it from the log/);
    expect(() => upgradeSnapshot(fixture.snapshot, FORMATS.snapshot + 1)).toThrow(NewerFormatError);
    expect(() => upgradeOp(fixture.ops[0]!, FORMATS.op + 1)).toThrow(NewerFormatError);
  });

  /*
   * SNAPSHOT FORMAT 2: a checkpoint past what stood published. A build before
   * it (0.1.59 reads snapshot 1, op 3) ignores `Epoch.published` and would
   * serve readers the horizon; it refuses the stamp instead.
   */
  const compacted = JSON.parse(readFileSync(new URL("../fixtures/formats/checkpoint-past-a-publish.json", import.meta.url), "utf8")) as Record<
    "before" | "past",
    { readonly framework?: string; readonly formats: { snapshot: number; op: number }; readonly epochs: Epoch[]; readonly ops: Operation[] }
  >;
  const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
  const schema = createSchema([note]);
  const add = bindSchema(schema).defineMutation("add-note", {
    title: "Add a note",
    creates: ["note"],
    input: z.object({ label: z.string().min(1) }),
    apply(ctx, args) {
      ctx.addNode({ id: ctx.freshId(args.label, "n"), kind: "note", label: args.label } as never);
    },
  });
  const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
  const opened = (held: (typeof compacted)["before"]) =>
    new Store({
      schema,
      mutations: [add],
      policy: { grants: [{ roles: ["editor"], mutations: "*" }], sees: [{ roles: "*", kinds: ["note"] }] },
      publishing: { mode: "on-publish", working: ["editor"], publishers: ["editor"] },
      log: held.ops,
      epochs: held.epochs,
    });
  const readersSee = (store: Store<typeof schema>) => store.seenBy(reader).graph.allNodes().map((node) => node.label).sort();

  it("what 0.1.59 wrote of a compacted app that publishes, snapshot format 1, reads as written and is stamped 1 again", () => {
    expect(() => assertReadable(compacted.before)).not.toThrow();
    const store = opened(compacted.before);
    expect(upgradeSnapshot(compacted.before.epochs[0]!.base, 1)).toEqual(compacted.before.epochs[0]!.base);
    expect(readersSee(store)).toEqual(["One"]);
    expect(formatStamp(store.log.horizonEpoch()).formats.snapshot).toBe(1);
  });

  it("a checkpoint past what stood published is stamped snapshot format 2, which the build before refuses", () => {
    const store = opened(compacted.past);
    expect(store.log.horizon).toBeGreaterThan(store.publishedSeq!);
    expect(readersSee(store)).toEqual(["One"]);
    const stamp = formatStamp(store.log.horizonEpoch());
    expect(stamp.formats).toEqual(compacted.past.formats);
    expect(() => assertReadable(stamp)).not.toThrow();
    expect(() => assertReadable(stamp, { snapshot: 1, op: 3 })).toThrow(NewerFormatError);
  });
});
