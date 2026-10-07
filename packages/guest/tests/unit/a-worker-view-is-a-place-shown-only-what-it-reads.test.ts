import { Store } from "@graview/core";
import { createViews } from "@graview/react/provider";
import { describe, expect, it } from "vitest";
import { erin, lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createGuestHost } from "../../src/host/session.js";
import { registerWorkerView } from "../../src/host/worker-react.js";
import type { GuestProps, GuestTheme } from "../../src/protocol.js";

/**
 * A WORKER VIEW IS A PLACE, SHOWN ONLY WHAT ITS MANIFEST READS (FR-91).
 * LifeLogics' package lens attaches to `package` and reads `offer` and
 * `includes`. Lin, of the client, may see the packages and only the offers
 * made to her firm; "Internal margin review" is made to the delivery
 * partner, and is in the starter package. That the lens is a place by its
 * title on both faces, and restyles with the app's toggle, is
 * `guest-sandbox --transport=place` in Chromium, WebKit and Firefox.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: offersSeed as never });
const packages: WorkerViewManifest = { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } };
const theme: GuestTheme = { scheme: "dark", accent: "#6fdcea", ground: "#080d12", panel: "rgba(20, 31, 39, 0.94)", ink: "#e8f3f6", inkMuted: "#9fb6bf", edge: "rgba(126, 196, 214, 0.20)", fontBody: "system-ui", fontDisplay: "Georgia, serif", fontMono: "ui-monospace", radius: "12px" };
const ids = (props: GuestProps) => (props.nodes ?? []).map((node) => node.id).sort();

describe("what a worker view is handed", () => {
  it("is the packages, the offers Lin may see, and the includes edges among them", () => {
    const props = workerViewProps(store(), lin, { manifest: packages });
    expect(ids(props)).toEqual(["offer:build", "offer:coaching", "offer:strategy", "package:full", "package:later", "package:start"]);
    expect(props.edges.every((edge) => edge.kind === "includes")).toBe(true);
    expect(props.edges).toContainEqual({ kind: "includes", from: "package:start", to: "offer:coaching" });
    expect(props.label).toBe("The packages");
    expect(props.cardinality).toBe("many");
  });

  it("holds no trace of the offer Lin may not see: not a node, an edge, a label or a field", () => {
    const wire = JSON.stringify(workerViewProps(store(), lin, { manifest: packages }));
    for (const word of ["offer:margin", "Internal margin review", "18500", "party:open-set"]) expect(wire).not.toContain(word);
  });

  it("is the margin review too, for Erin, who may see it", () => {
    const props = workerViewProps(store(), erin, { manifest: packages });
    expect(ids(props)).toContain("offer:margin");
    expect(props.edges).toContainEqual({ kind: "includes", from: "package:start", to: "offer:margin" });
  });

  it("is no kind and no edge it did not say it reads, however visible", () => {
    const props = workerViewProps(store(), erin, { manifest: packages });
    expect(new Set((props.nodes ?? []).map((node) => node.kind))).toEqual(new Set(["package", "offer"]));
    expect(props.edges.some((edge) => edge.kind === "for")).toBe(false);
    const bare = workerViewProps(store(), erin, { manifest: { ...packages, reads: undefined } as WorkerViewManifest });
    expect(ids(bare)).toEqual(["package:full", "package:later", "package:start"]);
    expect(bare.edges).toEqual([]);
  });

  it("fills every record's label as the host labels it", () => {
    const props = workerViewProps(store(), lin, { manifest: packages });
    expect(props.nodes!.find((node) => node.id === "offer:coaching")!.label).toBe("Team coaching");
  });

  it("is the one record and what it reads, for a view of one", () => {
    const props = workerViewProps(store(), lin, { manifest: { ...packages, cardinality: "one", title: undefined } as WorkerViewManifest, input: { node: { id: "package:start" } } });
    expect(props.node?.id).toBe("package:start");
    expect(ids(props)).toEqual(["offer:build", "offer:coaching", "offer:strategy"]);
  });

  it("is only what it reads, for the home", () => {
    const props = workerViewProps(store(), lin, { manifest: { name: "front", attach: "home", cardinality: "many", reads: { kinds: ["package", "signal"] } } });
    expect(ids(props)).toEqual(["package:full", "package:later", "package:start", "signal:hand-off"]);
    expect(props.node).toBeUndefined();
  });

  it("carries the app's look", () => {
    expect(workerViewProps(store(), lin, { manifest: packages, theme }).theme).toEqual(theme);
  });

  it("lists only the acts the manifest names that the viewer may run", () => {
    const props = workerViewProps(store(), erin, { manifest: { ...packages, acts: ["set-standing", { act: "set-standing", as: "recommend", constants: { standing: "recommended" } }] } });
    expect(props.acts.map((act) => act.name)).toEqual(["set-standing"]);
    expect(workerViewProps(store(), lin, { manifest: { ...packages, acts: ["set-standing"] } }).acts).toEqual([]);
  });
});

describe("a manifest", () => {
  it("is sound when it names what the app declares", () => {
    expect(checkManifest(packages, store())).toEqual([]);
  });
  it("names every kind, edge and act the app does not declare, and a name that is not a name", () => {
    const findings = checkManifest({ name: "The Packages!", attach: "packet", cardinality: "some" as never, reads: { kinds: ["offre"], edges: ["include"] }, acts: ["buy", "buy"] }, store());
    expect(findings).toHaveLength(8);
    expect(findings.join(" ")).toMatch(/packet.*offre.*include.*buy/s);
  });
});

describe("a frame guest, too", () => {
  it("is handed each record's label as the host labels it", () => {
    const said: unknown[] = [];
    const host = createGuestHost({ store: store(), principal: lin, view: "frame", nonce: "n", send: (message) => said.push(message), input: () => ({ nodes: [{ id: "offer:coaching" }, { id: "party:lifelogics" }] }) });
    host.push();
    const props = (said[0] as { props: GuestProps }).props;
    expect(props.nodes!.map((node) => node.label)).toEqual(["Team coaching", "LifeLogics"]);
    host.dispose();
  });
});

describe("registering a worker view", () => {
  const definition = { manifest: packages, worker: { script: "" } };
  it("makes a titled view a named place for the kind it attaches to, over what was drawn there", () => {
    const views = createViews(offersApp.schema);
    const before = () => null;
    views.register("package", { cardinality: "many", fidelity: "full" }, before);
    registerWorkerView(views, definition);
    expect(views.places()).toEqual([{ kind: "package", title: "The packages", as: "the-packages" }]);
    expect(views.lookup("package", { cardinality: "many", fidelity: "full" })).not.toBe(before);
  });
  it("draws a home view as the home's own view (FR-81) on both faces, over the home the app declared, and on no kind", () => {
    const views = createViews(offersApp.schema);
    const declared = () => null;
    views.home?.(declared);
    registerWorkerView(views, { ...definition, manifest: { ...packages, attach: "home" } });
    const home = views.homeView?.();
    expect(home).toBeDefined();
    expect(home).not.toBe(declared);
    expect(views.places()).toEqual([]);
    expect(views.lookup("package", { cardinality: "many", fidelity: "full" })).toBeUndefined();
  });
});
