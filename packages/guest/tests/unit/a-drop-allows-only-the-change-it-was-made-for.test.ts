// @vitest-environment jsdom
import { Store, type AnySchema, type FileValue, type HostFiles, type Policy, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { JOURNEY_HANDLED_MANIFEST, weekendDocument, weekendSeed } from "../../../../scripts/fixtures/weekend-app.js";
import { createGuestDrops } from "../../src/host/drop.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createGuestHost } from "../../src/host/session.js";
import { judgeCodeAct, type DropGrant } from "../../src/host/writes.js";
import type { GuestDomEvent, HostMessage } from "../../src/protocol.js";

/**
 * A DROP ALLOWS ONLY THE CHANGE IT WAS MADE FOR (FR-193, FR-92). Where some
 * members may not see some records, a view's own code may still hand an act
 * the files a person dropped on it — but the drop is the person's gesture,
 * so it allows the change it was made for and nothing the view chose: each
 * file in one act, once, on the record it was dropped on. Were any record
 * the view was shown free for its code to pick, which day each moment went
 * on could spell, in base 3, a code in the family's vault that Sam, a
 * friend, may not read; were the file good for a second act, the view could
 * spell it at its leisure.
 */
const compiled = compileDocument({
  ...weekendDocument,
  roles: ["family", "friend"],
  kinds: { ...weekendDocument.kinds, vault: { noun: "vault", plural: "vaults", description: "Family only.", fields: { name: { type: "string", required: true }, code: { type: "number" } } } },
  acts: { ...weekendDocument.acts, "add-moment-to-day": { title: "Add a moment to this day", on: "day", effects: [{ create: "moment", as: "new", set: { caption: "$caption", photo: "$photo", clip: "$clip" } }, { connect: "takenOn", from: "$new", to: "$subject" }] } },
});
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as unknown as { schema: AnySchema; mutations: unknown[] };
const policy: Policy = { grants: [{ roles: ["family"], mutations: "*" }], sees: [{ roles: "*", kinds: ["moment", "day"] }, { roles: ["family"], kinds: ["vault"] }] };
const mia: Principal = { kind: "human", id: "person:mia", roles: ["family"] };
const manifest = { ...JOURNEY_HANDLED_MANIFEST, reads: { kinds: ["moment", "vault"], edges: ["takenOn"] } } as unknown as WorkerViewManifest;
const SATURDAY = "day:saturday";

const store = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations as never,
    policy,
    snapshot: structuredClone({ nodes: [...weekendSeed.nodes, { id: "vault:a", kind: "vault", name: "Lockbox", code: 200 }], edges: weekendSeed.edges }) as never,
  });
const momentsOn = (s: Store<AnySchema>, day: string) => s.graph.allEdges().filter((edge) => edge.kind === "takenOn" && edge.to === day).length;

const hostFiles = (): HostFiles => {
  let sent = 0;
  return {
    maxBytes: 50_000_000,
    kinds: ["image/*"],
    async upload(file, name) {
      sent += 1;
      return { href: `/graview/files/${sent}-${name}`, name, type: file.type, bytes: file.size };
    },
  };
};
const photos = (n: number) => Array.from({ length: n }, (_, at) => new File([new Uint8Array(100)], `IMG_${at}.jpg`, { type: "image/jpeg" }));

/** A view's region as `mountWorkerView` wires it, without the worker: the drawing, the session and the drops, the view hearing the drop. */
function region(s: Store<AnySchema>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const told: GuestDomEvent[] = [];
  const answers: HostMessage[] = [];
  const props = () => workerViewProps(s, mia, { manifest });
  const shown = () => new Set((props().nodes ?? []).map((node) => node.id));
  const handed = new Map<string, { readonly file: FileValue; readonly drop: DropGrant }>();
  const judgeAct = (name: string, args: Readonly<Record<string, unknown>>) => {
    const judged = judgeCodeAct(s, manifest, name, args, { shown: shown(), file: (href) => handed.get(href)?.file, dropped: (href) => handed.get(href)?.drop });
    if (judged.ok) for (const href of judged.spent ?? []) handed.delete(href);
    return judged;
  };
  const session = createGuestHost({ store: s, principal: mia, view: manifest.name, nonce: "n", send: (message) => answers.push(message), props, judgeAct });
  let drawing: ReturnType<typeof createOpenDrawing> | undefined;
  const drops = createGuestDrops(window, {
    shadow,
    manifest,
    store: s,
    principal: mia,
    files: hostFiles,
    shown,
    hears: () => true,
    idOf: (one) => drawing?.renderer.idOf(one),
    send: (message) => told.push(message),
    change: (calls, intent) => session.change(calls, intent),
    handed: (file, drop) => handed.set(file.href, { file, drop }),
  });
  drawing = createOpenDrawing(shadow, { origin: "null", send: (message) => told.push(message) });
  let ids = 0;
  const card = { id: `c${(ids += 1)}`, type: 1, element: "section", attributes: { "data-drop": "moment", "data-drop-connect": `takenOn:${SATURDAY}` }, children: [] };
  drawing.apply([[0, "~", card, 0]]);
  drops.refresh();
  const target = shadow.querySelector("[data-drop]") as HTMLElement;
  const drop = async (given: File[]) => {
    const event = new Event("drop", { bubbles: true, composed: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: given, types: ["Files"], dropEffect: "none", effectAllowed: "all", items: given.map((file) => ({ kind: "file", type: file.type })) } });
    target.dispatchEvent(event);
    await drops.idle();
    return told.filter((one) => one.event === "drop").at(-1)!.files!;
  };
  let id = 0;
  const act = (args: unknown) => {
    id += 1;
    session.receive({ type: "act", nonce: "n", id, name: "add-moment-to-day", args: args as never });
    return answers.filter((one) => one.type === "answer").at(-1) as unknown as { ok: boolean; reason?: string };
  };
  return { drop, act };
}

describe("a drop, where some members may not see some records", () => {
  it("makes its files moments on the day they were dropped on, from the view's own act, as one change", async () => {
    const s = store();
    const view = region(s);
    const files = await view.drop(photos(3));
    expect(view.act(files.map((file) => ({ id: SATURDAY, photo: file })))).toMatchObject({ ok: true });
    expect(momentsOn(s, SATURDAY)).toBe(3);
  });

  it("refuses a moment on a day the view was shown but the files were not dropped on", async () => {
    const s = store();
    const view = region(s);
    const [file] = await view.drop(photos(1));
    expect(view.act({ id: "day:friday", photo: file })).toMatchObject({ ok: false, reason: "press-only" });
    expect(s.graph.allNodes().filter((node) => node.kind === "moment")).toHaveLength(0);
  });

  it("spends each file in the act that carries it: a second act with it is refused, minutes later or at once", async () => {
    const s = store();
    const view = region(s);
    const [file] = await view.drop(photos(1));
    expect(view.act({ id: SATURDAY, photo: file })).toMatchObject({ ok: true });
    expect(view.act({ id: SATURDAY, photo: file })).toMatchObject({ ok: false });
    expect(momentsOn(s, SATURDAY)).toBe(1);
  });

  it("refuses one file handed to several calls of one change", async () => {
    const s = store();
    const view = region(s);
    const [file] = await view.drop(photos(1));
    expect(view.act([0, 1, 2, 3, 4].map(() => ({ id: SATURDAY, photo: file })))).toMatchObject({ ok: false });
    expect(momentsOn(s, SATURDAY)).toBe(0);
  });

  it("refuses words of the view's own beside the files", async () => {
    const s = store();
    const view = region(s);
    const [file] = await view.drop(photos(1));
    expect(view.act({ id: SATURDAY, photo: file, caption: "200" })).toMatchObject({ ok: false, reason: "press-only" });
  });
});

describe("the drop's exception, judged alone", () => {
  const file: FileValue = { href: "/graview/files/1-x.jpg", name: "x.jpg", type: "image/jpeg", bytes: 10 };
  const shown = new Set(["day:friday", SATURDAY, "day:sunday"]);
  const context = (drop: DropGrant | undefined) => ({ shown, file: (href: string) => (href === file.href ? file : undefined), dropped: (href: string) => (href === file.href ? drop : undefined) });

  it("takes no record at all from a drop bound to none", () => {
    expect(judgeCodeAct(store(), manifest, "add-moment-to-day", { id: SATURDAY, photo: file }, context({}))).toMatchObject({ ok: false, reason: "press-only" });
  });

  it("says which files the act spent", () => {
    expect(judgeCodeAct(store(), manifest, "add-moment-to-day", { id: SATURDAY, photo: file }, context({ target: SATURDAY }))).toMatchObject({ ok: true, spent: [file.href] });
  });
});
