import { NO_KEPT_VIEWS, type KeptViews, type KeptViewsState, type LensTidyEdit, type Principal } from "@graview/core";
import { seatHeaders } from "./remote.js";

/**
 * THE CLIENT HALF OF THE VIEWS A PERSON TIDIES (Roadmap f-place-menu-views):
 * `KeptViews` over `/graview/views`, for a page whose store is served —
 * what it hands `mount`'s `keptViews`. The route (`./views.ts`) says what is
 * hidden and recently deleted and what the asking seat may do; each action
 * is a `POST` answered with the state after it.
 */
export const VIEWS_PATH = "/graview/views";

/** What `POST /graview/views` takes: one action on one view, or a declared lens's change. */
export type ViewsPost =
  | { readonly hide: string }
  | { readonly show: string }
  | { readonly remove: string; readonly about?: { readonly title: string; readonly kind: string } }
  | { readonly restore: string }
  | { readonly lens: LensTidyEdit };

export interface RemoteViewsOptions {
  /** Where the server is, as `openRemote` is told. */
  readonly url: string;
  /** The route, `/graview/views` by default; a dev server's door (`devViews`) answers at `/__graview/views`. */
  readonly path?: string;
  /** Who is asking: sent as the seat headers, which a server believes only where it trusts them. */
  readonly principal?: Principal;
  /** A host's own headers — its `authorization` — sent with every request. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetch?: typeof fetch;
  /** Asked again this often, in milliseconds, to hear what somebody else hid or deleted. Never, unless said. */
  readonly pollMs?: number;
  /**
   * After a declared lens's change has been written: the page's host
   * hands the page the new declaration here (`setApp`), and the action
   * resolves once it has.
   */
  readonly onDeclaration?: () => void | Promise<void>;
}

/** The asking seat's view of the views it may tidy, on a served store; `ready` resolves once the first answer is in. */
export function remoteViews(options: RemoteViewsOptions): KeptViews & { lens: NonNullable<KeptViews["lens"]>; readonly ready: Promise<void>; refresh(): Promise<void>; close(): void } {
  const doFetch = options.fetch ?? fetch;
  const base = options.url.replace(/\/$/, "");
  const headers = { "content-type": "application/json", ...(options.principal ? seatHeaders(options.principal) : {}), ...(options.headers ?? {}) };
  let state: KeptViewsState = NO_KEPT_VIEWS;
  const listeners = new Set<() => void>();
  const take = (next: KeptViewsState) => {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const listener of listeners) listener();
  };
  const call = async (method: string, body?: ViewsPost): Promise<void> => {
    const response = await doFetch(`${base}${options.path ?? VIEWS_PATH}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const answer = (await response.json()) as KeptViewsState & { error?: string };
    if (!response.ok) throw new Error(answer.error ?? `The store answered ${response.status}.`);
    take({ hidden: answer.hidden ?? [], removed: answer.removed ?? [], may: answer.may ?? NO_KEPT_VIEWS.may });
  };
  const refresh = () => call("GET");
  const ready = refresh().catch(() => undefined);
  const timer = options.pollMs ? setInterval(() => void refresh().catch(() => undefined), options.pollMs) : undefined;
  return {
    ready,
    refresh,
    close: () => clearInterval(timer),
    current: () => state,
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    hide: (name) => call("POST", { hide: name }),
    show: (name) => call("POST", { show: name }),
    remove: (name, about) => call("POST", { remove: name, ...(about ? { about } : {}) }),
    async restore(name) {
      const lens = state.removed.find((one) => one.name === name)?.lens;
      await call("POST", { restore: name });
      if (lens) await options.onDeclaration?.();
    },
    async lens(edit) {
      await call("POST", { lens: edit });
      await options.onDeclaration?.();
    },
  };
}
