/*
 * A GUEST BUNDLE, BUILT AS ONE CLASSIC SCRIPT (FR-71): `@graview/guest/build`.
 *
 * A chat's widget runs in an opaque origin (Claude) or one every widget
 * shares (ChatGPT), and Chromium refuses a module worker from a `blob:` URL
 * in an opaque origin. So a worker guest is a classic script: one IIFE,
 * strict, with nothing to fetch at run time — no `import`, no `import()`,
 * no `importScripts` — and the worker entry first, so the runtime is
 * hardened (FR-70) before a line of the guest runs.
 *
 * `buildGuestBundle` makes one with esbuild, which a project installs (an
 * optional peer: a host that only mounts guests needs none of this), and
 * `checkGuestBundle` says what in a script would keep it from being one.
 * This entry is Node's: it is how a guest is built, not what runs.
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

/** Remote DOM's license, carried by every guest bundle, which carries Remote DOM. */
const REMOTE_DOM_NOTICE = `/*! @remote-dom/core and @remote-dom/polyfill — Copyright 2020-present, Shopify Inc. — MIT License.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * @graview/guest's worker runtime — Elastic License 2.0. */`;

/**
 * What every guest bundle starts with: strict mode for the whole script —
 * so no frame of the runtime hands its `this` or itself to a stack trace's
 * reader — and the licenses of what it carries.
 */
export const GUEST_BUNDLE_BANNER = `"use strict";\n${REMOTE_DOM_NOTICE}`;

export interface BuildGuestOptions {
  /** The guest's entry module, a path. It imports `connectGuest` from `@graview/guest/worker`. */
  readonly entry: string;
  /** Minify. True by default. */
  readonly minify?: boolean;
  /** Replace these names at build time, as esbuild's `define`. */
  readonly define?: Readonly<Record<string, string>>;
}

export interface GuestBundle {
  /** The script: hand it to `mountGuestWorker` as `{ script }`. */
  readonly script: string;
  /** Its length in bytes, as UTF-8. */
  readonly bytes: number;
  /** Its SHA-256, hex: what a host that serves bundles through a tool call can pin. */
  readonly sha256: string;
}

/** Why a script is not a classic guest bundle. */
export class GuestBundleError extends Error {
  constructor(readonly findings: readonly string[]) {
    super(`Not a classic guest bundle: ${findings.join("; ")}.`);
    this.name = "GuestBundleError";
  }
}

type Esbuild = typeof import("esbuild");

async function esbuild(): Promise<Esbuild> {
  try {
    return (await import("esbuild")) as Esbuild;
  } catch {
    throw new Error("buildGuestBundle needs esbuild: add it to the project's devDependencies.");
  }
}

/** The worker entry this build of the package ships, beside this module. */
const RUNTIME = fileURLToPath(new URL("./worker/index.js", import.meta.url));

/**
 * What in a script would keep it from being a classic guest bundle, read
 * from the script with its comments taken out: anything that loads code at
 * run time (`import()`, `importScripts`, `import.meta`), and module syntax.
 * A string that merely says `import(` is refused too: a bundle is checked
 * as text, and a guest has no need to say it.
 */
export async function checkGuestBundle(script: string): Promise<readonly string[]> {
  const findings: string[] = [];
  /* A classic script, as a worker without `type: "module"` will compile it: `import` and `export` statements, and `import.meta`, do not. */
  try {
    new Script(script);
  } catch (error) {
    findings.push(`it is not a classic script: ${(error as Error).message.split("\n")[0]}`);
    return findings;
  }
  const { transform } = await esbuild();
  const code = (await transform(script, { loader: "js", minifyWhitespace: true, legalComments: "none" })).code;
  if (/\bimport\s*\(/.test(code)) findings.push("it loads code at run time with import()");
  /* What esbuild leaves of an import() or require() it could not resolve: a call that throws, and a guest that meant to load something. */
  if (/Dynamic require of/.test(code)) findings.push("it loads code at run time with import() or require()");
  if (/\bimportScripts\b/.test(code)) findings.push("it names importScripts");
  if (!script.startsWith('"use strict";')) findings.push('it does not start "use strict";');
  return findings;
}

/**
 * BUILD A GUEST'S BUNDLE: the worker entry first, then the guest's entry,
 * as one strict IIFE with nothing to load at run time. A dynamic `import()`
 * the guest writes is refused rather than kept, and so is anything
 * `checkGuestBundle` finds in the result.
 */
export async function buildGuestBundle(options: BuildGuestOptions): Promise<GuestBundle> {
  const { build } = await esbuild();
  const result = await build({
    stdin: {
      /* The runtime first: it is evaluated, and the worker hardened, before any module of the guest's. */
      contents: `import ${JSON.stringify(RUNTIME)};\nimport ${JSON.stringify(options.entry)};\n`,
      resolveDir: process.cwd(),
      loader: "js",
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: options.minify ?? true,
    banner: { js: GUEST_BUNDLE_BANNER },
    legalComments: "none",
    /* The guest's own import of the worker entry is the runtime already in the bundle: one module, one connection. */
    alias: { "@graview/guest/worker": RUNTIME },
    /* esbuild rewrites an import() it cannot resolve; with none supported, it refuses one instead. */
    supported: { "dynamic-import": false },
    define: { "process.env.NODE_ENV": '"production"', ...options.define },
    write: false,
    logLevel: "silent",
  });
  const script = result.outputFiles[0]!.text;
  const findings = await checkGuestBundle(script);
  if (findings.length > 0) throw new GuestBundleError(findings);
  const bytes = Buffer.byteLength(script, "utf8");
  return { script, bytes, sha256: createHash("sha256").update(script).digest("hex") };
}
