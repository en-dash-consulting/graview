import { arrange, arrangeable } from "@graview/core/arrange";
import { fieldWords, humaniseField, type AnySchema, type ArrangeGraph, type ArrangeNode, type DateBucket, type GraphReader } from "@graview/core";
import { aggregateId, BAND_PREFIX, isBandAggregate } from "./ids.js";
export { BAND_PREFIX, isBandAggregate } from "./ids.js";
import type { Aggregate, Opens, Via } from "./types.js";

/*
 * THE BAND DRAWS WHAT A PERSON CAN READ (docs/scale.md).
 *
 * The relation band held every neighbour of the focus: an artist with 1,100
 * songs put 1,100 cards in it, wrapped into rows whose height went negative,
 * each with a line, and the scene fell to a frame a second. The band has a
 * budget from the room it has — cards of a readable width, at most two rows
 * — and below it nothing changes. Above it each relation (a run of one edge
 * kind in one direction) gets a share, and a run that does not fit its share
 * is GROUPED by what its members' own declaration offers: another edge's far
 * end, a choice, a date by the decade or the year. A group is an aggregate —
 * the layout's own "a group standing in for its members" — named in the
 * graph's words with a true count, opened in place by the `expanded` stop.
 * When no grouping reads, the most relevant stand as themselves and one
 * "+N more" is a door to the kind's picture, filtered by the relation, where
 * the row and the search make any number of them browsable.
 */

/** What makes a member stand as itself when not all can. */
export interface Relevance {
  /** The selection, and what it reaches. */
  readonly chosen?: ReadonlySet<string>;
  /** What the search found. */
  readonly hits?: ReadonlySet<string>;
  /** What the rules implicate. */
  readonly flagged?: ReadonlySet<string>;
  /** Recently written, by the op log (`touchWeights`). */
  readonly touched?: ReadonlyMap<string, number>;
}

export interface BandAggregate extends Aggregate {
  readonly opens: Opens;
}

export interface BandItem<N extends ArrangeNode> {
  readonly id: string;
  readonly kind: string;
  readonly node?: N;
  readonly via?: Via;
  readonly aggregate?: BandAggregate;
}

export interface Related<N> {
  readonly node: N;
  readonly via?: Via;
}

export interface BandOptions<N extends ArrangeNode> {
  readonly schema: AnySchema;
  readonly graph: GraphReader<N>;
  /** Cards the band can hold legibly. */
  readonly budget: number;
  /** The focus the band is about: the far ends' filter for "+N more". */
  readonly focusId: string | undefined;
  readonly expanded: ReadonlySet<string>;
  readonly relevance?: Relevance;
  /** The stop's selection: it stands as itself before anything else. */
  readonly selection?: readonly string[];
  readonly plural: (kind: string) => string;
  readonly today?: string;
}

/** A band aggregate's id: the kind, the relation, and which part of it. */
const runKey = (via: Via | undefined, kind: string) => (via ? `${via.edgeKind}|${via.direction}` : `raised|${kind}`);
const groupId = (kind: string, run: string, part: string) => `${BAND_PREFIX}${kind}|${run}|${part}`;


/**
 * A band aggregate in words: "Albums — released by, type: album". Its id is
 * the picture's own bookkeeping (`aggregate:album|released-by|in|type=album`)
 * and was what the seat called it, in its header and to a screen reader.
 */
export function bandAggregateWords(id: string, schema: AnySchema): string | null {
  if (!isBandAggregate(id)) return null;
  const [kind = "", first = "", second = "", part = ""] = id.slice(BAND_PREFIX.length).split("|");
  const definition = schema.definitions.find((one) => one.kind === kind);
  const plural = definition?.plural ?? humaniseField(`${kind}s`);
  const relation =
    first === "raised"
      ? null
      : (() => {
          const declared = schema.definitions.map((one) => one.edges[first]).find(Boolean);
          const said = second === "in" ? declared?.inverse : declared?.description;
          return (said ?? humaniseField(first)).toLowerCase();
        })();
  const [by = "", key = ""] = part.split("=");
  const field = by.split(":")[0]!;
  const detail =
    part === "" || part === "kind" || part.startsWith("more")
      ? null
      : `${fieldWords(definition, field).toLowerCase()}: ${key === "none" ? "none" : key}`;
  const more = part.startsWith("more") ? `More ${plural.toLowerCase()}` : plural;
  return [more, [relation, detail].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
}

/**
 * The share each run of the band gets: none below one, the small runs whole,
 * the rest divided among the big ones — water-filling, so a relation of
 * three is never squeezed to make room for a relation of a thousand.
 */
export function shares(sizes: readonly number[], budget: number): number[] {
  const out = sizes.map(() => 0);
  const order = sizes.map((size, index) => ({ size, index })).sort((a, b) => a.size - b.size || a.index - b.index);
  let left = Math.max(budget, sizes.length);
  let runs = sizes.length;
  for (const { size, index } of order) {
    const fair = Math.max(1, Math.floor(left / runs));
    out[index] = Math.min(size, fair);
    left -= out[index]!;
    runs -= 1;
  }
  return out;
}

/** The relation a related node is on: one edge kind in one direction, or a raised kind. */
export function runOf(entry: { readonly node: { readonly kind: string }; readonly via?: Via | undefined }): string {
  return runKey(entry.via, entry.node.kind);
}

/*
 * A CROWDED BAND IS LAID OUT BY RELATION (docs/scale.md, "What a crowd
 * taught the band"). Relations filled one grid in turn, so a relation began
 * wherever the last one ended — mid-row — and its caption, hung in the
 * gutter above its first card, sat on the cards of the row before. A
 * relation starts its own row unless all of it fits in what is left of the
 * current one; then every caption has open ground above it.
 */

/** Rows of `perRow`, each relation in order starting a row unless it fits the rest of the current one. */
export function packRuns(counts: readonly number[], perRow: number): number[][] {
  const rows: number[][] = [];
  let left = 0;
  counts.forEach((count, run) => {
    if (count <= 0) return;
    if (rows.length > 0 && count <= left) {
      for (let i = 0; i < count; i++) rows[rows.length - 1]!.push(run);
      left -= count;
      return;
    }
    let rest = count;
    while (rest > 0) {
      const take = Math.min(perRow, rest);
      rows.push(Array.from({ length: take }, () => run));
      rest -= take;
      left = perRow - take;
    }
  });
  return rows;
}

/**
 * The cards each relation may draw so that, packed by relation, the band
 * holds `rows` rows of `perRow`: water-filled as `shares` does, then the
 * largest trimmed until the packing fits. Arithmetic only — the band is
 * planned once, not tried.
 */
export function bandCaps(sizes: readonly number[], perRow: number, rows: number): number[] {
  const caps = shares(sizes, perRow * rows);
  while (packRuns(caps, perRow).length > rows) {
    let largest = -1;
    caps.forEach((cap, index) => {
      if (cap > 1 && (largest < 0 || cap > caps[largest]!)) largest = index;
    });
    if (largest < 0) break;
    caps[largest] = caps[largest]! - 1;
  }
  return caps;
}

/** Relevance as a sort key: lower first. Deterministic, stable by the given order. */
function byRelevance<N extends ArrangeNode>(members: readonly N[], relevance: Relevance, graph: GraphReader<N>): N[] {
  const score = (node: N) => [
    relevance.chosen?.has(node.id) ? 0 : 1,
    relevance.hits?.has(node.id) ? 0 : 1,
    relevance.flagged?.has(node.id) ? 0 : 1,
    -(relevance.touched?.get(node.id) ?? 0),
    -graph.neighbors(node.id).length,
  ];
  return members
    .map((node, index) => ({ node, index, key: score(node) }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i]! - b.key[i]!;
      return a.index - b.index;
    })
    .map((entry) => entry.node);
}

/** How many groups a glance takes in: a grouping nearer this reads best. */
const READABLE_GROUPS = 5;

/** Lexicographic: whether `a` sorts before `b`. */
const before = (a: readonly number[], b: readonly number[]): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
};

interface Grouping {
  readonly by: string;
  readonly bucket?: DateBucket;
  readonly groups: readonly { readonly key: string; readonly label: string; readonly nodes: readonly ArrangeNode[] }[];
}

/**
 * The best grouping of one kind's members into at most `share` groups, from
 * what the kind's declaration offers — never the relation's own edge (every
 * song on this band is BY the focus), never one group holding everything,
 * and only when most of them are in a named group rather than "none".
 */
export function chooseGrouping<N extends ArrangeNode>(
  members: readonly N[],
  share: number,
  options: { readonly schema: AnySchema; readonly graph: GraphReader<N>; readonly exclude?: string; readonly today?: string },
): Grouping | undefined {
  if (members.length === 0 || share < 2) return undefined;
  const kind = members[0]!.kind;
  const ctx = { schema: options.schema, graph: options.graph as unknown as ArrangeGraph, ...(options.today ? { today: options.today } : {}) };
  const candidates: { by: string; bucket?: DateBucket }[] = [];
  for (const offer of arrangeable(options.schema, kind).groups) {
    if (offer.key === options.exclude) continue;
    if (offer.buckets) for (const bucket of ["decade", "year", "month"] as const) candidates.push({ by: offer.key, bucket });
    else candidates.push({ by: offer.key });
  }
  let best: { grouping: Grouping; score: number[] } | undefined;
  candidates.forEach((candidate, order) => {
    const arranged = arrange(members, { group: candidate }, ctx);
    const groups = arranged.groups;
    if (groups.length < 2 || groups.length > share) return;
    const named = groups.filter((group) => group.key !== "").reduce((sum, group) => sum + group.nodes.length, 0);
    const coverage = named / members.length;
    if (coverage < 0.5) return;
    /*
     * Not one group holding nearly all of them either. An album's songs by
     * artist were "Tech N9ne, 38 songs" and six cards of "1 song": a
     * grouping that says what everyone already knew, in seven cards that
     * could have been seven songs.
     */
    if (groups.some((group) => group.nodes.length > members.length * 0.75)) return;
    // Most in named groups, then nearest the five a glance takes in, then the declaration's order.
    const score = [-Math.round(coverage * 100), Math.abs(groups.length - READABLE_GROUPS), order];
    if (!best || before(score, best.score)) {
      best = { grouping: { by: candidate.by, ...(candidate.bucket ? { bucket: candidate.bucket } : {}), groups }, score };
    }
  });
  return best?.grouping;
}

/**
 * What the band draws: every related node when they fit; otherwise each
 * relation within its share, as itself, as groups, or as the most relevant
 * and one "+N more". Expanded groups stand open, their members within the
 * relation's share.
 */
export function bandOf<N extends ArrangeNode>(related: readonly Related<N>[], options: BandOptions<N>): BandItem<N>[] {
  const whole = (entry: Related<N>): BandItem<N> => ({ id: entry.node.id, kind: entry.node.kind, node: entry.node, ...(entry.via ? { via: entry.via } : {}) });
  if (related.length <= options.budget) return related.map(whole);

  const relevance: Relevance = {
    ...options.relevance,
    chosen: new Set([...(options.relevance?.chosen ?? []), ...(options.selection ?? [])]),
  };
  const runs = new Map<string, Related<N>[]>();
  for (const entry of related) {
    const key = runKey(entry.via, entry.node.kind);
    const run = runs.get(key);
    if (run) run.push(entry);
    else runs.set(key, [entry]);
  }

  /*
   * THE CARDS EACH RELATION GETS. Small relations stand whole; the rest are
   * planned by what they can be: groups, when their declaration offers a
   * grouping that reads, or one door. What is left over goes to the most
   * relevant members standing beside a door, or inside an opened group.
   */
  type Plan = {
    key: string;
    run: Related<N>[];
    via: Via | undefined;
    kinds: string[];
    members: N[];
    whole: boolean;
    grouping?: Grouping | undefined;
    byKind?: boolean;
    extra: number;
  };
  const plans: Plan[] = [...runs.entries()].map(([key, run]) => ({
    key,
    run,
    via: run[0]!.via,
    kinds: [...new Set(run.map((entry) => entry.node.kind))],
    members: [],
    whole: false,
    extra: 0,
  }));
  const fair = shares(plans.map((plan) => plan.run.length), options.budget);
  plans.forEach((plan, index) => (plan.whole = plan.run.length <= fair[index]!));
  const over = plans.filter((plan) => !plan.whole);
  const standingWhole = plans.filter((plan) => plan.whole).reduce((sum, plan) => sum + plan.run.length, 0);
  let room = Math.max(over.length, options.budget - standingWhole);
  for (const plan of over) {
    plan.members = byRelevance(plan.run.map((entry) => entry.node), relevance, options.graph);
    const most = room - (over.length - 1);
    if (plan.kinds.length > 1 && plan.kinds.length <= most) plan.byKind = true;
    else if (plan.kinds.length === 1)
      plan.grouping = chooseGrouping(plan.members, most, {
        schema: options.schema,
        graph: options.graph,
        ...(plan.via ? { exclude: plan.via.edgeKind } : {}),
        ...(options.today ? { today: options.today } : {}),
      });
  }
  const need = (plan: Plan) => (plan.byKind ? plan.kinds.length : plan.grouping ? plan.grouping.groups.length : 1);
  // Too many cards in all: the biggest groupings give way to a door.
  while (over.reduce((sum, plan) => sum + need(plan), 0) > room) {
    const biggest = [...over].filter((plan) => need(plan) > 1).sort((a, b) => need(b) - need(a))[0];
    if (!biggest) break;
    biggest.grouping = undefined;
    biggest.byKind = false;
  }
  room -= over.reduce((sum, plan) => sum + need(plan), 0);
  // The rest of the room: to a door's standing members, or into an opened group.
  const opened = (plan: Plan) =>
    plan.byKind
      ? plan.kinds.some((kind) => options.expanded.has(groupId(kind, plan.key, "kind")))
      : plan.grouping?.groups.some((group) => options.expanded.has(groupId(plan.kinds[0]!, plan.key, partOf(plan.grouping!, group.key))));
  const taking = over.filter((plan) => !plan.grouping && !plan.byKind ? true : opened(plan));
  const extra = shares(taking.map((plan) => plan.members.length), Math.max(0, room));
  taking.forEach((plan, index) => (plan.extra = room > 0 ? extra[index]! : 0));

  const out: BandItem<N>[] = [];
  for (const plan of plans) {
    const { key, via } = plan;
    if (plan.whole) {
      out.push(...plan.run.map(whole));
      continue;
    }
    const stand = (node: N): BandItem<N> => ({ id: node.id, kind: node.kind, node, ...(via ? { via } : {}) });
    /*
     * THE REST: the most relevant stand; one door holds the others. Relevance
     * decides WHO stands, never WHERE: the standing keep the relation's own
     * order, so selecting a card does not send it jumping to the front.
     */
    const natural = new Map(plan.run.map((entry, at) => [entry.node.id, at]));
    const rest = (members: readonly N[], standing: number, filter: string | undefined): void => {
      const picked = [...members.slice(0, standing)].sort((a, b) => natural.get(a.id)! - natural.get(b.id)!);
      out.push(...picked.map(stand));
      const held = members.slice(standing);
      if (held.length === 0) return;
      const kind = held[0]!.kind;
      out.push({
        id: groupId(kind, key, filter ? `more:${filter}` : "more"),
        kind,
        ...(via ? { via } : {}),
        aggregate: {
          kind,
          memberIds: held.map((node) => node.id),
          label: standing > 0 ? `${held.length} more ${options.plural(kind).toLowerCase()}` : `${held.length} ${options.plural(kind).toLowerCase()}`,
          opens: { in: "picture", focus: aggregateId(kind), within: filter ? { filter } : {} },
        },
      });
    };
    const relationFilter = via && options.focusId ? `${via.edgeKind}:${options.focusId}` : undefined;

    /* A RUN OF SEVERAL KINDS is grouped by kind first: that is what it is. */
    if (plan.byKind) {
      // An opened kind takes its card's place with its members, as many as the room gives.
      const open = plan.kinds.find((kind) => options.expanded.has(groupId(kind, key, "kind")));
      for (const kind of plan.kinds) {
        const ofKind = plan.members.filter((node) => node.kind === kind);
        if (kind === open) {
          const fits = plan.extra + 1;
          if (ofKind.length <= fits) out.push(...ofKind.map(stand));
          else rest(ofKind, fits - 1, relationFilter);
          continue;
        }
        out.push({ id: groupId(kind, key, "kind"), kind, ...(via ? { via } : {}), aggregate: { kind, memberIds: ofKind.map((node) => node.id), label: options.plural(kind), opens: { in: "place" } } });
      }
      continue;
    }
    const grouping = plan.grouping;
    if (!grouping) {
      rest(plan.members, plan.extra, relationFilter);
      continue;
    }
    const kind = plan.kinds[0]!;
    const open = grouping.groups.find((group) => options.expanded.has(groupId(kind, key, partOf(grouping, group.key))));
    for (const group of grouping.groups) {
      if (group === open) {
        const inside = plan.members.filter((node) => group.nodes.includes(node));
        // The opened group's place in the row takes its members, as many as the room gives.
        const fits = plan.extra + 1;
        if (inside.length <= fits) out.push(...inside.map(stand));
        else {
          const single = group.key !== "" && !group.key.includes(",") && !grouping.bucket;
          const filter = [relationFilter, single ? `${grouping.by}:${group.key}` : undefined].filter(Boolean).join(",") || undefined;
          rest(inside, fits - 1, filter);
        }
        continue;
      }
      out.push({
        id: groupId(kind, key, partOf(grouping, group.key)),
        kind,
        ...(via ? { via } : {}),
        aggregate: {
          kind,
          // Relevance order inside the group too: the names a card shows first are the ones worth seeing.
          memberIds: plan.members.filter((node) => group.nodes.includes(node)).map((node) => node.id),
          // A value reads as a word: "Single", not the enum's "single".
          label: group.label.charAt(0).toUpperCase() + group.label.slice(1),
          opens: { in: "place" },
        },
      });
    }
  }
  return out;
}

/** A group's part of its id: what it is grouped by, and which value. */
const partOf = (grouping: Grouping, key: string) => `${grouping.by}${grouping.bucket ? `:${grouping.bucket}` : ""}=${key || "none"}`;
