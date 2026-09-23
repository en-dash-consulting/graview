import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { editDeclaration, studioDoorHandler } from "../../src/dev.js";

/**
 * THE STUDIO'S CHANGE, MADE AS AN EDIT — held to "every other character
 * stays where it was" against a real app's declaration, not a toy.
 *
 * Seedbed's schema is the test because it is the kind of file the studio
 * must not flatten: comments that say why, a label function per kind, a
 * lifecycle, an appendOnly edge with both readings.
 */
const seedbed = fileURLToPath(new URL("../../../../apps/seedbed/src/domain/schema.ts", import.meta.url));

const edit = async (changes: Parameters<typeof editDeclaration>[2]) => {
  const text = await readFile(seedbed, "utf8");
  const edited = editDeclaration(ts, [{ path: "src/domain/schema.ts", text }], changes);
  return { text, edited };
};

/** The lines only one side has — a line diff, bag-wise. */
const differing = (before: string, after: string) => {
  const count = (text: string) => {
    const bag = new Map<string, number>();
    for (const line of text.split("\n")) bag.set(line, (bag.get(line) ?? 0) + 1);
    return bag;
  };
  const a = count(before);
  const b = count(after);
  const gone = [...a].flatMap(([line, n]) => Array(Math.max(0, n - (b.get(line) ?? 0))).fill(line) as string[]);
  const came = [...b].flatMap(([line, n]) => Array(Math.max(0, n - (a.get(line) ?? 0))).fill(line) as string[]);
  return { gone, came };
};

describe("a declaration change made inside the checkout's own source", () => {
  it("moves an edge to another kind with its readings and its comment, and touches nothing else", async () => {
    const { text, edited } = await edit([
      { what: "move-edge", edge: "tended-by", from: "plot", to: "planting", targets: '["gardener"]' },
    ]);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const after = edited.files[0]!.text;
    // The plot no longer declares it; the planting does, with its readings and the comment above it.
    const plot = after.slice(after.indexOf('defineNode("plot"'), after.indexOf('defineNode("planting"'));
    const planting = after.slice(after.indexOf('defineNode("planting"'), after.indexOf('defineNode("rotation"'));
    expect(plot).not.toContain("tended-by");
    expect(plot).not.toContain("edges:");
    expect(planting).toContain('"tended-by": { to: ["gardener"], description: "who looks after it", inverse: "what they look after" }');
    expect(planting).toContain("// One edge, two readings");
    // Everything else is the file as it was: the only lines that differ are the moved block and the emptied `edges`.
    const { gone, came } = differing(text, after);
    expect(gone.map((line) => line.trim())).toEqual(expect.arrayContaining(["edges: {", "},"]));
    expect(gone.every((line) => /edges: \{|^\s*},?$/.test(line) || line.includes("tended-by") || line.trim().startsWith("//"))).toBe(true);
    expect(came.every((line) => line.includes("tended-by") || line.trim().startsWith("//"))).toBe(true);
    // And it still parses.
    expect(ts.transpileModule(after, { reportDiagnostics: true }).diagnostics).toEqual([]);
  });

  it("adds, changes and removes a field in the kind's own z.object", async () => {
    const { text, edited } = await edit([
      { what: "add-field", kind: "gardener", field: "phone", zod: "z.string().optional()" },
      { what: "change-field", kind: "plot", field: "beds", zod: "z.number().int().min(0)" },
      { what: "remove-field", kind: "planting", field: "harvested" },
    ]);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const after = edited.files[0]!.text;
    expect(after).toContain("fields: z.object({ label: z.string().min(1), phone: z.string().optional() }),");
    expect(after).toContain("beds: z.number().int().min(0),");
    expect(after).not.toContain("harvested: isoDate.optional()");
    // The comment that explained the removed field goes with it; the ones around it stay.
    expect(after).not.toContain("WHEN IT CAME IN");
    expect(after).toContain("Where it lies in the garden");
    const { came } = differing(text, after);
    expect(came).toHaveLength(2);
  });

  it("adds an edge to a kind that had none, and a kind to the schema", async () => {
    const { edited } = await edit([
      { what: "add-edge", kind: "gardener", edge: "mentors", text: '{ to: ["gardener"], description: "who they are teaching" }' },
      {
        what: "add-kind",
        kind: "tool",
        binding: "tool",
        text: 'export const tool = defineNode("tool", {\n  fields: z.object({ label: z.string().min(1) }),\n  plural: "Tools",\n});',
      },
    ]);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const after = edited.files[0]!.text;
    expect(after).toContain('mentors: { to: ["gardener"], description: "who they are teaching" }');
    expect(after).toContain('export const tool = defineNode("tool", {');
    expect(after).toContain("createSchema([gardener, plot, planting, rotation, rule, tool])");
    expect(ts.transpileModule(after, { reportDiagnostics: true }).diagnostics).toEqual([]);
  });

  it("refuses the whole set, naming why, when one change cannot be made", async () => {
    const { edited } = await edit([
      { what: "add-field", kind: "gardener", field: "phone", zod: "z.string()" },
      { what: "remove-field", kind: "compost", field: "heat" },
    ]);
    expect(edited.ok).toBe(false);
    if (edited.ok) return;
    expect(edited.refused[0]).toContain('defineNode("compost"');
  });
});

describe("the studio door", () => {
  const respond = () => {
    const sent: { status?: number; body?: string } = {};
    const res = {
      setHeader: () => {},
      end: (body: string) => (sent.body = body),
      set statusCode(value: number) {
        sent.status = value;
      },
    } as never;
    return { sent, res };
  };
  const request = (method: string, body?: string, origin?: string) =>
    ({
      method,
      headers: { host: "localhost:5173", ...(origin ? { origin } : {}) },
      on: (event: string, handler: (chunk?: Buffer) => void) => {
        if (event === "data" && body) handler(Buffer.from(body));
        if (event === "end") handler();
      },
    }) as never;

  it("edits only its own src/domain, writes the change, and says what it wrote", async () => {
    const root = await mkdtemp(join(tmpdir(), "studio-door-"));
    try {
      await mkdir(join(root, "src/domain"), { recursive: true });
      await writeFile(join(root, "src/domain/schema.ts"), await readFile(seedbed, "utf8"));
      const door = studioDoorHandler({ root, typescript: ts });

      const probe = respond();
      await door(request("GET"), probe.res);
      expect(JSON.parse(probe.sent.body!)).toEqual({ available: true, domain: "src/domain", files: ["src/domain/schema.ts"] });

      const asked = respond();
      await door(
        request("POST", JSON.stringify({ changes: [{ what: "add-field", kind: "gardener", field: "phone", zod: "z.string().optional()" }] })),
        asked.res,
      );
      const answer = JSON.parse(asked.sent.body!);
      expect(answer.written).toEqual(["src/domain/schema.ts"]);
      expect(await readFile(join(root, "src/domain/schema.ts"), "utf8")).toContain("phone: z.string().optional()");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("answers this app only", async () => {
    const door = studioDoorHandler({ root: tmpdir(), typescript: ts });
    const { sent, res } = respond();
    await door(request("POST", "{}", "https://elsewhere.example"), res);
    expect(sent.status).toBe(403);
  });
});
