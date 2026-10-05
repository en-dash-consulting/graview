/*
 * A HARDENED WORKER (FR-70).
 *
 * A worker's policy and origin are the host's to set, and on ChatGPT the
 * origin is shared by every widget an app's connector shows: Graview
 * Cloud's spike watched one view's worker plant IndexedDB and Cache Storage
 * data that a second view's worker read, and ChatGPT's `connect-src` always
 * names a list of public CDNs. So before any guest code runs, the runtime
 * takes from the worker's global everything outside a short allowlist —
 * the network, storage, channels, nested workers, more code — from the
 * global itself and from every prototype on its chain, so no reference is
 * left to recover them by, and makes what is left stay as it is.
 *
 * What stays, and why:
 *
 *   the language          Object, Array, Promise, JSON, Intl, the typed arrays, … (LANGUAGE)
 *   postMessage           it reaches only the worker's owner, the host, which drops all but one ready
 *   timers                setTimeout and setInterval refuse a string, which would be code from text
 *   queueMicrotask, structuredClone
 *   crypto                as an object with getRandomValues alone
 *   console               it reaches the developer's tools, nothing else; a guest's errors stay readable
 *   DOMException          an error class, which the polyfill throws
 *   the polyfilled DOM    Remote DOM's document, window and node classes (POLYFILLED_DOM)
 *
 * And what goes that a reader might expect to stay:
 *
 *   eval, Function        code from text could write `import()`, which no global's removal can take
 *                         away and which reaches every origin script-src allows (ChatGPT's CDNs, or in
 *                         WebKit under Claude's policy any https origin). Without them a guest's code is
 *                         the bundle it was built as, and the build refuses one with `import()` in it
 *                         (FR-71). `Function` stays as a name, for `instanceof`, but makes nothing, and
 *                         so do the async and generator function constructors.
 *   performance           a fine clock, which is a side channel and draws nothing
 *   addEventListener, onmessage, onerror, close, name, location, navigator, self.fonts, WebAssembly, …
 *
 * The removal is deletion in the same realm, so it holds only while no
 * remaining API can hand back what was removed. The allowlist is what keeps
 * that true as browsers add APIs: a name not on it goes, whatever it is.
 * `scripts/guest-sandbox.mjs` enumerates the worker's global in Chromium and
 * WebKit and fails on any name outside it, and tries the ways back.
 */

/** The language's own globals: ECMAScript, ES2025 and the proposals engines already ship. */
export const LANGUAGE = [
  "globalThis", "Infinity", "NaN", "undefined", "isFinite", "isNaN", "parseFloat", "parseInt",
  "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape", "unescape",
  "Object", "Function", "Array", "Number", "Boolean", "String", "Symbol", "BigInt", "Date", "Promise", "RegExp", "Math", "JSON", "Reflect", "Proxy", "Intl",
  "Error", "AggregateError", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "SuppressedError",
  "Map", "Set", "WeakMap", "WeakSet", "WeakRef", "FinalizationRegistry", "Iterator", "AsyncIterator", "DisposableStack", "AsyncDisposableStack",
  "ArrayBuffer", "SharedArrayBuffer", "DataView", "Atomics",
  "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array", "Uint32Array", "Float16Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array",
] as const;

/** What Remote DOM's polyfill puts on the global: a document to build in, and the classes of what it builds. */
export const POLYFILLED_DOM = [
  "window", "parent", "top", "document", "customElements",
  "Event", "ErrorEvent", "PromiseRejectionEvent", "ToggleEvent", "FocusEvent", "ClipboardEvent", "CustomEvent", "EventTarget",
  "Node", "ParentNode", "ChildNode", "DocumentFragment", "Document", "CharacterData", "Comment", "Text", "Element", "HTMLElement", "SVGElement", "HTMLTemplateElement", "MutationObserver",
] as const;

/** The platform's few that stay (see the top of this module for why each). */
export const PLATFORM = ["self", "postMessage", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask", "structuredClone", "crypto", "console", "DOMException"] as const;

/**
 * Numbers an engine will not let go: Chromium's worker global defines
 * `TEMPORARY` (0) and `PERSISTENT` (1), the constants of the FileSystem API
 * it no longer ships, as non-configurable. They are numbers and hand back
 * nothing, so they may stay — only while they are numbers; anything else
 * by these names is removed or stops the worker.
 */
export const INERT = ["TEMPORARY", "PERSISTENT"] as const;

/**
 * EVERY NAME A GUEST'S WORKER GLOBAL MAY HAVE, on the global or any
 * prototype on its chain before `Object.prototype` (where a prototype's
 * `constructor` and `Symbol.toStringTag` stay too). Anything else is
 * removed before the guest runs.
 */
export const GUEST_GLOBALS: readonly string[] = Object.freeze([...LANGUAGE, ...POLYFILLED_DOM, ...PLATFORM, ...INERT]);

/** What `Object.prototype` holds in every engine; it is the language's, and the walk does not touch it. */
export const OBJECT_PROTOTYPE: readonly string[] = Object.freeze([
  "constructor", "__defineGetter__", "__defineSetter__", "hasOwnProperty", "__lookupGetter__", "__lookupSetter__",
  "isPrototypeOf", "propertyIsEnumerable", "toString", "valueOf", "__proto__", "toLocaleString",
]);

/** What hardening did: every name it took, and any it could not. */
export interface Hardening {
  readonly removed: readonly string[];
  /** Names outside the allowlist that could not be removed. Empty, or the worker is not hardened. */
  readonly stuck: readonly string[];
  /** Whether the global takes no new names. Where the engine refuses, a guest can add its own, which reach nothing removed. */
  readonly sealed: boolean;
  /** False when the runtime is not in a worker, and so hardened nothing. */
  readonly worker?: false;
}

const nameOf = (key: string | symbol) => (typeof key === "symbol" ? `[${key.description ?? "symbol"}]` : key);

/**
 * HARDEN A WORKER'S GLOBAL before guest code runs. Called once by the
 * worker entry, after Remote DOM's polyfill and the kit are in place.
 */
export function harden(scope: typeof globalThis = globalThis): Hardening {
  const removed: string[] = [];
  const stuck: string[] = [];
  const allowed = new Set<string | symbol>([...LANGUAGE, ...POLYFILLED_DOM, ...PLATFORM, "constructor", Symbol.toStringTag]);
  /* A name on the inert list stays only if it will not go and holds a number that cannot be changed. */
  const inert = (at: object, key: string | symbol) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(at, key);
    return (INERT as readonly (string | symbol)[]).includes(key) && descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "number" && !descriptor.writable && !descriptor.configurable;
  };
  const global = scope as unknown as Record<string | symbol, unknown>;

  /* Kept, but narrowed: what the guest is handed in place of the platform's own. */
  const nativeSetTimeout = global["setTimeout"] as (handler: unknown, ms?: number, ...args: unknown[]) => number;
  const nativeSetInterval = global["setInterval"] as (handler: unknown, ms?: number, ...args: unknown[]) => number;
  const nativeCrypto = global["crypto"] as Crypto | undefined;
  const timer = (native: typeof nativeSetTimeout, name: string) =>
    function (handler: unknown, ms?: number, ...args: unknown[]) {
      if (typeof handler !== "function") throw new TypeError(`${name} takes a function: a guest view cannot run code from text`);
      return native.call(scope, handler, ms, ...args);
    };
  const crypto = nativeCrypto ? Object.freeze({ getRandomValues: <T extends ArrayBufferView | null>(array: T): T => nativeCrypto.getRandomValues(array as never) as T }) : undefined;

  /*
   * THE POLYFILL'S WINDOW. Remote DOM's `window` (and `document.defaultView`)
   * is an object of its own, which took the platform's `navigator` and
   * `location` when it was made; they go from it as from the global.
   */
  const view = (global["document"] as { defaultView?: unknown } | undefined)?.defaultView as Record<string | symbol, unknown> | undefined;
  if (view && view !== global) {
    for (const key of Reflect.ownKeys(view)) {
      if (typeof key === "symbol" || allowed.has(key)) continue;
      if (!Reflect.deleteProperty(view, key)) stuck.push(`window.${key}`);
    }
  }

  /* THE CHAIN: the global, and every prototype up to Object.prototype. */
  const chain: object[] = [];
  for (let at: object | null = scope; at && at !== Object.prototype; at = Object.getPrototypeOf(at)) chain.push(at);
  for (const at of chain) {
    for (const key of Reflect.ownKeys(at)) {
      if (allowed.has(key)) continue;
      if (Reflect.deleteProperty(at, key)) removed.push(nameOf(key));
      else if (!inert(at, key)) stuck.push(nameOf(key));
    }
  }

  /* CODE FROM TEXT: eval went with the rest; every function constructor now refuses. */
  const refuse = () =>
    function Function() {
      throw new EvalError("A guest view cannot make code from text.");
    };
  const prototypes = [Function.prototype, Object.getPrototypeOf(async function () {}), Object.getPrototypeOf(function* () {}), Object.getPrototypeOf(async function* () {})] as object[];
  for (const prototype of prototypes) {
    const stand = refuse();
    Object.defineProperty(stand, "prototype", { value: prototype, writable: false, enumerable: false, configurable: false });
    if (!Reflect.defineProperty(prototype, "constructor", { value: stand, writable: false, enumerable: false, configurable: false })) stuck.push("Function.prototype.constructor");
    if (prototype === Function.prototype) Reflect.defineProperty(scope, "Function", { value: stand, writable: true, enumerable: false, configurable: true });
  }

  const keep = (name: string, value: unknown) => {
    if (!Reflect.defineProperty(scope, name, { value, writable: true, enumerable: true, configurable: true })) stuck.push(name);
  };
  keep("setTimeout", timer(nativeSetTimeout, "setTimeout"));
  keep("setInterval", timer(nativeSetInterval, "setInterval"));
  if (crypto) keep("crypto", crypto);

  /*
   * MAKE IT STICK. Every prototype on the chain is frozen, every property
   * left on the global is made non-configurable and read-only, and the
   * global takes no new ones: what a guest finds is what stays.
   */
  for (const at of chain.slice(1)) Object.freeze(at);
  for (const key of Reflect.ownKeys(scope)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(scope, key)!;
    Reflect.defineProperty(scope, key, "value" in descriptor ? { ...descriptor, writable: false, configurable: false } : { ...descriptor, configurable: false });
  }
  /* Where an engine will not have a global made inextensible, a guest can add its own names: nothing it adds reaches anything removed. */
  let sealed: boolean;
  try {
    sealed = Reflect.preventExtensions(scope);
  } catch {
    sealed = false;
  }
  return { removed, stuck, sealed };
}
