// @vitest-environment jsdom
import { createSchema, defineNode, imageField, Store, videoField, z, type AnySchema } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createGuestPictures, PICTURES_SETTLE_MS, standInPictures, type GuestPictures } from "../../src/host/pictures.js";
import type { GuestFile, GuestNode, GuestProps } from "../../src/protocol.js";

/**
 * A VIEW CHOOSES THE PICTURES IT DRAWS (Roadmap f-view-pictures-chosen,
 * FR-220). A view of a season's drivers that read its circuits too asked
 * for `pictures: true`, and the drivers' 73 photos came to more than the
 * 12,000,000 bytes a view is handed before the circuits' maps it drew were
 * reached. A manifest now says which pictures it draws — the kinds
 * (`["circuit"]`) or the fields by kind (`{ circuit: "map" }`) — and a
 * picture it did not choose is handed by its facts alone: never fetched,
 * never reckoned against the budget. What is left out past the budget is
 * the same on every push, reckoned in the order the records are handed.
 */
const driver = defineNode("driver", { fields: z.object({ label: z.string(), portrait: imageField().optional(), clip: videoField().optional() }), plural: "Drivers", label: (node) => node.label });
const circuit = defineNode("circuit", { fields: z.object({ label: z.string(), map: imageField().optional(), photo: imageField().optional() }), plural: "Circuits", label: (node) => node.label });
const schema = createSchema([driver, circuit]);
const store = () => new Store({ schema, mutations: [] }) as unknown as Store<AnySchema>;

const picture = (name: string, bytes = 1_000) => ({ href: `/graview/files/${name}`, name, type: "image/png", bytes, width: 200, height: 100 });
const drivers: GuestNode[] = Array.from({ length: 3 }, (_, index) => ({ id: `driver:${index}`, kind: "driver", label: `Driver ${index}`, portrait: picture(`portrait-${index}.png`, 5_000) }) as unknown as GuestNode);
const circuits: GuestNode[] = [
  { id: "circuit:monza", kind: "circuit", label: "Monza", map: picture("monza-map.png"), photo: picture("monza-photo.png") },
  { id: "circuit:spa", kind: "circuit", label: "Spa", map: picture("spa-map.png"), photo: picture("spa-photo.png") },
] as unknown as GuestNode[];
const props = { view: "season", edges: [], acts: [], nodes: [...drivers, ...circuits] } as unknown as GuestProps;

let fetched: string[] = [];
afterEach(() => vi.restoreAllMocks());
function hand(pictures: GuestPictures, picturesBytes?: number) {
  fetched = [];
  vi.spyOn(window, "fetch").mockImplementation(async (url) => {
    fetched.push(new URL(String(url)).pathname.replace("/graview/files/", ""));
    return new Response(new Uint8Array(100), { status: 200, headers: { "content-type": "image/png" } });
  });
  let pushes = 0;
  const host = createGuestPictures(window, { as: "data", view: '"Season"', pictures, ...(picturesBytes ? { limits: { picturesBytes } } : {}), moved: () => (pushes += 1), shrink: async (blob) => blob });
  return { host, pushes: () => pushes };
}
const settled = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
  await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
};
const fileOf = (handed: GuestProps, id: string, field: string) => (handed.nodes ?? []).find((node) => node.id === id)![field] as unknown as GuestFile;

describe("a view that chooses the kinds whose pictures it draws", () => {
  it("is handed an address for that kind's pictures only, and never has the others fetched", async () => {
    const { host } = hand(["circuit"]);
    host.hand(props);
    await settled();
    const handed = host.hand(props);
    expect(fileOf(handed, "circuit:monza", "map").src).toMatch(/^data:image\/png;base64,/);
    expect(fileOf(handed, "circuit:spa", "photo").src).toMatch(/^data:image\/png;base64,/);
    expect(fileOf(handed, "driver:0", "portrait")).toEqual({ name: "portrait-0.png", type: "image/png", bytes: 5_000, width: 200, height: 100 });
    expect(fetched.sort()).toEqual(["monza-map.png", "monza-photo.png", "spa-map.png", "spa-photo.png"]);
  });

  it("keeps its budget for what it chose: the drivers' heavier photos no longer crowd out the circuits", async () => {
    const all = standInPictures(props, { view: '"Season"', pictures: true, standIn: "data:x", limits: { picturesBytes: 15_000 } });
    expect(all.props.nodes!.filter((node) => node.kind === "circuit").flatMap((node) => [node["map"], node["photo"]] as GuestFile[]).filter((file) => file.src)).toHaveLength(0);
    const chosen = standInPictures(props, { view: '"Season"', pictures: ["circuit"], standIn: "data:x", limits: { picturesBytes: 15_000 } });
    expect(chosen.left).toEqual([]);
    expect(chosen.props.nodes!.filter((node) => node.kind === "circuit").every((node) => (node["map"] as GuestFile).src === "data:x")).toBe(true);
  });
});

describe("a view that chooses the fields whose pictures it draws", () => {
  it("is handed an address for those fields only", async () => {
    const { host } = hand({ width: 400, circuit: "map" });
    host.hand(props);
    await settled();
    const handed = host.hand(props);
    expect(fileOf(handed, "circuit:monza", "map").src).toMatch(/^data:image\/png;base64,/);
    expect(fileOf(handed, "circuit:monza", "photo").src).toBeUndefined();
    expect(fetched.sort()).toEqual(["monza-map.png", "spa-map.png"]);
  });
});

describe("what is left out past the budget", () => {
  it("is the same on every push, in the order the records are handed, and says how to choose", async () => {
    const { host } = hand(true, 12_000);
    const first = host.hand(props);
    await settled();
    const again = host.hand(props);
    const shown = (handed: GuestProps) => (handed.nodes ?? []).map((node) => Object.entries(node).filter(([, value]) => (value as GuestFile)?.name).map(([field, value]) => `${node.id}.${field}:${(value as GuestFile).left ? "left" : "kept"}`)).flat();
    expect(shown(again)).toEqual(shown(first));
    expect(shown(first)).toEqual(["driver:0.portrait:kept", "driver:1.portrait:kept", "driver:2.portrait:left", "circuit:monza.map:kept", "circuit:monza.photo:kept", "circuit:spa.map:left", "circuit:spa.photo:left"]);
    expect(fileOf(first, "driver:2", "portrait").left).toMatch(/in the order its records are handed, took them\. A view that draws only some kinds' pictures says which \("pictures": \["<kind>"\]\)\.$/);
  });
});

describe("a manifest's chosen pictures", () => {
  const view = (pictures: unknown): WorkerViewManifest => ({ name: "season", attach: "driver", cardinality: "many", reads: { kinds: ["circuit"] }, pictures: pictures as GuestPictures });
  it("are sound when they name kinds the view is handed and fields that hold pictures", () => {
    for (const pictures of [true, ["circuit"], ["driver", "circuit"], { circuit: "map" }, { width: 600, circuit: ["map", "photo"], driver: "portrait" }, { width: 600 }]) expect(checkManifest(view(pictures), store()), JSON.stringify(pictures)).toEqual([]);
  });
  it("are refused, in a sentence, for a kind or a field that is none", () => {
    expect(checkManifest(view(["track"]), store())).toEqual(['The view\'s pictures chooses "track", which is no kind of this app.']);
    expect(checkManifest(view({ circuit: "logo" }), store())).toEqual(['The view\'s pictures chooses circuit\'s "logo", which holds no picture.']);
    expect(checkManifest(view({ circuit: "label" }), store())).toEqual(['The view\'s pictures chooses circuit\'s "label", which holds no picture.']);
    expect(checkManifest(view({ driver: "clip" }), store())[0]).toMatch(/^The view's pictures chooses driver's "clip", which holds videos/);
    expect(checkManifest({ ...view(["circuit"]), reads: {} }, store())).toEqual(['The view\'s pictures chooses "circuit", whose records it is not handed: add "circuit" to its reads.kinds.']);
    expect(checkManifest(view({ circuit: 3 }), store())[0]).toMatch(/^The view's pictures says "circuit": beside "width", it names a kind and the field/);
    expect(checkManifest(view([]), store())[0]).toMatch(/^The view's pictures is true; the kinds whose pictures it draws/);
  });
});
