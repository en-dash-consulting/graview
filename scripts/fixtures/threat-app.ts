/**
 * A THREAT WATCH, in the shape of the app Graview Cloud's author built
 * (0.1.45): threats, each with a severity and a status, and a home drawn by
 * a worker view as cards — `<div class="card" data-record="threat:…">` with
 * a heading, badges and a line inside, no `<a>` anywhere — and a toggle on
 * each card the view binds itself with `graview.on("click")`. Each card
 * has an "Acknowledge" press that is a `<span role="button" data-act>`, not
 * a button, and below the cards a triage fieldset per threat takes a note
 * typed in and saved by another such span (0.1.45). Below them, every
 * threat as an `<a data-record>` with an icon, and as a table's row bound to
 * its record, and a `<div role="button" aria-pressed>` the view hears with
 * `graview.on("click")` that keeps only the critical ones (0.1.47).
 *
 * Sam is an analyst, and may acknowledge a threat.
 */
import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";

export const threatDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  description: "The threats an analyst is watching, how bad each is, and whether anyone has looked at it yet.",
  roles: ["analyst"],
  policy: { grants: [{ roles: ["analyst"], mutations: "*" }] },
  kinds: {
    threat: {
      noun: "threat",
      plural: "threats",
      label: "{name}",
      description: "Something that may harm us, being watched.",
      fields: {
        name: { type: "string", required: true },
        severity: { type: "enum", options: ["low", "high", "critical"], default: "low", required: true },
        status: { type: "enum", options: ["new", "acknowledged"], default: "new", required: true },
        summary: { type: "string" },
        note: { type: "string" },
      },
    },
  },
  acts: {
    "add-threat": { title: "Add a threat", creates: "threat" },
    acknowledge: { title: "Acknowledge", on: "threat", sets: { status: "acknowledged" } },
    "set-note": { title: "Note it", on: "threat", sets: { note: "$note" } },
  },
};

function compiled(document: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(`the threat watch compiles: ${JSON.stringify(result.findings.filter((one) => one.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}

export const threatApp = compiled(threatDocument);
export const threatSeed = {
  nodes: [
    { id: "threat:phishing", kind: "threat", name: "Invoice phishing", severity: "critical", status: "new", summary: "Forty mailboxes got the fake invoice this morning." },
    { id: "threat:vpn", kind: "threat", name: "Old VPN appliance", severity: "high", status: "new", summary: "Its firmware is two years behind." },
  ],
  edges: [],
};

export const sam: Principal = { kind: "human", id: "person:sam", roles: ["analyst"] };

/** The home, as the author's view draws it. */
export const WATCH_MANIFEST = { name: "watch", title: "Threat Watch", attach: "home", cardinality: "many", reads: { kinds: ["threat"] }, acts: ["acknowledge", "set-note"] } as const;

export const WATCH_JS = `
graview.style(\`
  .cards { display: grid; gap: 12px; padding: 12px; }
  .card { display: grid; gap: 6px; padding: 14px; border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); background: var(--graview-panel); }
  .card h3 { margin: 0; font-size: 1.125rem; }
  .badges { display: flex; gap: 6px; }
  .badge { padding: 2px 8px; border-radius: 999px; background: var(--graview-ground); font-size: 0.8125rem; }
  .more { justify-self: start; }
  .card p { margin: 0; }
  .press { justify-self: start; padding: 4px 10px; border: 1px solid var(--graview-edge); border-radius: 6px; }
  .triage { display: grid; gap: 8px; padding: 12px; }
  .every { display: grid; gap: 8px; padding: 12px; }
  .every ul { margin: 0; padding-left: 1.2em; }
\`);
const open = new Set();
const said = {};
let onlyCritical = false;
const draw = (props) => {
  const threats = (props.nodes ?? []).filter((node) => node.kind === "threat");
  graview.render(graview.html\`<div class="cards">\${threats.map((threat) => graview.html\`
    <div class="card" data-key="\${threat.id}" data-record="\${threat.id}">
      <h3>\${threat.label}</h3>
      <div class="badges"><span class="badge" data-badge>\${threat.severity}</span><span class="badge">\${threat.status}</span></div>
      <button class="more" data-more="\${threat.id}">\${open.has(threat.id) ? "Less" : "More"}</button>
      \${open.has(threat.id) ? graview.html\`<p data-summary>\${threat.summary}</p>\` : ""}
      <span class="press" role="button" data-act="acknowledge" data-ack="\${threat.id}">Acknowledge</span>
      <p data-said="\${threat.id}">\${said[threat.id] ?? ""}</p>
    </div>\`)}</div>
    <section class="triage"><h2>Triage</h2>\${threats.map((threat) => graview.html\`
      <fieldset data-key="note-\${threat.id}" data-record="\${threat.id}"><legend>\${threat.label}</legend>
        <input name="note" placeholder="A note" data-note="\${threat.id}">
        <span class="press" role="button" data-act="set-note" data-save-note="\${threat.id}">Save the note</span>
      </fieldset>\`)}</section>
    <section class="every"><h2>Every threat</h2>
      <div class="press" role="button" aria-pressed="\${onlyCritical ? "true" : "false"}" data-only-critical>Only critical</div>
      <ul>\${threats.filter((threat) => !onlyCritical || threat.severity === "critical").map((threat) => graview.html\`
        <li data-key="every-\${threat.id}"><a data-record="\${threat.id}" data-link="\${threat.id}"><svg data-icon viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg> \${threat.label}</a></li>\`)}</ul>
      <table><tbody>\${threats.map((threat) => graview.html\`
        <tr data-key="row-\${threat.id}" data-record="\${threat.id}" data-row="\${threat.id}"><td>\${threat.label}</td><td>\${threat.severity}</td></tr>\`)}</tbody></table>
    </section>\`);
};
graview.onProps(draw);
graview.on("acted", "[data-act]", (event) => {
  said[event.element.getAttribute("data-ack") ?? event.element.getAttribute("data-save-note")] = event.pressed.ok ? "Done" : event.pressed.message;
  draw(graview.props);
});
graview.on("click", "[data-only-critical]", () => {
  onlyCritical = !onlyCritical;
  draw(graview.props);
});
graview.on("click", "[data-more]", (event) => {
  const id = event.element.getAttribute("data-more");
  if (open.has(id)) open.delete(id);
  else open.add(id);
  draw(graview.props);
});
`;
