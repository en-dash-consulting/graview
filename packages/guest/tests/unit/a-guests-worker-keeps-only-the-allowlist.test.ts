import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInContext, createContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { GUEST_GLOBALS } from "../../src/worker/harden.js";

/**
 * A HARDENED WORKER (FR-70), the algorithm on its own: `harden()` run in a
 * realm of its own (node:vm) whose global stands in for a worker's — its
 * own properties, a prototype chain like WorkerGlobalScope's and
 * EventTarget's, a polyfilled `document` whose window took the platform's
 * `navigator` — and a platform API nobody has heard of yet. What a real
 * worker in Chromium and WebKit is left with, and the ways back that were
 * tried there, are `scripts/guest-sandbox.mjs --transport=worker`.
 */
const require = createRequire(import.meta.url);
const { buildSync } = require("esbuild") as typeof import("esbuild");
/* As a guest bundle carries it: inside a function, strict, and naming nothing on the global but what it hands the test. */
const hardenJs = buildSync({
  stdin: {
    contents: `import { harden } from ${JSON.stringify(fileURLToPath(new URL("../../src/worker/harden.ts", import.meta.url)))}; Object.defineProperty(globalThis, "__harden", { value: harden, configurable: true });`,
    resolveDir: fileURLToPath(new URL(".", import.meta.url)),
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  write: false,
  banner: { js: '"use strict";' },
}).outputFiles[0]!.text;

const SETUP = `
"use strict";
const EventTargetPrototype = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
const WorkerGlobalScopePrototype = Object.create(EventTargetPrototype, {
  fetch: { value: function fetch() { return "fetched"; }, configurable: true, writable: true },
  importScripts: { value: function importScripts() {}, configurable: true, writable: true },
  indexedDB: { get() { return { open() {} }; }, configurable: true },
  caches: { get() { return {}; }, configurable: true },
  onerror: { get() { return null; }, set() {}, configurable: true },
  [Symbol.toStringTag]: { value: "WorkerGlobalScope", configurable: true },
});
Object.setPrototypeOf(globalThis, WorkerGlobalScopePrototype);
const platform = {
  XMLHttpRequest: function XMLHttpRequest() {}, WebSocket: function WebSocket() {}, EventSource: function EventSource() {}, WebTransport: function WebTransport() {},
  BroadcastChannel: function BroadcastChannel() {}, Worker: function Worker() {}, SharedWorker: function SharedWorker() {}, MessageChannel: function MessageChannel() {},
  performance: { now() { return 1; } }, WebAssembly: {}, navigator: { storage: { getDirectory() {} } }, location: { href: "blob:x" },
  newPlatformApi: function newPlatformApi() { return "nobody had heard of this"; },
  postMessage() {}, queueMicrotask(task) { Promise.resolve().then(task); }, structuredClone(value) { return value; },
  setTimeout(handler) { if (typeof handler === "string") globalThis.__ranFromText = true; return 1; }, clearTimeout() {},
  setInterval() { return 1; }, clearInterval() {}, console: {}, DOMException: function DOMException() {},
  crypto: { getRandomValues(array) { return array; }, subtle: { digest() {} }, randomUUID() { return "x"; } },
  [Symbol.for("@remote-dom/polyfill/hooks")]: {},
};
for (const [key, value] of Reflect.ownKeys(platform).map((key) => [key, platform[key]])) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true, enumerable: true });
const view = { navigator: platform.navigator, location: platform.location, name: "", document: null, Event: function Event() {} };
globalThis.window = view;
globalThis.document = { defaultView: view };
view.document = globalThis.document;
globalThis.self = globalThis;
`;

function hardened() {
  const context = createContext({});
  runInContext(SETUP, context);
  runInContext(hardenJs, context);
  const report = runInContext("__harden(globalThis)", context) as { removed: string[]; stuck: string[]; sealed: boolean };
  const probe = (code: string) => runInContext(`(() => { "use strict"; try { return ${code}; } catch (error) { return "threw " + error.name; } })()`, context);
  return { context, report, probe };
}

describe("a hardened worker's global", () => {
  it("keeps no name outside the allowlist, on itself or any prototype on its chain", () => {
    const { report, probe } = hardened();
    expect(report.stuck).toEqual([]);
    const names = probe(`(() => { const all = []; for (let at = globalThis; at && at !== Object.prototype; at = Object.getPrototypeOf(at)) all.push(...Reflect.ownKeys(at).map(String)); return all; })()`) as string[];
    const allowed = new Set([...GUEST_GLOBALS, "constructor", "Symbol(Symbol.toStringTag)"]);
    expect(names.filter((name) => !allowed.has(name))).toEqual([]);
  });

  it("takes the network, storage, channels, nested workers and more code, and an API nobody had heard of", () => {
    const { report, probe } = hardened();
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker", "MessageChannel", "navigator", "location", "performance", "WebAssembly", "addEventListener", "onerror", "eval", "newPlatformApi"]) {
      expect(probe(`${JSON.stringify(name)} in self`), name).toBe(false);
    }
    expect(report.removed).toContain("newPlatformApi");
    expect(report.removed).toContain("fetch");
  });

  it("takes navigator and location from the polyfill's window too", () => {
    const { probe } = hardened();
    expect(probe(`"navigator" in window || "navigator" in document.defaultView || "location" in window`)).toBe(false);
  });

  it("leaves no constructor that makes code from text, and no timer that runs it", () => {
    const { probe } = hardened();
    expect(probe(`Function("return this")()`)).toBe("threw EvalError");
    expect(probe(`(function () {}).constructor("return this")()`)).toBe("threw EvalError");
    expect(probe(`(async function () {}).constructor("return this")`)).toBe("threw EvalError");
    expect(probe(`(function* () {}).constructor("yield this")`)).toBe("threw EvalError");
    expect(probe(`(async function* () {}).constructor("yield this")`)).toBe("threw EvalError");
    expect(probe(`(() => {}) instanceof Function`)).toBe(true);
    expect(probe(`setTimeout("globalThis.__ranFromText = true")`)).toBe("threw TypeError");
    expect(probe(`typeof setTimeout(() => {}, 0)`)).toBe("number");
    expect(probe(`globalThis.__ranFromText`)).toBe(undefined);
  });

  it("hands crypto over as getRandomValues alone", () => {
    const { probe } = hardened();
    expect(probe(`Object.keys(crypto)`)).toEqual(["getRandomValues"]);
    expect(probe(`crypto.getRandomValues(new Uint8Array(4)).length`)).toBe(4);
  });

  it("stays as it was left: nothing it keeps can be replaced or removed, and no prototype on its chain changed", () => {
    const { probe, report } = hardened();
    expect(probe(`(() => { Object.getPrototypeOf(globalThis).fetch = () => 1; return "fetch" in self; })()`)).toBe("threw TypeError");
    expect(probe(`(() => { globalThis.setTimeout = () => 1; return 1; })()`)).toBe("threw TypeError");
    // A node:vm global will not be made inextensible; a worker's is (guest-sandbox), and where it is, no name can be added.
    expect(probe(`(() => { globalThis.fetch = () => 1; return "fetch" in self; })()`)).toBe(report.sealed ? "threw TypeError" : true);
    expect(probe(`(() => { Object.defineProperty(globalThis, "postMessage", { value: 1 }); return postMessage; })()`)).toBe("threw TypeError");
    expect(probe(`(() => { delete Object.getPrototypeOf(globalThis)[Symbol.toStringTag]; return 1; })()`)).toBe("threw TypeError");
    expect(probe(`(() => { Function.prototype.constructor = function () { return 1; }; return 1; })()`)).toBe("threw TypeError");
  });
});
