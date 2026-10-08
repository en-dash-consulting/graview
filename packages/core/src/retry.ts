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
 *
 * FOR A PAGE ONLY: `@graview/core/retry`, never the main entry. The retry is
 * an `import()` of a URL computed at run time, and workerd — where a host
 * runs core, tools and ship — refuses a script with one in it, reached or
 * not. Nothing a server imports may import this.
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

/**
 * The URL a failed `import()` names in its message, where the engine names
 * one — and only a URL the retry may import again.
 *
 * The words are read from an error, and an import that fetched its module
 * but whose module threw while it ran rejects with that module's own words,
 * which may carry any URL a message was built from. So only an engine's own
 * sentence for a fetch that failed counts, from its first word, and only a
 * URL on the origin the bundle's own modules came from (`own`, this
 * module's URL by default): a chunk the bundle asked for, never a script
 * somewhere else.
 */
export function failedUrl(error: unknown, own: string = import.meta.url): string | undefined {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const found = /^(?:Failed to fetch dynamically imported module|error loading dynamically imported module): ((?:https?|file):\/\/[^\s"'<>]+)/.exec(message)?.[1];
  if (found === undefined) return undefined;
  const url = found.replace(/[.,;:)\]]+$/, "");
  try {
    const named = new URL(url);
    const home = new URL(own);
    if (named.protocol !== home.protocol || named.host !== home.host) return undefined;
    return named.href;
  } catch {
    return undefined;
  }
}
