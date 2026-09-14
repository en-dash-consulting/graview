import type { GraviewApp } from "../app.js";
import {
  deriveEditMutations,
  editVia,
  fieldWriters,
  subjectKindsOf,
  unwrittenFields,
} from "../mutations/derive-edits.js";
import { nodeRefArgs } from "../mutations/node-ref.js";
import { figureFaults, FIGURE_NAMES } from "../schema/figures.js";
import { withArticle } from "../schema/define-node.js";
import { permits, rolesOf } from "../permissions/policy.js";
import { checkBrandContrast } from "../theme/derive.js";
import { checkKitContrast, resolveKit } from "../theme/kit.js";
import type { Scheme } from "../theme/types.js";
import type { AnySchema } from "../schema/schema.js";

export type Severity = "error" | "warning";

export interface Finding {
  readonly severity: Severity;
  readonly code: string;
  /** Where the problem is, in terms an agent can act on. */
  readonly where: string;
  readonly message: string;
  /** The concrete edit that would fix it. */
  readonly fix: string;
}

export interface CheckResult {
  readonly app: string;
  readonly findings: readonly Finding[];
  readonly errors: number;
  readonly warnings: number;
  readonly ok: boolean;
}

/**
 * The build-time safety net. Most of these mistakes are already typecheck
 * failures — an edge to an undeclared kind, a view for a kind nobody
 * declared — but a schema assembled dynamically, or an app mid-rename, can
 * slip past `tsc`. Every message names the file-level thing to change,
 * because the primary reader is an agent editing the declaration.
 */
export function checkApp<S extends AnySchema>(app: GraviewApp<S>): CheckResult {
  const findings: Finding[] = [];
  const kinds = new Set<string>(app.schema.kinds as readonly string[]);
  const declaredMutations = app.mutations ?? [];
  const derivedEdits = deriveEditMutations(app.schema, declaredMutations);
  // Declared and derived: a grant may name `edit-<kind>`, and a repair may too.
  const mutations = new Map([...declaredMutations, ...derivedEdits].map((m) => [m.name, m]));
  const invariants = new Map((app.invariants ?? []).map((i) => [i.name, i]));

  const add = (f: Finding) => findings.push(f);

  /*
   * MODULE BOUNDARIES hold statically, before any workspace flips a toggle.
   *
   * The runtime is forgiving — enabling a module drags its requirements in —
   * so the strict reading lives here: a module naming things nobody
   * declared, a requirement naming a module nobody wrote, and the leak that
   * only shows the day someone turns a module off: an always-on kind whose
   * edge reaches into a module. Ownership by kind, so the reasoning is
   * checkable per edge.
   */
  /*
   * The routed face derives `/:plural` from each kind's plural. Two kinds
   * whose plurals slug identically would leave one of them unreachable by
   * registration order — a route nobody can link to.
   */
  const slugs = new Map<string, string>();
  for (const definition of app.schema.definitions) {
    const plural = definition.plural ?? `${definition.kind}s`;
    const slug = plural.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const taken = slugs.get(slug);
    if (taken) {
      add({
        severity: "error",
        code: "plural-slug-collision",
        where: `defineNode("${definition.kind}").plural`,
        message: `"${plural}" slugs to "/${slug}", already taken by kind "${taken}".`,
        fix: `Give one of them a distinct plural.`,
      });
    } else {
      slugs.set(slug, definition.kind);
    }
  }

  /*
   * A declared provider's allowlist must name real mutations — a metering
   * or narrowing rule pointing at nothing enforces nothing.
   */
  for (const provider of app.intelligence ?? []) {
    for (const may of provider.may ?? []) {
      if (!mutations.has(may)) {
        add({
          severity: "error",
          code: "intelligence-unknown-mutation",
          where: `intelligence["${provider.name}"].may`,
          message: `Provider "${provider.name}" is allowed "${may}", which is not registered.`,
          fix: `Register the mutation, or remove it from the allowlist.`,
        });
      }
    }
  }

  /*
   * A FIGURE THAT CANNOT BE DRAWN IS A BLANK NOBODY EXPLAINS.
   *
   * Every fault here looks fine in the file and fails on a screen: art with
   * no `viewBox` cannot be sized by anything that draws it, a literal
   * colour ignores the scheme and the kind's hue — and is therefore
   * invisible in one of the two, which nobody notices until somebody
   * switches — and a name that is not in the shipped set is a silent gap
   * where a drawing should be.
   */
  for (const definition of app.schema.definitions) {
    for (const [where, figure] of [
      [`defineNode("${definition.kind}").figure`, definition.figure],
      [`brand.figures["${definition.kind}"]`, app.brand?.figures?.[definition.kind]],
    ] as const) {
      if (!figure) continue;
      for (const fault of figureFaults(figure)) {
        add({
          severity: "error",
          code: "figure-undrawable",
          where,
          message: `The figure for "${definition.kind}" cannot be drawn: ${fault}`,
          fix: `Give it one viewBox and currentColor strokes with no fill, or name one of: ${FIGURE_NAMES.join(", ")}.`,
        });
      }
    }
  }
  for (const kind of Object.keys(app.brand?.figures ?? {})) {
    if (kinds.has(kind)) continue;
    add({
      severity: "error",
      code: "figure-unknown-kind",
      where: `brand.figures["${kind}"]`,
      message: `The brand draws a figure for "${kind}", which this app does not declare.`,
      fix: `Remove it, or declare the kind.`,
    });
  }

  /*
   * A SETTING NOBODY CAN HONOUR IS A CONTROL THAT DOES NOTHING.
   *
   * The profile pane draws what the app declares, and the shell knows
   * exactly two ways to carry an answer to every surface. A setting with
   * one option is not a setting; one whose starting value is not among its
   * options opens on an answer nobody chose and cannot choose again; two
   * settings with one name write over each other's storage.
   */
  const settingNames = new Set<string>();
  const HONOURED = ["root-font-size", "root-attribute"] as const;
  for (const setting of app.settings ?? []) {
    const where = `settings["${setting.name}"]`;
    if (!/^[a-z][a-z0-9-]*$/.test(setting.name)) {
      add({
        severity: "error",
        code: "setting-name-unusable",
        where,
        message: `"${setting.name}" becomes a storage key and a data-graview- attribute, so it must be kebab-case.`,
        fix: `Rename it to lower-case letters, digits and hyphens — "text-size", not "${setting.name}".`,
      });
    }
    if (settingNames.has(setting.name)) {
      add({
        severity: "error",
        code: "setting-name-taken",
        where,
        message: `Two settings are called "${setting.name}"; they would write over each other.`,
        fix: `Give one of them another name.`,
      });
    }
    settingNames.add(setting.name);
    if (!(HONOURED as readonly string[]).includes(setting.honoured)) {
      add({
        severity: "error",
        code: "setting-not-honourable",
        where: `${where}.honoured`,
        message: `Nothing knows how to apply "${setting.honoured}", so this control would do nothing.`,
        fix: `Use ${HONOURED.map((one) => `"${one}"`).join(" or ")}.`,
      });
    }
    if (setting.options.length < 2) {
      add({
        severity: "error",
        code: "setting-without-a-choice",
        where: `${where}.options`,
        message: `A setting with ${setting.options.length === 0 ? "no" : "one"} option is not something a person can set.`,
        fix: `Declare at least two options, or drop the setting.`,
      });
    }
    if (!setting.options.some((option) => option.value === setting.initial)) {
      add({
        severity: "error",
        code: "setting-starts-nowhere",
        where: `${where}.initial`,
        message: `It opens on "${setting.initial}", which is not one of its options — nobody could choose it back.`,
        fix: `Set initial to one of: ${setting.options.map((option) => `"${option.value}"`).join(", ")}.`,
      });
    }
    if (setting.honoured === "root-font-size") {
      for (const option of setting.options) {
        // The starting option means "leave it as the reader has it" and
        // stamps nothing, so it is a word rather than a length.
        if (option.value === setting.initial) continue;
        if (!/^[0-9.]+(px|rem|em|%|pt)$/.test(option.value)) {
          add({
            severity: "error",
            code: "setting-not-a-length",
            where: `${where}.options["${option.value}"]`,
            message: `A root font size has to be a CSS length; "${option.value}" is not one.`,
            fix: `Use a length with a unit, such as "18px".`,
          });
        }
      }
    }
  }

  /*
   * The migration chain must actually reach the declared version. A stored
   * graph at version 1 with a declaration at 3 and a hole at 2 is a
   * deployment that cannot start — findable here instead of there.
   */
  if (app.version !== undefined) {
    const steps = new Map((app.migrations ?? []).map((m) => [m.from, m]));
    for (const migration of app.migrations ?? []) {
      if (migration.to !== migration.from + 1) {
        add({
          severity: "error",
          code: "migration-not-single-step",
          where: `migrations[${migration.from}→${migration.to}]`,
          message: `Migrations move one version at a time; this one jumps ${migration.from}→${migration.to}.`,
          fix: `Split it into single steps so any stored version has a path.`,
        });
      }
    }
    for (let at = 1; at < app.version; at++) {
      if (!steps.has(at)) {
        add({
          severity: "error",
          code: "migration-gap",
          where: `defineApp("${app.name}").migrations`,
          message: `No migration from version ${at}, so a graph stored at ${at} cannot reach ${app.version}.`,
          fix: `Declare a migration { from: ${at}, to: ${at + 1}, ... }.`,
        });
      }
    }
  } else if ((app.migrations ?? []).length > 0) {
    add({
      severity: "error",
      code: "migration-without-version",
      where: `defineApp("${app.name}").version`,
      message: `Migrations are declared but the app declares no version to migrate to.`,
      fix: `Declare version: <n> alongside the migrations.`,
    });
  }

  /*
   * A declared kind accent must name a declared kind. A typo here would not
   * fail — it would quietly fall back to the hash, which is the worst kind
   * of wrong: a brand decision that looks applied and is not.
   */
  for (const [kind, hue] of Object.entries(app.brand?.accents ?? {})) {
    if (!kinds.has(kind)) {
      add({
        severity: "error",
        code: "brand-accent-unknown-kind",
        where: `brand.accents["${kind}"]`,
        message: `An accent is declared for "${kind}", which no defineNode declares.`,
        fix: `Fix the kind name, or remove the entry. Declared: ${[...kinds].join(", ")}.`,
      });
    }
    if (typeof hue !== "number" || !Number.isFinite(hue)) {
      add({
        severity: "error",
        code: "brand-accent-not-a-hue",
        where: `brand.accents["${kind}"]`,
        message: `The accent must be a hue in degrees (a number), got ${JSON.stringify(hue)}.`,
        fix: `Use a number 0–360, e.g. 152 for a green.`,
      });
    }
  }

  const moduleEntries = Object.entries(app.modules ?? {});
  const owners = new Map<string, Set<string>>();
  for (const [name, module] of moduleEntries) {
    for (const kind of module.kinds ?? []) {
      const set = owners.get(kind) ?? new Set<string>();
      set.add(name);
      owners.set(kind, set);
    }
  }
  const reach = (name: string): Set<string> => {
    const seen = new Set<string>();
    const walk = (current: string) => {
      if (seen.has(current)) return;
      seen.add(current);
      for (const required of (app.modules ?? {})[current]?.requires ?? []) walk(required);
    };
    walk(name);
    return seen;
  };
  for (const [name, module] of moduleEntries) {
    for (const kind of module.kinds ?? []) {
      if (!kinds.has(kind)) {
        add({
          severity: "error",
          code: "module-unknown-kind",
          where: `modules["${name}"].kinds`,
          message: `Module "${name}" claims kind "${kind}", which no defineNode declares.`,
          fix: `Declare the kind, or remove it from the module.`,
        });
      }
    }
    for (const mutation of module.mutations ?? []) {
      if (!mutations.has(mutation)) {
        add({
          severity: "error",
          code: "module-unknown-mutation",
          where: `modules["${name}"].mutations`,
          message: `Module "${name}" claims mutation "${mutation}", which is not registered.`,
          fix: `Register the mutation, or remove it from the module.`,
        });
      }
    }
    for (const invariant of module.invariants ?? []) {
      if (!invariants.has(invariant)) {
        add({
          severity: "error",
          code: "module-unknown-invariant",
          where: `modules["${name}"].invariants`,
          message: `Module "${name}" claims invariant "${invariant}", which is not registered.`,
          fix: `Register the invariant, or remove it from the module.`,
        });
      }
    }
    for (const required of module.requires ?? []) {
      if (!(required in (app.modules ?? {}))) {
        add({
          severity: "error",
          code: "module-unknown-requirement",
          where: `modules["${name}"].requires`,
          message: `Module "${name}" requires "${required}", which no module declares.`,
          fix: `Declare the module, or drop the requirement.`,
        });
      }
    }
  }
  if (moduleEntries.length > 0) {
    for (const definition of app.schema.definitions) {
      const from = owners.get(definition.kind);
      const fromReach =
        from === undefined
          ? null
          : new Set([...from].flatMap((name) => [...reach(name)]));
      for (const [edgeKind, edge] of Object.entries(definition.edges)) {
        if (edge.to === "*") continue;
        for (const target of edge.to) {
          const targetOwners = owners.get(target);
          if (!targetOwners) continue; // core is always on
          const safe =
            fromReach === null
              ? false // an always-on kind reaching into a module
              : [...targetOwners].some((owner) => fromReach.has(owner));
          if (!safe) {
            add({
              severity: "warning",
              code: "module-edge-leak",
              where: `defineNode("${definition.kind}").edges["${edgeKind}"]`,
              message: `Edge "${edgeKind}" reaches "${target}", owned by module ${[...targetOwners].map((o) => `"${o}"`).join("/")} — the line dangles wherever that module is off.`,
              fix:
                fromReach === null
                  ? `Move "${definition.kind}" into the module, or make the module require nothing this kind depends on.`
                  : `Add the target's module to modules["${[...(from ?? [])].join('"/"')}"].requires, or move the edge into the module.`,
            });
          }
        }
      }
    }
  }

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
       * good label, so slug-similarity is not the signal. A hyphen, an
       * underscore or interior capitals in a single word is.
       */
      if (/[-_]/.test(mutation.title) || /^[a-z]+[A-Z]/.test(mutation.title)) {
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

  /*
   * A policy that locks somebody out of everything, or locks everybody out of
   * something.
   *
   * Both are mistakes in the declaration rather than at runtime, and both are
   * silent: a mutation no role can run looks exactly like a mutation nobody
   * happens to have needed yet, and a role with nothing to do looks exactly
   * like a role whose grants are elsewhere. The person who finds either is
   * otherwise the person standing in front of a button they cannot press.
   */
  if (app.policy) {
    const roles = rolesOf(app.policy);
    for (const mutation of app.mutations ?? []) {
      const subjectKinds =
        mutation.subject && mutation.subject.kinds !== "*"
          ? (mutation.subject.kinds as readonly string[])
          : [undefined];
      const reachable = roles.some((role) =>
        subjectKinds.some(
          // A self grant counts: a role that may edit its own record may do
          // something, so the role is judged as somebody acting on themselves.
          (kind) =>
            permits(app.policy, { kind: "human", id: "themselves", roles: [role] }, mutation.name, kind, undefined, "themselves").ok,
        ),
      );
      const openToAll = subjectKinds.some(
        (kind) => permits(app.policy, { kind: "human", roles: [] }, mutation.name, kind).ok,
      );
      if (!reachable && !openToAll) {
        add({
          severity: "error",
          code: "mutation-unreachable-by-any-role",
          where: `policy.grants (mutation "${mutation.name}")`,
          message: `No role may ever run "${mutation.name}", so it is declared and unreachable.`,
          fix: `Grant it to a role, or remove the mutation.${
            roles.length > 0 ? ` Roles in this policy: ${roles.join(", ")}.` : ""
          }`,
        });
      }
    }

    for (const role of roles) {
      /*
       * Declared AND derived acts count, and a self grant counts: a role
       * that may edit its own record may do something. The role is judged
       * as somebody acting on themselves, which is the most a self grant
       * ever allows.
       */
      const canDo = [...mutations.values()].some((mutation) => {
        const subjectKinds =
          mutation.subject && mutation.subject.kinds !== "*"
            ? (mutation.subject.kinds as readonly string[])
            : [undefined];
        const via = mutation.derived
          ? declaredMutations
              .filter((m) => (m.creates ?? []).includes(mutation.derived!.edit as never) || (m.writes ?? []).length > 0)
              .map((m) => m.name)
          : undefined;
        return subjectKinds.some(
          (kind) =>
            permits(app.policy, { kind: "human", id: "themselves", roles: [role] }, mutation.name, kind, via, "themselves").ok,
        );
      });
      if (!canDo) {
        add({
          severity: "warning",
          code: "role-may-do-nothing",
          where: `policy.grants (role "${role}")`,
          message: `"${role}" may run no mutation, so anyone holding it can only read.`,
          fix: "Grant it something, or drop the role if read-only was the intent.",
        });
      }
    }

    for (const grant of app.policy.grants) {
      if (grant.mutations === "*") continue;
      for (const name of grant.mutations) {
        if (mutations.has(name)) continue;
        add({
          severity: "error",
          code: "grant-unknown-mutation",
          where: "policy.grants",
          message: `Grants "${name}", which no mutation declares.`,
          fix: `Register a mutation called "${name}", or drop it from the grant.`,
        });
      }
      if (grant.kinds === undefined || grant.kinds === "*") continue;
      for (const kind of grant.kinds) {
        if (kinds.has(kind)) continue;
        add({
          severity: "error",
          code: "grant-unknown-kind",
          where: "policy.grants",
          message: `Restricted to "${kind}", which no defineNode declares.`,
          fix: `Use one of: ${[...kinds].join(", ")}.`,
        });
      }
    }
  }

  /*
   * A palette that cannot be read.
   *
   * The two shipped schemes are not inversions of each other, and a brand
   * that supplies one colour and lets the rest be derived can end up with
   * text that clears AA in the dark and fails badly on paper. Contrast is
   * measurable, so it is checked rather than trusted — and the failure names
   * the exact token PAIR and where it is drawn, because "your theme has a
   * contrast problem" is not something anyone can act on.
   */
  if (app.brand) {
    for (const finding of checkBrandContrast(app.brand.schemes)) {
      if (finding.unreadable !== undefined) {
        add({
          severity: "warning",
          code: "theme-token-unreadable",
          where: `brand.schemes.${finding.scheme}.${finding.on === finding.ink ? finding.ink : finding.on}`,
          message: `Could not read "${finding.unreadable}" as a colour, so the pair ${finding.ink} on ${finding.on} was not checked.`,
          fix: "Use a hex, rgb() or hsl() value, or a gradient built from them.",
        });
        continue;
      }
      add({
        severity: "error",
        code: "theme-contrast-below-aa",
        where: `brand.schemes.${finding.scheme}: ${finding.ink} on ${finding.on}`,
        message: `${finding.ratio}:1 where ${finding.requires}:1 is required — ${finding.where}.`,
        fix: `Darken or lighten "${finding.ink}", or change the ground it sits on.`,
      });
    }
    /*
     * The kit's colours are held to the same standard as the text's, at the
     * graphics floor: a line a brand paints explicitly must be told from
     * the ground it crosses, on both grounds, in both schemes.
     */
    if (app.brand.kit) {
      const kit = resolveKit(app.brand.kit);
      const unreadable = new Set<string>();
      for (const scheme of Object.keys(app.brand.schemes) as Scheme[]) {
        for (const finding of checkKitContrast(kit, app.brand.schemes[scheme])) {
          const where = `brand.kit.connectors.${finding.edgeKind === "*" ? "all" : `byEdge.${finding.edgeKind}`}.colour`;
          if (finding.unreadable !== undefined) {
            if (unreadable.has(where)) continue;
            unreadable.add(where);
            add({
              severity: "warning",
              code: "kit-colour-unreadable",
              where,
              message: `Could not read "${finding.unreadable}" as a colour, so the line was not checked against the ground.`,
              fix: "Use a hex, rgb() or hsl() value.",
            });
            continue;
          }
          add({
            severity: "error",
            code: "kit-contrast-below-aa",
            where: `${where} in ${scheme}`,
            message: `${finding.ratio}:1 against the ground where ${finding.requires}:1 is required for a line to be seen.`,
            fix: `Darken or lighten "${finding.colour}", or drop it and let the kind's own hue paint the line.`,
          });
        }
      }
    }
    if (app.brand.name.trim().length === 0) {
      add({
        severity: "warning",
        code: "brand-unnamed",
        where: "brand.name",
        message: "An installation with no name shows the framework's wordmark instead of yours.",
        fix: "Set brand.name to the product name.",
      });
    }
  }

  // A node kind whose declaration demands an invariant nobody wrote will
  // silently skip at runtime. That is the right default for evaluation but
  // the wrong default for a build.
  for (const definition of app.schema.definitions) {
    if (!definition.requiresInvariant) continue;
    const covered = new Set(
      (app.invariants ?? [])
        .filter((i) => i.scope !== "graph" && i.scope.kind === definition.kind)
        .map((i) => i.name),
    );
    if (covered.size === 0) {
      add({
        severity: "warning",
        code: "required-invariant-unregistered",
        where: `defineNode("${definition.kind}").requiresInvariant`,
        message: `"${definition.kind}" declares that its nodes require an invariant, but none is registered for that kind.`,
        fix: `Add a defineInvariant scoped to "${definition.kind}", or drop requiresInvariant.`,
      });
    }
  }

  if (app.views) {
    const withViews = new Set(app.views.kindsWithViews());
    for (const kind of kinds) {
      if (!withViews.has(kind)) {
        add({
          severity: "warning",
          code: "kind-without-view",
          where: `defineNode("${kind}")`,
          message: `No view is registered for "${kind}" — it will fall back to a primitive.`,
          fix: `Register a view with views.register("${kind}", { cardinality, fidelity }, Component), or accept the primitive fallback.`,
        });
      }
    }
    for (const registration of app.views.all()) {
      if (!kinds.has(registration.kind)) {
        add({
          severity: "error",
          code: "view-for-undeclared-kind",
          where: `views.register("${registration.kind}", ...)`,
          message: `A view is registered for "${registration.kind}", which no defineNode declares.`,
          fix: `Declare the kind, or remove the view registration.`,
        });
      }
    }
  }

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
    if (lens.binds === "entities") {
      const bindings = (lens.bindings ?? {}) as Record<string, Record<string, string>>;
      for (const role of lens.requiredRoles) {
        if (!(role in bindings)) {
          add({
            severity: "error",
            code: "lens-role-unbound",
            where: `lens "${lens.name}" bindings`,
            message: `Lens "${lens.name}" requires role "${role}", which nothing binds.`,
            fix: `Add ${role}: { kind: "<node kind>" } or { edge: "<edge kind>" }.`,
          });
        }
      }
      /** The kind a role names, so a field binding can be checked against it. */
      const kindOfRole = (role: string): string | undefined => bindings[role]?.["kind"];

      for (const [role, binding] of Object.entries(bindings)) {
        const kind = binding["kind"];
        const edge = binding["edge"];
        const field = binding["field"];
        if (kind !== undefined && !kinds.has(kind)) {
          add({
            severity: "error",
            code: "lens-binding-undeclared-kind",
            where: `lens "${lens.name}" bindings.${role}`,
            message: `Role "${role}" names kind "${kind}", which no defineNode declares.`,
            fix: `Use one of: ${[...kinds].join(", ")}.`,
          });
        }
        if (edge !== undefined && !edgeKinds.has(edge)) {
          add({
            severity: "error",
            code: "lens-binding-undeclared-edge",
            where: `lens "${lens.name}" bindings.${role}`,
            message: `Role "${role}" names edge "${edge}", which no defineNode declares.`,
            fix: `Use one of: ${[...edgeKinds].join(", ")}.`,
          });
        }
        if (field !== undefined) {
          const owner = binding["on"];
          const ownerKind = owner === undefined ? undefined : kindOfRole(owner);
          if (owner === undefined || ownerKind === undefined) {
            add({
              severity: "error",
              code: "lens-binding-fieldless-owner",
              where: `lens "${lens.name}" bindings.${role}`,
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
                where: `lens "${lens.name}" bindings.${role}`,
                message: `Role "${role}" maps to field "${field}", which "${ownerKind}" does not declare.`,
                fix: `Point it at one of: ${Object.keys(shape).join(", ")}.`,
              });
            }
          }
        }
        if (kind === undefined && edge === undefined && field === undefined) {
          add({
            severity: "error",
            code: "lens-binding-empty",
            where: `lens "${lens.name}" bindings.${role}`,
            message: `Role "${role}" binds nothing.`,
            fix: `Give it { kind: "<node kind>" }, { edge: "<edge kind>" } or { field: "<field>", on: "<role>" }.`,
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
          where: `lens "${lens.name}" bindings`,
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
            where: `lens "${lens.name}" bindings.${kind}.${role}`,
            message: `Role "${role}" is bound to ${JSON.stringify(bound)}, which is neither a field name nor { field, is }.`,
            fix: `Use a field name, or { field: "<field>", is: ["<value>", …] }.`,
          });
          continue;
        }
        if (!(field in shape)) {
          add({
            severity: "error",
            code: "lens-binding-missing-field",
            where: `lens "${lens.name}" bindings.${kind}.${role}`,
            message: `Role "${role}" maps to field "${field}", which "${kind}" does not declare.`,
            fix: `Point it at one of: ${Object.keys(shape).join(", ")}.`,
          });
        }
      }
      for (const role of lens.requiredRoles) {
        if (!(role in bindings)) {
          add({
            severity: "error",
            code: "lens-role-unbound",
            where: `lens "${lens.name}" bindings.${kind}`,
            message: `Lens "${lens.name}" requires role "${role}", which "${kind}" does not bind.`,
            fix: `Add ${role}: "<field name>" to the bindings for "${kind}".`,
          });
        }
      }
    }
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;
  return { app: app.name, findings, errors, warnings, ok: errors === 0 };
}

/**
 * The field a role is bound to, whichever of the two shapes was written: a
 * bare field name, or `{ field, is }` — a field and the values that make the
 * role true, the same shape `lifecycle` takes. Undefined when it is neither.
 */
function fieldOf(bound: unknown): string | undefined {
  if (typeof bound === "string") return bound;
  if (bound !== null && typeof bound === "object") {
    const field = (bound as { field?: unknown }).field;
    const is = (bound as { is?: unknown }).is;
    if (typeof field === "string" && Array.isArray(is) && is.length > 0) return field;
  }
  return undefined;
}

export function formatFindings(result: CheckResult): string {
  if (result.findings.length === 0) {
    return `graview check: ${result.app} — no problems found.`;
  }
  const lines = result.findings.map(
    (f) =>
      `${f.severity === "error" ? "ERROR" : "warn "} [${f.code}] ${f.where}\n` +
      `        ${f.message}\n        fix: ${f.fix}`,
  );
  return [
    `graview check: ${result.app}`,
    ...lines,
    `${result.errors} error(s), ${result.warnings} warning(s)`,
  ].join("\n");
}
