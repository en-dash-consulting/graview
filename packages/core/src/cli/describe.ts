import { capitalize } from "../capital.js";
import { gridSortOf } from "../grid-sort.js";
import { jobIsFor } from "../job-shape.js";
import { arrangeable } from "../arrangement.js";
import { kindListWords } from "../kind-list.js";
import { searchableFields } from "../search.js";
import { capabilitiesOf, describeCapability, type GraviewApp, type IntelligenceProviderDeclaration } from "../app.js";
import { beginning } from "../beginning.js";
import { cityMap } from "../city.js";
import { roadsOf } from "../village.js";
import { deriveMutations, subjectKindsOf } from "../mutations/derive-edits.js";
import type { AnySchema } from "../schema/schema.js";
import { crowdedHues, HUE_CROWDING } from "../theme/derive.js";
import { pluralOf, withArticle } from "../schema/define-node.js";
import { ruleLineWords } from "../invariants/line.js";
import { ruleLine } from "../lines.js";
import { declaredLenses, isShippedLens } from "../places.js";
import { listsRecords } from "../lenses-that-list.js";
import { placesOf } from "../app-places.js";
import { columnReach } from "../columns.js";
import { stepKindOf } from "../workflows/steps.js";
import { resolveWorkflow } from "../workflows/resolve.js";
import { workflowWorldOfApp } from "../workflows/world.js";
import { computedOf } from "../document/computed.js";
import { placePath } from "../views/types.js";
import { dayAsRead, DEFAULT_LOCALE, numberAsRead, timeAsRead } from "../days.js";
import { formatMoney } from "../document/template.js";
import { amountOf } from "../schema/amount-mark.js";
import { amountMark, amountSentence } from "../schema/amount-words.js";
import { sayAmount } from "../document/amount.js";
import { linkedRelations } from "../schema/linked.js";
import { linkedRelationWords } from "../linked.js";
import { collaborativeFieldOf } from "../schema/collaborative-of.js";

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
 * refused; a color that was not a token, so the contrast guarantee did not
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
   * WHO IT IS FOR AND WHAT THEY COME TO DO (Roadmap f-app-jobs): the app's
   * own words before anything derived, so a reader — a person, a model, a
   * design — starts from its people. Asked as a seat, only that seat's jobs.
   */
  const jobs = (app.purpose?.jobs ?? []).filter((job) => !options.as || jobIsFor(job, options.as.roles));
  if (app.purpose?.for !== undefined || jobs.length > 0) {
    lines.push("", "## Who it is for");
    if (app.purpose?.for !== undefined) lines.push(`Who uses it: ${app.purpose.for.replace(/([^.!?])$/, "$1.")}`);
    if (jobs.length > 0) lines.push("They come to it to ask:");
    for (const job of jobs) {
      const sort = gridSortOf(job.sort);
      const answer = [
        `the ${app.schema.tryDefinition(job.kind) ? pluralOf(app.schema, job.kind).toLowerCase() : job.kind}${job.where ? ` where ${job.where}` : ""}`,
        ...(sort ? [`sorted by ${sort.by}${sort.direction === "desc" ? ", highest first" : ""}`] : []),
        ...(job.act ? [`then "${job.act}"`] : []),
      ].join(", ");
      lines.push(`  "${job.ask}" — ${answer}${job.roles && job.roles.length > 0 && !options.as ? ` (for ${list([...job.roles])})` : ""}.`);
    }
  }

  /*
   * WHAT IT DOES ON ITS OWN (Roadmap f-jobs-declared): each declared
   * workflow by name, in a sentence, paused or not, and its steps one to a
   * line. Dreaming, every app's own, is not declared and not said here.
   */
  const workflows = Object.entries(app.workflows ?? {});
  if (workflows.length > 0) {
    lines.push("", "## What it does on its own");
    const world = workflowWorldOfApp(app);
    for (const [name, declared] of workflows) {
      const workflow = resolveWorkflow(name, declared, world);
      lines.push(`  ${name} — ${workflow.words}${workflow.status === "paused" ? " (paused)" : ""}; its changes are ${workflow.approve === "apply" ? "applied" : workflow.approve === "suggest" ? "applied or suggested by how sure it is" : "asked about first"}.`);
      workflow.steps.forEach((step, at) => lines.push(`    ${at + 1}. ${stepKindOf(step)?.words(step) ?? "a step Graview does not run"}`));
    }
  }

  /*
   * THE OTHER WORDS PEOPLE USE (Roadmap f-learned-suggestions): "supplier"
   * for a vendor, "cost" for its price — what search finds a kind by and a
   * model is told, said once so a reader maps the people's words to the app's.
   */
  const otherWords = kinds.flatMap((kind) => {
    const definition = app.schema.tryDefinition(kind) as { aliases?: readonly string[]; fieldAliases?: Readonly<Record<string, readonly string[]>> } | undefined;
    const quoted = (words: readonly string[]) => list(words.map((word) => `"${word}"`));
    return [
      ...(definition?.aliases?.length ? [`  ${pluralOf(app.schema, kind)} are also called ${quoted(definition.aliases)}.`] : []),
      ...Object.entries(definition?.fieldAliases ?? {})
        .filter(([, words]) => words.length > 0)
        .map(([field, words]) => `  ${kind}'s ${field} is also called ${quoted(words)}.`),
    ];
  });
  if (otherWords.length > 0) lines.push("", "## Other words people use", ...otherWords);

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
          const at = everywhere.find((place) => place.slug === lens.as && (place.kind === lens.kinds[0] || (lens.kinds[0] !== undefined && place.over?.includes(lens.kinds[0]))));
          return `"${lens.title}" (the ${lens.lens} over ${list(lens.kinds.map((kind) => pluralOf(app.schema, kind)))}${lens.across ? ` across ${pluralOf(app.schema, lens.across)}` : ""}, at ${at?.address ?? placePath(lens.as)}${lens.hidden ? "; hidden: kept off the bar and the page list, reached by its address" : ""}${app.lenses?.[lens.index]?.export === false && listsRecords(lens.lens) ? "; offers nobody Export CSV" : ""})`;
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
    // Every list offers "Export CSV" (Roadmap f-view-export-csv) but those its declaration switches off.
    const unexported = Object.entries(app.pages.lists ?? {}).flatMap(([kind, one]) => (kinds.includes(kind) && one.export === false ? [kind] : []));
    if (unexported.length > 0) lines.push(`Offers nobody Export CSV on the list of: ${list(unexported)}.`);
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
    // How its list opens, where the declaration says (`pages.lists.<kind>.sort` and `.group`).
    const declared = app.pages?.lists?.[kind];
    const typeOf = (key: string) => {
      const type = offers.sorts.find((offer) => offer.key === key)?.type;
      if (type === "choice" || type === "boolean" || type === "number" || type === "date") return type;
      return app.schema.tryDefinition(kind)?.computed?.[key] !== undefined ? "number" : "text";
    };
    const opens = declared ? kindListWords(declared, typeOf) : {};
    if (opens.sort || opens.group) lines.push(`    Its list opens ${[opens.sort, opens.group].filter(Boolean).join(", ")}.`);
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
  /*
   * TEXT TYPED TOGETHER (Roadmap f-collab-text): which fields two people
   * type into at once, each keeping their words, and an agent's rewrite
   * merged into the typing rather than written over it.
   */
  const together = kinds.flatMap((kind) => Object.keys((app.schema.tryDefinition(kind)?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}).filter((field) => collaborativeFieldOf(app.schema, kind, field)).map((field) => `${kind}'s ${field}`));
  if (together.length > 0) {
    lines.push("", "## Typed together", `${capitalize(list(together))} ${together.length === 1 ? "is" : "are"} typed together: two people type at once and both keep their words, and a whole value written over one (an edit, an agent) is merged into what was typed since. Other fields are written whole.`);
  }

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
   * other is a city drawn in one color, which reads as a rendering fault
   * and is a declaration the author can change.
   */
  // The same answer `graview check` warns from (`brand-hues-crowded`): one source, so the two agree.
  const { hues, crowded } = crowdedHues(kinds, app.brand?.accents);
  lines.push(
    `Hues: ${hues.map((entry) => `${entry.kind} ${entry.hue}°`).join(", ")}.` +
      (crowded.length > 1 ? ` ${list(crowded)} are within ${HUE_CROWDING}° of each other and will read as one color.` : ""),
  );
  // THE APP'S LOCALE (FR-178), with what it makes of a day, a time and a figure, and the currency a sum is said in (FR-100).
  const locale = app.brand?.locale;
  lines.push(
    `Days, times and numbers are written for ${locale ?? `${DEFAULT_LOCALE}, the default`}: ${dayAsRead("2023-09-10", locale)}, ${timeAsRead("2023-09-10T15:30", locale)}, ${numberAsRead(1250, locale)}; ` +
      (app.brand?.currency ? `money is said in ${app.brand.currency} (${formatMoney(1250, { currency: app.brand.currency, ...(locale ? { locale } : {}) })}).` : "money is said with no currency."),
  );
  // THE APP'S TIME ZONE (Roadmap f-app-time-zone): what an instant reads as, on every reader's screen and in every act's sentence.
  const timeZone = app.brand?.timeZone;
  lines.push(
    timeZone
      ? `Times are said in ${timeZone}: 2023-09-10T19:30:00Z reads ${timeAsRead("2023-09-10T19:30:00Z", locale, timeZone)}, unless a host passes the person's own zone.`
      : "Times are said on each reader's own clock: brand.timeZone names one zone for everybody.",
  );

  /*
   * WHAT A SEAT CAN DO. A policy with roles and a principal holding none of
   * them refuses everything, and the app looks broken rather than guarded —
   * which is a whole product's worth of struck-through buttons and no
   * error anywhere.
   */
  // WHOSE RECORD A PRINCIPAL IS (Roadmap f-people-kind): what `$me`, `self`, `own`, `via` and `ownEnd` read.
  const people = app.schema.definitions.find((definition) => definition.people);
  if (people) {
    const noun = (people as { noun?: string }).noun ?? people.kind;
    lines.push("", "## The people", `The people are the ${pluralOf(app.schema, people.kind).toLowerCase()}: ${withArticle(noun)} whose id is a member's principal id is that member.`);
  }

  /*
   * HOW TWO RECORDS ARE LINKED (Roadmap f-relation-acts-derived): each
   * relation and the acts that make and break it — the app's own, or the
   * connect and disconnect every relation is given — so an agent reading
   * this knows which tool links a moment to its day.
   */
  const relationLines = app.schema.definitions.flatMap((definition) =>
    Object.entries(definition.edges as Readonly<Record<string, { readonly to: readonly string[] | "*"; readonly appendOnly?: boolean }>>).map(([relation, edge]) => {
      const by = (key: "connects" | "severs") => acts.filter((act) => act[key]?.includes(relation) && (act.derived === undefined || act.derived.kind === definition.kind)).map((act) => `"${act.name}"`);
      const made = by("connects");
      const unmade = by("severs");
      return `  ${capitalize(pluralOf(app.schema, definition.kind))} → ${edge.to === "*" ? "any record" : edge.to.join(" or ")} (${relation}): ${made.length > 0 ? `made by ${list(made)}` : "made by nothing"}, ${unmade.length > 0 ? `unmade by ${list(unmade)}` : edge.appendOnly ? "never unmade (append-only)" : "unmade by nothing"}.`;
    }),
  );
  if (relationLines.length > 0) lines.push("", "## How records are linked", ...relationLines);

  /*
   * WHAT AN ACT CARRIES ACROSS A LINK (Roadmap f-acts-update-linked): the
   * fields it also sets on the records its subject is linked to, so a reader
   * knows that renaming a plan item retitles its events — and that the act
   * is refused where one of those events is not theirs to change.
   */
  const carriedLines = declared.flatMap((act) =>
    Object.entries(act.writesLinked ?? {}).map(([relation, fields]) => {
      const kinds = subjectKindsOf(app.schema, act);
      const nouns = kinds.length > 0 ? list(kinds.map((kind) => pluralOf(app.schema, kind).toLowerCase())) : "its subject";
      return `  "${act.name}" also sets ${list([...fields])} on every record linked to ${nouns} through ${relation}, in the same change; it is refused, naming the record, where one of them is not the person's to change.`;
    }),
  );
  if (carriedLines.length > 0) lines.push("", "## Carried across links", ...carriedLines);

  /*
   * WHAT IT LINKS IN OTHER APPS (FR-171): a relation to another app's kind is
   * read there as the viewer, and linked by picking a record there — say
   * where it goes and how, since nothing of it is in this graph to see.
   */
  const linkedLines = app.schema.definitions.flatMap((definition) =>
    [...linkedRelations(definition)].map(([name, relation]) => `  ${pluralOf(app.schema, definition.kind)}: ${linkedRelationWords(name, relation, acts.some((act) => act.name === `edit-${definition.kind}`) ? `edit-${definition.kind}` : undefined)}.`),
  );
  if (linkedLines.length > 0) {
    lines.push("", "## Linked from other apps", "Each is a record in another app, read there as whoever is looking; one they may not open reads \"linked record (no access)\" and nothing of it. The other app is never changed by linking.", ...linkedLines);
  }

  // WHAT IS NEVER SET ASIDE (FR-173): a kind whose records are kept or removed has no archive, unarchive or merge.
  const kept = app.schema.definitions.filter((definition) => definition.archives === false).map((definition) => pluralOf(app.schema, definition.kind).toLowerCase());
  if (kept.length > 0) {
    lines.push("", "## Never archived", `${capitalize(list(kept))} are kept or removed, never archived or merged: no archive-, unarchive- or merge- act is offered on them.`);
  }

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

  // WHEN EDITS REACH READERS (Roadmap f-publishing-lifecycle): said only of an app that publishes; a live app is as every app was.
  if (app.publishing?.mode === "on-publish") {
    const publishers = app.publishing.publishers ?? app.publishing.working;
    lines.push(
      "",
      "## Publishing",
      `Edits reach readers when they are published. ${capitalize(list([...app.publishing.working]) || "nobody")} edit live and see every change as it is made; everyone else — visitors, embeds, static pages, other apps' linked reads — is served the app as it stood at the last publish. ${capitalize(list([...publishers]) || "nobody")} may publish ("publish") and take a publish back (undo it). What a reader sends lands at once, and reaches readers with the next publish.`,
    );
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
  // And the whole graph's facts: one value each, worked out over all of what the reader may see.
  const facts = [...computedOf(app.schema)].map(([name, entry]) => `fact('${name}')${entry.label ? ` (${entry.label})` : ""}: ${entry.expr}`);
  if (worked.length > 0 || facts.length > 0) {
    lines.push("", "## Worked out");
    if (worked.length > 0) lines.push("Computed fields: read like fields, written by nothing, worked out from what the reader may see.");
    for (const line of worked) lines.push(`  ${line}`);
    if (facts.length > 0) lines.push("Facts of the whole graph: read as fact('<name>') in any expression, written by nothing, worked out from what the reader may see.");
    for (const line of facts) lines.push(`  ${line}`);
  }

  /*
   * WHAT A NUMBER IS. A field marked money is said "$10,000" on every face
   * and is kept as 10000; an agent that knows so sets 10000, never the
   * words, and says it back as money. A percent is kept as a fraction.
   */
  const amounts = kinds.flatMap((kind) => {
    const definition = app.schema.tryDefinition(kind);
    const shape = ((definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}) as Record<string, unknown>;
    return Object.entries(shape).flatMap(([name, field]) => {
      const marked = amountOf(field);
      if (!marked) return [];
      const mark = amountMark(marked);
      const example = mark.format === "percent" ? 0.15 : 1250.5;
      const said = sayAmount(example, mark);
      return [`${kind} · ${name}: ${amountSentence(mark)} ${example} is said "${said}".`];
    });
  });
  if (amounts.length > 0) {
    lines.push("", "## Amounts");
    lines.push("Kept as plain numbers and said as their fields declare on every face: set the number, never the words.");
    for (const line of amounts) lines.push(`  ${line}`);
  }

  /*
   * WHAT A KIND SAYS OF ITSELF: its natural time and its author, which a
   * list opens newest first by and a glance leads with, and the rest of its
   * roles, which a lens reads where it binds none.
   */
  const roled = kinds.flatMap((kind) => {
    const roles = Object.entries(app.schema.tryDefinition(kind)?.fieldRoles ?? {});
    return roles.length === 0 ? [] : [`${kind}: ${roles.map(([role, field]) => `${role} is ${field}`).join(", ")}`];
  });
  if (roled.length > 0) {
    lines.push("", "## Field roles");
    for (const line of roled) lines.push(`  ${line}`);
  }

  /* WHAT IS JUDGED. A rule with no repair is a problem a person is told about and cannot fix. */
  const invariants = app.invariants ?? [];
  lines.push("", "## What is judged");
  if (invariants.length === 0) lines.push("No rules. Nothing about this graph can be wrong.");
  for (const invariant of invariants) {
    const scope = invariant.scope === "graph" ? "the whole graph" : `each ${withArticle((invariant.scope as { kind: string }).kind).slice(2)}`;
    // Its shape, where it has one, as a person reads it on the page: "margin ≥ target margin, when price > $0".
    const line = ruleLine(invariant, app.schema as AnySchema);
    const shape = line ? `: ${ruleLineWords(line)}` : "";
    lines.push(
      `${invariant.name} over ${scope}${shape} — ${
        invariant.repairs?.length ? `repairs with ${list([...invariant.repairs])}` : "NO REPAIR: a person is told and cannot act"
      }.`,
    );
  }

  return lines.join("\n");
}
