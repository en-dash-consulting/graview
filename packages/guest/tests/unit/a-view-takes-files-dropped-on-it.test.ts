// @vitest-environment jsdom
import { fileKindOf as coreFileKindOf, nodeRefArgs, Store, type AnySchema, type FileValue, type GraviewApp, type HostFiles, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { JOURNEY_HANDLED_MANIFEST, JOURNEY_MANIFEST, nana, theo, weekendApp, weekendOnDayApp, weekendSeed } from "../../../../scripts/fixtures/weekend-app.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { createGuestDrops } from "../../src/host/drop.js";
import { planDrop } from "../../src/host/drop-plan.js";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { fileKindOf, refArgsOf } from "../../src/host/marks.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createGuestHost } from "../../src/host/session.js";
import { judgeCodeAct } from "../../src/host/writes.js";
import type { GuestDomEvent, HostMessage } from "../../src/protocol.js";
import { createViewRuntime } from "../../src/worker/view-global.js";

/**
 * A VIEW TAKES FILES DROPPED ON IT (FR-193, Graview Cloud's family weekend):
 * three photographs and a phone's video dragged from Finder onto Saturday's
 * card become four moments on Saturday, in one change one undo takes back.
 *
 * A view marks the element — `data-drop="moment"`, and the record it links
 * them to, `data-drop-connect="takenOn:day:saturday"` — and its manifest
 * says the fields that take them (`accepts`). The HOST owns the rest: the
 * highlight while something is dragged over, the files themselves, their
 * type and size against the field and the host's files, storing them
 * through the host's files; then a view that hears `drop` is told once,
 * with the files as the host stored them and never their bytes, and one
 * that does not gets a record of the kind per file, linked. On a phone the
 * same element is a tap that opens the picker. A seat that may make no such
 * record is offered no drop target at all.
 */
const store = (app: GraviewApp<AnySchema> = weekendApp) =>
  new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, policy: app.policy!, snapshot: structuredClone(weekendSeed) as never });
const SATURDAY = "day:saturday";
const momentsOn = (s: Store<AnySchema>, day = SATURDAY) => s.graph.allEdges().filter((edge) => edge.kind === "takenOn" && edge.to === day).map((edge) => s.graph.getNode(edge.from) as unknown as Record<string, unknown>);

/** Finder's three photographs and a phone's video. */
const finder = () => [
  new File([new Uint8Array(1_200)], "IMG_4031.jpg", { type: "image/jpeg", lastModified: Date.UTC(2026, 9, 17, 14, 47) }),
  new File([new Uint8Array(1_400)], "IMG_4032.jpg", { type: "image/jpeg" }),
  new File([new Uint8Array(900)], "IMG_4033.png", { type: "image/png" }),
  new File([new Uint8Array(4_000)], "IMG_4034.MOV", { type: "video/quicktime" }),
];

/** A host that stores what it is handed, at a path of its own, and answers a video with what a browser plays. */
function hostFiles(options: { maxBytes?: number; kinds?: readonly string[] } = {}): HostFiles & { readonly sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    maxBytes: options.maxBytes ?? 50_000_000,
    kinds: options.kinds ?? ["image/*", "video/*"],
    async upload(file, name) {
      sent.push(name);
      const video = file.type.startsWith("video/");
      return {
        href: `/graview/files/${sent.length}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${video ? ".mp4" : ""}`,
        name,
        type: video ? "video/mp4" : file.type,
        bytes: file.size,
        ...(video ? { duration: 12, poster: `/graview/files/${sent.length}-poster.jpg` } : {}),
      };
    },
  };
}

const INSERT = 0;
let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `d${(ids += 1)}`, type: 1, element: name, attributes, children });
const card = (attributes: Record<string, string> = {}, children: unknown[] = [element("h3", {}, [{ id: `t${(ids += 1)}`, type: 3, data: "Saturday" }])]) =>
  element("section", { "data-drop": "moment", "data-drop-connect": `takenOn:${SATURDAY}`, "data-day": SATURDAY, ...attributes }, children);

/** A view's region as `mountWorkerView` wires it, without the worker: the drawing, the session and the drops. */
function region(s: Store<AnySchema>, options: { principal?: Principal; manifest?: WorkerViewManifest; hears?: boolean; files?: HostFiles | undefined; coarse?: boolean; drawn?: unknown } = {}) {
  const principal = options.principal ?? nana;
  const manifest = options.manifest ?? (JOURNEY_MANIFEST as unknown as WorkerViewManifest);
  const files = "files" in options ? options.files : hostFiles();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const told: GuestDomEvent[] = [];
  const answers: HostMessage[] = [];
  const props = () => workerViewProps(s, principal, { manifest });
  const shown = () => new Set((props().nodes ?? []).map((node) => node.id));
  const handed = new Map<string, FileValue>();
  const context = { shown: shown(), file: (href: string) => handed.get(href), dropped: (href: string) => handed.has(href) };
  const session = createGuestHost({ store: s, principal, view: manifest.name, nonce: "n", send: (message) => answers.push(message), props, judgeAct: (name, args) => judgeCodeAct(s, manifest, name, args, context) });
  let drawing: ReturnType<typeof createOpenDrawing> | undefined;
  const drops = createGuestDrops(window, {
    shadow,
    manifest,
    store: s,
    principal,
    files: () => files,
    shown,
    hears: () => options.hears === true,
    idOf: (one) => drawing?.renderer.idOf(one),
    send: (message) => told.push(message),
    change: (calls, intent) => session.change(calls, intent),
    handed: (file) => handed.set(file.href, file),
    coarse: () => options.coarse === true,
  });
  drawing = createOpenDrawing(shadow, { origin: "null", send: (message) => told.push(message), before: (event, at, root) => (drops.before(event, at, root) ? false : undefined) });
  drawing.apply([[INSERT, "~", options.drawn ?? card(), 0]]);
  drops.refresh();
  const target = shadow.querySelector("[data-drop]") as HTMLElement;
  const drag = (type: string, given: File[] = finder(), at: Element = target) => {
    const event = new Event(type, { bubbles: true, composed: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: given, types: ["Files"], dropEffect: "none", effectAllowed: "all", items: given.map((file) => ({ kind: "file", type: file.type })) } });
    at.dispatchEvent(event);
    return event;
  };
  return { shadow, target, drag, drops, told, answers, session, files: files as ReturnType<typeof hostFiles> | undefined };
}

describe("the marks the host reads without zod", () => {
  it("say what core's own readers say: each field's file, each act's record arguments", () => {
    for (const app of [weekendApp, weekendOnDayApp]) {
      for (const definition of app.schema.definitions) for (const [field, schema] of Object.entries((definition.fields as unknown as { shape: Record<string, unknown> }).shape)) expect(fileKindOf(schema), `${definition.kind}.${field}`).toBe(coreFileKindOf(schema));
      for (const mutation of store(app).allMutations()) expect(refArgsOf(mutation.input), mutation.name).toEqual(nodeRefArgs(mutation.input).map(({ name, kinds }) => ({ name, kinds })));
    }
  });
});

describe("a manifest that accepts files", () => {
  const s = store();
  it("names a kind of the app and a field of it that holds a picture, a video or a file", () => {
    expect(checkManifest(JOURNEY_MANIFEST as unknown as WorkerViewManifest, s)).toEqual([]);
    expect(checkManifest({ ...JOURNEY_MANIFEST, accepts: [{ kind: "photo", field: "photo" }] } as unknown as WorkerViewManifest, s)).toEqual([expect.stringContaining('"photo", which is no kind of this app')]);
    expect(checkManifest({ ...JOURNEY_MANIFEST, accepts: [{ kind: "moment", field: "caption" }] } as unknown as WorkerViewManifest, s)).toEqual([expect.stringContaining("holds no picture, video or file")]);
    expect(checkManifest({ ...JOURNEY_MANIFEST, accepts: "moment" } as unknown as WorkerViewManifest, s)).toEqual([expect.stringContaining("a list of")]);
  });
});

describe("a drop target", () => {
  it("is offered where the seat may make the kind and link it to a record the view was shown, with the picker asking for what its fields take", () => {
    const s = store();
    const shown = new Set(["day:friday", SATURDAY]);
    const plan = planDrop(s, nana, JOURNEY_MANIFEST as unknown as WorkerViewManifest, { kind: "moment", connect: `takenOn:${SATURDAY}` }, { shown, files: hostFiles({ kinds: ["image/*", "video/*", "application/pdf"] }) });
    expect(plan).toMatchObject({ ok: true, accept: "image/*,video/*" });
    expect(planDrop(s, theo, JOURNEY_MANIFEST as unknown as WorkerViewManifest, { kind: "moment", connect: `takenOn:${SATURDAY}` }, { shown, files: hostFiles() })).toMatchObject({ ok: false, says: expect.stringContaining("may not") });
    expect(planDrop(s, nana, JOURNEY_MANIFEST as unknown as WorkerViewManifest, { kind: "moment", connect: "takenOn:day:sunday" }, { shown, files: hostFiles() })).toMatchObject({ ok: false, says: expect.stringContaining("was not shown") });
    expect(planDrop(s, nana, JOURNEY_MANIFEST as unknown as WorkerViewManifest, { kind: "day" }, { shown, files: hostFiles() })).toMatchObject({ ok: false, says: expect.stringContaining("accepts") });
  });

  it("is not offered where the host takes no files, or none its fields take", () => {
    expect(region(store(), { files: undefined }).target.hasAttribute("data-graview-drop")).toBe(false);
    expect(region(store(), { files: hostFiles({ maxBytes: 0, kinds: [] }) }).target.hasAttribute("data-graview-drop")).toBe(false);
    expect(region(store(), { files: hostFiles({ kinds: ["application/pdf"] }) }).target.hasAttribute("data-graview-drop")).toBe(false);
    expect(region(store()).target.hasAttribute("data-graview-drop")).toBe(true);
  });

  it("is not offered to a seat that may not make the kind, so nothing is offered and then refused", async () => {
    const s = store();
    const view = region(s, { principal: theo });
    expect(view.target.hasAttribute("data-graview-drop")).toBe(false);
    const dropped = view.drag("drop");
    await view.drops.idle();
    expect(dropped.defaultPrevented).toBe(false);
    expect(view.files!.sent).toEqual([]);
    expect(momentsOn(s)).toEqual([]);
  });

  it("is drawn by the host while files are dragged over it, and says so to assistive technology", () => {
    const view = region(store());
    const over = view.drag("dragover");
    expect(over.defaultPrevented).toBe(true);
    expect(view.target.hasAttribute("data-graview-drop-over")).toBe(true);
    expect(view.shadow.querySelector("[data-graview-drop-status]")?.textContent).toContain("Drop to add");
    view.drag("dragleave");
    expect(view.target.hasAttribute("data-graview-drop-over")).toBe(false);
  });
});

describe("files dropped on a view that does not hear the drop", () => {
  it("are four moments on Saturday, each with its file on its field, made in one change that one undo takes back", async () => {
    const s = store();
    const view = region(s);
    const dropped = view.drag("drop");
    expect(dropped.defaultPrevented).toBe(true);
    await view.drops.idle();
    expect(view.files!.sent).toEqual(["IMG_4031.jpg", "IMG_4032.jpg", "IMG_4033.png", "IMG_4034.MOV"]);
    const moments = momentsOn(s);
    expect(moments).toHaveLength(4);
    expect(moments.filter((one) => one["photo"]).map((one) => (one["photo"] as FileValue).name).sort()).toEqual(["IMG_4031.jpg", "IMG_4032.jpg", "IMG_4033.png"]);
    expect(moments.filter((one) => one["clip"]).map((one) => (one["clip"] as FileValue).type)).toEqual(["video/mp4"]);
    const batches = new Set(s.log.all().map((op) => op.batch));
    expect(batches.size).toBe(1);
    expect(s.log.all().every((op) => op.via === "view:journey" && op.author.id === nana.id)).toBe(true);
    expect(view.shadow.querySelector("[data-graview-drop-status]")?.textContent).toBe("Added 4 moments to Saturday.");
    s.undo([...batches][0]!, { author: nana });
    expect(momentsOn(s)).toEqual([]);
    expect(s.graph.nodesOfKind("moment" as never)).toEqual([]);
  });

  it("are made by an act on the day that makes a moment linked to it, where the app has one", async () => {
    const s = store(weekendOnDayApp);
    const view = region(s);
    view.drag("drop");
    await view.drops.idle();
    expect(momentsOn(s)).toHaveLength(4);
    expect(new Set(s.log.all().map((op) => op.mutation?.name))).toEqual(new Set(["add-moment-to-day"]));
  });

  it("are refused one by one in words where the host or the field will not take them, and the rest are kept", async () => {
    const s = store();
    const view = region(s, { files: hostFiles({ maxBytes: 1_300 }) });
    view.drag("drop", [...finder(), new File(["%PDF"], "quote.pdf", { type: "application/pdf" })]);
    await view.drops.idle();
    expect(momentsOn(s).map((one) => (one["photo"] as FileValue).name).sort()).toEqual(["IMG_4031.jpg", "IMG_4033.png"]);
    const said = view.shadow.querySelector("[data-graview-drop-refused]")?.textContent ?? "";
    expect(said).toContain("“IMG_4032.jpg” is 1 KB; this host takes files up to 1 KB.");
    expect(said).toContain("“IMG_4034.MOV” is 4 KB");
    expect(said).toContain("“quote.pdf” isn’t a picture or a video");
  });
});

describe("files dropped on a view that hears the drop", () => {
  it("are stored by the host and told to the view once, by where they are kept and never their bytes", async () => {
    const s = store(weekendOnDayApp);
    const view = region(s, { hears: true, manifest: JOURNEY_HANDLED_MANIFEST as unknown as WorkerViewManifest });
    view.drag("drop");
    await view.drops.idle();
    const drops = view.told.filter((one) => one.event === "drop");
    expect(drops).toHaveLength(1);
    expect(drops[0]!.files).toHaveLength(4);
    expect(drops[0]!.files![0]).toEqual({ href: "/graview/files/1-img-4031-jpg", name: "IMG_4031.jpg", type: "image/jpeg", bytes: 1_200, at: "2026-10-17T14:47:00.000Z", field: "photo" });
    expect(drops[0]!.files![3]).toMatchObject({ type: "video/mp4", duration: 12, poster: "/graview/files/4-poster.jpg", field: "clip" });
    expect(momentsOn(s)).toEqual([]);
  });

  it("are made by the view's own act, several as one change, each with a file the host handed it", async () => {
    const s = store(weekendOnDayApp);
    const view = region(s, { hears: true, manifest: JOURNEY_HANDLED_MANIFEST as unknown as WorkerViewManifest });
    view.drag("drop");
    await view.drops.idle();
    const files = view.told.find((one) => one.event === "drop")!.files!;
    view.session.receive({ type: "act", nonce: "n", id: 1, name: "add-moment-to-day", args: files.map((file) => ({ id: SATURDAY, caption: `Dropped ${file.name}`, [file.field]: file })) });
    expect(view.answers.filter((one) => one.type === "answer")).toEqual([expect.objectContaining({ id: 1, ok: true })]);
    expect(momentsOn(s)).toHaveLength(4);
    expect(new Set(s.log.all().map((op) => op.batch)).size).toBe(1);
    /* The file as the host kept it: what the view added to it (`at`, `field`) is not on the record. */
    expect(momentsOn(s).find((one) => (one["photo"] as FileValue | undefined)?.name === "IMG_4031.jpg")!["photo"]).toEqual({ href: "/graview/files/1-img-4031-jpg", name: "IMG_4031.jpg", type: "image/jpeg", bytes: 1_200 });
  });

  it("refuses a file the host did not hand the view, whatever its href says", async () => {
    const s = store(weekendOnDayApp);
    const view = region(s, { hears: true, manifest: JOURNEY_HANDLED_MANIFEST as unknown as WorkerViewManifest });
    view.session.receive({ type: "act", nonce: "n", id: 2, name: "add-moment-to-day", args: { id: SATURDAY, photo: { href: "/graview/files/someone-elses.jpg", name: "x.jpg", type: "image/jpeg", bytes: 10 } } });
    expect(view.answers.find((one) => one.type === "answer")).toMatchObject({ ok: false, reason: "malformed", message: expect.stringContaining("the host did not hand this view") });
    expect(s.log.length).toBe(0);
  });
});

describe("on a phone", () => {
  it("the drop target is a tap that opens the picker, asking for what its fields take, and what is picked is kept as a drop is", async () => {
    const s = store();
    const view = region(s, { coarse: true });
    const picker = view.shadow.querySelector<HTMLInputElement>("input[type=file][data-graview-drop-picker]")!;
    expect(picker.accept).toBe("image/*,video/*");
    expect(picker.multiple).toBe(true);
    let opened = 0;
    picker.click = () => void (opened += 1);
    view.target.querySelector("h3")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(opened).toBe(1);
    Object.defineProperty(picker, "files", { value: finder().slice(0, 2), configurable: true });
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    await view.drops.idle();
    expect(momentsOn(s)).toHaveLength(2);
  });

  it("is no tap where the element is not a drop target there, and a press on a button in it is the button's", () => {
    const view = region(store(), { coarse: true, drawn: card({}, [element("button", { "data-act": "nothing" }, [{ id: "bt", type: 3, data: "Open" }])]) });
    const picker = view.shadow.querySelector<HTMLInputElement>("input[data-graview-drop-picker]")!;
    let opened = 0;
    picker.click = () => void (opened += 1);
    view.target.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(opened).toBe(0);
  });
});

describe("the view's runtime", () => {
  function runtime() {
    const sent: unknown[] = [];
    const asked: unknown[] = [];
    const made = createViewRuntime({
      send: (request) => sent.push(request),
      act: (name, args) => (asked.push([name, args]), Promise.resolve({ type: "answer", id: 1, ok: true, intent: "" })),
      navigate: () => {},
      microtask: (task) => queueMicrotask(task),
      now: () => 0,
      threw: (error) => {
        throw error;
      },
      warn: () => {},
      hardening: () => ({ removed: [], stuck: [], sealed: false }),
    });
    return { ...made, sent, asked };
  }

  it("tells the host once that the view hears the drop, so the host leaves the drop to it", () => {
    const view = runtime();
    view.view.on("drop", "[data-drop]", () => {});
    view.view.on("drop", ".other", () => {});
    expect(view.sent.filter((one) => (one as { type: string }).type === "hears")).toEqual([{ type: "hears", events: ["drop"] }]);
  });

  it("asks for several of one act as one, and hands a drop's files to its listener", async () => {
    const view = runtime();
    void view.view.act("add-moment", [{ caption: "a" }, { caption: "b" }]);
    expect(view.asked).toEqual([["add-moment", [{ caption: "a" }, { caption: "b" }]]]);
  });
});

describe("the view checker on a drop target", () => {
  const run = nodeIsolate();
  const problemsOf = async (markup: string, manifest: WorkerViewManifest = JOURNEY_MANIFEST as unknown as WorkerViewManifest) => {
    const source = `graview.onProps(() => graview.render(${JSON.stringify(markup)}));`;
    const result = await runWorkerViewHeadless({ manifest, source, store: store(), principal: nana, run });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    return result.description.problems.map((one) => one.says);
  };

  it("takes a data-drop its manifest accepts, linked to a record the view was shown", async () => {
    expect(await problemsOf(`<section data-drop="moment" data-drop-connect="takenOn:${SATURDAY}">Saturday</section>`)).toEqual([]);
  });

  it("says a data-drop of a kind or a field the manifest does not accept, and a data-drop-connect that names no record shown", async () => {
    expect(await problemsOf(`<section data-drop="day">Saturday</section>`)).toEqual([expect.stringContaining('accepts names no field of "day"')]);
    expect(await problemsOf(`<section data-drop="moment" data-drop-field="caption">Saturday</section>`)).toEqual([expect.stringContaining('"caption"')]);
    expect(await problemsOf(`<section data-drop="moment" data-drop-connect="day:saturday">Saturday</section>`)).toEqual([expect.stringContaining("<relation>:<record id>")]);
    expect(await problemsOf(`<section data-drop="moment" data-drop-connect="takenOn:day:monday">Saturday</section>`)).toEqual([expect.stringContaining("was not shown")]);
    expect(await problemsOf(`<section data-drop="moment">Saturday</section>`, { ...JOURNEY_MANIFEST, accepts: undefined } as unknown as WorkerViewManifest)).toEqual([expect.stringContaining("accepts names no field")]);
  });
});
