/**
 * A FAMILY WEEKEND, a day at a time (FR-193), in the shape of Graview
 * Cloud's "Maryland Family Weekend": a day, and the moments of each day —
 * a photograph or a phone's video — each taken on one day. The journey home
 * view draws the days as cards, and photographs and a video dropped from
 * Finder on a card become moments on that day.
 *
 * Nana is family, and may do anything; Theo is a friend, who sees the
 * weekend and changes nothing. Everyone sees everything, so a view's acts
 * apply from its own code.
 *
 * `weekendApp` makes a moment with "Add a moment" and links it to its day
 * with the derived "Set the day" (`connect-moment-taken-on`), as a Cloud
 * author's app does; `weekendOnDayApp` has, besides, "Add a moment to this
 * day", an act on a day that makes a moment linked to it.
 */
import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";

/** The weekend as a document: a day, and the moments of each, a photograph and a video field on a moment. */
export const weekendDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Family weekend",
  description: "A family's weekend away, a day at a time, and the moments of each day: the photographs and the phone videos dropped on the day they were taken.",
  roles: ["family", "friend"],
  policy: { grants: [{ roles: ["family"], mutations: "*" }] },
  kinds: {
    day: {
      noun: "day",
      plural: "days",
      description: "A day of the weekend.",
      fields: { name: { type: "string", required: true }, date: { type: "date" } },
    },
    moment: {
      noun: "moment",
      plural: "moments",
      description: "Something worth keeping from a day: a photograph or a video.",
      fields: { caption: { type: "string" }, photo: { type: "image", description: "the photograph" }, clip: { type: "video", description: "the video" } },
      edges: { takenOn: { to: ["day"], cardinality: "one", inverse: "moments", description: "the day it was taken" } },
    },
  },
  acts: {
    "add-day": { title: "Add a day", creates: "day" },
    "add-moment": { title: "Add a moment", creates: "moment" },
  },
};

function compiled(document: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(`the weekend compiles: ${JSON.stringify(result.findings.filter((one) => one.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}

export const weekendApp = compiled(weekendDocument);
export const weekendOnDayApp = compiled({
  ...weekendDocument,
  acts: {
    ...weekendDocument.acts,
    "add-moment-to-day": {
      title: "Add a moment to this day",
      on: "day",
      effects: [
        { create: "moment", as: "new", set: { caption: "$caption", photo: "$photo", clip: "$clip" } },
        { connect: "takenOn", from: "$new", to: "$subject" },
      ],
    },
  },
});
export const weekendSeed = {
  nodes: [
    { id: "day:friday", kind: "day", name: "Friday", date: "2026-10-16" },
    { id: "day:saturday", kind: "day", name: "Saturday", date: "2026-10-17" },
    { id: "day:sunday", kind: "day", name: "Sunday", date: "2026-10-18" },
  ],
  edges: [],
};

export const nana: Principal = { kind: "human", id: "person:nana", roles: ["family"] };
export const theo: Principal = { kind: "human", id: "person:theo", roles: ["friend"] };

/** The days as cards, each taking moments dropped on it: the view a Cloud chat writes, handling no drop itself. */
export const JOURNEY_MANIFEST = {
  name: "journey",
  title: "The journey home",
  attach: "day",
  cardinality: "many",
  reads: { kinds: ["moment"], edges: ["takenOn"] },
  accepts: [
    { kind: "moment", field: "photo" },
    { kind: "moment", field: "clip" },
  ],
} as const;

export const JOURNEY_JS = `
graview.style(\`
  .days { display: grid; gap: 12px; padding: 12px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .day { display: grid; gap: 6px; padding: 12px; min-height: 120px; border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); }
  .day h3 { margin: 0; }
  .day ul { margin: 0; padding-left: 1.2em; }
\`);
graview.onProps((props) => {
  const days = props.nodes.filter((node) => node.kind === "day");
  const momentsOf = (day) => props.edges.filter((edge) => edge.kind === "takenOn" && edge.to === day.id).map((edge) => props.nodes.find((node) => node.id === edge.from)).filter(Boolean);
  graview.render(graview.html\`<div class="days">\${days.map((day) => graview.html\`<section class="day" data-key="\${day.id}" data-day="\${day.id}" data-drop="moment" data-drop-connect="takenOn:\${day.id}"><h3>\${day.label}</h3><p data-count>\${momentsOf(day).length} moments</p><ul>\${momentsOf(day).map((moment) => graview.html\`<li data-key="\${moment.id}" data-moment>\${(moment.photo || moment.clip || {}).name || moment.label}</li>\`)}</ul></section>\`)}</div>\`);
});
`;

/** The same cards, handling the drop itself: each file a moment made on the day, all as one change, and the view says what came. */
export const JOURNEY_HANDLED_MANIFEST = { ...JOURNEY_MANIFEST, name: "journey-handled", title: "The journey home, told", acts: ["add-moment-to-day"] } as const;

export const JOURNEY_HANDLED_JS = `${JOURNEY_JS}
graview.on("drop", "[data-drop]", async (event) => {
  const day = event.element.getAttribute("data-day");
  const answer = await graview.act("add-moment-to-day", event.files.map((file) => ({ id: day, caption: "Dropped " + file.name, [file.field]: file })));
  console.log("dropped " + event.files.length + " " + (answer.ok ? "kept" : answer.message));
});
`;
