import { arrangeable } from "../arrange.js";
import type { GraviewApp } from "../app.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import { mutationToolSchema } from "../schema/json-schema.js";
import type { AnySchema } from "../schema/schema.js";

/**
 * Generates the file an agent reads before touching this app: what kinds
 * exist, what edges are legal, which mutations are the only way to change
 * anything, and what the invariants will refuse.
 */
export function generateLlmsTxt<S extends AnySchema>(app: GraviewApp<S>): string {
  const lines: string[] = [];
  lines.push(`# ${app.name}`, "");
  lines.push(
    "A Graview context graph. The graph is the interface: every change is a",
    "typed mutation, every mutation previews as a diff, and the invariants",
    "below are checked before anything applies.",
    "",
  );

  lines.push("## Node kinds", "");
  for (const definition of app.schema.definitions) {
    const fields = Object.keys(definition.fields.shape as Record<string, unknown>);
    lines.push(`### ${definition.kind}`);
    if (definition.description) lines.push(definition.description);
    lines.push(`- fields: ${fields.join(", ")}`);
    const edges = Object.entries(definition.edges);
    if (edges.length > 0) {
      for (const [kind, edge] of edges) {
        const target = edge.to === "*" ? "any kind" : edge.to.join(" | ");
        lines.push(
          `- edge \`${kind}\` -> ${target}${edge.cardinality === "one" ? " (at most one)" : ""}${
            edge.description ? ` — ${edge.description}` : ""
          }`,
        );
      }
    }
    if (definition.fieldRoles) {
      lines.push(
        `- field roles: ${Object.entries(definition.fieldRoles)
          .map(([role, field]) => `${role}=${field}`)
          .join(", ")}`,
      );
    }
    const offers = arrangeable(app.schema, definition.kind);
    lines.push(
      `- arranged by: sort ${offers.sorts.map((offer) => offer.key).join(" | ")}; filter ${offers.filters.map((offer) => offer.key).join(" | ")}; group ${offers.groups.map((offer) => offer.key).join(" | ") || "nothing"}${offers.natural ? `; ${offers.natural.by} unless asked` : ""}`,
    );
    lines.push("");
  }

  lines.push("## Arranging a picture", "");
  lines.push(
    "Every picture over a kind — the list page, a board, a calendar — takes an",
    "arrangement in its address, in one grammar: `sort=<key>[:desc]`,",
    "`filter=<key>:<value>[,<key>:<value>]`, `group=<key>[:day|week|month]`, `q=<words>`.",
    "A page carries them in its search (`/tasks?sort=due:desc&filter=done:false`);",
    "a picture in the scene carries them in the fragment as `in.sort`, `in.filter`,",
    "`in.group`, `in.q`. A filter value is a field's value, `before:`/`after:`/`on:` a",
    "date, a node id, `*` or `none` for an edge, and `current`/`past`/`any`/`flagged`/",
    "`clear` for `is`. Each kind above says what it offers.",
    "",
  );

  lines.push("## Mutations", "");
  lines.push(
    "These are the only writes. Nothing else may change the graph.",
    "",
  );
  for (const mutation of allMutationsOf(app)) {
    const tool = mutationToolSchema(mutation);
    lines.push(`### ${mutation.name}`);
    lines.push(tool.description);
    if (mutation.subject) {
      const kinds =
        mutation.subject.kinds === "*"
          ? "any node"
          : (mutation.subject.kinds as readonly string[]).join(" | ");
      lines.push(`- acts on: ${kinds} (argument \`${mutation.subject.arg}\`)`);
    }
    lines.push("```json");
    lines.push(JSON.stringify(tool.inputSchema, null, 2));
    lines.push("```", "");
  }

  lines.push(
    "Two things the framework adds to every act above. An act that creates a kind",
    "takes an optional `id`: the id of the node it makes, refused if the graph",
    "already has it. And every kind has `remove-<kind>`, derived: it takes the",
    "node and its ties out, and is permitted through the acts that create the",
    "kind or a grant naming it.",
    "",
  );

  lines.push("## Attaching an agent", "");
  lines.push(
    "The live graph is not the seed file. Do not edit the seed to change what",
    "the app shows; act on the store where it is:",
    "",
    "```sh",
    `graview mcp <entry> --data ./data --as <you> --roles <role,…>      # MCP over stdio, the tools above`,
    `graview mcp <entry> --remote-url <url> --header "authorization: …"   # the same, against graview serve`,
    `graview apply <entry> --data ./data --roles <role> --call <act> --args '{…}'`,
    `graview apply <entry> --data ./data --roles <role> --plan plan.json [--preview]`,
    `graview sync-seed <entry> --seed <file> --data ./data [--apply]     # default content, moved without a wipe`,
    "```",
    "",
    "Every change goes through `store.apply` under your seat and is judged by the",
    "policy, logged with your name, previewable first and undoable after. A plan",
    "is a JSON array of `{ mutation, args, as? }`; a later call names an earlier",
    "one's node as `{ \"$plan\": \"<as>\" }` and the whole plan is one batch.",
    "",
  );

  lines.push("## Invariants", "");
  for (const invariant of app.invariants ?? []) {
    const scope =
      invariant.scope === "graph" ? "whole graph" : `each ${invariant.scope.kind}`;
    lines.push(`- **${invariant.name}** (${scope}) — ${invariant.description ?? invariant.label ?? ""}`);
    if (invariant.repairs?.length) {
      lines.push(`  repairs: ${invariant.repairs.join(", ")}`);
    }
  }
  lines.push("");

  if (app.intelligence?.length) {
    lines.push("## Intelligence", "");
    for (const provider of app.intelligence) {
      lines.push(`### ${provider.name} (${provider.kind})`);
      if (provider.description) lines.push("", provider.description);
      if (provider.kind === "decision") {
        lines.push(
          "",
          "Answers typed questions only — a choice over declared options, a truth, a score over a declared rubric — with a confidence, and never prose. Not a conversational seat.",
        );
      }
      /* THE DOORS, so a reader knows how to reach it rather than guessing. */
      if (provider.reach?.length) {
        lines.push("", `Reached by: ${provider.reach.join(", ")}.`);
        if (provider.bridge) lines.push(`The local door answers at \`${provider.bridge}\`.`);
        if (provider.keyStorage) lines.push(`A key given here is kept ${provider.keyStorage}.`);
      }
      lines.push("", `May: ${provider.may?.join(", ") ?? "every registered mutation"}.`, "");
    }
  }

  if (app.views) {
    lines.push("## Views", "");
    lines.push(
      "Views form a matrix of cardinality (one / many) and fidelity",
      "(full / summary / glyph). The framework picks the cell from plane depth.",
      "",
    );
    for (const view of app.views.all()) {
      lines.push(`- ${view.kind}: ${view.cardinality} / ${view.fidelity}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Declared and derived alike: the surface an agent seat actually gets. */
function allMutationsOf<S extends AnySchema>(app: GraviewApp<S>) {
  return [...(app.mutations ?? []), ...deriveMutations(app.schema, app.mutations ?? [])];
}

/** The agent-facing instruction file, generated from the same declarations. */
export function generateAgentsMd<S extends AnySchema>(app: GraviewApp<S>): string {
  const mutationNames = allMutationsOf(app).map((m) => m.name);
  return [
    `# ${app.name} — working notes for agents`,
    "",
    "This app is built on Graview. Three rules follow from that, and they are",
    "the whole contract:",
    "",
    "1. **The graph is the interface.** Do not write to storage. Every change",
    "   goes through a typed mutation so it carries attribution, an inverse,",
    "   and the set of nodes it read.",
    `2. **Only these mutations exist:** ${mutationNames.join(", ") || "(none registered)"}.`,
    "   A change you cannot express as one of them is a change the app has",
    "   not agreed to; add a mutation rather than reaching around it.",
    "3. **Preview before you apply.** Every mutation previews as a diff plus",
    "   the invariants it would break. A preview that introduces a violation",
    "   is a proposal, not a fix.",
    "",
    "Run `graview check` after editing any declaration. It reports schema",
    "problems in terms of the declaration to change.",
    "",
    "## Evolving a live store",
    "",
    "- **The seed is a bootstrap snapshot,** read once into an empty store. To",
    "  change what a running app shows, act on its store — `graview mcp`,",
    "  `graview apply`, or the interface — never by editing the seed and wiping.",
    "  When the default content itself moves, `graview sync-seed` lands the",
    "  difference as one undoable operation; export a snapshot back into the seed",
    "  only when shipping a new default.",
    "- **Declare `version` and `migrations` when the schema moves.** A stored",
    "  graph at an older version has to reach the new one; `graview check` refuses",
    "  a gap.",
    "- **Name nodes by id when you will refer to them.** Every creating act takes an",
    "  optional `id`; a plan names an earlier call's node as `{ \"$plan\": name }`.",
    "  Do not hardcode a bootstrap id inside a mutation body or an invariant —",
    "  bind a role or a flag, so a store seeded differently still works.",
    "- **Prefer the derived acts over reaching around them.** `edit-<kind>` changes",
    "  what was set at creation; `remove-<kind>` takes a node out. Both flow",
    "  through the policy.",
    "- **Wire `serve` and `mcp` into the app's scripts** so an agent loop has a",
    "  door, and keep a declared provider's `may` list wide enough for redesign,",
    "  not only for filling an empty graph.",
    "",
    "See `llms.txt` for the full node, edge, mutation and invariant reference.",
    "",
  ].join("\n");
}
