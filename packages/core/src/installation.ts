import { z } from "zod";
import type { AnyMutationDefinition } from "./mutations/types.js";
import { defineMutation } from "./mutations/define-mutation.js";
import { nodeRef } from "./mutations/node-ref.js";
import type { ModuleMap } from "./modules.js";
import type { Grant, Policy } from "./permissions/types.js";
import { defineNode } from "./schema/define-node.js";
import type { AnyNodeDefinition } from "./schema/types.js";

/*
 * THE INSTALLATION IS IN THE GRAPH.
 *
 * Who may use an installation, who has been asked to, and what each of them
 * may do are not a second application bolted beside the first. They are
 * nodes — a user, an invitation — with acts that are ordinary mutations:
 * titled, described, judged by the policy, offered in the strip and the
 * pages and the agent's tools, and written to the operation log with an
 * author and an inverse like everything else.
 *
 * Because they are ordinary, everything derived works for them unasked: a
 * user's record page is their profile, a derived edit is how they change it,
 * the policy says who else may, and a lens over the policy draws what each
 * role reaches. The module is drawn only for those who administer it: a
 * seat that may run one of these acts is offered "Show the installation";
 * everyone else never sees a district for it.
 */

export interface InstallationOptions<R extends string = string> {
  /** Every role the policy knows. A user holds some of them. */
  readonly roles: readonly R[];
  /** The role that administers: invites, welcomes, removes, grants, revokes. */
  readonly admin: R;
  /** Plural nouns for the two kinds, if "People" and "Invitations" are wrong here. */
  readonly plurals?: { readonly user?: string; readonly invitation?: string };
}

export interface InstallationOf<
  U extends AnyNodeDefinition = AnyNodeDefinition,
  I extends AnyNodeDefinition = AnyNodeDefinition,
> {
  /**
   * The two kinds, ready for `createSchema([...yours, ...installation.kinds])`.
   *
   * WITH THEIR OWN TYPES, as a tuple, because they are statically known —
   * they are built a few lines down from here. They used to be widened to
   * `AnyNodeDefinition[]`, and an app that spread them lost every kind name
   * in its schema type, so every app spread them as an empty tuple instead
   * and `user` ended up in the graph and not in the type. That is fine until
   * the domain wants to point at a person — "who looks after this ground",
   * "whose round is this", "who reported it" — because `ValidateEdgeTargets`
   * is a TYPE-level check: the runtime resolved the edge perfectly and tsc
   * refused to compile it. No first-party app had ever pointed at a person,
   * which is why it survived this long.
   */
  readonly kinds: readonly [U, I];
  /** The acts, ready for `mutations: [...yours, ...installation.mutations]`. */
  readonly mutations: readonly AnyMutationDefinition<never>[];
  /** The module, drawn only for those who administer it. */
  readonly modules: ModuleMap;
  /** The policy's grants for the acts, and the self grant for a profile. */
  readonly grants: readonly Grant[];
  /** Your policy with the installation's grants and roles folded in. */
  withPolicy(policy?: Policy): Policy;
}

export const INSTALLATION_MODULE = "installation";

/**
 * What `declareInstallation` gives back, with the two kinds' own types.
 *
 * Inferred rather than annotated: the shapes are built inside the function
 * from the roles it was handed, so writing them out by hand would be a
 * second copy of the declaration that could disagree with the first.
 */
export type Installation<R extends string = string> = ReturnType<typeof declareInstallation<R>>;


/**
 * Declares the installation's kinds and acts for a set of roles.
 *
 * `admin` names the role that runs the acts. Every other role may edit its
 * own profile and nothing else here; the app's own policy says the rest.
 */
export function declareInstallation<const R extends string>(options: InstallationOptions<R>) {
  const roles = options.roles as readonly [R, ...R[]];
  if (roles.length === 0) throw new Error("declareInstallation needs at least one role.");
  if (!roles.includes(options.admin)) {
    throw new Error(`declareInstallation: the admin role "${options.admin}" is not one of the roles.`);
  }
  const role = z.enum(roles as unknown as [string, ...string[]]);

  const user = defineNode("user", {
    description: "Somebody who may use this installation, and the roles they hold.",
    fields: z.object({
      label: z.string().min(1),
      email: z.string().min(3),
      roles: z.array(role),
      status: z.enum(["active", "removed"]),
    }),
    plural: options.plurals?.user ?? "People",
    label: (node) => node.label,
    // A removed person leaves the picture and never the record: what they did
    // is still theirs in the log.
    lifecycle: { field: "status", retired: ["removed"] },
  });

  const invitation = defineNode("invitation", {
    description: "Somebody asked to join, and the roles they will hold when they do.",
    fields: z.object({
      label: z.string().min(1),
      email: z.string().min(3),
      roles: z.array(role),
      status: z.enum(["pending", "accepted", "revoked"]),
    }),
    edges: {
      // One edge, two readings: from the invitation, who it became; from
      // the person, how they came in.
      became: {
        to: ["user"],
        description: "who it became",
        inverse: "the invitation they came by",
        appendOnly: true,
      },
    },
    plural: options.plurals?.invitation ?? "Invitations",
    label: (node) => node.label,
    lifecycle: { field: "status", retired: ["accepted", "revoked"] },
  });

  const invite = defineMutation("invite", {
    title: "Invite somebody",
    description: "Ask somebody to join, with the roles they will hold when they do.",
    creates: ["invitation"],
    input: z.object({ email: z.string().min(3), roles: z.array(role).min(1) }),
    describe: (args) => `Invite ${args.email} as ${args.roles.join(", ")}`,
    apply(ctx, args) {
      ctx.addNode({
        id: ctx.freshId(args.email, "invitation"),
        kind: "invitation",
        label: args.email,
        email: args.email,
        roles: args.roles,
        status: "pending",
      } as never);
    },
  });

  const welcome = defineMutation("welcome", {
    title: "Welcome them in",
    description: "An invitation is accepted: the person exists, with the roles they were invited to hold.",
    subject: { kinds: ["invitation"], arg: "invitationId" },
    creates: ["user"],
    connects: ["became"],
    writes: ["status"],
    input: z.object({ invitationId: nodeRef(["invitation"]), label: z.string().min(1) }),
    describe: (args) => `Welcome ${args.label}`,
    apply(ctx, args) {
      const asked = ctx.graph.getNode(args.invitationId) as
        | ({ id: string; kind: string } & Record<string, unknown>)
        | undefined;
      if (!asked || asked["status"] !== "pending") {
        throw new Error("Only a pending invitation can be welcomed.");
      }
      const id = ctx.freshId(args.label, "user");
      ctx.addNode({
        id,
        kind: "user",
        label: args.label,
        email: asked["email"],
        roles: asked["roles"],
        status: "active",
      } as never);
      ctx.addEdge({ kind: "became", from: args.invitationId, to: id });
      ctx.patchNode(args.invitationId, { status: "accepted" });
    },
  });

  const revokeInvitation = defineMutation("revoke-invitation", {
    title: "Withdraw the invitation",
    description: "An invitation that will not be accepted.",
    subject: { kinds: ["invitation"], arg: "invitationId" },
    writes: ["status"],
    input: z.object({ invitationId: nodeRef(["invitation"]) }),
    describe: (args) => `Withdraw ${args.invitationId}`,
    apply(ctx, args) {
      ctx.patchNode(args.invitationId, { status: "revoked" });
    },
  });

  const removeUser = defineMutation("remove-user", {
    title: "Remove them",
    description: "They may no longer use this installation. What they did stays theirs in the record.",
    subject: { kinds: ["user"], arg: "userId" },
    writes: ["status"],
    destructive: true,
    input: z.object({ userId: nodeRef(["user"]) }),
    describe: (args) => `Remove ${args.userId}`,
    apply(ctx, args) {
      ctx.patchNode(args.userId, { status: "removed" });
    },
  });

  const grant = defineMutation("grant", {
    title: "Give a role",
    description: "Somebody holds one more role, and may do what it may.",
    subject: { kinds: ["user"], arg: "userId" },
    writes: ["roles"],
    input: z.object({ userId: nodeRef(["user"]), role }),
    describe: (args) => `Give ${args.userId} the ${args.role} role`,
    apply(ctx, args) {
      const held = (ctx.graph.getNode(args.userId) as { roles?: string[] } | undefined)?.roles ?? [];
      if (held.includes(args.role)) return;
      ctx.patchNode(args.userId, { roles: [...held, args.role] });
    },
  });

  const revoke = defineMutation("revoke", {
    title: "Take a role away",
    description: "Somebody holds one role fewer.",
    subject: { kinds: ["user"], arg: "userId" },
    writes: ["roles"],
    input: z.object({ userId: nodeRef(["user"]), role }),
    describe: (args) => `Take the ${args.role} role from ${args.userId}`,
    apply(ctx, args) {
      const held = (ctx.graph.getNode(args.userId) as { roles?: string[] } | undefined)?.roles ?? [];
      if (!held.includes(args.role)) return;
      ctx.patchNode(args.userId, { roles: held.filter((r) => r !== args.role) });
    },
  });

  const acts = [invite, welcome, revokeInvitation, removeUser, grant, revoke];
  const grants: readonly Grant[] = [
    {
      roles: [options.admin],
      mutations: acts.map((act) => act.name),
      describe: `The ${options.admin} keeps the installation: who is here, and what each of them may do.`,
    },
    {
      // A person's profile is theirs: the derived edit of a user, on their own record only.
      roles: "*",
      mutations: ["edit-user"],
      kinds: ["user"],
      self: true,
      describe: "Anyone may change their own name and address.",
    },
  ];

  return {
    kinds: [user, invitation] as const,
    mutations: acts as unknown as readonly AnyMutationDefinition<never>[],
    modules: {
      [INSTALLATION_MODULE]: {
        description: "Who may use this installation, who has been asked to, and what each may do.",
        kinds: ["user", "invitation"],
        mutations: acts.map((act) => act.name),
        visibility: "admin",
      },
    },
    grants,
    withPolicy(policy?: Policy): Policy {
      return {
        roles: [...new Set([...(policy?.roles ?? []), ...roles])],
        grants: [...(policy?.grants ?? []), ...grants],
      };
    },
    /*
     * INFERRED, AND STILL HELD TO THE SHAPE. `satisfies` keeps the two
     * kinds' own types — which is the whole point — while the interface goes
     * on being a contract the compiler checks rather than a comment.
     */
  } satisfies InstallationOf<typeof user, typeof invitation>;
}
