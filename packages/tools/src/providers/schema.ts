import { argShape, humaniseField, nodeRefArgs, nounOf, withArticle, type AnySchema, type Store } from "@graview/core";
import type { Affordance, AffordanceProvider, Observation, OpenParameter } from "../types.js";

const BASE_SCORE = 40;

/**
 * Which typed mutations are legal across the WHOLE selection.
 *
 * The declaration already says which kinds a mutation acts on and which
 * argument the subject binds to, so "all three selected nodes are duties, and
 * reassign acts on duties" is a fact the schema can answer — no per-selection
 * code, and a new node kind gets its affordances the moment it is declared.
 */
export function schemaProvider<S extends AnySchema>(): AffordanceProvider<S> {
  return {
    name: "schema",
    derive({ store, selection, nodes, kindSelection, edgeSelection }) {
      const affordances: Affordance[] = [];

      /*
       * A selected LINE asks "what may be done to this relation". Mutations
       * declare the edge kinds they make and break; endpoints prefill by
       * matching each node-reference argument's accepted kinds against the
       * edge's real ends — derived, never wired, and ambiguous matches stay
       * open questions rather than guesses.
       */
      if (nodes.length === 0 && edgeSelection.length > 0) {
        for (const edge of edgeSelection) {
          const fromNode = store.graph.getNode(edge.from);
          const toNode = store.graph.getNode(edge.to);
          if (!fromNode || !toNode) continue;
          for (const mutation of store.allMutations()) {
            const makes = (mutation.connects ?? []).includes(edge.kind);
            const breaks = (mutation.severs ?? []).includes(edge.kind);
            if (!makes && !breaks) continue;
            const args: Record<string, unknown> = {};
            const open: OpenParameter[] = [];
            const refs = nodeRefArgs(mutation.input);
            for (const ref of refs) {
              const takesFrom = ref.kinds.includes("*") || ref.kinds.includes(fromNode.kind as string);
              const takesTo = ref.kinds.includes("*") || ref.kinds.includes(toNode.kind as string);
              const fromOnly = takesFrom && !refs.some(
                (other) => other !== ref && (other.kinds.includes(fromNode.kind as string) || other.kinds.includes("*")),
              );
              // Prefill only the unambiguous end; two arguments accepting
              // the same kind stay open with candidates.
              if (takesFrom && !takesTo) args[ref.name] = edge.from;
              else if (takesTo && !takesFrom) args[ref.name] = edge.to;
              else if (takesFrom && takesTo && fromOnly) args[ref.name] = edge.from;
              else {
                // Ambiguity on a LINE resolves to the line: the only honest
                // candidates for "break this" are this line's own two ends —
                // a graph-wide picker here could sever an unrelated pair.
                open.push({
                  name: ref.name,
                  kinds: ref.kinds,
                  candidates: [edge.from, edge.to],
                  shape: argShape(mutation.input, ref.name),
                });
              }
            }
            for (const name of otherRequiredArgs(mutation.input, "")) {
              if (name in args || open.some((parameter) => parameter.name === name)) continue;
              open.push({ name, shape: argShape(mutation.input, name) });
            }
            const askable = open.every((parameter) =>
              parameter.optional === true
                ? true
                : parameter.kinds !== undefined
                  ? (parameter.candidates?.length ?? 0) > 0
                  : (parameter.candidates?.length ?? 0) > 0 ||
                    (parameter.shape !== undefined && parameter.shape.type !== "unknown"),
            );
            if (!askable) continue;
            /*
             * A LINE DOES NOT OFFER THE ACT THAT WOULD MAKE IT.
             *
             * Both ends come from the line, so a mutation that only makes
             * this edge kind arrives with nothing left to ask and nothing
             * left to change: the relation it would create is the one you
             * selected. Pressed, it was a one-press button that appeared to
             * do nothing — and did do something, writing a second identical
             * op into the history, undoable, describing a change that never
             * happened.
             *
             * A make with a question still open is a different act (connect
             * this end to something else), and a mutation that also breaks
             * the kind is a move. Both stay.
             */
            if (makes && !breaks && open.length === 0) continue;
            affordances.push({
              id: `schema:edge:${mutation.name}:${edge.kind}:${edge.from}:${edge.to}`,
              label: mutation.title ?? mutation.name,
              provider: "schema",
              mutation: mutation.name,
              args,
              open,
              ...(mutation.destructive ? { destructive: true } : {}),
              // A break offered on the line itself outranks a make; both sit
              // between plain schema actions and repairs.
              score: (breaks ? 62 : 58) - open.length,
              why: `this line is "${edge.kind}"`,
              nodeIds: [edge.from, edge.to],
            });
          }
        }
        return { affordances };
      }

      /*
       * A selected KIND — a card, a district — asks a different question
       * from a selected node: not "what can I do with this" but "how does
       * the first one get here". Mutations declare what they create, so an
       * empty kind card offers its own beginnings — which is the whole
       * onboarding path of a blank graph, one derived affordance at a time.
       */
      if (nodes.length === 0 && kindSelection.length > 0) {
        const wanted = new Set(kindSelection);
        const observations: Observation[] = [];
        for (const mutation of store.allMutations()) {
          if (!(mutation.creates ?? []).some((kind) => wanted.has(kind as string))) continue;
          const open: OpenParameter[] = [];
          for (const ref of nodeRefArgs(mutation.input)) {
            const candidates = ref.kinds.includes("*")
              ? store.graph.allNodes().map((node) => node.id)
              : ref.kinds.flatMap((kind) =>
                  store.graph.nodesOfKind(kind).map((node) => node.id),
                );
            open.push({
              name: ref.name,
              kinds: ref.kinds,
              candidates,
              shape: argShape(mutation.input, ref.name),
              ...(ref.optional ? { optional: true } : {}),
            });
          }
          for (const name of otherRequiredArgs(mutation.input, "")) {
            if (open.some((parameter) => parameter.name === name)) continue;
            open.push({ name, shape: argShape(mutation.input, name) });
          }
          const askable = open.every((parameter) =>
            parameter.optional === true
              ? true
              : parameter.kinds !== undefined
              ? // A node reference is only askable when real nodes exist to
                // pick — "sow into which plot?" has no honest answer at zero
                // plots, so the button waits for the first plot instead.
                (parameter.candidates?.length ?? 0) > 0
              : (parameter.candidates?.length ?? 0) > 0 ||
                (parameter.shape !== undefined && parameter.shape.type !== "unknown"),
          );
          /*
           * AN ACT WITHHELD FOR WANT OF A CANDIDATE IS NOT AN ACT THAT DOES
           * NOT EXIST, and the difference is the whole onboarding of a blank
           * graph.
           *
           * "creates: [kind] means an empty kind card offers its own
           * beginnings" holds for the kinds at the ROOT of the dependency
           * chain and stops there — because in any real domain almost every
           * creating act connects to something, and an act that needs a zone
           * cannot act when there are no zones. The derivation is right to
           * withhold it; a form with an empty picker is worse than nothing.
           *
           * What was wrong is that it said nothing. A person meets eight
           * districts, one of which offers a way in, and no explanation for
           * the other seven. The unsatisfied argument already names the kind
           * it wants, so the district can say it in the declaration's own
           * words — and it is an observation rather than an action, because
           * there is nothing to press yet.
           */
          if (!askable) {
            const waiting = open.filter(
              (parameter) =>
                parameter.optional !== true &&
                parameter.kinds !== undefined &&
                !parameter.kinds.includes("*") &&
                (parameter.candidates?.length ?? 0) === 0,
            );
            if (waiting.length > 0) {
              const wants = [
                ...new Set(waiting.flatMap((parameter) => parameter.kinds ?? [])),
              ].map((kind) => withArticle(nounOf(store.schema.tryDefinition(kind), kind)));
              observations.push({
                id: `schema:waits:${mutation.name}`,
                text: `"${mutation.title ?? mutation.name}" cannot begin until there is ${
                  wants.length === 1
                    ? wants[0]
                    : `${wants.slice(0, -1).join(", ")} and ${wants[wants.length - 1]}`
                }.`,
                nodeIds: [],
              });
            }
            continue;
          }
          affordances.push({
            id: `schema:add:${mutation.name}`,
            label: mutation.title ?? mutation.name,
            provider: "schema",
            mutation: mutation.name,
            args: {},
            open,
            score: BASE_SCORE - open.length,
            why: `this makes ${(mutation.creates ?? [])
              .filter((kind) => wanted.has(kind as string))
              .map((kind) => withArticle(nounOf(store.schema.tryDefinition(kind as string), kind as string)))
              .join(", ")}`,
            nodeIds: [],
          });
        }
        return { affordances, observations };
      }

      if (nodes.length === 0) return {};
      const kinds = new Set(nodes.map((node) => node.kind));

      /*
       * CANDIDATES KNOW THE SUBJECT. A mutation that declares the edge
       * kinds it severs is answerable from the graph: "take someone off
       * it" offered on a run should offer the people ON that run — all
       * five people is a lie four-fifths of the time — and offered with
       * nobody aboard it should not be offered at all. `connects` narrows
       * the other way: no offering to add who is already on.
       */
      const across = (
        subjectId: string,
        edgeKinds: readonly string[],
        wantKinds: readonly string[],
      ): string[] => {
        const found: string[] = [];
        for (const edge of store.graph.allEdges()) {
          if (!edgeKinds.includes(edge.kind)) continue;
          const other = edge.from === subjectId ? edge.to : edge.to === subjectId ? edge.from : null;
          if (!other) continue;
          const node = store.graph.getNode(other);
          if (!node) continue;
          if (!wantKinds.includes("*") && !wantKinds.includes(node.kind as string)) continue;
          if (!found.includes(other)) found.push(other);
        }
        return found;
      };

      for (const mutation of store.allMutations()) {
        const subject = mutation.subject;
        if (!subject) continue;
        const accepted =
          subject.kinds === "*"
            ? true
            : [...kinds].every((kind) => (subject.kinds as readonly string[]).includes(kind));
        if (!accepted) continue;

        const subjectId = nodes.length === 1 ? nodes[0]!.id : null;
        const severs = mutation.severs ?? [];
        const connects = mutation.connects ?? [];
        /*
         * A PURE severing act with nothing attached is not an offer —
         * "Restore one occurrence" with nothing skipped was a button that
         * could only fail. A mutation that BOTH makes and breaks is a
         * move/handover: it is exactly what an unattached subject needs,
         * so it is never gated on attachment.
         */
        if (
          subjectId &&
          severs.length > 0 &&
          connects.length === 0 &&
          across(subjectId, severs, ["*"]).length === 0
        ) {
          continue;
        }
        const open: OpenParameter[] = [];
        for (const ref of nodeRefArgs(mutation.input)) {
          if (ref.name === subject.arg) continue;
          let candidates = ref.kinds.includes("*")
            ? store.graph.allNodes().map((node) => node.id)
            : ref.kinds.flatMap((kind) =>
                store.graph.nodesOfKind(kind).map((node) => node.id),
              );
          if (subjectId && connects.length > 0) {
            /*
             * Anything that CONNECTS offers only who is not already on —
             * including a move (connects + severs), whose whole point is
             * someone NEW. Reading severs first here offered "Reassign
             * run" a list containing exactly the current assignee.
             */
            const already = new Set(across(subjectId, connects, ref.kinds));
            candidates = candidates.filter((id) => !already.has(id));
          } else if (subjectId && severs.length > 0) {
            // A pure severing act reaches only what is actually attached.
            candidates = across(subjectId, severs, ref.kinds);
          }
          open.push({
            name: ref.name,
            kinds: ref.kinds,
            // Offering real ids is what turns "reassign" into "reassign to
            // whom" without anyone wiring up a picker per mutation.
            candidates: candidates.filter((id) => !selection.includes(id)),
            shape: argShape(mutation.input, ref.name),
            ...(ref.optional ? { optional: true } : {}),
          });
        }
        for (const name of otherRequiredArgs(mutation.input, subject.arg)) {
          if (open.some((parameter) => parameter.name === name)) continue;
          open.push({ name, shape: argShape(mutation.input, name) });
        }

        /*
         * A ONE-PRESS ACT MUST BE ABLE TO ACT. An action with nothing
         * required left to ask is offered as a single press — and pressed
         * with only its subject, a derived edit whose every field is
         * optional refused: "Nothing to change — give at least one of
         * label a value", said on the button. Its inputs were inputs all
         * along; being optional made them askable one at a time, not
         * unnecessary. So an action that needs nothing more is rehearsed
         * with what it has, and one that would refuse asks for its optional
         * arguments instead, each of which may be skipped.
         */
        if (open.length === 0 && subjectId) {
          const optionalArgs = otherOptionalArgs(mutation.input, subject.arg);
          if (optionalArgs.length > 0 && !rehearses(store as Pick<Store<AnySchema>, "preview">, mutation.name, { [subject.arg]: subjectId })) {
            for (const name of optionalArgs) {
              const ref = nodeRefArgs(mutation.input).find((candidate) => candidate.name === name);
              open.push({
                name,
                optional: true,
                ...(ref ? { kinds: ref.kinds } : {}),
                shape: argShape(mutation.input, name),
              });
            }
          }
        }

        /*
         * Only actions the interface can actually ASK FOR.
         *
         * An open argument with no candidates and no scalar shape — a
         * structured object, say — has no honest prompt: the strip offered a
         * text box whose every answer failed validation, which read as a
         * button that does nothing. The mutation still exists and an agent
         * supplies structured arguments natively; it is just not a button.
         * Invariant repairs are unaffected — a rule that names a repair has
         * already decided it is offerable.
         */
        const askable = open.every((parameter) =>
          parameter.optional === true
            ? true
            : parameter.kinds !== undefined
            ? (parameter.candidates?.length ?? 0) > 0
            : (parameter.candidates?.length ?? 0) > 0 ||
              (parameter.shape !== undefined && parameter.shape.type !== "unknown"),
        );
        if (!askable) continue;

        const batch = nodes.map((node) => ({ [subject.arg]: node.id }));

        /*
         * AN ACT WITH NOTHING LEFT TO ASK MUST HAVE SOMETHING LEFT TO DO.
         *
         * One press, no arguments, and the mutation compiles to no
         * primitives: "Close it" offered on something already closed. It was
         * offered, pressed, and nothing happened — except a line in the
         * activity rail claiming it had. Only asked where there is nothing
         * left to ask, because an act still holding a question has not been
         * decided yet, and only of the batch, so a selection of five where
         * one is still open keeps the offer.
         */
        if (open.length === 0 && !batch.some((args) => store.wouldChange({ name: mutation.name, args }))) {
          continue;
        }
        affordances.push({
          id: `schema:${mutation.name}`,
          label:
            nodes.length > 1
              ? `${mutation.title ?? mutation.name} (${nodes.length})`
              : (mutation.title ?? mutation.name),
          provider: "schema",
          mutation: mutation.name,
          args: batch[0] ?? {},
          open,
          ...(mutation.destructive ? { destructive: true } : {}),
          ...(severs.length > 0 || connects.length > 0 ? { ties: true } : {}),
          ...(nodes.length > 1 ? { batch } : {}),
          // A mutation needing nothing more is readier than one needing three
          // more answers, so it should surface above it.
          score: BASE_SCORE - open.length,
          why:
            nodes.length > 1
              ? `all ${nodes.length} selected nodes are ${[...kinds]
                  .map((kind) => (store.schema.tryDefinition(kind as string)?.plural ?? humaniseField(kind as string)).toLowerCase())
                  .join(" or ")}`
              : `this is ${withArticle(nounOf(store.schema.tryDefinition(nodes[0]!.kind as string), nodes[0]!.kind as string))}`,
          nodeIds: nodes.map((node) => node.id),
        });
      }

      /*
       * THE OTHER END OF THE TIE. "Take someone off it" declares a duty as
       * its subject, but the person standing in a run's own view is the
       * natural place to say "take THIS one off" — and the only offers there
       * used to be rename and a destructive remove, which is how deleting a
       * child from the household got clicked meaning "off this run". A
       * mutation that declares what it severs or connects is offerable from
       * either endpoint: the selected node fills its matching argument, and
       * the subject's candidates come from the actual edges.
       */
      if (nodes.length === 1) {
        const chosen = nodes[0]!;
        for (const mutation of store.allMutations()) {
          const subject = mutation.subject;
          const severs = mutation.severs ?? [];
          const connects = mutation.connects ?? [];
          if (!subject || (severs.length === 0 && connects.length === 0)) continue;
          // Already offered the ordinary way when the selection IS the subject.
          const subjectAccepts: readonly string[] | "*" =
            (subject.kinds as unknown) === "*" ? "*" : (subject.kinds as readonly string[]);
          if (subjectAccepts === "*" || subjectAccepts.includes(chosen.kind as string)) {
            continue;
          }
          const refs = nodeRefArgs(mutation.input);
          const mine = refs.find(
            (ref) =>
              ref.name !== subject.arg &&
              (ref.kinds.includes("*") || ref.kinds.includes(chosen.kind as string)),
          );
          if (!mine) continue;
          // Narrowed by the continue above: the subject names concrete kinds.
          const subjectKinds = subjectAccepts;
          const pool = subjectKinds.includes("*")
            ? store.graph.allNodes().map((node) => node.id)
            : subjectKinds.flatMap((kind) =>
                store.graph.nodesOfKind(kind).map((node) => node.id),
              );
          // Same rule as the forward direction: a move offers the NEW
          // (everything not already tied), a pure sever offers the tied.
          const attached = new Set(
            across(chosen.id, connects.length > 0 ? connects : severs, subjectKinds),
          );
          const subjectCandidates =
            connects.length > 0
              ? pool.filter((id) => !attached.has(id))
              : pool.filter((id) => attached.has(id));
          if (subjectCandidates.length === 0) continue;
          const open: OpenParameter[] = [
            {
              name: subject.arg,
              kinds: subjectKinds,
              candidates: subjectCandidates,
              shape: argShape(mutation.input, subject.arg),
            },
          ];
          for (const ref of refs) {
            if (ref.name === mine.name || ref.name === subject.arg) continue;
            const pool = ref.kinds.includes("*")
              ? store.graph.allNodes().map((node) => node.id)
              : ref.kinds.flatMap((kind) =>
                  store.graph.nodesOfKind(kind).map((node) => node.id),
                );
            open.push({
              name: ref.name,
              kinds: ref.kinds,
              candidates: pool,
              shape: argShape(mutation.input, ref.name),
              ...(ref.optional ? { optional: true } : {}),
            });
          }
          for (const name of otherRequiredArgs(mutation.input, mine.name)) {
            if (name === subject.arg || open.some((parameter) => parameter.name === name)) continue;
            open.push({ name, shape: argShape(mutation.input, name) });
          }
          const askable = open.every((parameter) =>
            parameter.optional === true
              ? true
              : parameter.kinds !== undefined
                ? (parameter.candidates?.length ?? 0) > 0
                : (parameter.candidates?.length ?? 0) > 0 ||
                  (parameter.shape !== undefined && parameter.shape.type !== "unknown"),
          );
          if (!askable) continue;
          affordances.push({
            id: `schema:tie:${mutation.name}:${chosen.id}`,
            /*
             * THE FAR END'S OWN WORDS. `title` is written from the subject's
             * side — "Hand it to someone", offered on the person, read as
             * handing the person to someone. `fromTheOtherEnd` is the act's
             * reading from here; without it the near-end title is all there
             * is, and `graview check` says so by name.
             */
            label: mutation.fromTheOtherEnd ?? mutation.title ?? mutation.name,
            provider: "schema",
            mutation: mutation.name,
            args: { [mine.name]: chosen.id },
            open,
            ties: true,
            ...(mutation.destructive ? { destructive: true } : {}),
            score: BASE_SCORE - open.length + 2,
            why: `${severs.length > 0 ? "this one is on" : "this one could join"} ${open[0]!.candidates!.length === 1 ? "it" : "one of these"}`,
            nodeIds: [chosen.id],
          });
        }
      }

      return { affordances };
    },
  };
}

/** Required input fields that are not node references and not the subject. */
/** The arguments the input would accept unanswered, the subject aside. */
function otherOptionalArgs(input: unknown, subjectArg: string): string[] {
  const shape = (input as { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> })
    .shape;
  if (!shape) return [];
  return Object.entries(shape)
    .filter(([name, field]) => name !== subjectArg && field.safeParse(undefined).success)
    .map(([name]) => name);
}

/** Whether the mutation, called with exactly these arguments, would go through. */
function rehearses(
  store: Pick<Store<AnySchema>, "preview">,
  name: string,
  args: Record<string, unknown>,
): boolean {
  try {
    store.preview({ name, args });
    return true;
  } catch {
    return false;
  }
}

function otherRequiredArgs(input: unknown, subjectArg: string): string[] {
  const shape = (input as { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> })
    .shape;
  if (!shape) return [];
  return Object.entries(shape)
    .filter(([name, field]) => name !== subjectArg && !field.safeParse(undefined).success)
    .map(([name]) => name);
}
