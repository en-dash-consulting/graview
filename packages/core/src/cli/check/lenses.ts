import { walkKinds } from "../../schema/path.js";
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
import { arrangementFindings, bindsOf, declaredLenses, isShippedLens, requiredRolesOf } from "../../places.js";
import { fieldOf } from "./context.js";
import { columnReach } from "../../columns.js";
import { deriveMutations } from "../../mutations/derive-edits.js";

export function checkShippedLenses<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * THE LENSES THIS FRAMEWORK SHIPS, by name.
   *
   * Names rather than implementations, because the checker lives a tier
   * below the package that draws them. Anything else in `lenses` is a lens
   * this app wrote, which is the one thing worth asking about: the reuse
   * test is the single most valuable instruction in `graview-lens` — build
   * it against a domain it was not designed for, and if you cannot, say so
   * plainly, you wrote a view — and nothing enforces it. This cannot
   * enforce it either. It can make sure the question gets asked out loud
   * every time somebody runs a check, which is most of the distance.
   */
  const authored = (app.lenses ?? [])
    .filter((lens) => !isShippedLens(lens.name))
    /* A lens that says where its reuse was proved has answered this. */
    .filter((lens) => lens.provenBy === undefined);
  if (authored.length > 0) {
    add({
      severity: "note",
      code: "lens-authored-here",
      where: "lenses",
      message: `${authored.map((lens) => `"${lens.name}"`).join(", ")} ${
        authored.length === 1 ? "is a lens" : "are lenses"
      } this app wrote. A lens claims to be reusable by a domain it was not designed for.`,
      fix: `Build ${
        authored.length === 1 ? "it" : "each of them"
      } against another domain in a test — and if you cannot, say so plainly: it is a view, and there is nothing wrong with a view.`,
    });
  }
}

export function checkLensBindings<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, kinds, add } = ctx;
  /** Every edge kind any node declares, for validating an entity lens. */
  const edgeKinds = new Set<string>();
  for (const kind of kinds) {
    const edges = app.schema.tryDefinition(kind)?.edges as Record<string, unknown> | undefined;
    for (const edge of Object.keys(edges ?? {})) edgeKinds.add(edge);
  }

  for (const lens of app.lenses ?? []) {
    /*
     * An `entities` lens binds roles to whole kinds and edges rather than a
     * kind's fields to roles. Checking it against the field-binding shape
     * reported every role as an undeclared node kind, which is a confident
     * and completely wrong diagnosis — the sort a checker earns distrust for.
     */
    if (bindsOf(lens) === "entities") {
      const bindings = (lens.bindings ?? {}) as Record<string, Record<string, unknown>>;
      for (const role of requiredRolesOf(lens)) {
        if (!(role in bindings)) {
          add({
            severity: "error",
            code: "lens-role-unbound",
            where: `lens "${lens.title ?? lens.name}" bindings`,
            message: `Lens "${lens.name}" requires role "${role}", which nothing binds.`,
            fix: `Add ${role}: { kind: "<node kind>" }, { edge: "<edge kind>" } or { path: ["<edge>", …] }.`,
          });
        }
      }
      /** The kind a role names, so a field binding can be checked against it. */
      const kindOfRole = (role: string): string | undefined => {
        const named = bindings[role]?.["kind"];
        return typeof named === "string" ? named : undefined;
      };

      for (const [role, binding] of Object.entries(bindings)) {
        const kind = typeof binding["kind"] === "string" ? (binding["kind"] as string) : undefined;
        const edge = typeof binding["edge"] === "string" ? (binding["edge"] as string) : undefined;
        const field = typeof binding["field"] === "string" ? (binding["field"] as string) : undefined;
        /*
         * A relationship that runs THROUGH a node is a walk, and every step
         * of it is an edge kind somebody declared — so the whole path is
         * checkable, which is the point of naming it here rather than
         * reaching for the graph inside a view.
         */
        const path = Array.isArray(binding["path"]) ? (binding["path"] as readonly unknown[]) : undefined;
        if (path !== undefined) {
          if (path.length === 0) {
            add({
              severity: "error",
              code: "lens-binding-empty-path",
              where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
              message: `Role "${role}" binds an empty path, which reaches nothing.`,
              fix: `Name the edge kinds from the column end to the row end, e.g. path: ["covers", "applies", "addresses"].`,
            });
          }
          /*
           * AND THE PATH GETS THERE. Column end to row end, as the coverage
           * walks it: named backwards, or through a kind it never touches, it
           * reaches nothing and the picture says every row is uncovered.
           */
          const ends = { columns: bindings["columns"]?.["kind"], rows: bindings["rows"]?.["kind"] };
          if (path.length > 0 && path.every((step) => typeof step === "string" && edgeKinds.has(step)) && typeof ends.columns === "string" && typeof ends.rows === "string" && kinds.has(ends.columns) && kinds.has(ends.rows)) {
            const walked = walkKinds(app.schema, ends.columns, path as readonly string[]);
            if (!walked.ok || !walked.reached.has(ends.rows)) {
              const reversed = walkKinds(app.schema, ends.columns, [...(path as readonly string[])].reverse());
              const backwards = reversed.ok && reversed.reached.has(ends.rows);
              add({
                severity: "error",
                code: "lens-binding-path-misses",
                where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
                message: backwards
                  ? `Role "${role}" walks from the rows to the columns: from "${ends.columns}" it reaches nothing, so every row would read as uncovered.`
                  : `Role "${role}" cannot get from "${ends.columns}" to "${ends.rows}"${walked.ok ? "" : `: "${String(path[walked.at])}" does not touch where the walk has got to`}.`,
                fix: backwards
                  ? `Name it column end first: path: [${[...path].reverse().map((step) => JSON.stringify(step)).join(", ")}].`
                  : `Name the edges from a ${ends.columns} to a ${ends.rows}, in order.`,
              });
            }
          }
          for (const step of path) {
            if (typeof step !== "string" || !edgeKinds.has(step)) {
              add({
                severity: "error",
                code: "lens-binding-undeclared-edge",
                where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
                message: `Role "${role}" walks through "${String(step)}", which no defineNode declares as an edge.`,
                fix: `Use one of: ${[...edgeKinds].join(", ")}.`,
              });
            }
          }
        }
        if (kind !== undefined && !kinds.has(kind)) {
          add({
            severity: "error",
            code: "lens-binding-undeclared-kind",
            where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
            message: `Role "${role}" names kind "${kind}", which no defineNode declares.`,
            fix: `Use one of: ${[...kinds].join(", ")}.`,
          });
        }
        if (edge !== undefined && !edgeKinds.has(edge)) {
          add({
            severity: "error",
            code: "lens-binding-undeclared-edge",
            where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
            message: `Role "${role}" names edge "${edge}", which no defineNode declares.`,
            fix: `Use one of: ${[...edgeKinds].join(", ")}.`,
          });
        }
        if (field !== undefined) {
          const owner = typeof binding["on"] === "string" ? (binding["on"] as string) : undefined;
          const ownerKind = owner === undefined ? undefined : kindOfRole(owner);
          if (owner === undefined || ownerKind === undefined) {
            add({
              severity: "error",
              code: "lens-binding-fieldless-owner",
              where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
              message: `Role "${role}" binds field "${field}" but does not say which role's kind it belongs to.`,
              fix: `Add on: "<role that binds a kind>".`,
            });
          } else {
            const shape = app.schema.tryDefinition(ownerKind)?.fields.shape as
              | Record<string, unknown>
              | undefined;
            if (shape && !(field in shape)) {
              add({
                severity: "error",
                code: "lens-binding-missing-field",
                where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
                message: `Role "${role}" maps to field "${field}", which "${ownerKind}" does not declare.`,
                fix: `Point it at one of: ${Object.keys(shape).join(", ")}.`,
              });
            }
          }
        }
        if (kind === undefined && edge === undefined && field === undefined && path === undefined) {
          add({
            severity: "error",
            code: "lens-binding-empty",
            where: `lens "${lens.title ?? lens.name}" bindings.${role}`,
            message: `Role "${role}" binds nothing.`,
            fix: `Give it { kind: "<node kind>" }, { edge: "<edge kind>" }, { path: ["<edge>", …] } or { field: "<field>", on: "<role>" }.`,
          });
        }
      }
      continue;
    }

    for (const [kind, rawBindings] of Object.entries(lens.bindings ?? {})) {
      const bindings = rawBindings as Record<string, unknown>;
      if (!kinds.has(kind)) {
        add({
          severity: "error",
          code: "lens-binding-undeclared-kind",
          where: `lens "${lens.title ?? lens.name}" bindings`,
          message: `Binds roles for "${kind}", which no defineNode declares.`,
          fix: `Use one of: ${[...kinds].join(", ")}.`,
        });
        continue;
      }
      const definition = app.schema.tryDefinition(kind);
      if (!definition) continue;
      const shape = definition.fields.shape as Record<string, unknown>;
      for (const [role, bound] of Object.entries(bindings)) {
        /*
         * A ROLE IS A FIELD NAME, OR A FIELD AND THE VALUES THAT MAKE IT
         * TRUE. The second shape — `{ field: "status", is: ["done"] }` — is
         * how `lifecycle` already reads a state, and a role that reads
         * completion has to accept it or most domains cannot bind it at all.
         * The checker asks the same question of both: is that a field this
         * kind declares?
         */
        const field = fieldOf(bound);
        if (field === undefined) {
          add({
            severity: "error",
            code: "lens-binding-not-a-field",
            where: `lens "${lens.title ?? lens.name}" bindings.${kind}.${role}`,
            message: `Role "${role}" is bound to ${JSON.stringify(bound)}, which is neither a field name nor { field, is }.`,
            fix: `Use a field name, or { field: "<field>", is: ["<value>", …] }.`,
          });
          continue;
        }
        if (!(field in shape)) {
          add({
            severity: "error",
            code: "lens-binding-missing-field",
            where: `lens "${lens.title ?? lens.name}" bindings.${kind}.${role}`,
            message: `Role "${role}" maps to field "${field}", which "${kind}" does not declare.`,
            fix: `Point it at one of: ${Object.keys(shape).join(", ")}.`,
          });
        }
      }
      for (const role of requiredRolesOf(lens)) {
        if (!(role in bindings)) {
          add({
            severity: "error",
            code: "lens-role-unbound",
            where: `lens "${lens.title ?? lens.name}" bindings.${kind}`,
            message: `Lens "${lens.name}" requires role "${role}", which "${kind}" does not bind.`,
            fix: `Add ${role}: "<field name>" to the bindings for "${kind}".`,
          });
        }
      }
      /*
       * TWO PLACES NAME A ROLE, AND THEY DO DIFFERENT JOBS.
       *
       * `fieldRoles` on the kind is what everything that is not a lens reads
       * — the graph's own responder answering "when is it", the generated
       * docs. A lens reads `bindings` and only `bindings`. Neither overrides
       * the other, because neither is looking at the other.
       *
       * Which is fine until they disagree, and then one surface answers with
       * one field and the next surface answers with another, both truthfully.
       * Nothing could see it before: each half is valid on its own.
       */
      const declaredRoles = (definition.fieldRoles ?? {}) as Record<string, string>;
      for (const [role, bound] of Object.entries(bindings)) {
        const field = fieldOf(bound);
        const declared = declaredRoles[role];
        if (field === undefined || declared === undefined || declared === field) continue;
        add({
          severity: "note",
          code: "lens-binding-disagrees-with-field-role",
          where: `lens "${lens.title ?? lens.name}" bindings.${kind}.${role}`,
          message: `The lens binds "${role}" to "${field}"; defineNode("${kind}").fieldRoles binds it to "${declared}". A lens reads bindings and everything else reads fieldRoles, so the picture and the sentence will answer differently.`,
          fix: `Point both at the same field — or keep them apart deliberately, which is right when two lenses mean different things by one role name (a day and a time of day both being a "start").`,
        });
      }
    }
  }
}

/**
 * A DECLARED LENS THAT SHOULD DRAW, AND DOES NOT (FR-79). The reasons come
 * from `declaredLenses`, the one place that decides what draws — so the
 * checker, `describe` and the picture cannot disagree about why a place is
 * missing. Warnings, never errors: a lens that cannot draw is not a reason
 * to refuse an app that used to compile, and every one is at its path.
 */
export function checkDeclaredLenses<S extends AnySchema>(ctx: CheckContext<S>): void {
  const declared = declaredLenses(ctx.app);
  for (const finding of declared.findings) {
    ctx.add({ severity: finding.severity, code: finding.code, where: finding.path, message: finding.message, fix: finding.fix });
  }
  /*
   * A STATUS BOARD WITH A COLUMN NOTHING MOVES A CARD INTO (FR-108): a note,
   * not a warning — a column a record only starts in, or only an import
   * sets, is a design — but one the author should have chosen.
   */
  const own = ctx.app.mutations ?? [];
  const acts = [...own, ...deriveMutations(ctx.app.schema, own)];
  for (const lens of declared.drawn.filter((one) => one.lens === "columns")) {
    for (const [kind, roles] of Object.entries((lens.options["bindings"] ?? {}) as Record<string, { column?: string }>)) {
      if (!roles.column) continue;
      const reach = columnReach(ctx.app.schema, acts, kind, roles.column);
      const unreached = reach.filter((one) => one.by === "none");
      // A board nothing moves on at all is a picture of where things stand, and `describe` says so; the note is for the gaps in one that moves.
      if (unreached.length === 0 || unreached.length === reach.length) continue;
      ctx.add({
        severity: "note",
        code: "lens-column-unreached",
        where: `lenses.${lens.index}.bindings.${kind}.column`,
        message: `"${lens.title}" has ${unreached.length === 1 ? "a column" : "columns"} no act moves a card into: ${unreached.map((one) => one.label).join(", ")}.`,
        fix: `Give ${kind} an act that sets ${roles.column} to ${unreached.map((one) => `"${one.value}"`).join(" or ")} (a named step), or one that takes the ${roles.column} it is given.`,
      });
    }
  }
}

/** What `pages` names that is not there: a kind in `order` or `hide`, a place for `first` (FR-80). */
export function checkPagesArrangement<S extends AnySchema>(ctx: CheckContext<S>): void {
  for (const finding of arrangementFindings(ctx.app)) {
    ctx.add({ severity: finding.severity, code: finding.code, where: finding.path, message: finding.message, fix: finding.fix });
  }
}
