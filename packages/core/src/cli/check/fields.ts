import { editVia, fieldWriters, subjectKindsOf, unwrittenFields } from "../../mutations/derive-edits.js";
import { nodeRefArgs } from "../../mutations/node-ref.js";
import { withArticle } from "../../schema/define-node.js";
import { permits, rolesOf } from "../../permissions/policy.js";
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

export function checkEditableFields<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, kinds, declaredMutations, add } = ctx;
  /*
   * A FIELD YOU COULD SET AT CREATION, YOU CAN CHANGE — and when you cannot,
   * the declaration says why.
   *
   * Every settable field nobody writes is covered by the derived edit act,
   * so a field is out of reach only when that act is: under a policy that
   * lets no role write or create the kind, or where an app declared its own
   * `edit-<kind>` that leaves the field alone. `fixed` is the way to say a
   * field never changes on purpose; naming a field nothing declares, or one
   * some act writes anyway, is a contradiction worth hearing about.
   */
  {
    const writers = fieldWriters(app.schema, declaredMutations);
    const roles = app.policy ? rolesOf(app.policy) : [];
    for (const definition of app.schema.definitions) {
      const shape = definition.fields.shape as Record<string, unknown>;
      for (const [field, why] of Object.entries(definition.fixed ?? {})) {
        if (!(field in shape)) {
          add({
            severity: "error",
            code: "fixed-unknown-field",
            where: `defineNode("${definition.kind}").fixed`,
            message: `Marks "${field}" fixed, which is not in this kind's fields.`,
            fix: `Point it at one of: ${Object.keys(shape).join(", ")}.`,
          });
          continue;
        }
        const written = writers.get(definition.kind)?.get(field) ?? [];
        if (written.length > 0) {
          add({
            severity: "warning",
            code: "fixed-but-written",
            where: `defineNode("${definition.kind}").fixed.${field}`,
            message: `"${field}" is marked fixed ("${why}") yet ${written.join(", ")} writes it.`,
            fix: `Drop it from fixed, or stop ${written.join(" / ")} writing it.`,
          });
        }
      }

      const uncovered = unwrittenFields(app.schema, declaredMutations, definition.kind);
      if (uncovered.length === 0) continue;
      const derivedName = `edit-${definition.kind}`;
      const own = declaredMutations.find((mutation) => mutation.name === derivedName);
      let reason: string | null = null;
      if (own) {
        // The app kept the name; the derivation stood aside.
        const ownWrites = writers.get(definition.kind) ?? new Map<string, readonly string[]>();
        if (uncovered.some((field) => !ownWrites.has(field))) {
          reason = `"${derivedName}" is declared by the app, so no edit act was derived, and it does not write them`;
        }
      } else if (app.policy) {
        const via = editVia(app.schema, declaredMutations, definition.kind);
        const reachable =
          via.length > 0 &&
          (roles.some((role) =>
            permits(app.policy, { kind: "human", roles: [role] }, derivedName, definition.kind, via).ok,
          ) ||
            permits(app.policy, { kind: "human", roles: [] }, derivedName, definition.kind, via).ok);
        if (!reachable) {
          reason =
            via.length === 0
              ? `no declared act writes or creates ${withArticle(definition.kind)}, so the derived edit is nobody's`
              : `no role may run any act that writes or creates ${withArticle(definition.kind)} (${via.join(", ")}), so the derived edit is out of everyone's reach`;
        }
      }
      if (reason === null) continue;
      for (const field of uncovered) {
        add({
          severity: "warning",
          code: "field-without-writer",
          where: `defineNode("${definition.kind}").fields.${field}`,
          message: `"${field}" is set when ${withArticle(definition.kind)} is made and nothing can ever change it — ${reason}.`,
          fix:
            `Declare writes: ["${field}"] on the act that changes it (and grant that act), ` +
            `or mark it fixed: { ${field}: "why it never changes" } on defineNode("${definition.kind}").`,
        });
      }
    }
  }

  const titles = new Map<string, string>();
  for (const mutation of app.mutations ?? []) {
    /*
     * A TITLE is the whole label a person gets, and a DESCRIPTION is the whole
     * instruction an agent gets. Neither is a slug.
     *
     * `mutationToolSchema` falls back from description to title to name, so a
     * mutation that says nothing hands an agent a label where an instruction
     * belongs — and the same opaque string is what a person reads in the
     * actions strip. An unreadable one costs twice, which is why this is
     * checked at build time rather than noticed in use.
     */
    for (const [field, listed] of [
      ["connects", mutation.connects ?? []],
      ["severs", mutation.severs ?? []],
    ] as const) {
      for (const edgeKind of listed) {
        if (!(app.schema.edgeKinds as readonly string[]).includes(edgeKind)) {
          add({
            severity: "error",
            code: "edge-claim-unknown-kind",
            where: `defineMutation("${mutation.name}").${field}`,
            message: `Claims to ${field === "connects" ? "make" : "break"} "${edgeKind}" edges, which no declaration mentions.`,
            fix: `Use one of: ${(app.schema.edgeKinds as readonly string[]).join(", ")}.`,
          });
        }
      }
    }
    /*
     * A mutation that SAYS what it writes is believed about it — so what it
     * says has to exist. A field name no subject kind declares is a typo the
     * in-place edit would silently offer nothing for.
     */
    for (const field of mutation.writes ?? []) {
      const subjectKinds = subjectKindsOf(app.schema, mutation);
      const onSome = subjectKinds.some((kind) => {
        const shape = app.schema.tryDefinition(kind)?.fields.shape as Record<string, unknown> | undefined;
        return shape !== undefined && field in shape;
      });
      if (onSome) continue;
      add({
        severity: "error",
        code: "writes-unknown-field",
        where: `defineMutation("${mutation.name}").writes`,
        message:
          subjectKinds.length === 0
            ? `Claims to write "${field}", but declares no subject to write it on.`
            : `Claims to write "${field}", which none of its subject kinds (${subjectKinds.join(", ")}) declares.`,
        fix:
          subjectKinds.length === 0
            ? "Declare a subject, or drop writes."
            : `Use a field of ${subjectKinds.join(" / ")}, or drop it from writes.`,
      });
    }
    for (const created of mutation.creates ?? []) {
      if (!kinds.has(created as string)) {
        add({
          severity: "error",
          code: "creates-unknown-kind",
          where: `defineMutation("${mutation.name}").creates`,
          message: `Claims to create "${String(created)}", which no defineNode declares.`,
          fix: `Declare the kind, or correct the creates list.`,
        });
      }
    }
    if (!mutation.title || mutation.title.trim().length === 0) {
      add({
        severity: "error",
        code: "mutation-untitled",
        where: `defineMutation("${mutation.name}").title`,
        message: "No title, so the interface will show the mutation's slug as its label.",
        fix: `Add title: "<what this does, in the app's own words>".`,
      });
    } else {
      const said = titles.get(mutation.title);
      if (said) {
        add({
          severity: "warning",
          code: "mutation-title-ambiguous",
          where: `defineMutation("${mutation.name}").title`,
          message: `"${mutation.title}" is also the title of "${said}", so the two are indistinguishable wherever both are offered.`,
          fix: "Give one of them a title that says which it is.",
        });
      }
      titles.set(mutation.title, mutation.name);
      /*
       * A title that is an IDENTIFIER names the code rather than the act.
       *
       * Deliberately narrow: "Add person" matches its slug and is a perfectly
       * good label, so slug-similarity is not the signal. An underscore is,
       * and so is a hyphen or interior capitals in a title that is one word.
       * A hyphen inside a sentence is English: "Offer a trade-in", "Book a
       * follow-up", "Re-open it" are labels on buttons.
       */
      const oneWord = !/\s/.test(mutation.title.trim());
      if (/_/.test(mutation.title) || (oneWord && /-/.test(mutation.title)) || /^[a-z]+[A-Z]/.test(mutation.title)) {
        add({
          severity: "warning",
          code: "mutation-title-is-an-identifier",
          where: `defineMutation("${mutation.name}").title`,
          message: `"${mutation.title}" reads as a name in the source rather than as a label on a button.`,
          fix: "Say what it does to the thing it is offered on, in the app's own words.",
        });
      }
    }
    if (!mutation.description || mutation.description.trim().length === 0) {
      add({
        severity: "warning",
        code: "mutation-undescribed",
        where: `defineMutation("${mutation.name}").description`,
        message:
          "No description, so an agent's tool schema falls back to the title — a label where an instruction belongs.",
        fix: "Add a sentence saying what it is for and when to reach for it.",
      });
    }

    const subject = mutation.subject;
    if (subject && subject.kinds !== "*") {
      for (const kind of subject.kinds) {
        if (!kinds.has(kind as string)) {
          add({
            severity: "error",
            code: "mutation-subject-undeclared",
            where: `defineMutation("${mutation.name}").subject.kinds`,
            message: `Subject kind "${String(kind)}" is not declared.`,
            fix: `Use one of: ${[...kinds].join(", ")}.`,
          });
        }
      }
      const shape = (mutation.input as { shape?: Record<string, unknown> }).shape;
      if (shape && !(subject.arg in shape)) {
        add({
          severity: "error",
          code: "mutation-subject-arg-missing",
          where: `defineMutation("${mutation.name}").subject.arg`,
          message: `Subject binds to argument "${subject.arg}", which is not in the input schema.`,
          fix: `Add "${subject.arg}" to the input, or point subject.arg at one of: ${Object.keys(shape).join(", ")}.`,
        });
      }
    }
    for (const ref of nodeRefArgs(mutation.input)) {
      for (const kind of ref.kinds) {
        if (kind !== "*" && !kinds.has(kind)) {
          add({
            severity: "error",
            code: "node-ref-undeclared",
            where: `defineMutation("${mutation.name}").input.${ref.name}`,
            message: `nodeRef accepts "${kind}", which no defineNode declares.`,
            fix: `Use one of: ${[...kinds].join(", ")}.`,
          });
        }
      }
    }
  }
}
