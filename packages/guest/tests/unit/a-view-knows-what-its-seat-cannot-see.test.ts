import { createSchema, defineNode, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createGuestHost } from "../../src/host/frame.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import type { GuestProps } from "../../src/protocol.js";
import { club, member, parent, visitor } from "./club.js";
import { inbox } from "./showroom.js";

/*
 * A VIEW KNOWS WHAT ITS SEAT CANNOT SEE (Roadmap
 * f-view-knows-what-its-seat-cannot-see). A home view that draws the
 * vendors, the players, the memos and the shifts drew well for its owner
 * and was an empty section for a visitor, with nothing to tell it why. It
 * is now handed what its seat is kept from — the kinds, and the fields its
 * sight hides — and nothing of any record: no count, no id, no value.
 */
const home: WorkerViewManifest = { name: "club-home", attach: "home", cardinality: "many", reads: { kinds: ["vendor", "player", "memo", "shift"] } };
const props = (principal: typeof member) => workerViewProps(club(), principal, { manifest: home });

describe("what a view is told its seat is kept from", () => {
  it("tells a visitor which kinds it sees none of, and the fields its sight hides", () => {
    expect(props(visitor).unseen).toEqual({ kinds: ["vendor", "memo", "shift"], fields: { player: ["phone"] } });
  });

  it("tells a parent the fields its sight hides, and nothing of any record", () => {
    const shown = props(parent);
    expect(shown.unseen).toEqual({ kinds: ["vendor"], fields: { player: ["phone"], memo: ["code"] } });
    // The memo a parent is handed none of is not counted, nor named: no count of any kind is said.
    expect(shown.unseen).not.toHaveProperty("withheld");
    expect(shown.nodes!.map((node) => node.id)).toEqual(["player:ada"]);
  });

  it("never carries a hidden value, nor the label of a record kept", () => {
    for (const seat of [parent, visitor]) {
      const wire = JSON.stringify(props(seat));
      for (const word of ["555 0101", "7731", "Gate", "Hart's Bakery", "Saturday bar"]) expect(wire, word).not.toContain(word);
    }
  });

  it("is not handed to a seat nothing of what it reads is kept from", () => {
    expect(props(member).unseen).toBeUndefined();
  });

  it("is handed to a frame guest through its bridge as the kinds its own reads name, and no field", () => {
    const { said, send } = inbox();
    createGuestHost({ store: club(), principal: visitor, view: "frame", nonce: "n", send, reads: { kinds: ["vendor", "player"] } }).push();
    const unseen = (said[0] as { props: GuestProps }).props.unseen;
    expect(unseen).toEqual({ kinds: ["vendor"] });
    // A frame is somebody else's code: no field name of the declaration reaches it.
    expect(JSON.stringify(unseen)).not.toContain("phone");
  });

  it("hands a frame nothing for a kind its reads do not name", () => {
    const { said, send } = inbox();
    createGuestHost({ store: club(), principal: visitor, view: "frame", nonce: "n", send, reads: { kinds: ["player"] } }).push();
    expect((said[0] as { props: GuestProps }).props.unseen).toBeUndefined();
  });
});

/*
 * A RECORD A SIGHT SHOWS AND THE SEAT IS HANDED NONE OF IS NOT THERE TO IT.
 * Every patient sees every appointment, and each appointment must name its
 * patient, whom only that patient sees: the store hands Ann only her own.
 * Nothing in what her view is told moves when Bob's appointments are made.
 */
const patient = defineNode("patient", { fields: z.object({ label: z.string() }), plural: "Patients" });
const appointment = defineNode("appointment", { fields: z.object({ label: z.string(), patient: nodeRef(["patient"]) }), plural: "Appointments" });
const clinicPolicy: Policy = {
  grants: [{ roles: ["patient"], mutations: "*" }],
  sees: [
    { roles: ["patient"], kinds: ["patient"], own: true },
    { roles: ["patient"], kinds: ["appointment"] },
  ],
};
const clinic = (bobs: number) =>
  new Store<AnySchema>({
    schema: createSchema([patient, appointment]) as AnySchema,
    mutations: [],
    policy: clinicPolicy,
    snapshot: {
      nodes: [
        { id: "patient:ann", kind: "patient", label: "Ann" },
        { id: "patient:bob", kind: "patient", label: "Bob" },
        { id: "appointment:a1", kind: "appointment", label: "Ann's checkup", patient: "patient:ann" },
        ...Array.from({ length: bobs }, (_, i) => ({ id: `appointment:b${i}`, kind: "appointment", label: `Bob's visit ${i}`, patient: "patient:bob" })),
      ] as never,
      edges: [],
    },
  });
const ann: Principal = { kind: "human", id: "patient:ann", roles: ["patient"] };
const clinicView: WorkerViewManifest = { name: "visits", attach: "appointment", cardinality: "many", reads: { kinds: ["patient"] } };

describe("a required link to a record only its owner sees", () => {
  it("leaks nothing through what a worker view is told, however many such records there are", () => {
    const told = [0, 1, 3].map((bobs) => workerViewProps(clinic(bobs), ann, { manifest: clinicView }));
    for (const one of told) expect(one.unseen).toEqual(told[0]!.unseen);
    for (const one of told) expect(one.nodes!.map((node) => node.id).sort()).toEqual(["appointment:a1", "patient:ann"]);
    const wire = JSON.stringify(told);
    for (const word of ["Bob", "patient:bob", "appointment:b"]) expect(wire, word).not.toContain(word);
  });

  it("leaks nothing through what a frame is told", () => {
    const told = [0, 1, 3].map((bobs) => {
      const { said, send } = inbox();
      createGuestHost({ store: clinic(bobs), principal: ann, view: "frame", nonce: "n", send, reads: { kinds: ["appointment", "patient"] } }).push();
      return (said[0] as { props: GuestProps }).props;
    });
    for (const one of told) expect(one.unseen).toEqual(told[0]!.unseen);
    const wire = JSON.stringify(told);
    for (const word of ["Bob", "patient:bob", "appointment:b"]) expect(wire, word).not.toContain(word);
  });
});
