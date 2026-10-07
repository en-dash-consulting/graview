import {
  bindSchema,
  labelOf,
  type GraphReader,
  type InvariantDefinition,
  type Repair,
  type Violation,
} from "@graview/core";
import { rotaSchema, type RotaSchema } from "./schema.js";

const { defineInvariant } = bindSchema(rotaSchema);
type AnyNode = { id: string; kind: string } & Record<string, unknown>;
type Reader = GraphReader<AnyNode>;
type I = InvariantDefinition<RotaSchema>;

const name = (node: AnyNode | undefined): string =>
  node ? labelOf(rotaSchema.tryDefinition(node.kind), node) : "something";
const nodesOf = (graph: Reader, kind: string): AnyNode[] =>
  graph.allNodes().filter((node) => node.kind === kind);

/**
 * The two things an organizer actually worries about, as rules that name
 * the acts that put them right.
 *
 * This is the seam the whole interface rides on: nobody writes "offer to
 * cover this shift" anywhere. The rule says what is wrong and which act
 * resolves it, and the strip, the pointer menu, the routed face's inbox and
 * an agent's tool list all derive the rest.
 */

/** A shift nobody is covering is the only thing a rota is really for. */
export const everyShiftCovered: I = defineInvariant("every-shift-covered", {
  scope: { kind: "rule", match: (node) => node.spec.type === "every-shift-covered" },
  label: "Every shift is covered",
  description: "A shift nobody has taken on is the one thing a roster exists to find.",
  repairs: ["cover", "drop-shift"],
  evaluate({ graph, subject }) {
    const reader = graph as Reader;
    const free = nodesOf(reader, "volunteer").filter((person) => person["status"] === "available");
    return nodesOf(reader, "shift")
      .filter((shift) => reader.out(shift.id, "covered-by").length === 0)
      .map((shift): Violation => ({
        invariant: "every-shift-covered",
        subjectId: subject.id,
        label: subject.label,
        message: `Nobody is covering "${name(shift)}" on ${String(shift["on"])}`,
        nodeIds: [shift.id],
        repairs: [
          {
            mutation: "cover",
            args: { shiftId: shift.id },
            /*
             * The repair ASKS for the person rather than choosing one. A
             * rota that assigned somebody on your behalf would be the one
             * thing an organizer would never forgive it for — and the
             * framework already knows which volunteers would fit, so the
             * question has an honest list of answers.
             */
            missing: ["volunteerId"],
            label: free.length === 0 ? `Nobody free for "${name(shift)}"` : `Find somebody for "${name(shift)}"`,
          },
          {
            mutation: "drop-shift",
            args: { shiftId: shift.id },
            label: `It is not happening — drop "${name(shift)}"`,
          },
        ],
      }));
  },
});

/**
 * Nobody over the number they said they could do.
 *
 * The rule with an opinion, and the one worth arguing with — which is
 * exactly why the limit is a field on the person rather than a constant
 * here, and why the rule is a node somebody can rename.
 */
export const nobodyOverTheirLimit: I = defineInvariant("nobody-over-their-limit", {
  scope: { kind: "rule", match: (node) => node.spec.type === "nobody-over-their-limit" },
  label: "Nobody over what they said they could do",
  description: "Asking somebody for a seventh shift is how you lose a volunteer.",
  repairs: ["uncover", "set-limit"],
  evaluate({ graph, subject }) {
    const reader = graph as Reader;
    const violations: Violation[] = [];
    for (const person of nodesOf(reader, "volunteer")) {
      const taken = reader.in(person.id, "covered-by");
      const limit = Number(person["limit"] ?? 0);
      if (taken.length <= limit) continue;
      violations.push({
        invariant: "nobody-over-their-limit",
        subjectId: subject.id,
        label: subject.label,
        message: `${name(person)} is down for ${taken.length} and said ${limit}`,
        nodeIds: [person.id, ...taken.map((shift) => shift.id)],
        repairs: [
          // Two honest ways out, and the framework offers both rather than
          // choosing: take one off them, or believe the new number.
          ...taken.map(
            (shift): Repair => ({
              mutation: "uncover",
              args: { shiftId: shift.id, volunteerId: person.id },
              label: `Take "${name(shift)}" off ${name(person)}`,
            }),
          ),
          {
            mutation: "set-limit",
            args: { volunteerId: person.id, limit: taken.length },
            label: `${name(person)} can take ${taken.length} after all`,
          },
        ],
      });
    }
    return violations;
  },
});

export const rotaInvariants: I[] = [everyShiftCovered, nobodyOverTheirLimit];
