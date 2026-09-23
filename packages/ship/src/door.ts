import type { IncomingMessage, ServerResponse } from "node:http";

/*
 * WHAT EVERY DEV-SERVER DOOR SHARES: who may knock, how much they may
 * send, and the shape of the plugin that opens it. The local door, the
 * decision door and the studio door each answered these three questions,
 * and they must answer them the same way.
 */

/** Same origin, or no origin at all (curl, a test). Anything else is another site. */
export function sameOrigin(headers: { readonly origin?: string; readonly host?: string }): boolean {
  if (headers.origin === undefined) return true;
  try {
    return new URL(headers.origin).host === headers.host;
  } catch {
    return false;
  }
}

/** Whether this request came from the page this server serves. */
export function fromThisApp(req: IncomingMessage): boolean {
  const { origin, host } = req.headers;
  return sameOrigin({ ...(origin ? { origin } : {}), ...(host ? { host } : {}) });
}

/** The request's body, refused past `limit` bytes with a sentence saying what was too much. */
export function readBody(req: IncomingMessage, limit: number, what = "request"): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > limit) {
        reject(new Error(`That is more than ${Math.round(limit / 1_000_000)} MB of ${what} — send fewer, or smaller.`));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** The shape of the Vite plugin object, without importing Vite to say it. */
export interface DevServerPlugin {
  readonly name: string;
  readonly apply: "serve";
  configureServer(server: {
    middlewares: { use(path: string, handler: (req: IncomingMessage, res: ServerResponse) => void): void };
  }): void;
}
