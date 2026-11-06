// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, z, type Violation } from "@graview/core";
import { drawnFindings } from "@graview/tools/section";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readDrawn } from "../../../primitives/src/better-bar.js";
import { labelsShown, recordIdsOf } from "../../../primitives/src/page-better.js";
import { PagesApp } from "../../src/index.js";

/*
 * BETTER UI READS THE RECORDS A LIST PAGE DRAWS (Roadmap
 * f-better-ui-draws-first-time). On a wedding's Vendors list, Graview
 * Cloud saw Better UI hand the agent no records at all — a vendor's label
 * is its name, and the page read a field called `label` that a vendor
 * does not have — so a draft that dropped every status passed. A record is
 * named as its kind says it is named.
 */
const vendor = defineNode("vendor", {
  fields: z.object({ name: z.string(), status: z.enum(["researching", "contacted", "booked", "declined"]).default("researching") }),
  plural: "Vendors",
  label: (node: { name: string }) => node.name,
});
const schema = createSchema([vendor]);
/* A rule that flags the booked vendor, so the list draws it "⚠ The Velvet Notes". */
const { defineInvariant } = bindSchema(schema);
const bookedFlagged = defineInvariant("booked-flagged", {
  scope: { kind: "vendor" },
  evaluate({ subject }): Violation[] {
    return subject.status === "booked" ? [{ invariant: "booked-flagged", subjectId: subject.id, label: subject.name, message: `${subject.name} needs a deposit`, nodeIds: [subject.id], repairs: [] }] : [];
  },
});
const store = ({ flagged = false }: { flagged?: boolean } = {}) =>
  new Store({
    schema,
    mutations: [],
    ...(flagged ? { invariants: [bookedFlagged] } : {}),
    snapshot: {
      nodes: [
        { id: "v1", kind: "vendor", name: "The Velvet Notes", status: "booked" },
        { id: "v2", kind: "vendor", name: "Sugar & Spoon", status: "researching" },
        { id: "v3", kind: "vendor", name: "Crumbs Bakery", status: "contacted" },
      ] as never,
      edges: [],
    },
  });

// jsdom lays nothing out; every element is drawn, as a browser would draw these, and each one's words read apart.
const rects = HTMLElement.prototype.getClientRects;
beforeAll(() => {
  HTMLElement.prototype.getClientRects = function () {
    return [{ width: 1, height: 1 }] as unknown as DOMRectList;
  };
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      const walker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
      const said: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.trim()) said.push(node.textContent.trim());
      return said.join("\n");
    },
  });
});
afterAll(() => {
  HTMLElement.prototype.getClientRects = rects;
  delete (HTMLElement.prototype as { innerText?: string }).innerText;
});

describe("Better UI on a built-in list page", () => {
  it("reads the records the page draws, by the names their kind gives them, and fails a draft that drops their statuses", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const kept = store();
    await act(async () => root.render(<PagesApp context={{ store: kept }} initialPath="/vendors" />));
    await act(async () => new Promise<void>((done) => setTimeout(done, 50)));
    const main = host.querySelector("main");
    expect(main).not.toBeNull();
    const part = { name: "Vendors", slot: "list" as const, kind: "vendor", elements: [], main };
    const labels = labelsShown(kept as never, part, (main as HTMLElement).innerText);
    expect(labels).toEqual(["The Velvet Notes", "Sugar & Spoon", "Crumbs Bakery"]);
    const before = readDrawn(main, labels);
    expect(before.records.map((one) => one.label).sort()).toEqual(["Crumbs Bakery", "Sugar & Spoon", "The Velvet Notes"]);
    expect(recordIdsOf(kept as never, part, before)).toEqual({ "The Velvet Notes": "v1", "Sugar & Spoon": "v2", "Crumbs Bakery": "v3" });
    const booked = before.records.find((one) => one.label === "The Velvet Notes");
    expect(booked?.facts?.join(" ").toLowerCase()).toContain("booked");

    // A draft that shows the names alone.
    const draft = document.createElement("main");
    draft.innerHTML = `<h1>Vendors</h1><ul>${labels.map((one) => `<li><a href="#">${one.replace("&", "&amp;")}</a></li>`).join("")}</ul>`;
    document.body.append(draft);
    const findings = drawnFindings(before, readDrawn(draft, labels), { asked: "make it more modern looking" });
    expect(findings.join(" ")).toContain("on “The Velvet Notes”");
    await act(async () => root.unmount());
    host.remove();
    draft.remove();
  });

  it("reads a row a rule flags by its record's name, so every row the page shows is held", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const kept = store({ flagged: true });
    await act(async () => root.render(<PagesApp context={{ store: kept }} initialPath="/vendors" />));
    await act(async () => new Promise<void>((done) => setTimeout(done, 50)));
    const main = host.querySelector("main")!;
    // The row is drawn with the rule's mark before its name.
    expect((main as HTMLElement).innerText).toContain("⚠");
    const part = { name: "Vendors", slot: "list" as const, kind: "vendor", elements: [], main };
    const labels = labelsShown(kept as never, part, (main as HTMLElement).innerText);
    const before = readDrawn(main, labels);
    expect(before.records.map((one) => one.label).sort()).toEqual(["Crumbs Bakery", "Sugar & Spoon", "The Velvet Notes"]);
    expect(before.records.find((one) => one.label === "The Velvet Notes")?.facts?.join(" ").toLowerCase()).toContain("booked");
    expect(recordIdsOf(kept as never, part, before)).toEqual({ "The Velvet Notes": "v1", "Sugar & Spoon": "v2", "Crumbs Bakery": "v3" });

    // A draft that drops the flagged vendor fails by its name; one that keeps it, its mark before it, is read as the page was.
    const draft = document.createElement("main");
    const card = (name: string, status: string, mark = "") => `<li><a href="#">${mark}${name.replace("&", "&amp;")}</a> <span>${status}</span></li>`;
    draft.innerHTML = `<h1>Vendors</h1><ul>${card("Sugar & Spoon", "Researching")}${card("Crumbs Bakery", "Contacted")}</ul>`;
    document.body.append(draft);
    expect(drawnFindings(before, readDrawn(draft, labels), { asked: "make it more modern looking" }).join(" ")).toContain("“The Velvet Notes”");
    draft.innerHTML = `<h1>Vendors</h1><ul>${card("The Velvet Notes", "Booked", "<span>⚠</span> ")}${card("Sugar & Spoon", "Researching")}${card("Crumbs Bakery", "Contacted")}</ul>`;
    expect(drawnFindings(before, readDrawn(draft, labels), { asked: "make it more modern looking" })).toEqual([]);
    await act(async () => root.unmount());
    host.remove();
    draft.remove();
  });
});
