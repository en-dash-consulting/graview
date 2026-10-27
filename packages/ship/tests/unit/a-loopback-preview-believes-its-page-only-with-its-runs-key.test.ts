import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request as send } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { serveKey } from "../../src/cli.js";
import { seatHeaders } from "../../src/remote.js";
import { SERVE_KEY } from "../../src/seat-headers.js";
import { servePreview, type Preview } from "../../src/serve-preview.js";

/**
 * A LOOPBACK PREVIEW BELIEVES ITS PAGE ONLY WITH ITS RUN'S KEY.
 *
 * `graview preview` believes the seat its own page names, and kept other
 * sites' pages out; but another account on this machine, or any program
 * that sends no `Origin`, reached it too and sat in any seat. Now a preview
 * handed a key (as `graview preview` and `graview shots` are, one per run)
 * answers nothing but health without it: the address it says carries the
 * key, opening it trades the key for a cookie named for its port (so two
 * previews in one browser keep their own), and the page it serves, and the
 * document beside it, never carry the key.
 */
const ORG = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.gdd.json", import.meta.url), "utf8")) as { roles?: string[]; name: string };
const ORG_SEED = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.seed.json", import.meta.url), "utf8"));
const KEY = "a-preview-key-for-one-run-0123456789abcdef";

let page: string;
let preview: Preview;
beforeAll(async () => {
  page = mkdtempSync(join(tmpdir(), "graview-keyed-preview-"));
  writeFileSync(join(page, "index.html"), "<!doctype html><title>the page</title>");
  preview = await servePreview({ document: ORG, seed: ORG_SEED, page, key: KEY });
});
afterAll(async () => {
  await preview.close();
  rmSync(page, { recursive: true, force: true });
});

interface Answer {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: string;
}

function ask(path: string, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((done, fail) => {
    const asked = send({ host: "127.0.0.1", port: preview.served.port, path, headers: { host: `127.0.0.1:${preview.served.port}`, ...headers } }, (answer) => {
      let text = "";
      answer.on("data", (chunk) => (text += String(chunk)));
      answer.on("end", () => done({ status: answer.statusCode ?? 0, headers: answer.headers, body: text }));
    });
    asked.on("error", fail);
    asked.end();
  });
}

function upgrade(headers: Record<string, string>): Promise<number> {
  return new Promise((done) => {
    const asked = send({
      host: "127.0.0.1",
      port: preview.served.port,
      path: "/graview/live",
      headers: { host: `127.0.0.1:${preview.served.port}`, connection: "Upgrade", upgrade: "websocket", "sec-websocket-version": "13", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==", ...headers },
    });
    asked.on("upgrade", (_answer, socket) => {
      socket.destroy();
      done(101);
    });
    asked.on("response", (answer) => {
      answer.resume();
      done(answer.statusCode ?? 0);
    });
    asked.on("error", () => done(0));
    asked.end();
  });
}

const said = process.env["GRAVIEW_SERVE_KEY"];
afterEach(() => {
  if (said === undefined) delete process.env["GRAVIEW_SERVE_KEY"];
  else process.env["GRAVIEW_SERVE_KEY"] = said;
});

describe("a loopback preview believes its page only with its run's key", () => {
  it("says an address that carries the key, and answers nothing but health without it", async () => {
    expect(preview.address).toBe(`${preview.url}/?${SERVE_KEY.param}=${KEY}`);
    expect((await ask("/")).status).toBe(401);
    expect((await ask("/graview/document")).status).toBe(401);
    expect((await ask("/graview/state", seatHeaders(preview.principal))).status).toBe(401);
    expect(await upgrade({})).toBe(401);
    expect((await ask("/graview/health")).status).toBe(200);
  });

  it("lets the page in from the printed address, by a cookie named for its port, and serves the key nowhere", async () => {
    const traded = await ask(`/places/overview?${SERVE_KEY.param}=${KEY}`);
    expect(traded.status).toBe(303);
    expect(traded.headers.location).toBe("/places/overview");
    const cookie = String(traded.headers["set-cookie"]).split(";")[0]!;
    expect(cookie.startsWith(`${SERVE_KEY.cookie}_${preview.served.port}=`)).toBe(true);
    const answers = [traded, await ask("/places/overview", { cookie }), await ask("/graview/document", { cookie }), await ask("/graview/state", { cookie, ...seatHeaders(preview.principal) })];
    expect(answers.slice(1).map((one) => one.status)).toEqual([200, 200, 200]);
    for (const answer of answers) {
      expect(answer.body).not.toContain(KEY);
      expect(JSON.stringify(answer.headers)).not.toContain(KEY);
    }
    expect(await upgrade({ cookie })).toBe(101);
  });

  it("takes this run's key from GRAVIEW_SERVE_KEY when it is long enough, and mints one otherwise", () => {
    process.env["GRAVIEW_SERVE_KEY"] = "short";
    const minted = serveKey();
    expect(minted).toMatch(/^[\w-]{43}$/);
    expect(serveKey()).not.toBe(minted);
    process.env["GRAVIEW_SERVE_KEY"] = KEY;
    expect(serveKey()).toBe(KEY);
  });
});
