import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { fieldSpecOf, fileFieldsOf, firstPicture, resolveBlocks, compileBlocks, blockContextFor, videoClock } from "../../src/blocks.js";
import { documentTypes } from "../../src/cli/types.js";
import { toDocument, type GraviewDocument } from "../../src/document/index.js";
import { formFields } from "../../src/forms.js";
import { createSchema, defineApp, defineNode, fileKindOf, isFileValue, isVideo, refusalOf, Store, videoField, videoWords, z, type AnySchema, type FileValue, type GraviewApp } from "../../src/index.js";
import { readableFields } from "../../src/words.js";
import { argShape } from "../../src/mutations/arg-shape.js";
import { mutationToolSchema } from "../../src/json-schema.js";

/**
 * A RECORD CAN HOLD A VIDEO (0.1.37, Roadmap f-video-framework).
 *
 *   "clip":  { "type": "video" }
 *   "clips": { "type": "list", "of": "video" }
 *
 * A video is a file the host stored, as a picture is — `{ href, name,
 * type, bytes }` — with what a player wants before it loads a byte: a
 * poster (a picture on the host), its length in seconds, its size in
 * pixels, and captions (a WebVTT file on the host). Uploaded through the
 * host's files, said in words as "a 45-second video".
 */
const beach: FileValue = { href: "/graview/files/9c1e.mp4", name: "beach.mov", type: "video/mp4", bytes: 18_400_000, width: 1920, height: 1080, duration: 45, poster: "/graview/files/9c1e.jpg", caption: "The waves at dusk" };
const bare: FileValue = { href: "/graview/files/5d0a.webm", name: "rain.webm", type: "video/webm", bytes: 2_100 };
const porch: FileValue = { href: "/graview/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000 };

const moments = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Moments",
    kinds: {
      moment: {
        fields: {
          name: { type: "string", required: true },
          clip: { type: "video" },
          clips: { type: "list", of: "video" },
          photo: { type: "image" },
        },
      },
    },
    acts: { "add-moment": { title: "Add a moment", creates: "moment" } },
    views: { moment: { card: [{ title: "{name}" }, { image: "clip", as: "thumb" }], page: [{ image: "clips", as: "gallery" }] } },
  }) as unknown as GraviewDocument;

function compiled(doc: unknown = moments()): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-18" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "dusk", kind: "moment", name: "Dusk" }], edges: [] } as never });
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("expected a refusal");
};

describe("a video's value", () => {
  it("may say its poster, its length, its size and its captions — each a path on the host, or a sound number", () => {
    expect(isFileValue(beach)).toBe(true);
    expect(isFileValue(bare)).toBe(true);
    expect(isFileValue({ ...beach, captions: "/graview/files/9c1e.vtt" })).toBe(true);
    expect(isFileValue({ ...beach, duration: 12.48 })).toBe(true);
    expect(isFileValue({ ...beach, poster: "https://elsewhere.example/p.jpg" })).toBe(false);
    expect(isFileValue({ ...beach, poster: "data:image/png;base64,AAAA" })).toBe(false);
    expect(isFileValue({ ...beach, captions: "javascript:alert(1)" })).toBe(false);
    expect(isFileValue({ ...beach, duration: 0 })).toBe(false);
    expect(isFileValue({ ...beach, duration: -3 })).toBe(false);
    expect(isFileValue({ ...beach, duration: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isFileValue({ ...beach, duration: "45" })).toBe(false);
    expect(isVideo(beach)).toBe(true);
    expect(isVideo(porch)).toBe(false);
  });

  it("is said by its length: a 45-second video, a 3-minute video, and its clock on a card", () => {
    expect(videoWords(beach)).toBe("a 45-second video");
    expect(videoWords({ ...beach, duration: 1 })).toBe("a 1-second video");
    expect(videoWords({ ...beach, duration: 59.6 })).toBe("a 1-minute video");
    expect(videoWords({ ...beach, duration: 185 })).toBe("a 3-minute video");
    expect(videoWords({ ...beach, duration: 4_000 })).toBe("a 1-hour 7-minute video");
    expect(videoWords(bare)).toBe("a video");
    expect(videoClock(45)).toBe("0:45");
    expect(videoClock(125.4)).toBe("2:05");
    expect(videoClock(3_725)).toBe("1:02:05");
  });
});

describe("a document's video field", () => {
  it("compiles, and the store keeps a video the host gave and refuses a picture or a document", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-moment", args: { id: "dusk", clip: beach, clips: [beach, bare] } });
    expect(store.graph.getNode("dusk")).toMatchObject({ clip: beach, clips: [beach, bare] });
    expect(refusal(() => store.apply({ name: "edit-moment", args: { id: "dusk", clip: porch } }))).toMatchObject({ reason: "invalid" });
    expect(refusal(() => store.apply({ name: "edit-moment", args: { id: "dusk", clips: [porch] } }))).toMatchObject({ reason: "invalid" });
    // A picture field takes no video.
    expect(refusal(() => store.apply({ name: "edit-moment", args: { id: "dusk", photo: beach } }))).toMatchObject({ reason: "invalid" });
  });

  it("is asked for as a video: the argument's shape, the form's control and the tool's schema say so", () => {
    const store = storeOf(compiled());
    const edit = store.mutation("edit-moment");
    expect(argShape(edit.input, "clip")).toEqual({ type: "file", video: true });
    expect(argShape(edit.input, "clips")).toEqual({ type: "several", of: { type: "file", video: true } });
    const form = formFields(edit.input);
    expect(form.find((f) => f.name === "clip")).toMatchObject({ control: "file", video: true });
    const properties = mutationToolSchema(edit).inputSchema["properties"] as Record<string, Record<string, unknown>>;
    expect(properties["clip"]).toMatchObject({ type: "object", properties: { poster: { type: "string" }, duration: { type: "number" }, captions: { type: "string" } }, required: ["href", "name", "type", "bytes"] });
  });

  it("is read by a record's facts with its length, and is the picture a card shows when it is the first", () => {
    const app = compiled();
    const definition = app.schema.tryDefinition("moment");
    const node = { id: "dusk", kind: "moment", name: "Dusk", clip: beach, photo: porch };
    const facts = readableFields(node, definition);
    expect(facts.find((f) => f.key === "clip")).toMatchObject({ files: [beach], value: "beach.mov — The waves at dusk (a 45-second video)" });
    expect(fileFieldsOf(definition)).toEqual(["clip", "clips", "photo"]);
    expect(firstPicture(node, definition)).toEqual(beach);
    expect(firstPicture({ ...node, clip: bare }, definition)).toEqual(bare);
  });

  it("is shown by an image block: a thumb shows the first video by its poster, and its words say how long", () => {
    const app = compiled();
    const node = { id: "dusk", kind: "moment", name: "Dusk", clip: beach, clips: [bare, beach] };
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [node], edges: [] } as never });
    const ctx = blockContextFor(store, null, node);
    const [, thumb] = resolveBlocks(compileBlocks([{ title: "{name}" }, { image: "clip", as: "thumb" }]), ctx);
    expect(thumb).toMatchObject({ t: "image", as: "thumb", files: [beach], text: "The waves at dusk, a 45-second video" });
    const [gallery] = resolveBlocks(compileBlocks([{ image: "clips", as: "gallery" }]), ctx);
    expect(gallery).toMatchObject({ files: [bare, beach], text: "rain.webm, a video, The waves at dusk, a 45-second video" });
  });

  it("is checked like an image field: `of` a video only on a list", () => {
    const errors = (doc: unknown) =>
      compileDocument(doc)
        .findings.filter((f) => f.severity === "error")
        .map((f) => `${f.code} at ${f.path}`);
    expect(errors(moments())).toEqual([]);
    const listed = moments() as unknown as { kinds: { moment: { fields: Record<string, unknown> } } };
    listed.kinds.moment.fields["reel"] = { type: "video", of: "video" };
    expect(errors(listed)).toEqual(["shape at kinds.moment.fields.reel.of"]);
  });

  it("is written as TypeScript by graview types: a FileValue, or a list of them", () => {
    const types = documentTypes(moments());
    expect(types).toContain('import type { FileValue } from "@graview/core";');
    expect(types).toMatch(/readonly clip\?: FileValue;/);
    expect(types).toMatch(/readonly clips\?: readonly FileValue\[\];/);
    const only = { ...moments(), kinds: { moment: { fields: { clip: { type: "video" } } } } };
    expect(documentTypes(only as never)).toContain("FileValue");
  });
});

describe("a TypeScript declaration's video field", () => {
  const moment = defineNode("moment", { fields: z.object({ name: z.string(), clip: videoField().optional(), clips: z.array(videoField()).max(20).default([]) }) });
  const schema = createSchema([moment]);

  it("is marked through optional and describe, and written as a document's", () => {
    expect(fileKindOf(videoField().optional().describe("the clip"))).toBe("video");
    const { document, findings } = toDocument(defineApp({ name: "moments", schema }));
    expect(findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(document.kinds["moment"]!.fields).toMatchObject({ clip: { type: "video" }, clips: { type: "list", of: "video" } });
    expect(fieldSpecOf(videoField())).toEqual({ type: "video", required: true });
  });

  it("refuses a value that is not a video the host stored", () => {
    expect(videoField().safeParse(beach).success).toBe(true);
    expect(videoField().safeParse(porch).success).toBe(false);
    expect(videoField().safeParse({ ...beach, poster: "//elsewhere/p.jpg" }).success).toBe(false);
  });
});
