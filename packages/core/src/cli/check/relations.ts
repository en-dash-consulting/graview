import { nodeRefArgs } from "../../mutations/node-ref.js";
import { withArticle } from "../../schema/define-node.js";
import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { CheckContext } from "./context.js";
import { bounded } from "./context.js";

export function checkReadings<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * AN EDGE HAS ONE DIRECTION AND TWO READINGS, and every surface reads it
   * from the end it is standing on: a plot's page says "who looks after
   * it", the gardener's page says what she looks after. With only the
   * declaring side's words, the other end is captioned with the edge kind
   * in plain words — "tended by", on the gardener — which reads the wrong
   * way round. The words are part of the declaration, so their absence is
   * a finding here rather than a surprise on a page.
   */
  for (const definition of app.schema.definitions) {
    for (const [edgeKind, edge] of Object.entries(definition.edges)) {
      if (edge.inverse) continue;
      const farEnd =
        edge.to === "*" ? "the other end" : edge.to.map((kind) => withArticle(kind)).join(" or ");
      add({
        severity: "warning",
        code: "edge-without-inverse",
        where: `defineNode("${definition.kind}").edges["${edgeKind}"]`,
        message: edge.description
          ? `"${edgeKind}" reads from ${withArticle(definition.kind)} only ("${edge.description}"); from ${farEnd} it is captioned "${edgeKind.replace(/-/g, " ")}", which is the wrong way round.`
          : `"${edgeKind}" has no words in either direction; both ends are captioned "${edgeKind.replace(/-/g, " ")}".`,
        fix:
          `Add inverse: "…" — how the relation reads from ${farEnd}` +
          (edge.description ? "" : `, and description: "…" for how it reads from ${withArticle(definition.kind)}`) +
          `.`,
      });
    }
  }
}

/**
 * ONE EDGE NAME, ONE RELATION. Every surface treats an edge kind as a single
 * relation: the connections on a record, the pages' groups, the captions
 * over a band, the arrangement's `by:` all key on its name. Declared on two
 * kinds with two sets of words — `by` on a song ("the artist whose song it
 * is" / "their songs") and on an album ("the artist whose release it is" /
 * "their releases") — the artist's page listed thirty-five songs and six
 * albums together under "Their releases". Declaring the same relation from
 * several kinds in the SAME words is fine and is left alone.
 */
export function checkEdgeNamesAgree<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  const declared = new Map<string, { kind: string; description?: string; inverse?: string }[]>();
  for (const definition of app.schema.definitions) {
    for (const [edgeKind, edge] of Object.entries(definition.edges)) {
      const held = declared.get(edgeKind) ?? [];
      held.push({ kind: definition.kind, ...(edge.description ? { description: edge.description } : {}), ...(edge.inverse ? { inverse: edge.inverse } : {}) });
      declared.set(edgeKind, held);
    }
  }
  for (const [edgeKind, ends] of declared) {
    if (ends.length < 2) continue;
    const words = new Set(ends.map((end) => `${end.description ?? ""}|${end.inverse ?? ""}`));
    if (words.size < 2) continue;
    const said = ends
      .map((end) => `on ${withArticle(end.kind)} ("${end.description ?? edgeKind}" / "${end.inverse ?? edgeKind}")`)
      .join(" and ");
    const [first, second] = ends;
    add({
      severity: "error",
      code: "edge-name-shared",
      where: ends.map((end) => `defineNode("${end.kind}").edges["${edgeKind}"]`).join(", "),
      message: `"${edgeKind}" is declared ${said}, but to every surface an edge name is ONE relation: from the far end both are listed together under ${JSON.stringify(first!.inverse ?? edgeKind)}, including the ${second!.kind === first!.kind ? "second" : `${second!.kind}s`}.`,
      fix: `Give each relation its own name (say "${edgeKind}" on ${withArticle(first!.kind)} and "${second!.kind}-${edgeKind}" on ${withArticle(second!.kind)}), or give every declaration the same description and inverse.`,
    });
  }
}

export function checkActsFromEnds<S extends AnySchema>(ctx: CheckContext<S>, writtenByAModel: ReadonlySet<string>): void {
  const { app, kinds, mutations, add } = ctx;
  /*
   * AN ACT OFFERED FROM AN END IT HAS NO WORDS FOR.
   *
   * A mutation that declares what it connects or severs is offered from
   * EITHER endpoint — standing on a person, "take this one off the run" is
   * the natural thing to say. The button there is labelled with `title`,
   * which is written from the subject's side: "Hand it to someone", offered
   * on the owner, reads as handing the owner to someone. The same shape as
   * `edge-without-inverse`, one layer up: the relation has two readings and
   * the act only has one.
   */
  for (const mutation of app.mutations ?? []) {
    if (mutation.fromTheOtherEnd) continue;
    const subject = mutation.subject;
    const ties = [...(mutation.connects ?? []), ...(mutation.severs ?? [])];
    if (!subject || ties.length === 0 || (subject.kinds as unknown) === "*") continue;
    const subjectKinds = subject.kinds as readonly string[];
    // The far ends: node-reference arguments naming a kind the subject is not.
    const farEnds = new Set<string>();
    for (const ref of nodeRefArgs(mutation.input)) {
      if (ref.name === subject.arg) continue;
      for (const kind of ref.kinds) {
        if (kind !== "*" && !subjectKinds.includes(kind)) farEnds.add(kind);
      }
    }
    if (farEnds.size === 0) continue;
    const spoken = [...farEnds].map((kind) => withArticle(kind)).join(" or ");
    add({
      severity: "warning",
      code: "act-without-far-end-reading",
      where: `defineMutation("${mutation.name}")`,
      message:
        `"${mutation.title ?? mutation.name}" is written from ${subjectKinds.map((kind) => withArticle(kind)).join(" or ")}, ` +
        `and is also offered on ${spoken}, where it is labelled with those same words — which is the wrong way round.`,
      fix: `Add fromTheOtherEnd: "…" — how this act reads standing on ${spoken}.`,
    });
  }

  for (const definition of app.schema.definitions) {
    for (const [edgeKind, edge] of Object.entries(definition.edges)) {
      if (edge.to === "*") continue;
      for (const target of edge.to) {
        if (!kinds.has(target)) {
          add({
            severity: "error",
            code: "edge-target-undeclared",
            where: `defineNode("${definition.kind}").edges["${edgeKind}"]`,
            message: `Edge "${edgeKind}" points at "${target}", which no defineNode declares.`,
            fix: `Declare a node kind "${target}", or change the target to one of: ${[...kinds].join(", ")}.`,
          });
        }
      }
    }

    /*
     * A LABEL A MODEL WRITES IS A NAME, AND NOTHING SAYS SO.
     *
     * Every derived surface in this framework draws `label`: on a card, in
     * a list, on a plan, in a chip. And the declaration almost always says
     * `z.string().min(1)`, which permits a paragraph. When a person types
     * it that is fine — people write names. When a MODEL writes it, it
     * writes whatever the prompt implied, and the prompt was generated from
     * this schema, which said nothing.
     *
     * A product asked a model to survey a garden and got back seven areas
     * called things like "Pea-gravel corner with river-rock border, log
     * seats and a fire bowl". Every one is a true, useful sentence and a
     * terrible name, and the model was not wrong — it was never told. The
     * plan drew them across each other, the cards wrapped to four lines,
     * and nothing failed anywhere.
     *
     * So this asks only about kinds a declared provider may actually
     * create. A note, not a warning: a long label is legal and sometimes
     * right. What is not defensible is not having made the call.
     */
    if (writtenByAModel.has(definition.kind)) {
      const field = (definition.fields.shape as Record<string, unknown>)["label"];
      if (field !== undefined && !bounded(field)) {
        add({
          severity: "note",
          code: "label-unbounded",
          where: `defineNode("${definition.kind}").fields.label`,
          message: `A declared provider may create ${withArticle(definition.kind)}, and "label" has no maximum length — so a model may write a paragraph where a name goes, and every surface that draws it will try.`,
          fix: `Bound it to something an interface can draw: z.string().min(1).max(60). Whatever else there is to say about ${withArticle(definition.kind)} belongs in a field of its own, where a person will actually read it.`,
        });
      }
    }

    /*
     * WHAT A GLANCE SAYS. A card shows three facts, and unsaid they are the
     * first three the heading does not already say — declaration order,
     * which is nobody's choice: a car declared VIN-first showed its VIN on
     * every card in the showroom and never its price (W-168).
     */
    {
      const shape = definition.fields.shape as Record<string, unknown>;
      const hidden = new Set(definition.display?.hide ?? []);
      const readable = Object.keys(shape).filter((key) => key !== "label" && !hidden.has(key));
      for (const key of definition.display?.glance ?? []) {
        if (key in shape) continue;
        add({
          severity: "error",
          code: "glance-unknown-field",
          where: `defineNode("${definition.kind}").display.glance`,
          message: `A glance at ${withArticle(definition.kind)} is to say "${key}", which it does not declare.`,
          fix: `Use one of: ${readable.join(", ")}.`,
        });
      }
      if (readable.length > 5 && !definition.display?.glance) {
        add({
          severity: "note",
          code: "glance-unchosen",
          where: `defineNode("${definition.kind}").display`,
          message: `${withArticle(definition.kind).replace(/^./, (first) => first.toUpperCase())} has ${readable.length} fields and a card shows three — the first three in the order they were declared (${readable.slice(0, 3).join(", ")}).`,
          fix: `Say which: display: { glance: ["${readable.slice(0, 3).join('", "')}"] } — the facts a person compares one by, at a glance.`,
        });
      }
    }

    /*
     * A lifecycle must name a real field. A currency read off a field that
     * does not exist would silently make every node current for ever —
     * which is exactly the state a kind was in before declaring anything,
     * minus the honesty.
     */
    if (definition.lifecycle) {
      const shape = definition.fields.shape as Record<string, unknown>;
      if (!(definition.lifecycle.field in shape)) {
        add({
          severity: "error",
          code: "lifecycle-missing-field",
          where: `defineNode("${definition.kind}").lifecycle`,
          message: `Lifecycle reads field "${definition.lifecycle.field}", which is not in this kind's fields.`,
          fix: `Point it at one of: ${Object.keys(shape).join(", ")}.`,
        });
      }
      if (
        definition.lifecycle.retired !== "date" &&
        definition.lifecycle.retired.length === 0
      ) {
        add({
          severity: "error",
          code: "lifecycle-never-retires",
          where: `defineNode("${definition.kind}").lifecycle`,
          message: `Lifecycle lists no retired values, so nothing can ever leave the horizon.`,
          fix: `List the values that mean "past", or use "date" for an expiry field.`,
        });
      }
    }

    for (const [role, field] of Object.entries(definition.fieldRoles ?? {})) {
      const shape = definition.fields.shape as Record<string, unknown>;
      if (!(field in shape)) {
        add({
          severity: "error",
          code: "field-role-missing-field",
          where: `defineNode("${definition.kind}").fieldRoles.${role}`,
          message: `Field role "${role}" maps to field "${field}", which is not in this kind's fields.`,
          fix: `Point the role at one of: ${Object.keys(shape).join(", ")}.`,
        });
      }
    }
  }

  for (const invariant of app.invariants ?? []) {
    if (invariant.scope !== "graph" && !kinds.has(invariant.scope.kind)) {
      add({
        severity: "error",
        code: "invariant-scope-undeclared",
        where: `defineInvariant("${invariant.name}").scope`,
        message: `Scoped to node kind "${invariant.scope.kind}", which no defineNode declares.`,
        fix: `Use one of: ${[...kinds].join(", ")}.`,
      });
    }
    for (const repair of invariant.repairs ?? []) {
      if (!mutations.has(repair)) {
        add({
          severity: "error",
          code: "repair-unknown-mutation",
          where: `defineInvariant("${invariant.name}").repairs`,
          message: `Names repair mutation "${repair}", which is not registered on this app.`,
          fix: `Register a mutation called "${repair}", or drop it from repairs. Registered: ${
            [...mutations.keys()].join(", ") || "(none)"
          }.`,
        });
      }
    }
  }
}

export function checkUnmakeable<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * A RELATION YOU CAN MAKE BUT NEVER UNMAKE.
   *
   * An edge kind with a connecting act and no severing one is an asymmetry
   * the declaration exposes: whoever draws the line can never erase it, and
   * nobody notices until the first person needs to. Some edges are like that
   * on purpose — history, rationale, a record — and the way to say so is
   * `appendOnly: true` on the edge declaration, which suppresses this and
   * documents the intent in the same stroke.
   */
  {
    const connectors = new Map<string, string[]>();
    const severers = new Set<string>();
    for (const mutation of app.mutations ?? []) {
      for (const edgeKind of mutation.connects ?? []) {
        connectors.set(edgeKind, [...(connectors.get(edgeKind) ?? []), mutation.name]);
      }
      for (const edgeKind of mutation.severs ?? []) severers.add(edgeKind);
    }
    for (const [edgeKind, makers] of connectors) {
      if (severers.has(edgeKind)) continue;
      const declaredOn = app.schema.definitions.filter(
        (definition) => edgeKind in definition.edges,
      );
      // An unknown edge kind is already `edge-claim-unknown-kind` above.
      if (declaredOn.length === 0) continue;
      /*
       * EVERY declaration of the edge kind must say appendOnly, not just
       * one. Two kinds can share an edge-kind name, and a suppression on
       * one must not hide the other's makeable-but-never-unmakeable
       * relation — that is the exact asymmetry this check exists to catch.
       */
      if (declaredOn.every((definition) => definition.edges[edgeKind]?.appendOnly)) continue;
      add({
        severity: "warning",
        code: "edge-without-severer",
        where: `defineMutation("${makers[0]}").connects`,
        message: `"${edgeKind}" is a relation you can make (${makers.join(", ")}) but never unmake — no mutation declares it in severs.`,
        fix:
          `Declare severs: ["${edgeKind}"] on the act that removes it, or mark the edge ` +
          `appendOnly: true on ${declaredOn
            .map((definition) => `defineNode("${definition.kind}").edges["${edgeKind}"]`)
            .join(" / ")} if it is genuinely never unmade.`,
      });
    }
  }
}
