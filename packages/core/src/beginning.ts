import type { GraviewApp } from "./app.js";
import { deriveEditMutations } from "./mutations/derive-edits.js";
import { nodeRefArgs } from "./mutations/node-ref.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { AnySchema } from "./schema/schema.js";

/**
 * THE ORDER THINGS MUST BE MADE IN, WHICH THE DECLARATION ALREADY STATES.
 *
 * `creates: ["feature"]` on an act, and `zoneId: nodeRef(["zone"])` in its
 * input, are together a dependency graph over kinds: a feature cannot be
 * made until a zone exists. Every app declares this and, until now, one
 * place read it — the affordance derivation, withholding a single act whose
 * picker would be empty.
 *
 * Read whole it is the whole of onboarding:
 *
 *   - WHICH KINDS CAN BEGIN on an empty graph, and which single act is the
 *     only way in. A blank installation of a ten-kind app has one door and
 *     seven silent districts, and nobody ever sees that but the first person
 *     to open it.
 *   - THE ORDER TO ASK IN. Ground before features; practices before the
 *     routines that apply them.
 *   - THE ORDER TO APPLY IN. A model proposing forty calls should not have
 *     to sort them, and a runtime that applies them in the order they
 *     arrived fails on the first one that names something not yet made.
 *   - WHAT IS UNREACHABLE. A kind no act creates cannot arrive at all, which
 *     is a legitimate design (a kind a migration seeds, a kind a module
 *     owns) and one the author should have to look at once.
 *
 * It is read from the DECLARATION alone — no graph, no store. What can be
 * done on a particular graph is `deriveAffordances`' question, and this is
 * the question underneath it: what could ever be done at all, and in what
 * order.
 */

export interface KindBeginning {
  readonly kind: string;
  /** Acts that create this kind, by name. */
  readonly madeBy: readonly string[];
  /**
   * Kinds an act must be handed before it can make this one, as the union
   * over every act that makes it: the cheapest way in is what matters, so a
   * kind with two doors needs whichever door is open.
   */
  readonly needs: readonly string[];
  /**
   * How many kinds must exist first, along the shortest chain. 0 is a kind
   * that can begin on an empty graph; `null` is one nothing can make.
   */
  readonly depth: number | null;
}

export interface Beginning {
  /**
   * Every kind, in the order a blank installation can fill them: by depth,
   * then by how many other kinds wait on it (most first), then by name.
   */
  readonly order: readonly KindBeginning[];
  /** Kinds that can be made with nothing in the graph at all, the one that opens most first. */
  readonly roots: readonly string[];
  /** The acts that make those kinds: the doors into an empty installation. */
  readonly doors: readonly string[];
  /**
   * Kinds no act can ever make, with why — nothing creates them, or
   * everything that does needs something that is itself unreachable.
   */
  readonly unreachable: readonly { readonly kind: string; readonly why: string }[];
}

/** Every act the app has, declared and derived alike. */
function actsOf<S extends AnySchema>(app: GraviewApp<S>): readonly AnyMutationDefinition<S>[] {
  return [...(app.mutations ?? []), ...deriveEditMutations(app.schema, app.mutations ?? [])];
}

export function beginning<S extends AnySchema>(app: GraviewApp<S>): Beginning {
  const kinds = [...(app.schema.kinds as readonly string[])];
  const acts = actsOf(app);

  /** What each act must be handed, as kinds, ignoring optional arguments. */
  const requires = new Map<string, readonly string[]>();
  /** What each act makes. */
  const makes = new Map<string, readonly string[]>();
  for (const act of acts) {
    makes.set(act.name, (act.creates ?? []) as readonly string[]);
    const wanted = nodeRefArgs(act.input)
      .filter((arg) => !arg.optional && !arg.kinds.includes("*"))
      .flatMap((arg) => arg.kinds);
    requires.set(act.name, [...new Set(wanted)]);
  }

  const madeBy = new Map<string, string[]>();
  for (const kind of kinds) madeBy.set(kind, []);
  for (const act of acts) {
    for (const kind of makes.get(act.name) ?? []) madeBy.get(kind)?.push(act.name);
  }

  /*
   * THE SHORTEST CHAIN TO EACH KIND, by widening the set of what exists.
   *
   * Start with nothing; take every act whose required kinds are all present;
   * whatever they make now exists, at this depth. Repeat until a pass adds
   * nothing. Kinds left over are unreachable — which includes an act whose
   * only door needs a kind only IT can make, a cycle nobody can enter.
   */
  const depth = new Map<string, number>();
  const present = new Set<string>();
  for (let round = 0; ; round += 1) {
    const arrived: string[] = [];
    for (const act of acts) {
      const wants = requires.get(act.name) ?? [];
      if (!wants.every((kind) => present.has(kind))) continue;
      for (const kind of makes.get(act.name) ?? []) {
        if (!present.has(kind)) arrived.push(kind);
      }
    }
    if (arrived.length === 0) break;
    for (const kind of arrived) {
      present.add(kind);
      depth.set(kind, round);
    }
  }

  const needsOf = (kind: string): readonly string[] => {
    const doors = madeBy.get(kind) ?? [];
    if (doors.length === 0) return [];
    /* The cheapest door decides, because one open door is enough. */
    const cheapest = doors
      .map((name) => requires.get(name) ?? [])
      .sort((a, b) => a.length - b.length)[0]!;
    return [...new Set(cheapest)].filter((wanted) => wanted !== kind);
  };

  /*
   * WHAT EACH KIND OPENS: how many other kinds wait on it, through any chain
   * of needs. Among kinds that can be made at the same depth, the one that
   * unlocks the most is the one to ask for first — a yard every batch,
   * piece of equipment and shift stands in comes before the batch, not
   * after it because "b" sorts before "y".
   */
  const waitsOn = new Map<string, Set<string>>();
  const reach = (kind: string): Set<string> => {
    const known = waitsOn.get(kind);
    if (known) return known;
    const all = new Set<string>();
    waitsOn.set(kind, all);
    for (const needed of needsOf(kind)) {
      all.add(needed);
      for (const further of reach(needed)) all.add(further);
    }
    all.delete(kind);
    return all;
  };
  const opens = new Map<string, number>(kinds.map((kind) => [kind, 0]));
  for (const kind of kinds) {
    for (const needed of reach(kind)) opens.set(needed, (opens.get(needed) ?? 0) + 1);
  }

  const order: KindBeginning[] = kinds
    .map((kind) => ({
      kind,
      madeBy: [...(madeBy.get(kind) ?? [])].sort(),
      needs: [...needsOf(kind)].sort(),
      depth: depth.get(kind) ?? null,
    }))
    .sort(
      (a, b) =>
        (a.depth ?? Number.MAX_SAFE_INTEGER) - (b.depth ?? Number.MAX_SAFE_INTEGER) ||
        (opens.get(b.kind) ?? 0) - (opens.get(a.kind) ?? 0) ||
        a.kind.localeCompare(b.kind),
    );

  const roots = order.filter((entry) => entry.depth === 0).map((entry) => entry.kind);
  const doors = [
    ...new Set(
      acts
        .filter((act) => (requires.get(act.name) ?? []).length === 0)
        .filter((act) => (makes.get(act.name) ?? []).length > 0)
        .map((act) => act.name),
    ),
  ].sort();

  const unreachable = order
    .filter((entry) => entry.depth === null)
    .map((entry) => ({
      kind: entry.kind,
      why:
        entry.madeBy.length === 0
          ? "no act declares that it creates this kind"
          : `every act that makes it needs ${entry.needs
              .map((kind) => `"${kind}"`)
              .join(", ")}, which nothing can make first`,
    }));

  return { order, roots, doors, unreachable };
}
