import { pascal, titleCase } from "./index.js";
import type { ScaffoldFile } from "./index.js";

/**
 * `graview lens <name>`: a lens, started.
 *
 * `graview figure` draws line art for a kind, and nothing generated a lens.
 * The `graview-lens` skill is excellent about the RULES — bind roles not
 * field names, fail loudly on a bad binding, mark every target with
 * `data-graview-pick`, three fidelities, a title that makes it a place — and
 * those are exactly the rules that are easy to agree with and easy to forget
 * at line 300.
 *
 * So the stub has all of them already in it, and the reuse test — the one
 * instruction with nothing enforcing it — starts life as a RED test in a
 * domain the app is not about, rather than as a good intention. A lens whose
 * reuse test cannot be written is a view; the stub says so in the place
 * where you would find that out.
 */

export interface LensScaffoldOptions {
  /** The lens's name, as a slug: "grounds-map". */
  readonly name: string;
  /** Roles the lens requires an app to bind. */
  readonly roles: readonly string[];
  /** Field names onto roles, or roles onto whole kinds and edges. */
  readonly binds?: "fields" | "entities";
  /** Where the lens goes. Defaults to `src/ui/lens`. */
  readonly dir?: string;
}

export function validateLensOptions(options: LensScaffoldOptions): readonly string[] {
  const problems: string[] = [];
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(options.name)) {
    problems.push(`"${options.name}" is not a slug: lower case, hyphen-separated, e.g. grounds-map`);
  }
  if (options.roles.length === 0) {
    problems.push("a lens needs at least one role: --roles rows,columns,link");
  }
  for (const role of options.roles) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(role)) problems.push(`"${role}" is not a role name`);
  }
  return problems;
}

/** The files a new lens is: the lens itself, and the test that proves it. */
export function scaffoldLens(options: LensScaffoldOptions): readonly ScaffoldFile[] {
  const dir = (options.dir ?? "src/ui/lens").replace(/\/+$/, "");
  const binds = options.binds ?? "fields";
  const Name = pascal(options.name);
  const title = titleCase(options.name);
  const roles = options.roles;
  return [
    { path: `${dir}/${options.name}.tsx`, contents: lensTsx(options.name, Name, title, roles, binds) },
    { path: `${dir}/${options.name}.reuse.test.tsx`, contents: reuseTest(options.name, Name, roles, binds) },
  ];
}

function rolesType(roles: readonly string[], binds: "fields" | "entities"): string {
  return roles
    .map((role) =>
      binds === "fields"
        ? `  /** The field that fills "${role}". */\n  readonly ${role}: string;`
        : `  /** The kind or edge that fills "${role}". */\n  readonly ${role}: { readonly kind: string } | { readonly edge: string };`,
    )
    .join("\n");
}

function lensTsx(
  name: string,
  Name: string,
  title: string,
  roles: readonly string[],
  binds: "fields" | "entities",
): string {
  const first = roles[0] ?? "rows";
  return `import { Chip, Panel } from "@graview/primitives";
import { useGraview, type ViewProps } from "@graview/react";
import type { AnySchema } from "@graview/core";

/**
 * ${title} — a lens.
 *
 * A lens knows nothing about your domain: it knows there is ${roles
   .map((role) => `a "${role}"`)
   .join(", ")}, and an app says which of its own ${
    binds === "fields" ? "fields" : "kinds and edges"
  } fill them. That indirection is the whole point, and the test beside this
 * file is where the claim is kept honest.
 */

export const ${constantName(name)}_REQUIRED_ROLES = [${roles.map((role) => `"${role}"`).join(", ")}] as const;

export interface ${Name}Roles {
${rolesType(roles, binds)}
}

/** Thrown when an app binds a role to something that is not there. */
export class ${Name}BindingError extends Error {
  /** A sentence about what to do, which the scene's panel prints. */
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "${Name}BindingError";
    this.hint = hint;
  }
}

/**
 * FAIL LOUDLY ON A BAD BINDING — and loudly means this panel, not the page:
 * the scene puts an error boundary around every view, so a throw draws the
 * message and the hint where the picture would have been.
 */
function check<S extends AnySchema>(roles: ${Name}Roles, schema: S): void {
  for (const role of ${constantName(name)}_REQUIRED_ROLES) {
    if (roles[role] === undefined) {
      throw new ${Name}BindingError(
        \`${title} has no "\${role}" bound.\`,
        \`Add \${role} to the lens bindings for this kind.\`,
      );
    }
  }
  void schema;
}

export function build${Name}(
  nodes: readonly { readonly id: string; readonly kind: string }[],
  roles: ${Name}Roles,
  schema: AnySchema,
): { readonly marks: readonly { readonly id: string; readonly label: string }[] } {
  check(roles, schema);
  /* TODO: read the roles, not the field names. This is the whole lens. */
  return { marks: nodes.map((node) => ({ id: node.id, label: node.id })) };
}

/**
 * Three fidelities, and \`summary\` is DENSER CONTENT rather than the same
 * content scaled down.
 */
export function create${Name}Lens<S extends AnySchema>(roles: ${Name}Roles) {
  function View(props: ViewProps<S>) {
    const { store } = useGraview<S>();
    const built = build${Name}(props.nodes ?? [], roles, store.schema);
    if (props.fidelity === "glyph") {
      return <Chip label={\`\${props.label ?? "${title}"} · \${built.marks.length}\`} />;
    }
    return (
      <Panel title={props.label ?? "${title}"} meta={\`\${built.marks.length}\`}>
        {built.marks.map((mark) => (
          /*
           * EVERY REAL THING IS A TARGET. That one attribute is the whole
           * contract: the host routes the click, gives it a tab stop and a
           * role. Drawing in SVG? Set aria-label yourself — a shape has no
           * text to be named by.
           */
          <div
            key={mark.id}
            data-graview-pick={mark.id}
            data-graview-emphasis={props.implicated?.includes(mark.id) ? "lit" : undefined}
          >
            {mark.label}
          </div>
        ))}
      </Panel>
    );
  }
  return {
    name: "${name}",
    requiredRoles: [...${constantName(name)}_REQUIRED_ROLES],
    roles,
    View,
  };
}
`;
}

function reuseTest(
  name: string,
  Name: string,
  roles: readonly string[],
  binds: "fields" | "entities",
): string {
  const bound = roles
    .map((role) => (binds === "fields" ? `${role}: "TODO"` : `${role}: { kind: "TODO" }`))
    .join(", ");
  return `import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { build${Name} } from "./${name}.js";

/**
 * THE REUSE TEST, RED ON PURPOSE.
 *
 * This is the claim a lens exists to support and the one nothing can make
 * for you: build it against a domain it was NOT designed for, and if you
 * cannot write this test, say so plainly — you have written a view, and a
 * view is a legitimate thing to have written.
 *
 * The domain below is deliberately nothing to do with the app. Change the
 * bindings to this domain's own fields, make it pass, and the claim is true.
 */
const shift = defineNode("shift", {
  fields: z.object({ label: z.string(), on: z.string(), place: z.string() }),
  plural: "Shifts",
});
const volunteer = defineNode("volunteer", { fields: z.object({ label: z.string() }), plural: "Volunteers" });
const rota = createSchema([shift, volunteer]);

describe("${name} in a domain nothing here is about", () => {
  it("builds against a rota, with no change to the lens", () => {
    const built = build${Name}(
      [{ id: "s1", kind: "shift" }],
      { ${bound} },
      rota as never,
    );
    expect(built.marks).toHaveLength(1);
    /* TODO: assert something this lens is FOR, not that it returned. */
    expect.fail("Bind the roles to this domain and assert what the picture says.");
  });
});
`;
}

function constantName(name: string): string {
  return name.replace(/-/g, "_").toUpperCase();
}
