/**
 * A MODULE FETCHED WHEN IT IS ASKED FOR, THAT ASKS AGAIN AFTER IT FAILED
 * (FR-139).
 *
 * Every part the framework fetches only when it is first drawn — the
 * person's menu, the problems' rows, the faces, the studio, the compiler —
 * is an `import()`. Asked for while the network is away, it fails, and
 * Chromium and Firefox keep that failure for the document's life: an
 * `import()` of the same URL fails again at once, without a request, after
 * the network is back. WebKit asks again. So a part that missed the network
 * once was missing until a reload.
 *
 * Wrap the bare import: `retryingImport(() => import("./menu.js"))` gives a
 * loader that returns the module once it is here, joins an attempt already
 * on its way, and after a failure tries again on the next call. The first
 * try is the bundler's own `import()`. A later one, where the failure named
 * the URL it could not fetch (Chromium: "Failed to fetch dynamically
 * imported module: <url>", Firefox: "error loading dynamically imported
 * module: <url>"), imports that URL with `?retry=<n>` added: another URL,
 * so another fetch, and the module's own imports resolve to the URLs every
 * other chunk already holds. Where the failure names no URL (WebKit, or a
 * bundler's own chunk loader), the bundler's import is called again, which
 * those fetch again.
 *
 * What it cannot mend: a chunk that arrived while one of ITS imports did
 * not. The failed import is kept under its own URL, which no query on the
 * importer changes; a reload is the only way past it.
 *
 * Only ever wrap a bare `import()`: the retry imports the URL itself, so a
 * loader that picked or combined what it imported would get the module
 * back instead of what it made of it. Combine wrapped loaders instead.
 */
export function retryingImport<M>(load: () => Promise<M>): () => Promise<M> {
  let here: M | undefined;
  let arrived = false;
  let pending: Promise<M> | undefined;
  let url: string | undefined;
  let tries = 0;
  return () => {
    if (arrived) return Promise.resolve(here as M);
    if (pending) return pending;
    const attempt = tries > 0 && url !== undefined ? importAgain<M>(url) : load();
    tries += 1;
    const going: Promise<M> = attempt.then(
      (module) => {
        here = module;
        arrived = true;
        pending = undefined;
        return module;
      },
      (error: unknown) => {
        pending = undefined;
        url ??= failedUrl(error);
        throw error;
      },
    );
    pending = going;
    return going;
  };
}

/** Each retry a URL of its own, page-wide, so two loaders of one module never share a failed one. */
let serial = 0;

function importAgain<M>(url: string): Promise<M> {
  serial += 1;
  const again = `${url}${url.includes("?") ? "&" : "?"}retry=${serial}`;
  return import(/* @vite-ignore */ /* webpackIgnore: true */ again) as Promise<M>;
}

/** The URL a failed `import()` names in its message, where the engine names one. */
export function failedUrl(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const found = /\b(?:https?|file):\/\/[^\s"'<>]+/.exec(message)?.[0];
  return found?.replace(/[.,;:)\]]+$/, "");
}
