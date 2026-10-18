import type { FileValue, HostFiles } from "@graview/core";

/** Where a record keeps a host's file: the path every host's upload answers, without its base. */
const HOST_FILES = "/graview/files/";

/**
 * A HOST'S FILES AT AN ADDRESS (FR-163): the `files` a page hands `mount`,
 * `<Embed>` or the Shell, sending each file to `url` with POST — the bytes
 * as the body, `content-type` their type, `x-graview-file-name` the name
 * URI-encoded — and reading back the `FileValue` the record will keep. A
 * refusal (`{ error }` with any status that is not 2xx) is thrown in the
 * server's words, which the editor says as they are.
 *
 * It is what the dev door (`devFiles` in `@graview/ship/dev`) answers, and
 * a host whose route answers the same may use it as it is.
 *
 * WHERE A RECORD'S FILE IS SERVED (`src`, 0.1.36): a record keeps the path
 * the host answered, `/graview/files/<sha>.<ext>`, without the base the app
 * is served under; such a path is drawn under `url` — `filesAt("/a/jobs/
 * graview/files")` draws `/graview/files/x.webp` at `/a/jobs/graview/files/
 * x.webp`. Any other href (the dev door's `/__graview/files/…`, already
 * where it is served) is drawn as the record keeps it.
 */
export function filesAt(url: string, options: { readonly maxBytes: number; readonly kinds: readonly string[]; readonly fetch?: typeof fetch }): HostFiles {
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const served = url.replace(/\/+$/, "");
  return {
    maxBytes: options.maxBytes,
    kinds: options.kinds,
    src: (href: string) => (href.startsWith(HOST_FILES) ? served + href.slice(HOST_FILES.length - 1) : href),
    async upload(file: Blob, name: string): Promise<FileValue> {
      const response = await send(url, {
        method: "POST",
        body: file,
        credentials: "same-origin",
        headers: { "content-type": file.type || "application/octet-stream", "x-graview-file-name": encodeURIComponent(name) },
      });
      const said = (await response.json().catch(() => ({}))) as { readonly error?: unknown } & Partial<FileValue>;
      if (!response.ok) throw new Error(typeof said.error === "string" && said.error ? said.error : `the server answered ${response.status}`);
      return said as FileValue;
    },
  };
}
