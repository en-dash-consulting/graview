import type { AnySchema, Primitive, Principal, Store } from "@graview/core";
import { mutationToolSchema } from "@graview/core/json-schema";
import { linkedRecordsOver } from "@graview/core/linked";
import { suggest } from "@graview/core/tidying";
import type { FarAppShape } from "@graview/core/workflows";
import type { FarActAnswer, FarApps, FarOrigin, FarReached } from "./types.js";

/*
 * THE HOST, OVER APPS IT HOLDS IN MEMORY (Roadmap
 * f-workflow-steps-in-another-app), as `linkedRecordsOver` is for a link:
 * a workflow's step that names another app's kind or act reaches it here,
 * as the run's actor — its records read through the far store's
 * `seenBy(actor)`, its acts previewed, applied or suggested through the
 * far store's own door with the run's lineage, so that app's Activity says
 * the change and `workflowOrigin` reads it as from that workflow's run.
 * The tests reach a second compiled app through it; a host serving many
 * apps answers the same `FarApps` from its own stores and grants.
 */

/** An app a host holds, as a workflow in another app reaches it. */
export interface FarHome {
  /** The far app's store: its records, its acts, its policy and its sights. */
  readonly store: Store<AnySchema>;
  /** What the app is called, as a run says where it acted. */
  readonly name?: string;
  /** Whether this run may reach it at all — the grant; every run, when unsaid. */
  readonly reaches?: (origin: FarOrigin) => boolean;
  /** The grant in the host's own words: a sentence for why this run may not reach it, said as the step's reason; undefined lets it. */
  readonly refuses?: (origin: FarOrigin) => string | undefined;
}

/** What a store's app is, said for a workflow in another app: its name, its kinds, and every act with its input schema. */
export function farAppShapeOf(store: Store<AnySchema>, name?: string): FarAppShape {
  const acts: Record<string, FarAppShape["acts"][string]> = {};
  for (const mutation of store.allMutations()) {
    const tool = mutationToolSchema(mutation as never);
    acts[tool.name] = { ...(tool.title ? { title: tool.title } : {}), description: tool.description, input: tool.inputSchema };
  }
  return { ...(name ? { name } : {}), kinds: [...(store.schema.kinds as readonly string[])], acts };
}

/** The records a change's primitives made and changed, each said only where there are some. */
function touched(primitives: readonly Primitive[]): { made?: string[]; changed?: string[] } {
  const made = new Set<string>();
  const changed = new Set<string>();
  for (const primitive of primitives) {
    if (primitive.op === "add-node") made.add(primitive.node.id);
    else if ((primitive.op === "patch-node" || primitive.op === "splice-text") && !made.has(primitive.id)) changed.add(primitive.id);
  }
  return { ...(made.size > 0 ? { made: [...made] } : {}), ...(changed.size > 0 ? { changed: [...changed] } : {}) };
}

const said = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** `FarApps` over stores this process holds, by address: what `runWorkflow({ farApps })` is handed by a host holding both apps. */
export function farAppsOver(homes: Readonly<Record<string, FarHome>>): FarApps {
  return {
    otherApp(address, origin): FarReached | undefined {
      const home = Object.hasOwn(homes, address) ? homes[address] : undefined;
      if (!home || (home.reaches && !home.reaches(origin))) return undefined;
      const refused = home.refuses?.(origin);
      if (refused) return { refused };
      const { store } = home;
      const actor = origin.author as Principal;
      const reader = linkedRecordsOver({ [address]: { store, ...(home.name ? { name: home.name } : {}) } });
      return {
        shape: farAppShapeOf(store, home.name),
        read: (kind, { limit }) => reader.find({ address, kinds: [kind], query: "", limit }, { kind: actor.kind, ...(actor.id !== undefined ? { id: actor.id } : {}) }),
        async act(call): Promise<FarActAnswer> {
          const calls = [{ name: call.act, args: { ...call.args } }];
          const options = { author: call.author, lineage: call.lineage, via: `workflow:${call.origin.workflow}` };
          try {
            const preview = store.previewAll(calls, options);
            if (preview.ops.length === 0) return { as: "unchanged" };
            if (call.as === "preview") return { as: "previewed", ...touched(preview.primitives) };
            if (call.as === "suggest") {
              const op = suggest(store, calls, options);
              return { as: "suggested", ...(op ? { op: op.id } : {}) };
            }
            const result = store.applyAll(calls, options);
            return { as: "applied", ...touched(result.primitives), ...(result.ops[0] ? { op: result.ops[0].id } : {}) };
          } catch (error) {
            return { as: "refused", error: said(error) };
          }
        },
      };
    },
  };
}
