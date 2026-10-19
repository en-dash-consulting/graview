/**
 * A CREW'S JOBS, EACH WITH ITS PHOTOGRAPHS AND PAPERS: the fixture a guest
 * view is handed the pictures on (FR-175), in `@graview/guest`'s unit tests
 * and `guest-sandbox --transport=pictures`.
 *
 * Sam, the office, sees every job; Ana, of the crew, sees only the jobs
 * she is on — the porch, not the roof, whose photograph is therefore never
 * fetched for a view she is reading. Each job holds pictures (a JPEG, a
 * PNG, and an SVG plan, which is handed as a document) and papers (a PDF);
 * a job may hold a video (`clip`, 0.1.37), which `guest-sandbox
 * --transport=pictures` puts on the porch to place it in a view.
 */
import { createSchema, defineApp, defineNode, fileField, imageField, videoField, z, type Policy, type Principal } from "@graview/core";

const crew = defineNode("crew", {
  fields: z.object({ label: z.string().min(1).max(60) }),
  plural: "Crew",
  label: (node) => node.label,
});
const job = defineNode("job", {
  fields: z.object({ label: z.string().min(1).max(60), photos: z.array(imageField()).max(12), papers: z.array(fileField()).max(12).optional(), clip: videoField().optional() }),
  edges: { on: { to: ["crew"], description: "who is on it", inverse: "the jobs they are on" } },
  plural: "Jobs",
  label: (node) => node.label,
});

export const jobsSchema = createSchema([crew, job]);

const policy: Policy = {
  grants: [{ roles: ["office"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["crew"] },
    { roles: ["office"], kinds: ["job"] },
    { roles: ["crew"], kinds: ["job"], own: true },
  ],
};

export const jobsApp = defineApp({ name: "Jobs", schema: jobsSchema, mutations: [], policy });

export const sam: Principal = { kind: "human", id: "person:sam", roles: ["office"] };
export const ana: Principal = { kind: "human", id: "crew:ana", roles: ["crew"] };

/** Where each file is served on the host, as Graview Cloud answers an upload. */
export const FILES = {
  porch: "/graview/files/porch-3f9a.png",
  step: "/graview/files/step-77c1.png",
  plan: "/graview/files/plan-02bd.svg",
  quote: "/graview/files/quote-9e4f.pdf",
  roof: "/graview/files/roof-b5e0.png",
  clip: "/graview/files/clip-5d0a.webm",
  clipPoster: "/graview/files/clip-5d0a.png",
} as const;

export const jobsSeed = {
  nodes: [
    { id: "crew:ana", kind: "crew", label: "Ana" },
    { id: "crew:ben", kind: "crew", label: "Ben" },
    {
      id: "job:porch",
      kind: "job",
      label: "Porch repair",
      photos: [
        { href: FILES.porch, name: "porch.png", type: "image/png", bytes: 2_400, width: 1_600, height: 1_000, caption: "The porch before" },
        { href: FILES.step, name: "step.png", type: "image/png", bytes: 300, width: 40, height: 20, caption: "The cracked step" },
        { href: FILES.plan, name: "plan.svg", type: "image/svg+xml", bytes: 200 },
      ],
      papers: [{ href: FILES.quote, name: "quote.pdf", type: "application/pdf", bytes: 1_800 }],
    },
    { id: "job:roof", kind: "job", label: "Roof survey", photos: [{ href: FILES.roof, name: "roof.png", type: "image/png", bytes: 300, width: 40, height: 20 }] },
  ],
  edges: [
    { kind: "on", from: "job:porch", to: "crew:ana" },
    { kind: "on", from: "job:roof", to: "crew:ben" },
  ],
};
