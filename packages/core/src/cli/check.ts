import type { GraviewApp } from "../app.js";
import { nodeRefArgs } from "../mutations/node-ref.js";
import { permits, rolesOf } from "../permissions/policy.js";
import { checkBrandContrast } from "../theme/derive.js";
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
  const mutations = new Map((app.mutations ?? []).map((m) => [m.name, m]));
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
          (kind) => permits(app.policy, { kind: "human", roles: [role] }, mutation.name, kind).ok,
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
      const canDo = (app.mutations ?? []).some((mutation) => {
        const subjectKinds =
          mutation.subject && mutation.subject.kinds !== "*"
            ? (mutation.subject.kinds as readonly string[])
            : [undefined];
        return subjectKinds.some(
          (kind) => permits(app.policy, { kind: "human", roles: [role] }, mutation.name, kind).ok,
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
      const bindings = rawBindings as Record<string, string>;
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
      for (const [role, field] of Object.entries(bindings)) {
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
