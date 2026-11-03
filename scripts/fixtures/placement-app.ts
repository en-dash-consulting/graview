/**
 * A STAFFING PLACEMENT, in the shape of the app Graview Cloud's author
 * built (Roadmap f-views-work-end-to-end): placements, each with its
 * economics — a fixed fee, a rate, hours and a margin, every one optional —
 * and an attached contract. Its view of one placement draws the economics
 * as a fieldset bound to the record with four number fields the host fills
 * from it (`data-prefill`) and a "Save economics" press, and the contract
 * as View and Download links. Rhea's placement has no fixed fee yet.
 *
 * Kit is a recruiter, and may change a placement's economics. Some members
 * see only their own placements, so a view's act applies only from a press.
 *
 * And the views the press check is held to: the honest one, and one of each
 * way a control fails — a button bound to nothing, a button whose code
 * throws, a link to a record it was not shown, a jump to an id it never
 * drew, a number asked for in a text field.
 */
import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";

export const placementDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Staffing Placement",
  description: "Who is placed where, and what each placement earns.",
  roles: ["recruiter", "candidate"],
  policy: {
    grants: [{ roles: ["recruiter"], mutations: "*" }],
    sees: [{ roles: ["recruiter"], kinds: ["placement"] }],
  },
  kinds: {
    placement: {
      noun: "placement",
      plural: "placements",
      label: "{name}",
      description: "A person placed with a client, and what it earns.",
      fields: {
        name: { type: "string", required: true },
        fixedFee: { type: "number" },
        rate: { type: "number" },
        hours: { type: "number" },
        margin: { type: "number" },
        contract: { type: "file" },
      },
    },
  },
  acts: {
    "add-placement": { title: "Add a placement", creates: "placement" },
    "set-economics": { title: "Save economics", on: "placement", sets: { fixedFee: "$fixedFee", rate: "$rate", hours: "$hours", margin: "$margin" } },
  },
};

function compiled(document: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(`the placement app compiles: ${JSON.stringify(result.findings.filter((one) => one.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}

export const placementApp = compiled(placementDocument);
export const CONTRACT = { href: "/graview/files/rhea-contract.pdf", name: "Rhea — contract.pdf", type: "application/pdf", bytes: 48_213 };
export const placementSeed = {
  nodes: [
    { id: "placement:rhea", kind: "placement", name: "Rhea at Northwind", rate: 95, hours: 120, margin: 18, contract: CONTRACT },
    { id: "placement:omar", kind: "placement", name: "Omar at Contoso", fixedFee: 4_000, rate: 80, hours: 60, margin: 22 },
  ],
  edges: [],
};

export const kit: Principal = { kind: "human", id: "person:kit", roles: ["recruiter"] };

export const ECONOMICS_MANIFEST = { name: "economics", title: "Economics", attach: "placement", cardinality: "one", acts: ["set-economics"] } as const;

/** The view of one placement: its economics to edit, and its contract to view and download. */
export const ECONOMICS_JS = `
graview.style(".econ { display: grid; gap: 8px; } .econ label { display: grid; gap: 2px; }");
graview.onProps((props) => {
  const node = props.node;
  graview.render(graview.html\`
    <h2>\${node.label}</h2>
    <fieldset class="econ" data-record="\${node.id}">
      <label>Fixed fee <input type="number" name="fixedFee" data-prefill="fixedFee"></label>
      <label>Rate <input type="number" name="rate" data-prefill="rate"></label>
      <label>Hours <input type="number" name="hours" data-prefill="hours"></label>
      <label>Margin <input type="number" name="margin" data-prefill="margin"></label>
      <button id="save" data-act="set-economics">Save economics</button>
    </fieldset>
    \${node.contract ? graview.html\`<p><a id="view-contract" data-file="\${node.id}" data-field="contract">View the contract</a>
       <a id="download-contract" data-file="\${node.id}" data-field="contract" data-download>Download it</a></p>\` : ""}
  \`);
});
`;

/** Each way a control fails the press check, one control apiece. */
export const BROKEN_JS = {
  nothing: `graview.onProps(() => graview.render('<button id="go">Save</button>'));`,
  throws: `graview.on("click", "#go", () => { throw new Error("rate is undefined"); });
graview.onProps(() => graview.render('<button id="go">Recalculate</button>'));`,
  lost: `graview.onProps(() => graview.render('<a id="go" data-record="placement:nobody">Open Nobody</a>'));`,
  jump: `graview.onProps(() => graview.render('<a id="go" href="#terms">Terms</a><section id="fees"><h2>Fees</h2></section>'));`,
  untyped: `graview.onProps((props) => graview.render(graview.html\`<fieldset data-record="\${props.node.id}"><input name="fixedFee"><button id="go" data-act="set-economics">Save economics</button></fieldset>\`));`,
  code: `graview.on("click", "#go", () => graview.act("set-economics", { id: graview.props.node.id, fixedFee: 1 }));
graview.onProps(() => graview.render('<button id="go">Save fee</button>'));`,
};
