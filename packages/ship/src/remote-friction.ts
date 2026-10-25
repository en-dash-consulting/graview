import type { FrictionEvent, FrictionSink, FrictionSummary } from "@graview/core/friction";

/**
 * THE CLIENT HALF OF THE FRICTION LOG ON THE WIRE (Roadmap f-friction-log),
 * in a module of its own a page carries: a sink that posts each draft to
 * `/graview/friction` — the server says who, from the session — and a read
 * of the asker's own events and the counts. Nothing is awaited by whoever
 * recorded; a host that keeps none (410) or a server without the route
 * (404) is never asked again.
 */
export const FRICTION_PATH = "/graview/friction";

export interface RemoteFrictionOptions {
  /** Where the server is, as `openRemote` is told. */
  readonly url: string;
  /** Every header the server needs: the seat headers (`seatHeaders`) and the host's own `authorization`. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetch?: typeof fetch;
}

export interface RemoteFriction {
  /** Records a draft: posted, never awaited by the caller. */
  readonly sink: FrictionSink;
  /** The asker's own events and the counts across people. */
  read(): Promise<{ readonly mine: readonly FrictionEvent[]; readonly counts: FrictionSummary }>;
  /** Settles once every post sent so far has been answered. */
  idle(): Promise<void>;
}

export function remoteFriction(options: RemoteFrictionOptions): RemoteFriction {
  const doFetch = options.fetch ?? fetch;
  const at = `${options.url.replace(/\/$/, "")}${FRICTION_PATH}`;
  const headers = { "content-type": "application/json", ...(options.headers ?? {}) };
  let closed = false;
  let pending: Promise<void> = Promise.resolve();
  return {
    sink(draft) {
      if (closed) return;
      // Who is the session's to say: the body carries the draft alone.
      const sent = doFetch(at, { method: "POST", headers, body: JSON.stringify({ event: draft }) })
        .then((response) => {
          if (response.status === 404 || response.status === 410) closed = true;
        })
        .catch(() => {});
      pending = pending.then(() => sent);
    },
    async read() {
      const response = await doFetch(at, { headers });
      const answer = (await response.json()) as { mine: FrictionEvent[]; counts: FrictionSummary; error?: string };
      if (!response.ok) throw new Error(answer.error ?? `The store answered ${response.status}.`);
      return { mine: answer.mine, counts: answer.counts };
    },
    idle: () => pending,
  };
}
