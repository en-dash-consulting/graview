import { arrangeable } from "../arrange.js";
import { searchableFields } from "../search.js";
import { capabilitiesOf, describeCapability, type GraviewApp, type IntelligenceProviderDeclaration } from "../app.js";
import { beginning } from "../beginning.js";
import { cityMap, roadsOf } from "../city.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import type { AnySchema } from "../schema/schema.js";
import { hueFor } from "../theme/derive.js";
import { withArticle } from "../schema/define-node.js";
import { declaredLenses, isShippedLens, placesOf } from "../places.js";
import { columnReach } from "../columns.js";
import { computedOf } from "../document/computed.js";

/**
 * WHAT THIS APP IS, READ OUT — the rung between `check` and a browser.
 *
 * "Run it and look" is the sentence every skill ends on, and it is the one
 * instruction an agent cannot follow: it can declare, and it cannot see. The
 * product that found thirty-one things in this framework said so plainly —
 * *"what no check caught, running it did"* — and listed four faults that
 * passed every static check and were obvious the moment somebody opened the
 * thing: a hue in the wrong unit, so every surface drew red; a lens built
 * from the wrong node set, so every piece of ground drew empty; a policy
 * declared with no principal supplied, so every act in the product was
 * refused; a colour that was not a token, so the contrast guarantee did not
 * apply.
 *
 * Every one of those is visible in a DESCRIPTION. The interface here is
 * derived, which is exactly what makes it describable: the same derivations
 * that draw a district, offer an act and refuse one can say what they would
 * do, in words, with no browser and no eyes.
 *
 * This is deliberately not a screenshot in prose. It states the things that
 * are wrong ON A SCREEN and invisible IN A FILE, and says nothing that
 * `check` already says.
 */

export interface DescribeOptions {
  /** A seat to answer "what can this person do" as. */
  readonly as?: { readonly kind: "human" | "agent"; readonly id?: string; readonly roles?: readonly string[] };
}

/** Whether a seat may run one named act, by the declaration's own grants. */
function permits<S extends AnySchema>(
  app: GraviewApp<S>,
  act: string,
  seat: { readonly roles?: readonly string[] },
): boolean {
  if (!app.policy) return true;
  const held = seat.roles ?? [];
  return (app.policy.grants ?? []).some(
    (grant) =>
      (grant.roles === "*" || held.some((role) => (grant.roles as readonly string[]).includes(role))) &&
      (grant.mutations === "*" || (grant.mutations as readonly string[]).includes(act)),
  );
}

const list = (words: readonly string[]): string =>
  words.length === 0 ? "none" : words.length === 1 ? words[0]! : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

export function describeApp<S extends AnySchema>(
  app: GraviewApp<S>,
  options: DescribeOptions = {},
): string {
  const kinds = [...(app.schema.kinds as readonly string[])];
  const declared = app.mutations ?? [];
  const acts = [...declared, ...deriveMutations(app.schema, declared)];
  const lines: string[] = [`${app.name} — ${kinds.length} kinds, ${acts.length} acts (${declared.length} declared, ${acts.length - declared.length} derived).`];

  /*
   * WHAT A BLANK INSTALLATION MEETS. The first screen of every product, the
   * one the author never sees because their own graph has data in it.
   */
  const chain = beginning(app);
  lines.push("", "## Opening it empty");
  if (chain.doors.length === 0) {
    lines.push(`Nothing can be made. Every act that creates a kind needs a node that does not exist yet, so a blank installation is ${kinds.length} districts and no way in.`);
  } else {
    /*
     * AND WHETHER THIS SEAT MAY GO THROUGH ANY OF THEM.
     *
     * The chain is a property of the declaration and the same for everyone;
     * the doors are not. An observer reading "7 of 12 kinds can begin" is
     * being told about somebody else's product — they can begin none of
     * them, and the useful sentence names who can. The same mistake was
     * shipped in `<Begin>`, which drew ten kinds and offered no acts to a
     * seat the policy refused, so it is worth saying in both places.
     */
    const open = options.as === undefined ? chain.doors : chain.doors.filter((door) => permits(app, door, options.as!));
    if (open.length === 0) {
      lines.push(
        `Nothing here is this seat's to begin. ${chain.roots.length} of ${kinds.length} kinds can be started — ` +
          `${list(chain.roots)} — and ${list(chain.doors.map((door) => `"${door}"`))} ${chain.doors.length === 1 ? "is" : "are"} not permitted to it.`,
      );
    } else {
      lines.push(
        `${chain.roots.length} of ${kinds.length} kinds can begin: ${list(chain.roots)} — through ${list(open.map((door) => `"${door}"`))}${
          open.length < chain.doors.length ? ` (${chain.doors.length - open.length} more not permitted to this seat)` : ""
        }.`,
      );
    }
    const waiting = chain.order.filter((entry) => (entry.depth ?? 0) > 0 && entry.depth !== null);
    for (const entry of waiting) {
      lines.push(`  ${entry.kind} waits for ${list(entry.needs)} (${entry.depth} deep).`);
    }
  }
  for (const entry of chain.unreachable) {
    lines.push(`  ${entry.kind} can never be made here — ${entry.why}.`);
  }

  /*
   * WHAT IS DRAWN, and what falls back. A kind with no view of its own is a
   * legitimate state and an invisible one: the framework's own list is
   * tidy enough that nobody notices the picture was never written.
   */
  lines.push("", "## What is drawn");
  /*
   * THE PLACES THE DECLARATION DRAWS ITSELF (FR-79), read from the one list
   * that decides what draws — so this says what the faces show, and why a
   * titled lens that is missing is missing.
   */
  const lensesDeclared = declaredLenses(app);
  const everywhere = placesOf(app);
  if (lensesDeclared.drawn.length > 0) {
    lines.push(
      `${lensesDeclared.drawn.length} declared ${lensesDeclared.drawn.length === 1 ? "lens draws" : "lenses draw"} as places, with no view of the app's own: ${list(
        lensesDeclared.drawn.map((lens) => {
          const at = everywhere.find((place) => place.slug === lens.as && place.kind === lens.kinds[0]);
          return `"${lens.title}" (the ${lens.lens} over ${list(lens.kinds.map((kind) => app.schema.tryDefinition(kind)?.plural ?? `${kind}s`))}${lens.across ? ` across ${app.schema.tryDefinition(lens.across)?.plural ?? `${lens.across}s`}` : ""}, at ${at?.address ?? `/places/${lens.as}`})`;
        }),
      )}.`,
    );
  }
  // A status board (FR-97) moves a card only by an act; say which, so nobody expects a drag the policy will not run.
  for (const lens of lensesDeclared.drawn.filter((one) => one.lens === "columns")) {
    for (const [kind, roles] of Object.entries((lens.options["bindings"] ?? {}) as Record<string, { column?: string }>)) {
      if (!roles.column) continue;
      // Column by column (FR-108): a named step is the move to its value's column; a free act reaches the rest.
      const noun = app.schema.tryDefinition(kind)?.noun ?? kind;
      const reach = columnReach(app.schema, acts, kind, roles.column);
      const named = (some: readonly { readonly title?: string; readonly name: string }[]) => some.map((act) => `"${act.title ?? act.name}"`);
      const or = (words: readonly string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`);
      const stepped = reach.filter((one) => one.by === "step");
      const free = reach.find((one) => one.by === "value");
      const unreached = reach.filter((one) => one.by === "none");
      const ways = [...stepped.map((one) => `to ${one.label} by ${or(named(one.acts))}`), ...(free ? [`to ${stepped.length > 0 ? "any other" : "another"} column by ${list(named(free.acts))}`] : [])];
      if (ways.length === 0) {
        lines.push(`  "${lens.title}" offers no move: no act sets the ${roles.column} of ${withArticle(noun)} to a value of its own or a value it is given.`);
        continue;
      }
      lines.push(
        `  "${lens.title}" moves ${withArticle(noun)} ${list(ways)}, for a seat its policy lets run it${stepped.length > 0 ? ` and where the act's condition holds for that ${noun}` : ""}; any other seat is offered no move.${unreached.length > 0 ? ` Nothing moves ${withArticle(noun)} to ${list(unreached.map((one) => one.label))} from the board.` : ""}`,
      );
    }
  }
  for (const lens of lensesDeclared.undrawn) {
    if (lens.title) lines.push(`  "${lens.title}" does not draw: ${lens.why}.`);
  }
  // The home view (FR-81): what the home draws in place of the derived one, on both faces, once there is something to show.
  if (app.home && app.home.length > 0) {
    const lists = app.home.filter((block) => typeof block === "object" && block !== null && "list" in block).length;
    lines.push(
      `Its home is drawn from ${app.home.length} ${app.home.length === 1 ? "block" : "blocks"} of its own${lists > 0 ? `, ${lists} of them ${lists === 1 ? "a list" : "lists"} of records` : ""}, in place of the derived home; an empty graph still opens on the way in.`,
    );
  }
  if (app.pages) {
    const first = everywhere.find((place) => place.first);
    const order = (app.pages.order ?? []).filter((kind) => kinds.includes(kind));
    const hidden = (app.pages.hide ?? []).filter((kind) => kinds.includes(kind));
    if (first) lines.push(`It opens on ${first.kind === null ? "its home" : `"${first.title}"`} (${first.address}).`);
    if (order.length > 0) lines.push(`The home and the city take the kinds in this order: ${list(order)}${order.length < kinds.length ? ", then the rest as declared" : ""}.`);
    if (hidden.length > 0) lines.push(`Left off the home, and still at their own addresses and in search: ${list(hidden)}.`);
  }
  if (!app.views) {
    /*
     * NOT "there are no views" — "nothing here can see them".
     *
     * A view registry is optional on `defineApp`, and most apps build theirs
     * in the UI package where the components are. That is a reasonable
     * place for it and it means the pictures are invisible to everything
     * outside a browser: this, `graview check`'s kind-without-view, and the
     * docs generator all go quiet rather than wrong. Saying which of the two
     * this is matters more than the count.
     */
    lines.push(
      `The pictures live in the UI package, which the declaration cannot import, so this cannot see what is drawn — that is the design, not neglect. Run it with --views ./dist/ui/views.js (a module exporting \`views\`, or the registry as default) and this, check and docs read the pictures: which kinds have one of their own, which places are named, which have a drive-in.`,
    );
  } else {
    const registered = new Set(app.views.kindsWithViews());
    const withOwn = kinds.filter((kind) => registered.has(kind));
    lines.push(
      withOwn.length === 0
        ? `No kind has a view of its own; every district draws the framework's list.`
        : `${withOwn.length} of ${kinds.length} kinds have a view of their own: ${list(withOwn)}.`,
    );
    const bare = kinds.filter((kind) => !registered.has(kind));
    if (bare.length > 0) lines.push(`  Drawn by the framework's list: ${list(bare)}.`);
    const places = app.views.places?.() ?? [];
    lines.push(
      places.length === 0
        ? "No group view is titled, so the bar lists no places, a page can link to none, and no district has a drive-in."
        : `${places.length} named places: ${list(places.map((place) => `"${place.title}" over the ${place.kind}s`))}.`,
    );
    const driveIns = [...new Set(places.map((place) => place.kind))];
    if (driveIns.length > 0) {
      lines.push(`  Drive-ins from altitude: ${list(driveIns)}; the rest open in place.`);
    }
  }
  /*
   * WHAT A PICTURE CAN BE ASKED TO DO. An agent that cannot see the row can
   * still write the stop — `in.sort=due:desc`, `in.group=held-at` — if it
   * knows the words; and the words are the declaration's.
   */
  lines.push("", "## What can be arranged");
  lines.push("Any picture over a kind sorts, filters and groups it through in.sort, in.filter and in.group in the stop (a page's ?sort, ?filter, ?group, ?q):");
  for (const kind of kinds) {
    const offers = arrangeable(app.schema, kind);
    const say = (entries: readonly { key: string; label: string }[]) => entries.map((offer) => `${offer.key} (${offer.label.toLowerCase()})`);
    lines.push(
      `  ${kind}: sort by ${list(say(offers.sorts))}; filter by ${list(say(offers.filters))}; group by ${offers.groups.length === 0 ? "nothing" : list(say(offers.groups))}` +
        `${offers.natural ? `; sorted by ${offers.natural.by} unless asked` : ""}.`,
    );
  }
  for (const lens of app.lenses ?? []) {
    if (!lens.arrangedBy) continue;
    const words = Object.entries(lens.arrangedBy).map(([part, value]) => `${part}=${value}`);
    lines.push(`  The ${lens.name} lens opens with ${list(words)}.`);
  }

  /*
   * WHAT THE WORDS REACH. The Find box, `/search` and `search_graph` read the
   * name and every field a person reads on a record; an agent that knows
   * which is an agent that searches rather than reading the whole graph.
   */
  lines.push("", "## What can be found");
  lines.push("The Find box (/ or ⌘K), /search?q= and the search_graph tool match the start of words in:");
  for (const kind of kinds) {
    const fields = searchableFields(app.schema, kind).map((field) => `${field.key} (${field.reading.toLowerCase()})`);
    const lifecycle = app.schema.tryDefinition(kind)?.lifecycle;
    lines.push(`  ${kind}: ${list(fields)}${lifecycle ? "; past records only with is:any" : ""}.`);
  }
  lines.push("  key:value tokens narrow as a list's filter does, and kind:<kind> to one kind.");

  const authored = (app.lenses ?? []).filter((lens) => !isShippedLens(lens.name));
  if (authored.length > 0) {
    lines.push(
      `Lenses this app wrote: ${list(
        authored.map((lens) =>
          lens.provenBy
            ? `${lens.name} (reuse proved in ${lens.provenBy})`
            : `${lens.name} (reuse unproved)`,
        ),
      )}.`,
    );
  }

  /*
   * THE HUES, IN DEGREES. Six kinds all landing within a few degrees of each
   * other is a city drawn in one colour, which reads as a rendering fault
   * and is a declaration the author can change.
   */
  const hues = kinds.map((kind) => ({ kind, hue: Math.round(hueFor(kind, app.brand?.accents)) }));
  const crowded = hues.filter((a, index) =>
    hues.some((b, other) => other !== index && Math.abs(a.hue - b.hue) < 12),
  );
  lines.push(
    `Hues: ${hues.map((entry) => `${entry.kind} ${entry.hue}°`).join(", ")}.` +
      (crowded.length > 1 ? ` ${list(crowded.map((entry) => entry.kind))} are within 12° of each other and will read as one colour.` : ""),
  );

  /*
   * WHAT A SEAT CAN DO. A policy with roles and a principal holding none of
   * them refuses everything, and the app looks broken rather than guarded —
   * which is a whole product's worth of struck-through buttons and no
   * error anywhere.
   */
  if (app.policy) {
    lines.push("", "## Who may do what");
    const roles = app.policy.roles ?? [];
    lines.push(`${roles.length} roles: ${list([...roles])}.`);
    const asked = options.as;
    if (asked) {
      const held = asked.roles ?? [];
      const permitted = acts.filter((act) => permits(app, act.name, asked));
      lines.push(
        `As ${asked.id ?? asked.kind} holding ${list([...held])}: ${permitted.length} of ${acts.length} acts permitted.` +
          (permitted.length === 0
            ? " Every act in the product would be struck through — check the principal holds a role the policy grants."
            : ""),
      );
    } else {
      lines.push(`Pass --as <role> to see what one seat is offered; a principal holding no granted role is refused everything, silently.`);
    }
  }

  /* HOW A MODEL IS REACHED, and whether anything actually serves the door. */
  const providers = app.intelligence ?? [];
  if (providers.length > 0) {
    lines.push("", "## Intelligence");
    for (const provider of providers as readonly IntelligenceProviderDeclaration[]) {
      const doors =
        provider.kind === "graph"
          ? "it IS the graph, so there is no door"
          : provider.reach?.length
            ? `reached by ${list([...provider.reach])}`
            : "no door declared, so nothing derived can offer one";
      /*
       * A decision provider is read out for what it IS: typed answers, never
       * prose. A reader deciding whether to offer it in a chat, or to a
       * field that wants filling, needs that sentence more than the doors.
       */
      const nature =
        provider.kind === "decision"
          ? " Answers typed questions only — a choice, a truth, a score — and never prose, so no chat seat offers it."
          : "";
      lines.push(
        `${provider.name} (${provider.kind}) — ${doors}; may ${
          provider.may ? list([...provider.may]) : "every act"
        }.${nature}`,
      );
    }
  }

  /*
   * THE LADDER, READ OUT. Which rungs this app declares and what each can
   * do — so a reader knows, before opening it, that on a decision rung the
   * chat seat will be answered by the graph, and that a prose-only door is
   * not a rung a field can be filled from. The graph rung is always there,
   * declared or not: it is what everything falls down to.
   */
  lines.push("", "## The ladder");
  const graphDeclared = providers.some((provider) => provider.kind === "graph");
  lines.push(
    `graph only (${graphDeclared ? "declared" : "always there, undeclared"}) — ${capabilitiesOf("graph").map(describeCapability).join("; ")}. Keyless; every capability a rung cannot serve falls down to it.`,
  );
  for (const provider of providers as readonly IntelligenceProviderDeclaration[]) {
    if (provider.kind === "graph") continue;
    const serves = capabilitiesOf(provider.kind);
    const cannot = (["prose", "decide", "propose"] as const).filter((capability) => !serves.includes(capability));
    lines.push(
      `${provider.name} (${provider.kind}) — ${serves.map(describeCapability).join("; ")}.` +
        (cannot.length > 0
          ? ` Cannot ${cannot.map((capability) => ({ prose: "talk", decide: "decide", propose: "propose" })[capability]).join(" or ")}: on this rung the graph answers that instead.`
          : ""),
    );
  }

  /*
   * THE CITY, READ OUT. Where each kind stands and which roads join them —
   * the first thing outside a browser that can say what is drawn, because
   * the map is drawn from the declaration and nothing else. Sides are
   * empty here: an installation's population is not the declaration's.
   */
  const map = cityMap(app.schema, { order: chain.order.map((entry) => entry.kind) });
  lines.push("", "## The city");
  for (const [kind, plot] of map) lines.push(`${kind} at (${plot.col}, ${plot.row})`);
  const roads = roadsOf(app.schema, map);
  lines.push(roads.length === 0 ? "No roads: no kind declares an edge to another." : `Roads: ${roads.map((road) => `${road.from} — ${road.to} by ${road.edges.join(", ")}`).join("; ")}.`);

  /*
   * WHAT IS WORKED OUT (FR-83). A computed field reads like a stored one in
   * every template, view and rule, and no act writes it: an agent that knows
   * which is which never tries to set a price that is a sum.
   */
  const worked = kinds.flatMap((kind) => {
    const definition = app.schema.tryDefinition(kind) as Parameters<typeof computedOf>[0] & { display?: { labels?: Readonly<Record<string, string>> } };
    return [...computedOf(definition)].map(([name, entry]) => {
      const label = entry.label ?? definition?.display?.labels?.[name];
      return `${kind} · ${name}${label ? ` (${label})` : ""}, read-only: ${entry.expr}`;
    });
  });
  if (worked.length > 0) {
    lines.push("", "## Worked out");
    lines.push("Computed fields: read like fields, written by nothing, worked out from what the reader may see.");
    for (const line of worked) lines.push(`  ${line}`);
  }

  /* WHAT IS JUDGED. A rule with no repair is a problem a person is told about and cannot fix. */
  const invariants = app.invariants ?? [];
  lines.push("", "## What is judged");
  if (invariants.length === 0) lines.push("No rules. Nothing about this graph can be wrong.");
  for (const invariant of invariants) {
    const scope = invariant.scope === "graph" ? "the whole graph" : `each ${withArticle((invariant.scope as { kind: string }).kind).slice(2)}`;
    lines.push(
      `${invariant.name} over ${scope} — ${
        invariant.repairs?.length ? `repairs with ${list([...invariant.repairs])}` : "NO REPAIR: a person is told and cannot act"
      }.`,
    );
  }

  return lines.join("\n");
}
