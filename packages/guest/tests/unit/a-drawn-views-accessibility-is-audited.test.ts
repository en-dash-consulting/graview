import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, type AnySchema } from "@graview/core";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { sam, threatApp, threatSeed, WATCH_JS, WATCH_MANIFEST } from "../../../../scripts/fixtures/threat-app.js";
import { AUDIT_RULES, auditView, type AuditedNode, type AuditViewOptions, type ViewAudit } from "../../src/audit/index.js";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/*
 * A DRAWN VIEW'S ACCESSIBILITY IS AUDITED (Roadmap f-view-a11y-audit).
 * Graview Cloud, `graview view check --audit` and Studio gate a view on
 * `auditView` (`@graview/guest/audit`): what a person on a keyboard or with
 * a screen reader would meet in what it drew, each problem a repair — the
 * rule, its WCAG 2.2 criterion, how bad, where, the line that fixes it, and
 * whether the framework fixes it rather than the view. Judged as the host
 * draws it: a link, a press and a control the view drew itself are given
 * the keyboard on a page, so none is a problem; a `<div>` the view only
 * hears a click on is. With no layout (here, and in a headless run), the
 * rules that need a browser say so and do not run.
 */
const page = (markup: string) => {
  const { window } = new JSDOM(`<!doctype html><div data-graview-view-root>${markup}</div>`);
  return window.document.querySelector("[data-graview-view-root]") as unknown as AuditedNode;
};
const audit = (markup: string, options: AuditViewOptions = {}): ViewAudit => auditView(page(markup), { host: "pending", ...options });
const rules = (found: ViewAudit) => found.problems.map((one) => one.rule);

describe("an audit of a drawn view", () => {
  it("flags a div with only a click handler, as the keyboard's and the view's to fix", () => {
    const found = audit(`<div class="open">Open the report</div>`, { clicked: [".open"] });
    expect(found.problems).toHaveLength(1);
    expect(found.problems[0]).toMatchObject({ rule: "keyboard", wcag: "2.1.1", impact: "serious", at: "div.open", automatic: false });
    expect(found.problems[0]!.fix).toMatch(/<button type="button">/);
  });

  it("passes a div the view hears that says role=\"button\": the host gives it the keyboard", () => {
    expect(audit(`<div class="open" role="button">Open the report</div>`, { clicked: [".open"] }).problems).toEqual([]);
  });

  it("passes a click the view hears on a wrapper whose button is reached", () => {
    expect(audit(`<div class="row"><button type="button">Open</button></div>`, { clicked: [".row"] }).problems).toEqual([]);
  });

  it("passes an <a data-record>, a card bound to a record and an element bound to an act", () => {
    expect(audit(`<a data-record="threat:vpn">Old VPN appliance</a><div class="card" data-record="threat:vpn"><h3>Old VPN</h3></div><span role="button" data-act="acknowledge">Acknowledge</span>`).problems).toEqual([]);
  });

  it("flags a link or a press the host makes that Tab does not reach, as the framework's", () => {
    const found = auditView(page(`<div data-graview-link data-record="threat:vpn">Old VPN</div>`), { host: "drawn" });
    expect(found.problems[0]).toMatchObject({ rule: "keyboard", automatic: true });
  });

  it("flags a button with no name, and passes one named by aria-label or words for a screen reader", () => {
    const bare = audit(`<button type="button" data-key="x"><svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg></button>`);
    expect(bare.problems).toEqual([expect.objectContaining({ rule: "name", wcag: "4.1.2", impact: "critical", at: '[data-key="x"]', key: "x", automatic: false })]);
    expect(audit(`<button type="button" aria-label="Close"><svg viewBox="0 0 10 10"></svg></button>`).problems).toEqual([]);
    expect(audit(`<button type="button"><span class="graview-sr">Close</span></button>`).problems).toEqual([]);
    expect(rules(audit(`<a data-record="threat:vpn"><img src="data:image/png;base64,AA==" alt=""></a>`))).toEqual(["name"]);
  });

  it("flags a field with no label, and passes one with a label or a placeholder", () => {
    expect(rules(audit(`<input name="note">`))).toEqual(["name"]);
    expect(audit(`<label for="n">Note</label><input id="n" name="note"><label>Due <input name="due"></label><input name="q" placeholder="A note">`).problems).toEqual([]);
  });

  it("flags a toggle without state, and a press that reads like a disclosure and says none", () => {
    const toggle = audit(`<span role="switch" aria-label="Only live threats"></span>`);
    expect(toggle.problems).toEqual([expect.objectContaining({ rule: "toggle-state", impact: "serious" })]);
    expect(rules(audit(`<span role="tab">Developers</span>`))).toEqual(["toggle-state"]);
    expect(rules(audit(`<span role="button" aria-pressed="yes">Bold</span>`))).toEqual(["toggle-state"]);
    expect(rules(audit(`<button type="button" class="more">More</button>`, { clicked: [".more"] }))).toEqual(["toggle-state"]);
    expect(audit(`<button type="button" class="more" aria-expanded="false">More</button><span role="switch" aria-checked="true" aria-label="Live"></span>`, { clicked: [".more"] }).problems).toEqual([]);
  });

  it("flags a control inside another, and a card that holds a button, with the card's own fix", () => {
    const button = audit(`<button type="button">Open <a href="https://example.com/">the site</a></button>`);
    expect(rules(button)).toContain("nested-interactive");
    const card = audit(`<div class="card" data-key="threat:vpn" data-record="threat:vpn"><h3>Old VPN</h3><button type="button">More</button></div>`);
    expect(card.problems).toEqual([expect.objectContaining({ rule: "nested-interactive", at: '[data-key="threat:vpn"]', automatic: false })]);
    expect(card.problems[0]!.fix).toMatch(/<a data-record> on its heading/);
    // A list's item keeps its own meaning: it is no link around the button.
    expect(audit(`<ul><li data-record="threat:vpn">Old VPN <button type="button">More</button></li></ul>`).problems).toEqual([]);
  });

  it("flags an image with no alt, and passes one said to be decoration", () => {
    expect(audit(`<img src="data:image/png;base64,AA==">`).problems).toEqual([expect.objectContaining({ rule: "img-alt", wcag: "1.1.1", impact: "critical" })]);
    expect(audit(`<img src="data:image/png;base64,AA==" alt="">`).problems).toEqual([]);
  });

  it("flags an SVG that is role=img with no name, and hides one that says nothing", () => {
    expect(audit(`<svg role="img" viewBox="0 0 10 10"><circle r="4"/></svg>`).problems).toEqual([expect.objectContaining({ rule: "svg-name", impact: "serious" })]);
    expect(audit(`<svg aria-label="Severity" viewBox="0 0 10 10"><circle r="4"/></svg>`).problems).toEqual([expect.objectContaining({ rule: "svg-name", impact: "minor" })]);
    expect(audit(`<p><svg viewBox="0 0 10 10"><circle r="4"/></svg> Critical</p><svg role="img" aria-label="Severity"><circle r="4"/></svg>`).problems).toEqual([]);
  });

  it("flags a box that says it scrolls and takes no keyboard, and passes a labeled one", () => {
    expect(rules(audit(`<div style="overflow-y: auto; max-height: 80px"><p>Long</p></div>`))).toEqual(["scroll-region"]);
    expect(audit(`<div style="overflow: auto" tabindex="0" role="group" aria-label="Every threat"><p>Long</p></div>`).problems).toEqual([]);
  });

  it("says which rules ran and which need a browser or keys, and claims none it did not run", () => {
    const found = audit(`<p>Nothing to press</p>`);
    expect(found.ran).toEqual(["keyboard", "role", "name", "toggle-state", "nested-interactive", "img-alt", "svg-name", "scroll-region"]);
    expect(found.skipped.map((one) => one.rule)).toEqual(["focus-visible", "contrast", "keyboard-trap"]);
    expect(found.skipped[0]!.why).toMatch(/browser/);
    for (const rule of [...found.ran, ...found.skipped.map((one) => one.rule)]) expect(AUDIT_RULES[rule].wcag).toMatch(/^\d\.\d\.\d+$/);
  });

  it("says every problem in the framework's own chrome is the framework's to fix", () => {
    expect(auditView(page(`<div style="overflow: auto"><p>Long</p></div>`), { chrome: true }).problems).toEqual([expect.objectContaining({ rule: "scroll-region", automatic: true })]);
  });
});

describe("a headless run asked to audit", () => {
  const store = () => new Store({ schema: threatApp.schema, mutations: threatApp.mutations ?? [], policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never }) as unknown as Store<AnySchema>;
  const run = nodeIsolate();

  it("audits Threat Watch as the host draws it, with the clicks the view hears", async () => {
    const result = (await runWorkerViewHeadless({ manifest: WATCH_MANIFEST as unknown as WorkerViewManifest, source: WATCH_JS, store: store(), principal: sam, run, audit: true })) as HeadlessDescribed;
    expect(result.ok).toBe(true);
    const found = result.audit!;
    expect(found.skipped.map((one) => one.rule)).toEqual(["focus-visible", "contrast", "keyboard-trap"]);
    // Each card is a link the host made around a button and a press: a link a screen reader never reaches inside.
    expect(found.problems.filter((one) => one.rule === "nested-interactive").map((one) => one.at)).toEqual(['[data-key="threat:phishing"]', '[data-key="threat:vpn"]']);
    // "More" opens a summary and says no state; the "Only critical" toggle says aria-pressed, and is reached.
    expect(found.problems.filter((one) => one.rule === "toggle-state").map((one) => one.at)).toEqual(['[data-key="threat:phishing"] > button.more', '[data-key="threat:vpn"] > button.more']);
    expect(found.problems.filter((one) => one.rule === "keyboard" || one.rule === "role" || one.rule === "name")).toEqual([]);
    expect(found.problems.every((one) => !one.automatic)).toBe(true);
  });

  it("flags a div the view only hears a click on", async () => {
    const source = `graview.render(graview.html\`<div class="go">Go</div>\`); graview.on("click", ".go", () => {});`;
    const result = (await runWorkerViewHeadless({ manifest: WATCH_MANIFEST as unknown as WorkerViewManifest, source, store: store(), principal: sam, run, audit: true })) as HeadlessDescribed;
    expect(result.audit?.problems).toEqual([expect.objectContaining({ rule: "keyboard", at: "div.go", automatic: false })]);
  });

  it("is not run unless asked", async () => {
    const result = (await runWorkerViewHeadless({ manifest: WATCH_MANIFEST as unknown as WorkerViewManifest, source: WATCH_JS, store: store(), principal: sam, run })) as HeadlessDescribed;
    expect(result.audit).toBeUndefined();
  });
});

describe("graview view check --audit", () => {
  const fixture = (name: string) => new URL(`../fixtures/survey/${name}`, import.meta.url).pathname;
  async function said(source: string, ...more: string[]) {
    const file = join(mkdtempSync(join(tmpdir(), "graview-audit-")), "view.js");
    writeFileSync(file, source);
    const { view } = await import("../../src/cli.js");
    const written: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
    try {
      return { code: await view(["check", file, "--app", fixture("app.mjs"), "--manifest", fixture("glance.manifest.json"), "--seed", fixture("seed.json"), ...more]), text: written.join("") };
    } finally {
      write.mockRestore();
    }
  }
  const UNREACHED = `graview.render(graview.html\`<div class="go">Go</div>\`); graview.on("click", ".go", () => {});`;

  it("fails on a problem the view must fix, says it with its fix, and says the rules it did not run", async () => {
    const { code, text } = await said(UNREACHED, "--audit");
    expect(code).toBe(1);
    expect(text).toContain("Accessibility: 1 problem under keyboard, role, name");
    expect(text).toMatch(/serious · keyboard \(WCAG 2\.1\.1\) at div\.go: A <div> the view hears a click on/);
    expect(text).toMatch(/Not run: contrast — /);
  });

  it("says the audit in --json, and runs none without --audit", async () => {
    const json = await said(UNREACHED, "--audit", "--json");
    expect(json.code).toBe(1);
    expect(JSON.parse(json.text).audit.problems[0]).toMatchObject({ rule: "keyboard", wcag: "2.1.1", automatic: false });
    const plain = await said(UNREACHED);
    expect(plain.code).toBe(0);
    expect(plain.text).not.toContain("Accessibility");
  });

  it("passes a view whose controls are reached and named", async () => {
    const { code, text } = await said(`graview.render(graview.html\`<button type="button" class="go">Go</button>\`); graview.on("click", ".go", () => {});`, "--audit");
    expect(text).toContain("Accessibility: no problems");
    expect(code).toBe(0);
  });
});
