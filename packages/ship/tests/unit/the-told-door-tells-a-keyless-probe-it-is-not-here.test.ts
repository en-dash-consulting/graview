import { describe, expect, it } from "vitest";
import { memoryTold } from "@graview/core/told";
import { devToldHandler } from "../../src/dev.js";

/*
 * THE TOLD DOOR, ASKED BY A PAGE WITHOUT THE DOOR'S KEY (Roadmap
 * f-menu-learns). A driven browser — a harness, which keeps model keys out —
 * asks the dev server whether it keeps tellings. It is told it does not, as
 * the model's door tells it, rather than answered 403: a refused resource is
 * an error in the page's console, and the harnesses that hold a page to
 * saying nothing (verify-renderer) failed on it. A write without the key is
 * still refused.
 */
const respond = () => {
  const sent: { status?: number; body?: string } = {};
  const res = { setHeader: () => {}, end: (body: string) => (sent.body = body), set statusCode(value: number) { sent.status = value; } } as never;
  return { sent, res };
};
const request = (method: string) => ({ method, url: "/__graview/told", headers: { host: "localhost:5193" }, on: (event: string, handler: () => void) => event === "end" && handler() }) as never;

describe("the told door, without the door's key", () => {
  it("tells a page asking whether it is here that it is not, and still refuses a write", async () => {
    const handler = devToldHandler({ store: memoryTold() });
    const probe = respond();
    await handler(request("GET"), probe.res);
    expect(probe.sent.status).toBe(200);
    expect(JSON.parse(probe.sent.body!)).toEqual({ available: false });
    const write = respond();
    await handler(request("POST"), write.res);
    expect(write.sent.status).toBe(403);
  });
});
