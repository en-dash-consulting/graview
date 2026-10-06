import { describe, expect, it } from "vitest";
import { z } from "zod";
import { diffDocuments, editDocument, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";
import { createSchema, defineApp, defineNode } from "../../src/index.js";

/**
 * A DOCUMENT SAYS WHAT A GLANCE SAYS (FR-39). The compiler told a document's
 * author to "say which: display: { glance: [...] }" for a kind with many
 * fields, and the document format had no word for it — the note could not
 * be answered by the only author who would ever read it. A kind says
 * `glance` now, checked like any other field it names, renamed with the
 * field and dropped with it, and carried both ways.
 */
const car = (glance?: readonly string[]): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Lot",
    kinds: {
      car: {
        plural: "cars",
        fields: {
          name: { type: "string", required: true },
          vin: { type: "string" },
          year: { type: "integer" },
          make: { type: "string" },
          body: { type: "string" },
          colour: { type: "string" },
          price: { type: "number", format: "money", label: "Asking price" },
          mileage: { type: "integer" },
        },
        ...(glance ? { glance } : {}),
      },
    },
  }) as GraviewDocument;

const displayOf = (app: { schema: unknown }, kind: string) => (app.schema as { tryDefinition(kind: string): { display?: { glance?: readonly string[]; labels?: Record<string, string> } } }).tryDefinition(kind).display;

describe("a document's glance", () => {
  it("compiles to the kind's display.glance, beside its labels", () => {
    const compiled = compileDocument(car(["price", "mileage", "body"]));
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    expect(displayOf(compiled.app, "car")).toEqual({ labels: { price: "Asking price" }, glance: ["price", "mileage", "body"] });
    expect(compiled.findings.map((finding) => finding.code)).not.toContain("check:glance-unchosen");
  });

  it("is what the note asks for when a document has not said one — in the document's words", () => {
    const compiled = compileDocument(car());
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const note = compiled.findings.find((finding) => finding.code === "check:glance-unchosen");
    expect(note?.path).toBe("kinds.car.glance");
    expect(note?.fix).toContain('"glance": ["name", "vin", "year"]');
    expect(note?.fix).not.toContain("display");
  });

  it("names only fields the kind declares", () => {
    const compiled = compileDocument(car(["prise", "mileage"]));
    expect(compiled.ok).toBe(false);
    expect(compiled.findings.map((finding) => `${finding.code} ${finding.path}`)).toContain("glance-field kinds.car.glance");
  });

  it("follows a renamed field and lets go of a removed one", () => {
    const renamed = editDocument(car(["price", "mileage", "body"]), [{ op: "rename-field", kind: "car", field: "mileage", to: "odometer" }]);
    if (!renamed.ok) throw new Error(JSON.stringify(renamed.findings));
    expect(renamed.document.kinds["car"]!.glance).toEqual(["price", "odometer", "body"]);
    expect(compileDocument(renamed.document).ok).toBe(true);

    const removed = editDocument(car(["price", "mileage"]), [{ op: "remove-field", kind: "car", field: "mileage" }]);
    if (!removed.ok) throw new Error(JSON.stringify(removed.findings));
    expect(removed.document.kinds["car"]!.glance).toEqual(["price"]);

    const emptied = editDocument(car(["mileage"]), [{ op: "remove-field", kind: "car", field: "mileage" }]);
    if (!emptied.ok) throw new Error(JSON.stringify(emptied.findings));
    expect(emptied.document.kinds["car"]!.glance).toBeUndefined();
  });

  it("is a change a diff says, and not one a rename or a removal says twice", () => {
    expect(diffDocuments(car(["price"]), car(["mileage", "price"])).sentences).toEqual(["What a glance at a car says changes."]);
    expect(diffDocuments(car(), car(["price"])).unchanged).toBe(false);
    const renamed = editDocument(car(["price", "mileage"]), [{ op: "rename-field", kind: "car", field: "mileage", to: "odometer" }]);
    if (!renamed.ok) throw new Error(JSON.stringify(renamed.findings));
    expect(diffDocuments(car(["price", "mileage"]), renamed.document).sentences.join(" ")).not.toContain("glance");
    const removed = editDocument(car(["price", "mileage"]), [{ op: "remove-field", kind: "car", field: "mileage" }]);
    if (!removed.ok) throw new Error(JSON.stringify(removed.findings));
    expect(diffDocuments(car(["price", "mileage"]), removed.document).sentences.join(" ")).not.toContain("glance");
  });

  it("comes back from a declaration that chose one", () => {
    const fields = z.object({ name: z.string(), vin: z.string(), year: z.number(), make: z.string(), body: z.string(), colour: z.string(), price: z.number(), mileage: z.number() });
    const app = defineApp({ name: "Lot", schema: createSchema([defineNode("car", { fields, plural: "cars", display: { glance: ["price", "mileage", "body"] } })]) });
    const { document } = toDocument(app);
    expect(document.kinds["car"]!.glance).toEqual(["price", "mileage", "body"]);
    const compiled = compileDocument(document);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    expect(displayOf(compiled.app, "car")?.glance).toEqual(["price", "mileage", "body"]);
    expect(compiled.findings.map((finding) => finding.code)).not.toContain("check:glance-unchosen");
  });
});
