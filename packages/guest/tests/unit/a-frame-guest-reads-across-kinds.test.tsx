// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { createViews } from "@graview/react/provider";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { erin, lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { guestView, mountGuestView } from "../../src/host/index.js";
import { createGuestHost } from "../../src/host/session.js";
import { GUEST_PROTOCOL, type GuestProps, type HostHello, type HostMessage } from "../../src/protocol.js";

/**
 * A FRAME GUEST MAY READ ACROSS KINDS, AND MAY BE THE HOME (FR-85).
 * Owner-uploaded frames are the "bring your own" form; the worker form is
 * FR-91, and both now read across kinds by one rule (session.ts's
 * `readAcross`). A frame over LifeLogics' packages that reads `offer` and
 * `includes` is handed each package's offers, as the viewer sees them:
 * Lin, of the client, is never handed "Internal margin review", made to the
 * delivery partner, as a node, an edge, a label or a figure. A frame drawn
 * as the home is drawn over nothing and sees what it reads.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: offersSeed as never });
const packages = ["package:full", "package:later", "package:start"];
const reads = { kinds: ["offer"], edges: ["includes"] };

function pushed(options: Partial<Parameters<typeof createGuestHost>[0]> = {}): GuestProps {
  const said: HostMessage[] = [];
  const host = createGuestHost({ store: store() as unknown as Store<AnySchema>, principal: lin, view: "packages", nonce: "n", send: (message) => said.push(message), input: () => ({ nodes: packages.map((id) => ({ id })) }), ...options });
  host.push();
  host.dispose();
  return (said[0] as { props: GuestProps }).props;
}

describe("a frame guest over packages that reads offer and includes", () => {
  it("is handed each package's offers that Lin may see, and the includes edges to them", () => {
    const props = pushed({ reads });
    expect(props.nodes!.map((node) => node.id).sort()).toEqual(["offer:build", "offer:coaching", "offer:strategy", ...packages]);
    expect(props.edges).toContainEqual({ kind: "includes", from: "package:start", to: "offer:coaching" });
    const start = props.edges.filter((edge) => edge.from === "package:start").map((edge) => edge.to).sort();
    expect(start).toEqual(["offer:coaching", "offer:strategy"]);
  });

  it("holds no trace of the offer Lin may not see: not a node, an edge, a label or a figure", () => {
    const wire = JSON.stringify(pushed({ reads }));
    for (const word of ["offer:margin", "Internal margin review", "18500"]) expect(wire).not.toContain(word);
  });

  it("is handed the margin review for Erin, who may see it", () => {
    const props = pushed({ reads, principal: erin });
    expect(props.nodes!.map((node) => node.id)).toContain("offer:margin");
    expect(props.edges).toContainEqual({ kind: "includes", from: "package:start", to: "offer:margin" });
  });

  it("is handed only its own kind, as before, when it reads nothing", () => {
    const props = pushed();
    expect(props.nodes!.map((node) => node.id).sort()).toEqual(packages);
    expect(props.edges).toEqual([]);
  });

  it("is handed each record's label as the host labels it", () => {
    expect(pushed({ reads }).nodes!.find((node) => node.id === "offer:coaching")!.label).toBe("Team coaching");
  });

  it("drawn over nothing, as the home is, sees what it reads", () => {
    const props = pushed({ input: () => ({}), reads: { kinds: ["package", "offer"], edges: ["includes"] } });
    expect(props.node).toBeUndefined();
    expect(props.nodes!.map((node) => node.id).sort()).toEqual(["offer:build", "offer:coaching", "offer:strategy", ...packages]);
  });
});

describe("mountGuestView", () => {
  it("pushes what the frame reads across kinds", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const frame = mountGuestView(element, { url: "https://cards.example/packages.html", view: "packages", store: store(), principal: lin, input: () => ({ nodes: packages.map((id) => ({ id })) }), reads });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
    const [, , [port]] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
    const heard: HostMessage[] = [];
    port!.onmessage = (event) => heard.push(event.data as HostMessage);
    await vi.waitFor(() => expect(heard.some((one) => one.type === "props")).toBe(true));
    const props = (heard.find((one) => one.type === "props") as { props: GuestProps }).props;
    expect(props.nodes!.map((node) => node.id)).toContain("offer:coaching");
    expect(JSON.stringify(props)).not.toContain("offer:margin");
    port!.close();
    frame.dispose();
    element.remove();
  });
});

describe("a frame guest attached to the home", () => {
  it("is the routed home's body, its frame named by its title", async () => {
    const views = createViews(offersApp.schema);
    views.home?.(guestView({ url: "https://cards.example/front.html", name: "front", title: "The front page", reads: { kinds: ["package"] } }) as never);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store() as unknown as Store<AnySchema>, views: views as never, principal: lin }} initialPath="/" />));
    const frame = host.querySelector<HTMLIFrameElement>('[data-testid="home-view"] iframe[data-guest-view="front"]');
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute("title")).toBe("The front page");
    expect(frame!.getAttribute("sandbox")).toBe("allow-scripts");
    expect(host.querySelector('[data-testid="standing"]')).toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
