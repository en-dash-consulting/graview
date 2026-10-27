/**
 * THE RUN'S KEY, AS A HARNESS HOLDS IT.
 *
 * `graview serve` and `graview preview` on loopback answer nothing but
 * health without their run's key, which they print in the address they
 * say. A harness that starts one is the person who started it: it names
 * the key itself (`GRAVIEW_SERVE_KEY`, which the server takes when it is
 * set, and which every child this process spawns inherits), sends it as
 * `x-graview-key` from Node, and lets its browsers in the way a person's
 * is let in — by opening the printed address once, which trades the key
 * for a cookie named for the server's port (`admit`). Every context a
 * harness's browser makes afterwards carries the cookies admitted so far
 * (`withServeKeys`, which `launchEngine` wraps every browser in).
 */
import { randomBytes } from "node:crypto";

const said = process.env["GRAVIEW_SERVE_KEY"];
/** This harness run's key, handed to every server it starts. */
export const KEY = said !== undefined && said.length >= 16 ? said : randomBytes(24).toString("base64url");
process.env["GRAVIEW_SERVE_KEY"] = KEY;

/** The header a program sends the key in. */
export const keyHeaders = { "x-graview-key": KEY };

/** An address with the key in its query, before any `#` — what the server printed. */
export function keyed(address) {
  const hash = address.indexOf("#");
  const [before, after] = hash < 0 ? [address, ""] : [address.slice(0, hash), address.slice(hash)];
  return `${before}${before.includes("?") ? "&" : "?"}graview_key=${encodeURIComponent(KEY)}${after}`;
}

const admitted = [];
const contexts = new Set();

/**
 * Lets this harness's browsers into the server at `base`: the printed
 * address is opened once from Node, its cookie kept, and handed to every
 * context there is and will be.
 */
export async function admit(base) {
  const answer = await fetch(keyed(`${base}/`), { redirect: "manual" });
  const cookie = answer.headers.get("set-cookie");
  if (answer.status !== 303 || !cookie) throw new Error(`${base} did not trade the key for a cookie (${answer.status})`);
  const [pair] = cookie.split(";");
  const at = pair.indexOf("=");
  const one = { name: pair.slice(0, at), value: pair.slice(at + 1), url: base };
  admitted.push(one);
  await Promise.all([...contexts].map((context) => context.addCookies([one]).catch(() => {})));
}

/** A browser whose every context carries the cookies `admit` has kept. */
export function withServeKeys(browser) {
  const ready = async (context) => {
    contexts.add(context);
    context.on("close", () => contexts.delete(context));
    if (admitted.length > 0) await context.addCookies(admitted);
    return context;
  };
  return new Proxy(browser, {
    get(target, prop) {
      if (prop === "newContext") return async (...args) => ready(await target.newContext(...args));
      if (prop === "newPage") {
        return async (...args) => {
          const context = await ready(await target.newContext(...args));
          const page = await context.newPage();
          page.on("close", () => void context.close().catch(() => {}));
          return page;
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** `fetch`, with the key: what a harness's own requests to the servers it started send. */
export const keyedFetch = (url, init = {}) => fetch(url, { ...init, headers: { ...keyHeaders, ...(init.headers ?? {}) } });

/** Text a server printed, with the key taken out, for a verdict that is kept. */
export const scrub = (text) => String(text).replaceAll(KEY, "<key>").replaceAll(encodeURIComponent(KEY), "<key>");
