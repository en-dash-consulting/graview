import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { fieldSpecOf, fileFieldsOf, firstPicture, resolveBlocks, compileBlocks, blockContextFor } from "../../src/blocks.js";
import { documentTypes } from "../../src/cli/types.js";
import { planMigration, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { formFields } from "../../src/forms.js";
import {
  createSchema,
  defineApp,
  defineNode,
  fileField,
  fileKindOf,
  filesOf,
  imageField,
  isFileValue,
  readableFields,
  refusalOf,
  safeFileHref,
  Store,
  z,
  type AnySchema,
  type FileValue,
  type GraviewApp,
} from "../../src/index.js";
import { argShape } from "../../src/mutations/node-ref.js";
import { mutationToolSchema } from "../../src/json-schema.js";

/**
 * FR-162. A RECORD CAN HOLD A PICTURE OR A DOCUMENT.
 *
 *   "photo":  { "type": "image" }
 *   "papers": { "type": "list", "of": "file" }
 *
 * The value is what the host's upload answered — `{ href, name, type,
 * bytes, width?, height?, caption? }` — its `href` a path on the host and
 * nothing else. It is a value like any other: set by an act, refused when
 * it is not one, undone, carried by an export, and said by every surface
 * that says a record.
 */
const porch: FileValue = { href: "/graview/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000, width: 1600, height: 1200, caption: "The porch after the storm" };
const gutter: FileValue = { href: "/graview/files/77b1.jpg", name: "gutter.jpg", type: "image/jpeg", bytes: 91_000 };
const quote: FileValue = { href: "files/a0c2.pdf", name: "quote.pdf", type: "application/pdf", bytes: 40_210 };

const repairs = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Repairs",
    kinds: {
      job: {
        fields: {
          name: { type: "string", required: true },
          photo: { type: "image", description: "what it looks like" },
          photos: { type: "list", of: "image" },
          papers: { type: "list", of: "file" },
        },
      },
    },
    acts: { "add-job": { title: "Add a job", creates: "job" } },
    views: { job: { card: [{ title: "{name}" }, { image: "photos", as: "thumb" }], page: [{ image: "papers", as: "gallery", label: "The papers" }] } },
  }) as unknown as GraviewDocument;

function compiled(doc: unknown = repairs()): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-11" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "roof", kind: "job", name: "Fix the roof" }], edges: [] } as never });
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("expected a refusal");
};
const errors = (doc: unknown) =>
  compileDocument(doc)
    .findings.filter((f) => f.severity === "error")
    .map((f) => `${f.code} at ${f.path}`);

describe("a file's value", () => {
  it("is a path on the host: a scheme, another host, a backslash or a climb is refused", () => {
    for (const href of ["/graview/files/3f9a.jpg", "files/3f9a.jpg", "3f9a.jpg", "/files/a.pdf?sig=1:2"]) expect(safeFileHref(href), href).toBe(true);
    for (const href of ["javascript:alert(1)", "JavaScript:x", "data:image/png;base64,AAAA", "https://elsewhere.example/a.jpg", "//elsewhere.example/a.jpg", "/files/../secrets", "../a.jpg", "./a.jpg", "/a/%2e%2e/b", "/a\\b", "/a b", "", "vbscript:x"]) {
      expect(safeFileHref(href), href).toBe(false);
    }
  });

  it("has a name, a media type and a size; a size in pixels and a caption are optional", () => {
    expect(isFileValue(porch)).toBe(true);
    expect(isFileValue(quote)).toBe(true);
    expect(isFileValue({ ...porch, href: "javascript:alert(1)" })).toBe(false);
    expect(isFileValue({ ...porch, name: "" })).toBe(false);
    expect(isFileValue({ ...porch, type: "jpeg" })).toBe(false);
    expect(isFileValue({ ...porch, bytes: -1 })).toBe(false);
    expect(isFileValue({ ...porch, bytes: undefined })).toBe(false);
    expect(isFileValue({ ...porch, width: 0 })).toBe(false);
    expect(isFileValue({ ...porch, caption: "x".repeat(501) })).toBe(false);
    expect(isFileValue("porch.jpg")).toBe(false);
    expect(filesOf([porch, "nope", quote])).toEqual([porch, quote]);
  });
});

describe("a document's image and file fields", () => {
  it("compile, and the store keeps a value the host gave and refuses one that is not a file of that sort", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-job", args: { id: "roof", photo: porch, papers: [quote] } });
    expect(store.graph.getNode("roof")).toMatchObject({ photo: porch, papers: [quote] });
    // A PDF is no picture; an address elsewhere is no file of the host's.
    expect(refusal(() => store.apply({ name: "edit-job", args: { id: "roof", photo: quote } }))).toMatchObject({ reason: "invalid" });
    expect(refusal(() => store.apply({ name: "edit-job", args: { id: "roof", papers: [{ ...quote, href: "https://elsewhere.example/q.pdf" }] } }))).toMatchObject({ reason: "invalid" });
    expect(refusal(() => store.apply({ name: "edit-job", args: { id: "roof", photo: { ...porch, href: "data:image/png;base64,AAAA" } } }))).toMatchObject({ reason: "invalid" });
  });

  it("are asked for as files: the argument's shape, the form's control and the tool's schema say so", () => {
    const store = storeOf(compiled());
    const edit = store.mutation("edit-job");
    expect(argShape(edit.input, "photo")).toEqual({ type: "file", image: true });
    expect(argShape(edit.input, "papers")).toEqual({ type: "several", of: { type: "file" } });
    const form = formFields(edit.input);
    expect(form.find((f) => f.name === "photo")).toMatchObject({ control: "file", image: true });
    expect(form.find((f) => f.name === "papers")).toMatchObject({ control: "list", item: { control: "file" } });
    const properties = mutationToolSchema(edit).inputSchema["properties"] as Record<string, Record<string, unknown>>;
    expect(properties["photo"]).toMatchObject({ type: "object", properties: { href: { type: "string" }, name: { type: "string" }, type: { type: "string" }, bytes: { type: "number" } }, required: ["href", "name", "type", "bytes"] });
    expect(properties["papers"]).toMatchObject({ type: "array", items: { type: "object" } });
  });

  it("set by an act are said in the history by their names and undone like any edit", () => {
    const store = storeOf(compiled());
    const done = store.apply({ name: "edit-job", args: { id: "roof", photos: [porch, gutter] } });
    expect(store.log.all().at(-1)?.intent).toContain("porch.jpg, gutter.jpg");
    expect(store.log.all().at(-1)?.intent).not.toContain("/graview/files");
    store.undo(done.batch!);
    expect(store.graph.getNode("roof")?.["photos"]).toBeUndefined();
  });

  it("are read by a record's facts as files, and left out of a glance's words", () => {
    const app = compiled();
    const definition = app.schema.tryDefinition("job");
    const node = { id: "roof", kind: "job", name: "Fix the roof", photos: [porch, gutter], papers: [quote] };
    const facts = readableFields(node, definition);
    expect(facts.find((f) => f.key === "photos")).toMatchObject({ files: [porch, gutter], value: "porch.jpg — The porch after the storm, gutter.jpg" });
    expect(facts.find((f) => f.key === "papers")).toMatchObject({ files: [quote], value: "quote.pdf" });
    expect(readableFields(node, definition, { glance: true }).map((f) => f.key)).toEqual(["name"]);
    expect(fileFieldsOf(definition)).toEqual(["photo", "photos", "papers"]);
    expect(firstPicture(node, definition)).toEqual(porch);
  });

  it("are shown by an image block: the first picture as a thumbnail, or every file in a gallery, named for who cannot see them", () => {
    const app = compiled();
    const node = { id: "roof", kind: "job", name: "Fix the roof", photos: [porch, gutter], papers: [quote] };
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [node], edges: [] } as never });
    const ctx = blockContextFor(store, null, node);
    const [, thumb] = resolveBlocks(compileBlocks([{ title: "{name}" }, { image: "photos", as: "thumb" }]), ctx);
    expect(thumb).toMatchObject({ t: "image", as: "thumb", files: [porch], text: "The porch after the storm" });
    const [gallery] = resolveBlocks(compileBlocks([{ image: "papers", as: "gallery", label: "The papers" }]), ctx);
    expect(gallery).toMatchObject({ t: "image", as: "gallery", label: "The papers", files: [quote], text: "quote.pdf" });
  });

  it("are checked: `of` a file only on a list, an image block only of a field that holds files", () => {
    expect(errors(repairs())).toEqual([]);
    const listed = repairs() as unknown as { kinds: { job: { fields: Record<string, unknown> } } };
    listed.kinds.job.fields["cover"] = { type: "image", of: "image" };
    expect(errors(listed)).toEqual(["shape at kinds.job.fields.cover.of"]);
    const shown = repairs() as unknown as { views: { job: { card: unknown[] } } };
    shown.views.job.card.push({ image: "name" }, { image: "photos", as: "big" });
    expect(errors(shown)).toEqual(["view-image at views.job.card.2.image", "view-format at views.job.card.3.as"]);
  });

  it("are written as TypeScript by graview types: a FileValue, or a list of them", () => {
    const types = documentTypes(repairs());
    expect(types).toContain('import type { FileValue } from "@graview/core";');
    expect(types).toMatch(/readonly photo\?: FileValue;/);
    expect(types).toMatch(/readonly papers\?: readonly FileValue\[\];/);
    expect(documentTypes({ ...repairs(), kinds: { note: { fields: { text: { type: "string" } } } } } as never)).not.toContain("FileValue");
  });
});

describe("a TypeScript declaration's image and file fields", () => {
  const job = defineNode("job", { fields: z.object({ name: z.string(), photo: imageField().optional(), papers: z.array(fileField()).max(20).default([]) }) });
  const schema = createSchema([job]);

  it("are marked through optional, default and describe, and written as a document's", () => {
    expect(fileKindOf(imageField().optional().describe("what it looks like"))).toBe("image");
    expect(fileKindOf(z.string())).toBeUndefined();
    const { document, findings } = toDocument(defineApp({ name: "repairs", schema }));
    expect(findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(document.kinds["job"]!.fields).toMatchObject({ photo: { type: "image" }, papers: { type: "list", of: "file" } });
    expect(fieldSpecOf(imageField())).toEqual({ type: "image", required: true });
  });

  it("refuse a value that is not a file the host stored", () => {
    expect(imageField().safeParse(porch).success).toBe(true);
    expect(imageField().safeParse(quote).success).toBe(false);
    expect(fileField().safeParse(quote).success).toBe(true);
    expect(fileField().safeParse({ ...quote, href: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("a change that loses files says so", () => {
  it("a removed field: the plan names the files no record holds afterwards, and the host decides about the bytes", () => {
    const before = repairs();
    const after = structuredClone(before) as unknown as { kinds: { job: { fields: Record<string, unknown> } } };
    delete after.kinds.job.fields["papers"];
    const plan = planMigration(before, after as never, { nodes: [{ id: "roof", kind: "job", name: "Fix the roof", photo: porch, papers: [quote] }], edges: [] });
    expect(plan.files).toEqual([quote]);
    expect(plan.words.join(" ")).toContain("1 file no record would hold any more (quote.pdf)");
  });

  it("a file kept by another record is not lost", () => {
    const before = repairs();
    const after = structuredClone(before) as unknown as { kinds: { job: { fields: Record<string, unknown> } } };
    delete after.kinds.job.fields["papers"];
    const plan = planMigration(before, after as never, { nodes: [{ id: "roof", kind: "job", name: "Roof", papers: [porch] }, { id: "porch", kind: "job", name: "Porch", photo: porch }], edges: [] });
    expect(plan.files).toEqual([]);
  });

  it("a removed record: its act says what files go with it", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-job", args: { id: "roof", photos: [porch, gutter], papers: [quote] } });
    store.apply({ name: "remove-job", args: { id: "roof" } });
    expect(store.log.all().at(-1)?.intent).toBe("Remove Fix the roof and its 3 files");
  });
});

describe("a removed record's count of files", () => {
  it("counts each file once, however many of its fields hold it", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-job", args: { id: "roof", photo: porch, photos: [porch, gutter] } });
    store.apply({ name: "remove-job", args: { id: "roof" } });
    expect(store.log.all().at(-1)?.intent).toBe("Remove Fix the roof and its 2 files");
  });
});

describe("an export carries a file's value as any field's", () => {
  it("a snapshot holds it and a store made from the snapshot reads it back", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-job", args: { id: "roof", photo: porch } });
    const copy = new Store<AnySchema>({ schema: store.schema, mutations: compiled().mutations ?? [], snapshot: JSON.parse(JSON.stringify(store.snapshot())) });
    expect(copy.graph.getNode("roof")).toMatchObject({ photo: porch });
  });
});
