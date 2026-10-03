import { describe, expect, it } from "vitest";
import { createGuestHost } from "../../src/host/index.js";
import type { GuestProps } from "../../src/protocol.js";
import { bethan, inbox, settle, showroom, staff, UNSEEN } from "./showroom.js";

/**
 * A GUEST CAN RENDER, BUT NEVER RECEIVES THE STORE, A TOKEN OR AN UNSEEN
 * NODE (FR-04). A guest view is somebody else's code; what it is handed is
 * the plain-data half of `ViewProps`, read from the store as the viewer
 * sees it — so whatever the host's own view was given, a record the viewer
 * may not see is not a node, a member, an edge or an id in it.
 */
const everything = {
  node: { id: "shopper:freya" },
  nodes: [{ id: "car:golf" }, { id: "shopper:bethan" }, { id: "shopper:freya" }, { id: "enquiry:1" }],
  implicated: ["car:golf", "enquiry:1", "shopper:freya"],
  flagged: ["shopper:freya"],
  fidelity: "full" as const,
  cardinality: "many" as const,
};

describe("what a guest is pushed", () => {
  it("is the view's props as the viewer sees them, with nothing they may not see in any field", () => {
    const store = showroom();
    const { said, send } = inbox();
    createGuestHost({ store, principal: bethan, view: "card", nonce: "n", send, input: () => everything }).push();
    const props = (said[0] as { props: GuestProps }).props;
    expect(props.node).toBeUndefined();
    expect(props.nodes!.map((node) => node.id)).toEqual(["car:golf", "shopper:bethan"]);
    expect(props.implicated).toEqual(["car:golf"]);
    expect(props.flagged).toEqual([]);
    expect(props.edges).toEqual([]);
    const wire = JSON.stringify(said);
    for (const word of UNSEEN) expect(wire, word).not.toContain(word);
  });

  it("never carries the viewer's token, their roles or anything that is a store", () => {
    const store = showroom();
    const { said, send } = inbox();
    createGuestHost({ store, principal: bethan, view: "card", nonce: "n", send, input: () => everything }).push();
    const wire = JSON.stringify(said);
    expect(wire).not.toContain("sk-session-7f3a");
    expect(wire).not.toContain('"roles"');
    // What arrives is plain data: structured clone would have refused a store, a function or a proxy.
    expect(Object.keys((said[0] as { props: GuestProps }).props).sort()).toEqual(["acts", "cardinality", "edges", "fidelity", "flagged", "implicated", "nodes", "view"]);
  });

  it("lists only the acts the viewer may run, as what the guest may ask for", () => {
    const store = showroom();
    const asStranger = inbox();
    createGuestHost({ store, principal: { kind: "human", id: "browsing", roles: [] }, view: "card", nonce: "n", send: asStranger.send }).push();
    expect((asStranger.said[0] as { props: GuestProps }).props.acts).toEqual([]);
    const asStaff = inbox();
    createGuestHost({ store, principal: staff, view: "card", nonce: "n", send: asStaff.send }).push();
    expect((asStaff.said[0] as { props: GuestProps }).props.acts.map((act) => act.name)).toEqual(store.permittedMutations(staff).map((act) => act.name));
    expect((asStaff.said[0] as { props: GuestProps }).props.acts.map((act) => act.name)).toEqual(expect.arrayContaining(["ask", "retire-car"]));
  });

  it("is pushed again when the store moves, still as the viewer sees it", async () => {
    const store = showroom();
    const { said, send } = inbox();
    createGuestHost({ store, principal: bethan, view: "card", nonce: "n", send, input: () => ({ nodes: store.graph.allNodes().map(({ id }) => ({ id })) }) });
    store.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Part exchange?" } }, { author: staff });
    await settle();
    expect(said).toHaveLength(1);
    const wire = JSON.stringify(said);
    expect(wire).not.toContain("Part exchange?");
    for (const word of UNSEEN) expect(wire, word).not.toContain(word);
  });
});
