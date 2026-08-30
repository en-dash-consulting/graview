import {
  defineInvariant,
  type GraphReader,
  type InvariantDefinition,
  type Repair,
  type Violation,
} from "@graview/core";
import type { LauncherSchema } from "./schema.js";

type LInvariant = InvariantDefinition<LauncherSchema>;
type AnyNode = { id: string; kind: string } & Record<string, unknown>;
type Reader = GraphReader<AnyNode>;

/**
 * Three rules about the FRAMEWORK, held by the framework.
 *
 * The launcher is the only app here whose subject is Graview itself, so it is
 * the only one that can ask whether Graview is earning its keep. These are
 * uncomfortable questions on purpose — one of them fires today, about a lens
 * I wrote last, and the honest thing is to let it say so on screen rather
 * than to soften the rule until it passes.
 */

const nodesOf = (graph: Reader, kind: string): AnyNode[] =>
  graph.allNodes().filter((node) => node.kind === kind);

const labelOf = (node: AnyNode | undefined): string =>
  node && "label" in node ? String(node["label"]) : (node?.id ?? "?");

/** Apps exercising a capability. */
const usersOf = (graph: Reader, capabilityId: string): AnyNode[] =>
  graph.in(capabilityId, "uses");

/**
 * A capability nothing uses is a feature carrying its own weight and
 * nobody's — maintained, documented, and paid for by every future change.
 */
export const everyCapabilityIsEarned: LInvariant = defineInvariant<LauncherSchema, "rule">(
  "every-capability-is-earned",
  {
    scope: { kind: "rule", match: (node) => node.spec.type === "every-capability-is-earned" },
    label: "Every capability is earned",
    description: "A framework capability no app uses is weight without a reason.",
    repairs: ["retire-capability", "justify"],
    evaluate({ graph, subject }) {
      const reader = graph as Reader;
      return nodesOf(reader, "capability")
        .filter((item) => usersOf(reader, item.id).length === 0)
        // A capability someone has written a reason for is a deliberate bet,
        // not an oversight. The rule respects an argument; it just insists
        // there is one.
        .filter((item) => reader.in(item.id, "justifies").length === 0)
        .map(
          (item): Violation => ({
            invariant: "every-capability-is-earned",
            subjectId: subject.id,
            label: subject.label,
            message: `No app uses ${labelOf(item)} — it is being maintained for nobody`,
            nodeIds: [item.id],
            repairs: [
              {
                mutation: "justify",
                args: { id: item.id },
                missing: ["text"],
                label: `Say why ${labelOf(item)} is worth keeping`,
              },
              {
                mutation: "retire-capability",
                args: { id: item.id },
                label: `Stop tracking ${labelOf(item)}`,
              },
            ],
          }),
        );
    },
  },
);

/**
 * The rule this whole exercise has been arguing for out loud.
 *
 * A lens with one user is not a lens, it is a component that happens to live
 * in the framework — and the only way to find out is to point it at a second
 * domain. Two of the three lenses passed that test by being reused; the
 * newest has not yet, and the launcher says so rather than pretending.
 */
export const aLensNeedsTwoUsers: LInvariant = defineInvariant<LauncherSchema, "rule">(
  "a-lens-needs-two-users",
  {
    scope: { kind: "rule", match: (node) => node.spec.type === "a-lens-needs-two-users" },
    label: "A lens needs two users",
    description: "A lens used by one app is unproven: it may only fit the app it was written beside.",
    repairs: ["justify"],
    evaluate({ graph, subject }) {
      const reader = graph as Reader;
      return nodesOf(reader, "capability")
        .filter((item) => item["area"] === "lens")
        .map((item) => ({ item, users: usersOf(reader, item.id) }))
        .filter(({ item, users }) => users.length === 1 && reader.in(item.id, "justifies").length === 0)
        .map(
          ({ item, users }): Violation => ({
            invariant: "a-lens-needs-two-users",
            subjectId: subject.id,
            label: subject.label,
            message: `Only ${labelOf(users[0])} uses ${labelOf(item)} — one user does not prove a lens`,
            nodeIds: [item.id, users[0]!.id],
            repairs: [
              {
                mutation: "justify",
                args: { id: item.id },
                missing: ["text"],
                label: `Record why ${labelOf(item)} is general anyway`,
              } satisfies Repair,
            ],
          }),
        );
    },
  },
);

/** An app declaring no lens is drawing its main picture by hand. */
export const everyAppUsesALens: LInvariant = defineInvariant<LauncherSchema, "rule">(
  "every-app-uses-a-lens",
  {
    scope: { kind: "rule", match: (node) => node.spec.type === "every-app-uses-a-lens" },
    label: "Every app uses a lens",
    description: "An app with no lens is drawing its primary view by hand.",
    repairs: ["justify"],
    evaluate({ graph, subject }) {
      const reader = graph as Reader;
      return nodesOf(reader, "app")
        .filter(
          (item) =>
            reader.out(item.id, "uses").filter((used) => used["area"] === "lens").length === 0,
        )
        .map(
          (item): Violation => ({
            invariant: "every-app-uses-a-lens",
            subjectId: subject.id,
            label: subject.label,
            message: `${labelOf(item)} declares no lens, so its main picture is bespoke`,
            nodeIds: [item.id],
            repairs: [
              {
                mutation: "justify",
                args: { id: item.id },
                missing: ["text"],
                label: `Say why ${labelOf(item)} needs none`,
              },
            ],
          }),
        );
    },
  },
);

export const launcherInvariants: LInvariant[] = [
  everyCapabilityIsEarned,
  aLensNeedsTwoUsers,
  everyAppUsesALens,
];
