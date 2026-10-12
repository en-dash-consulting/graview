import type { FileValue, HostFiles } from "@graview/core";

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
 */
export function filesAt(url: string, options: { readonly maxBytes: number; readonly kinds: readonly string[]; readonly fetch?: typeof fetch }): HostFiles {
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    maxBytes: options.maxBytes,
    kinds: options.kinds,
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
