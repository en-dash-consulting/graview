/**
 * A MAP OF TWENTY-FIVE DISTRICTS, for `scripts/verify-scale.mjs`.
 *
 * The catalog is five kinds, and its overview has a handful of ribbons; the
 * apps that froze coming back to the overview had twenty-five kinds and
 * eight hundred records, the ribbons between them routed on the main thread
 * every time the map was shown again (Roadmap
 * request:gv-scene-ribbon-routing-blocks). This page is that shape, made up:
 * twenty-five kinds, each linked to three others, thirty-two records each,
 * in the scene the catalog draws with, opening at altitude.
 *
 *   /districts.html#overview=1
 */
import { createSchema, defineApp, defineNode, Store, z, type GraphSnapshot } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { registerDefaultViews, Shell, themeCss } from "@graview/primitives";
import { createRoot } from "react-dom/client";

const KINDS = 25;
const EACH = 32;
/** Which kinds each kind links to, by how far along the chain they stand. */
const REACH = [1, 3, 7];
const WORDS = ["source", "brief", "claim", "finding", "person", "place", "event", "document", "theme", "question", "lead", "team", "task", "risk", "decision", "meeting", "asset", "vendor", "contract", "budget", "milestone", "region", "signal", "note", "review"];

const names = WORDS.slice(0, KINDS);
const kinds = names.map((name, i) =>
  defineNode(name, {
    fields: z.object({ label: z.string() }),
    plural: `${name}s`,
    label: (node: { label: string }) => node.label,
    edges: Object.fromEntries(REACH.map((d) => [`to-${names[(i + d) % KINDS]}`, { to: [names[(i + d) % KINDS]!], description: `the ${names[(i + d) % KINDS]} it rests on`, inverse: `the ${name}s resting on it` }])),
  }),
);
const schema = createSchema(kinds as never);
const app = defineApp({ name: "Twenty-five districts", schema });

const nodes = names.flatMap((name) => Array.from({ length: EACH }, (_, n) => ({ id: `${name}:${n}`, kind: name, label: `${name} ${n + 1}` })));
const edges = names.flatMap((name, i) =>
  Array.from({ length: EACH }, (_, n) => REACH.map((d) => ({ kind: `to-${names[(i + d) % KINDS]}`, from: `${name}:${n}`, to: `${names[(i + d) % KINDS]}:${(n * 7 + d) % EACH}` }))).flat(),
);
const store = new Store({ schema, snapshot: { nodes, edges } as unknown as GraphSnapshot<never> });

const sheet = new CSSStyleSheet();
sheet.replaceSync(themeCss("light"));
document.adoptedStyleSheets = [sheet];

createRoot(document.getElementById("root")!).render(
  <GraviewProvider store={store as never} views={registerDefaultViews(schema as never, createViews(schema as never))} initialView={{ ...EMPTY_VIEW, overview: true }} app={app as never}>
    <Shell syncUrl scheme="light" onScheme={() => {}} />
  </GraviewProvider>,
);
(window as unknown as Record<string, unknown>)["__graviewReady"] = { kinds: KINDS, records: nodes.length };
