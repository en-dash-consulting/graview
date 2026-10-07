/**
 * MODULES: named parts of a declaration a workspace can turn on and off.
 *
 * A deployed app needs to scope itself per workspace — one household wants
 * Vehicles, another does not — and "comment out the import" is not a thing a
 * hosted product can offer. A module is a declared subset of the app's
 * surface: node kinds, mutations, invariants. The enabled set is plain
 * serializable config, which is what lets a platform bind it to entitlements.
 *
 * Two rules keep this honest. Anything no module claims is CORE and always
 * on — an app pays for the concept only where it opts in. And disabling
 * never deletes: nodes of a disabled kind stay in the graph and simply stop
 * being drawn, counted or judged, so re-enabling brings a workspace back
 * intact. "Module off" is a horizon, not a delete.
 */

export interface ModuleDeclaration {
  readonly description?: string;
  /** Node kinds this module owns. */
  readonly kinds?: readonly string[];
  /** Mutation names this module owns. */
  readonly mutations?: readonly string[];
  /** Invariant names this module owns. */
  readonly invariants?: readonly string[];
  /** Modules this one cannot stand without. */
  readonly requires?: readonly string[];
  /**
   * A module that is never off.
   *
   * People are not a bolt-on for a grounds app, or a rota, or anything else
   * several people use: an installation without people is a household of one,
   * which is a graph with no user NODES rather than a disabled module. An app
   * in that position had two options, both bad — drop the module, which draws
   * the installation for everybody and loses the thing the module is for, or
   * carry a permanent `module-edge-leak` warning for every edge the domain
   * points at a person and hope nobody stops reading them.
   *
   * A warning that can only ever be acknowledged costs the checker its
   * authority on the warnings that matter, so the declaration can say the
   * thing that makes the question moot: this cannot be off, so no line
   * dangles. `resolveModules` keeps it on whatever the enabled set says, and
   * `graview check` skips the leak warning for edges reaching into it.
   */
  readonly required?: boolean;
  /**
   * Who the module's kinds are drawn for. `always` (the default) is every
   * seat; `admin` keeps them out of the picture until a seat that may run
   * one of the module's acts asks to see them — the installation's own
   * users and invitations sit beside the domain for the person who keeps
   * it, and are never a district for anyone else.
   */
  readonly visibility?: "always" | "admin";
}

export type ModuleMap = Readonly<Record<string, ModuleDeclaration>>;

/** What an enabled set works out to, asked once and shared by every surface. */
export interface ModuleProjection {
  /** Module names actually on, requirements included. */
  readonly enabled: ReadonlySet<string>;
  readonly disabledKinds: ReadonlySet<string>;
  readonly disabledMutations: ReadonlySet<string>;
  readonly disabledInvariants: ReadonlySet<string>;
  /** Enabled modules drawn only for those who administer them, by name. */
  readonly administered: ReadonlyMap<string, ModuleDeclaration>;
}

const NOTHING: ReadonlySet<string> = new Set();

/**
 * Resolves an enabled set against the declared modules.
 *
 * `enabled: undefined` means everything — the default install is the whole
 * app, and a store that never heard of modules behaves exactly as before.
 * Enabling a module quietly enables what it `requires`, transitively: at
 * runtime the forgiving reading is correct (an entitlement flip must not
 * strand a workspace), and the strict reading lives in `graview check`,
 * which reports a requirement pointing at a module nobody declared.
 */
export function resolveModules(
  modules: ModuleMap | undefined,
  enabled: readonly string[] | undefined,
): ModuleProjection {
  if (!modules || enabled === undefined) {
    return {
      enabled: new Set(Object.keys(modules ?? {})),
      disabledKinds: NOTHING,
      disabledMutations: NOTHING,
      disabledInvariants: NOTHING,
      administered: administeredOf(modules, new Set(Object.keys(modules ?? {}))),
    };
  }

  const on = new Set<string>();
  const turnOn = (name: string) => {
    if (on.has(name) || !(name in modules)) return;
    on.add(name);
    for (const required of modules[name]?.requires ?? []) turnOn(required);
  };
  for (const name of enabled) turnOn(name);
  /* A module that declares itself required is on whatever the config says. */
  for (const [name, module] of Object.entries(modules)) if (module.required) turnOn(name);

  const disabledKinds = new Set<string>();
  const disabledMutations = new Set<string>();
  const disabledInvariants = new Set<string>();
  for (const [name, module] of Object.entries(modules)) {
    if (on.has(name)) continue;
    for (const kind of module.kinds ?? []) disabledKinds.add(kind);
    for (const mutation of module.mutations ?? []) disabledMutations.add(mutation);
    for (const invariant of module.invariants ?? []) disabledInvariants.add(invariant);
  }
  /*
   * A kind two modules claim stays on while EITHER is enabled — ownership
   * is a union, and the disabled set only holds what nothing enabled wants.
   */
  for (const name of on) {
    const module = modules[name];
    for (const kind of module?.kinds ?? []) disabledKinds.delete(kind);
    for (const mutation of module?.mutations ?? []) disabledMutations.delete(mutation);
    for (const invariant of module?.invariants ?? []) disabledInvariants.delete(invariant);
  }

  return { enabled: on, disabledKinds, disabledMutations, disabledInvariants, administered: administeredOf(modules, on) };
}

function administeredOf(
  modules: ModuleMap | undefined,
  on: ReadonlySet<string>,
): ReadonlyMap<string, ModuleDeclaration> {
  const found = new Map<string, ModuleDeclaration>();
  for (const [name, module] of Object.entries(modules ?? {})) {
    if (on.has(name) && module.visibility === "admin") found.set(name, module);
  }
  return found;
}
