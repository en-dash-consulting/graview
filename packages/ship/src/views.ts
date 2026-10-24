import type { AnySchema, KeptViews, KeptViewsMay, LensTidyEdit, Principal, Store } from "@graview/core";
import { VIEWS_PATH } from "./remote-views.js";

/**
 * THE VIEWS A PERSON TIDIES, ON THE WIRE (Roadmap f-place-menu-views): one
 * route, `/graview/views`. `GET` answers what is hidden and recently
 * deleted, and what the asking seat may do (`may`); `POST { hide | show |
 * remove | restore: <name> }` does it to a script view the host keeps, and
 * `POST { lens: <set-lens-hidden | set-lens-export | remove-lens> }` to a declared lens, where
 * the host writes the declaration. Each is answered with the state after
 * it, or refused with a sentence: 403 where the seat may not, 400 where the
 * body says nothing this route does.
 *
 * Nothing here reaches a `node:` builtin; `remoteViews`
 * (`./remote-views.ts`) is the client half.
 */
export { VIEWS_PATH } from "./remote-views.js";
export type { ViewsPost } from "./remote-views.js";

/** An answer of the route: a status and a body. */
export interface ViewsAnswer {
  readonly status: number;
  readonly body: unknown;
}

/**
 * WHETHER A SEAT KEEPS THE APP — what `graview serve` lets tidy views when
 * its host says nothing (`mayTidyViews`): where something is administered,
 * whoever administers it; with a policy and nothing administered, whoever
 * may do every act on every kind; with neither, whoever is here.
 */
export function keepsTheApp(store: Store<AnySchema>, seat: Principal): boolean {
  const administered = [...store.modules.administered.keys()];
  if (administered.length > 0) return administered.some((name) => store.mayAdminister(name, seat));
  const policy = store.policy;
  if (!policy) return true;
  const roles = seat.roles ?? [];
  return policy.grants.some((grant) => grant.mutations === "*" && !grant.self && (grant.kinds === undefined || grant.kinds === "*") && (grant.roles === "*" || roles.some((role) => (grant.roles as readonly string[]).includes(role))));
}

const isLensEdit = (edit: unknown): edit is LensTidyEdit => {
  if (typeof edit !== "object" || edit === null) return false;
  const { op, title, on, hidden, export: exported } = edit as Record<string, unknown>;
  if (typeof title !== "string" || title === "" || (on !== undefined && typeof on !== "string")) return false;
  return (op === "set-lens-hidden" && typeof hidden === "boolean") || (op === "set-lens-export" && typeof exported === "boolean") || op === "remove-lens";
};

const SAY = 'Say what to do with which view: { hide | show | remove | restore: "<its name>" }, or { lens: { op: "set-lens-hidden" | "set-lens-export" | "remove-lens", title, on?, hidden?, export? } }.';

/** What is hidden and deleted as the asking seat is told it, or one action done for it. */
export async function answerViews(method: string, body: unknown, may: KeptViewsMay, views: KeptViews): Promise<ViewsAnswer> {
  const state = () => ({ ...views.current(), may: { views: may.views, lenses: may.lenses && Boolean(views.lens) } });
  if (method === "GET") return { status: 200, body: state() };
  if (method !== "POST") return { status: 405, body: { error: `${VIEWS_PATH} is read with GET and changed with POST.`, reason: "invalid" } };
  const asked = (body ?? {}) as Record<string, unknown>;
  const name = (key: string) => (typeof asked[key] === "string" && asked[key] !== "" ? (asked[key] as string) : undefined);
  try {
    if (asked["lens"] !== undefined) {
      if (!isLensEdit(asked["lens"])) return { status: 400, body: { error: SAY, reason: "invalid" } };
      if (!views.lens) return { status: 403, body: { error: "This host does not change the app's declaration, so its lenses are not hidden or deleted here.", reason: "forbidden" } };
      if (!may.lenses) return { status: 403, body: { error: "Only the app's owner hides or deletes a lens the app declares.", reason: "forbidden" } };
      await views.lens(asked["lens"]);
      return { status: 200, body: state() };
    }
    const restore = name("restore");
    if (restore !== undefined) {
      const lens = views.current().removed.find((one) => one.name === restore)?.lens;
      if (!(lens ? may.lenses : may.views)) return { status: 403, body: { error: lens ? "Only the app's owner restores a lens the app declares." : "Only the app's owner or an editor restores a view.", reason: "forbidden" } };
      await views.restore(restore);
      return { status: 200, body: state() };
    }
    const hide = name("hide");
    const show = name("show");
    const remove = name("remove");
    if (hide === undefined && show === undefined && remove === undefined) return { status: 400, body: { error: SAY, reason: "invalid" } };
    if (!may.views) return { status: 403, body: { error: "Only the app's owner or an editor hides or deletes a view.", reason: "forbidden" } };
    if (hide !== undefined) await views.hide(hide);
    else if (show !== undefined) await views.show(show);
    else {
      const about = asked["about"] as { title?: unknown; kind?: unknown } | undefined;
      await views.remove(remove!, typeof about?.title === "string" && typeof about.kind === "string" ? { title: about.title, kind: about.kind } : undefined);
    }
    return { status: 200, body: state() };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : String(error), reason: "invalid" } };
  }
}
