import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, sayFindings, type Finding } from "../../src/document/index.js";

/**
 * A CONNECTION REFUSED, SAID TO THE PERSON FILLING THE FORM (Roadmap
 * f-connection-refusal-in-plain-words, FR-229): a calendar connected to a
 * kind whose make-act needs a field the event cannot give is told so in
 * words — "Blocks need a Type, and Google events don't have one." — with
 * the fixes a host offers as buttons, each as document edits where one can
 * be written, and the technical sentence kept as `details` for an agent.
 */

const rota = (more: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Rota",
  kinds: {
    block: {
      fields: {
        name: { type: "string", required: true },
        type: { type: "enum", options: ["drive", "rest"], required: true },
        starts: { type: "datetime" },
        ends: { type: "datetime" },
      },
    },
    event: {
      fields: { title: { type: "string", required: true }, starts: { type: "datetime" }, ends: { type: "datetime" }, where: { type: "string" } },
    },
  },
  acts: { "add-block": { creates: "block" }, "add-event": { creates: "event" } },
  connections: { cal: { system: "google-calendar", calendar: "primary", kind: "block", fields: { summary: "name", start: "starts", end: "ends" }, direction: "both" } },
  ...more,
});

const refusal = (raw: unknown): Finding => {
  const found = compileDocument(raw).findings.find((finding) => finding.code === "connection-creates");
  if (!found) throw new Error("the connection was not refused");
  return found;
};

describe("a connection to a kind the event cannot make is refused in plain words", () => {
  it("says what the kind needs and that events do not have it, and keeps the technical sentence as details", () => {
    const finding = refusal(rota());
    expect(finding.path).toBe("connections.cal.kind");
    expect(finding.message).toBe("Blocks need a Type, and Google events don't have one.");
    expect(finding.fix).toBe("Map a calendar field to Type, give Type a default, or sync to a kind made for events.");
    expect(finding.details).toContain("add-block asks for type, which the connection does not map");
    expect(sayFindings([finding])).toContain("details: ");
  });

  it("offers each fix with the edits that do it, and every written one makes the connection pass", () => {
    const raw = rota();
    const finding = refusal(raw);
    const labels = (finding.fixes ?? []).map((fix) => fix.label);
    expect(labels).toEqual(["Give Type a default", "Let Type be left blank", "Map a calendar field to Type", "Sync to event instead", "Add a kind made for events"]);
    const written = (finding.fixes ?? []).filter((fix) => fix.edits && fix.edits.length > 0);
    expect(written.map((fix) => fix.label)).toEqual(["Give Type a default", "Let Type be left blank", "Sync to event instead", "Add a kind made for events"]);
    // An enum's default is its first option; the calendar's words cannot fill a choice, so that fix is offered with nothing to apply.
    expect(written[0]!.edits).toEqual([{ op: "set-default", kind: "block", field: "type", default: "drive" }]);
    for (const fix of written) {
      const edited = editDocument(raw as never, fix.edits as never);
      expect(edited.ok, `${fix.label}: ${edited.ok ? "" : JSON.stringify(edited.findings)}`).toBe(true);
      const again = compileDocument(edited.ok ? edited.document : raw);
      expect(again.findings.filter((f) => f.code === "connection-creates"), fix.label).toEqual([]);
    }
  });

  it("maps the event's description to a words field the kind needs, as an edit", () => {
    const raw = rota({
      kinds: { block: { fields: { name: { type: "string", required: true }, notes: { type: "text", required: true }, starts: { type: "datetime" }, ends: { type: "datetime" } } } },
      acts: { "add-block": { creates: "block" } },
    });
    const finding = refusal(raw);
    expect(finding.message).toBe("Blocks need Notes, and Google events don't have one.");
    const map = (finding.fixes ?? []).find((fix) => fix.label === "Map a calendar field to Notes")!;
    expect(map.edits).toEqual([{ op: "set-connection", name: "cal", connection: { ...(raw.connections.cal as object), fields: { summary: "name", start: "starts", end: "ends", description: "notes" } } }]);
  });

  it("says several fields together, and a kind only ever made on another record", () => {
    const two = refusal(rota({ kinds: { ...rota().kinds, block: { fields: { ...rota().kinds.block.fields, driver: { type: "string", required: true } } } } }));
    expect(two.message).toBe("Blocks need a Type and a Driver, and Google events don't have them.");
    const logged = refusal(rota({ acts: { "log-block": { on: "event", creates: "block" } } }));
    expect(logged.message).toBe("A block is only ever made on an event (log-block), and a Google event is made on nothing.");
    expect(logged.fix).toBe("Add an act that makes a block on its own, or sync to a kind made for events.");
  });
});
