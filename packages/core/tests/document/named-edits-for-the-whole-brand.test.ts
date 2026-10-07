import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { describePlace } from "../../src/describe.js";
import { diffDocuments, documentHash, editDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * FR-125: NAMED EDITS FOR ALL OF IT. A chat renamed an app with a raw
 * JSON Patch on `/name` it had to discover, and could not reach the
 * description or anything of the brand beyond its accent. `set-brand`
 * takes every key of the brand (null clears one), `set-name` and
 * `set-description` are edits of their own, and each previews (it
 * compiles, and the diff says it in words), applies, and rolls back to
 * the very document it started from. The description is the line under
 * the app's name, and `describePlace("home")` says the masthead.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const enDash = read("en-dash.gdd.json") as GraviewDocument;
const vendors = read("vendors.gdd.json") as GraviewDocument;
const LOGO = (enDash.brand!.logo as { src: string }).src;
const ASSET = "/graview/assets/0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c.svg";

function edit(document: GraviewDocument, edits: unknown[]) {
  const outcome = editDocument(document, edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome;
}
function compiles(document: GraviewDocument) {
  const compiled = compileDocument(document, { today: () => "2026-10-07" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  return compiled;
}

const ROUND_TRIPS: readonly { name: string; on: GraviewDocument; edit: Record<string, unknown>; inverse: Record<string, unknown>; said: RegExp; says: RegExp }[] = [
  { name: "set-name", on: vendors, edit: { op: "set-name", name: "Our wedding" }, inverse: { op: "set-name", name: "Wedding vendors" }, said: /^The app is now called "Our wedding"\.$/, says: /^The app is now called "Our wedding", where it was "Wedding vendors"\.$/ },
  { name: "set-description", on: vendors, edit: { op: "set-description", description: "Who we hire, and for how much." }, inverse: { op: "set-description", description: vendors.description }, said: /^The line under the app's name reads "Who we hire, and for how much\."\.$/, says: /^The line under the app's name reads "Who we hire, and for how much\."\.$/ },
  { name: "set-description to none", on: vendors, edit: { op: "set-description", description: null }, inverse: { op: "set-description", description: vendors.description }, said: /^The app has no line under its name\.$/, says: /^The app has no line under its name\.$/ },
  { name: "set-brand: a logo, inline", on: vendors, edit: { op: "set-brand", logo: LOGO }, inverse: { op: "set-brand", logo: null }, said: /^The app gets a logo\.$/, says: /^The app gets a logo\.$/ },
  { name: "set-brand: a logo from the app's assets, with its alt text", on: enDash, edit: { op: "set-brand", logo: { src: ASSET, alt: "The En Dash mark" } }, inverse: { op: "set-brand", logo: enDash.brand!.logo }, said: /^The logo changes\.$/, says: /^The logo changes\.$/ },
  { name: "set-brand: a page icon", on: vendors, edit: { op: "set-brand", favicon: ASSET }, inverse: { op: "set-brand", favicon: null }, said: /^The app gets a page icon\.$/, says: /^The app gets a page icon\.$/ },
  { name: "set-brand: serif headings", on: vendors, edit: { op: "set-brand", typography: { display: "system-serif" } }, inverse: { op: "set-brand", typography: null }, said: /^Headings are now set in system-serif\.$/, says: /^Headings are now set in system-serif\.$/ },
  { name: "set-brand: one face of three cleared", on: enDash, edit: { op: "set-brand", typography: { mono: null } }, inverse: { op: "set-brand", typography: { mono: "system-mono" } }, said: /^Code goes back to Graview's face\.$/, says: /^Code goes back to Graview's face\.$/ },
  { name: "set-brand: shape", on: vendors, edit: { op: "set-brand", shape: { radius: 2, density: 0.8 } }, inverse: { op: "set-brand", shape: null }, said: /^Corners are now 2px\. Spacing is now 0\.8 times Graview's own\.$/, says: /^Corners are now 2px\. Spacing is now 0\.8 times Graview's own\.$/ },
  { name: "set-brand: a hue per kind", on: vendors, edit: { op: "set-brand", accents: { vendor: 140 } }, inverse: { op: "set-brand", accents: null }, said: /^Vendor is drawn at hue 140°\.$/, says: /^Vendor is drawn at hue 140°\.$/ },
  { name: "set-brand: prefers dark", on: vendors, edit: { op: "set-brand", scheme: "dark" }, inverse: { op: "set-brand", scheme: null }, said: /^The app opens dark when the reader has not chosen\.$/, says: /^The app opens dark when the reader has not chosen\.$/ },
  { name: "set-brand: the wordmark's own name", on: vendors, edit: { op: "set-brand", name: "Vendors" }, inverse: { op: "set-brand", name: null }, said: /^The app's wordmark says Vendors\.$/, says: /^The wordmark says Vendors\.$/ },
  {
    name: "set-brand: Nick's ask, all at once",
    on: vendors,
    edit: { op: "set-brand", name: "En Dash", accent: "#0f6e5c", logo: { src: ASSET, alt: "En Dash" }, typography: { display: "system-serif" } },
    inverse: { op: "set-brand", name: null, accent: vendors.brand!.accent, logo: null, typography: null },
    said: /^The app's accent color becomes #0f6e5c\. The app's wordmark says En Dash\. The app gets a logo\. Headings are now set in system-serif\.$/,
    says: /^The app's colors change\. The wordmark says En Dash\. The app gets a logo\. Headings are now set in system-serif\.$/,
  },
];

describe("every key of the brand, the name and the description: previewed, applied, rolled back", () => {
  for (const trip of ROUND_TRIPS) {
    it(trip.name, async () => {
      const applied = edit(trip.on, [trip.edit]);
      // Preview: it compiles, and the diff says it in words.
      compiles(applied.document);
      expect(applied.said.join(" ")).toMatch(trip.said);
      expect(diffDocuments(trip.on, applied.document).sentences.join(" ")).toMatch(trip.says);
      expect(diffDocuments(trip.on, applied.document).breaking).toBe(false);
      // Rolled back: the very document it started from, by its hash.
      const back = edit(applied.document, [trip.inverse]);
      expect(await documentHash(back.document)).toBe(await documentHash(trip.on));
    });
  }

  it("refuses a logo that could act, at the edit's own path, and changes nothing", () => {
    const outcome = editDocument(vendors, [{ op: "set-brand", logo: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map((f) => `${f.code} at ${f.path}: ${f.message}`)).toEqual(["brand-mark at edits.0.logo: the logo cannot be drawn as given, because it has a script in it"]);
  });

  it("refuses a face from an origin, and a hue for a kind the app does not have", () => {
    const font = editDocument(vendors, [{ op: "set-brand", typography: { display: "https://fonts.example.net/serif.css" } }]);
    expect(font.ok ? [] : font.findings.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-font at edits.0.typography.display"]);
    const hue = editDocument(vendors, [{ op: "set-brand", accents: { venue: 20 } }]);
    expect(hue.ok ? [] : hue.findings.map((f) => f.path)).toEqual(["edits.0.accents"]);
  });
});

describe("describePlace says the home's masthead: the name, the line under it, and the logo by its alt text", () => {
  const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
  const say = (document: GraviewDocument) => {
    const { app } = compiles(document);
    const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy! });
    const result = describePlace(store, owner, "home", { app: app as GraviewApp<AnySchema>, today: "2026-10-07" });
    if (!result.ok) throw new Error(result.error);
    return result.description;
  };

  it("says an inline logo with its alt text, and the description under the name", () => {
    const home = say(enDash);
    expect(home.masthead).toEqual({ name: "En Dash", subtitle: enDash.description, logo: { alt: "En Dash Consulting", drawn: "inline SVG" } });
    expect(home.text.split("\n")[1]).toBe(`Masthead: the logo ("En Dash Consulting", inline SVG), En Dash — ${enDash.description}`);
    expect(home.drawnBy).toBe("blocks");
  });

  it("says a logo from a path by its path, its alt the app's name when none is given", () => {
    const renamed = edit(vendors, [{ op: "set-name", name: "En Dash" }, { op: "set-brand", logo: ASSET }, { op: "set-description", description: "Who we hire." }]).document;
    expect(say(renamed).masthead).toEqual({ name: "En Dash", subtitle: "Who we hire.", logo: { alt: "En Dash", drawn: "image", src: ASSET } });
  });

  it("says no logo where there is none", () => {
    expect(say(vendors).masthead).toEqual({ name: "Wedding vendors", subtitle: vendors.description });
  });
});
