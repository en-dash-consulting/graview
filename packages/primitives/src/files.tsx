import { fieldWords, filesOf, isFileValue, isImage, LOCAL_LAYERS, type FileValue, type HostFiles } from "@graview/core";
import { fileFieldsOf, fileWords } from "@graview/core/blocks";
import { useEditableFields } from "@graview/react/drawing";
import { useGraview, useHostFiles, useNode, usePlayback } from "@graview/react/provider";
import { useEffect, useId, useRef, useState, type ClipboardEvent, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { resample } from "./resample.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * A RECORD'S PICTURES AND DOCUMENTS, DRAWN AND PUT THERE (FR-162, FR-163).
 *
 * Fetched with the first file field drawn (`files-door.tsx`), never with
 * the page: a record without files never loads this.
 *
 * Drawn: a picture as a thumbnail on a card or a row, a gallery on the
 * record that opens each full size; a document by its name, its type and
 * its size — a PDF shown inline, anything else a download. Every picture is
 * said by its caption, else its name.
 *
 * Put there: from the files, a camera, a drop or a paste — several at once
 * for a list — through the host's `files.upload`, and then as the ordinary
 * act that sets the field, which the room records, and undo takes back. A
 * camera's photograph is made smaller in the page before it is sent; a HEIC
 * the browser can read is sent as a JPEG. What the host takes (`kinds`,
 * `maxBytes`) is said before anything is sent, and what it refuses is said
 * in the editor's own words. Without a host's files the editor says so,
 * and offers nothing it would refuse.
 */

/** The long edge a photograph is sent at: a page, not a print. */
export const SEND_EDGE = 2048;
const SEND_QUALITY = 0.85;

/** A size as a person reads it: "820 bytes", "120 KB", "3.4 MB". */
export function sizeWords(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

/** A file's type as a person says it: "PDF", "JPEG", "DOCX" — its name's ending, else the type's. */
export function typeWords(file: { readonly type: string; readonly name?: string }): string {
  if (file.type === "application/pdf") return "PDF";
  const ending = /\.([a-z0-9]{2,5})$/i.exec(file.name ?? "")?.[1];
  if (ending) return ending.toUpperCase();
  const sub = file.type.split("/")[1] ?? file.type;
  return sub.replace(/^x-|^vnd\./, "").split(/[.+-]/)[0]!.toUpperCase();
}

/** The kinds a host takes, in words: "pictures and PDF files". */
export function kindsWords(kinds: readonly string[]): string {
  const said = [...new Set(kinds.map((kind) => (kind === "image/*" ? "pictures" : kind === "*/*" || kind === "*" ? "any file" : `${typeWords({ type: kind })} files`)))];
  return said.length <= 1 ? (said[0] ?? "no files") : `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`;
}

/** Whether a host's kinds take a type: the type itself, its family (`image/*`), or anything. */
export function takes(kinds: readonly string[], type: string): boolean {
  if (kinds.length === 0) return true;
  const family = `${type.split("/")[0]}/*`;
  return kinds.some((kind) => kind === "*" || kind === "*/*" || kind === type || kind === family);
}

const HEIC = /^image\/hei[cf]$|\.hei[cf]$/i;
const isHeic = (file: { readonly type: string; readonly name: string }) => HEIC.test(file.type) || HEIC.test(file.name);

/** What is sent: the file, or a smaller JPEG of it, with its size in pixels where it was read. */
interface Prepared {
  readonly blob: Blob;
  readonly name: string;
  readonly type: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * A FILE MADE READY TO SEND, or the reason it cannot be, in words.
 *
 * A camera's photograph, a picture bigger than a page needs and a HEIC are
 * drawn again as a JPEG no larger than `SEND_EDGE`; a HEIC this browser
 * cannot read goes as it is when the host takes HEIC, and is refused in
 * words when it does not.
 */
export async function prepare(file: File, host: HostFiles, options: { readonly image: boolean; readonly camera?: boolean }): Promise<Prepared | { readonly refused: string }> {
  const name = file.name || (options.camera ? "photo.jpg" : "file");
  const type = file.type || (isHeic({ type: "", name }) ? "image/heic" : "application/octet-stream");
  const heic = isHeic({ type, name });
  const picture = type.startsWith("image/") || heic;
  if (options.image && !picture) return { refused: `“${name}” isn’t a picture.` };
  const redraw = heic || (picture && /^image\/(jpeg|webp)$/.test(type) && (options.camera || file.size > host.maxBytes || file.size > 1_500_000));
  if (redraw) {
    try {
      const canvas = await resample(file, SEND_EDGE);
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", SEND_QUALITY));
      if (blob) return check({ blob, name: heic ? name.replace(/\.hei[cf]$/i, "") + ".jpg" : name, type: "image/jpeg", width: canvas.width, height: canvas.height }, host);
    } catch {
      // This browser cannot read it: a HEIC goes as it is where the host takes HEIC.
      if (heic && !takes(host.kinds, type)) return { refused: `“${name}” is a HEIC photo, which this browser can’t turn into a JPEG and this host doesn’t take. Save it as a JPEG and try again.` };
    }
  }
  let size: { width?: number; height?: number } = {};
  if (picture && !heic) {
    try {
      const bitmap = await createImageBitmap(file);
      size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
    } catch {
      // Its size in pixels is the host's to know, then.
    }
  }
  return check({ blob: file, name, type, ...size }, host);
}

function check(prepared: Prepared, host: HostFiles): Prepared | { readonly refused: string } {
  if (!takes(host.kinds, prepared.type)) return { refused: `“${prepared.name}” is a ${typeWords(prepared)} file; this host takes ${kindsWords(host.kinds)}.` };
  if (prepared.blob.size > host.maxBytes) return { refused: `“${prepared.name}” is ${sizeWords(prepared.blob.size)}; this host takes files up to ${sizeWords(host.maxBytes)}.` };
  return prepared;
}

/** Send one prepared file and read what the host answered: the value, or why it was not kept. */
export async function send(prepared: Prepared, host: HostFiles, image: boolean): Promise<FileValue | { readonly refused: string }> {
  let answered: unknown;
  try {
    answered = await host.upload(prepared.blob, prepared.name);
  } catch (error) {
    const said = error instanceof Error && error.message.trim() ? error.message.trim() : "the host refused it";
    return { refused: `“${prepared.name}” wasn’t kept: ${said}` };
  }
  if (!isFileValue(answered)) return { refused: `The host’s answer for “${prepared.name}” isn’t a file a record can keep.` };
  if (image && !isImage(answered)) return { refused: `“${prepared.name}” isn’t a picture.` };
  const value: FileValue = { ...answered, ...(answered.width === undefined && prepared.width ? { width: prepared.width } : {}), ...(answered.height === undefined && prepared.height ? { height: prepared.height } : {}) };
  return value;
}

// ── drawn ─────────────────────────────────────────────────────────────────

const ROUND = "var(--graview-radius, 8px)";
const QUIET: CSSProperties = { color: "var(--graview-ink-muted)", fontSize: "0.8125rem" };

/**
 * A FILE REMOVED SINCE THE MOMENT DRAWN (Roadmap f-playback): the host says
 * it no longer keeps the bytes (`HostFiles.kept`), or — while somebody
 * looks back — the picture did not load. Said, never a broken picture.
 */
function useRemovedLater(file: FileValue): readonly [boolean, () => void] {
  const host = useHostFiles();
  const lookingBack = usePlayback()?.past != null;
  const [failed, setFailed] = useState(false);
  return [host?.kept?.(file.href) === false || (lookingBack && failed), () => setFailed(true)] as const;
}

function RemovedLater({ file, style }: { readonly file: FileValue; readonly style?: CSSProperties }) {
  return (
    <span
      role="img"
      aria-label={`${fileWords(file)}, removed later`}
      data-graview-removed-later={file.href}
      style={{ display: "grid", placeItems: "center", textAlign: "center", padding: 4, boxSizing: "border-box", fontSize: "0.6875rem", lineHeight: 1.2, color: "var(--graview-ink-muted)", border: "1px dashed var(--graview-edge-bright)", borderRadius: ROUND, ...style }}
    >
      removed later
    </span>
  );
}

/** One picture, small: on a card, a row, an `image` block's `thumb`. */
function FileThumb({ file, size = 56, style }: { readonly file: FileValue; readonly size?: number; readonly style?: CSSProperties }) {
  const [gone, failed] = useRemovedLater(file);
  if (gone) return <RemovedLater file={file} style={{ width: size, height: size, flex: "none", ...style }} />;
  return (
    <img
      onError={failed}
      src={file.href}
      alt={fileWords(file)}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      data-graview-thumb={file.href}
      style={{ width: size, height: size, objectFit: "cover", borderRadius: ROUND, display: "block", flex: "none", background: "var(--graview-edge)", ...style }}
    />
  );
}

/** One picture of a gallery, opening full size; one removed since the moment drawn is said so, and opens nothing. */
function GalleryPicture({ file, onOpen }: { readonly file: FileValue; readonly onOpen: (button: HTMLButtonElement) => void }) {
  const [gone, failed] = useRemovedLater(file);
  if (gone) return <RemovedLater file={file} style={{ width: "100%", aspectRatio: "1" }} />;
  return (
    <button
      type="button"
      aria-label={`Open ${fileWords(file)} full size`}
      onClick={(event) => onOpen(event.currentTarget)}
      style={{ padding: 0, border: 0, background: "none", cursor: "zoom-in", display: "block", width: "100%", borderRadius: ROUND }}
    >
      <img src={file.href} alt={fileWords(file)} loading="lazy" decoding="async" onError={failed} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: ROUND, display: "block", background: "var(--graview-edge)" }} />
    </button>
  );
}

/**
 * A RECORD'S FILES, AS ITS PAGE SHOWS THEM: its pictures in a gallery, each
 * opening full size in a dialog that gives the keyboard back to it; its
 * documents by name, type and size — a PDF inline, the rest a download.
 */
function FilesShown({ files, label }: { readonly files: readonly FileValue[]; readonly label: string }) {
  const pictures = files.filter(isImage);
  const documents = files.filter((file) => !isImage(file));
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  // The picture it opened from: the keyboard goes back there, in an engine that focuses no button on a press (WebKit) too.
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open !== null && element && !element.open) element.showModal?.();
  }, [open]);
  const shown = open === null ? undefined : pictures[open];
  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      {pictures.length > 0 ? (
        <ul data-graview-gallery="" aria-label={label} style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
          {pictures.map((file, index) => (
            <li key={file.href} style={{ minWidth: 0 }}>
              <GalleryPicture
                file={file}
                onOpen={(button) => {
                  opener.current = button;
                  setOpen(index);
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {documents.length > 0 ? (
        <ul data-graview-documents="" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {documents.map((file) => (
            <li key={file.href} data-graview-document={file.type} style={{ display: "grid", gap: 6, minWidth: 0 }}>
              {file.type === "application/pdf" ? (
                <object data={file.href} type="application/pdf" aria-label={fileWords(file)} style={{ width: "100%", height: 420, border: "1px solid var(--graview-edge)", borderRadius: ROUND }}>
                  <p style={{ margin: 0, padding: 12 }}>
                    This browser shows no PDF here: <a href={file.href} download={file.name}>download {file.name}</a>.
                  </p>
                </object>
              ) : null}
              <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "baseline", minWidth: 0, overflowWrap: "anywhere" }}>
                <a href={file.href} download={file.name} {...(file.type === "application/pdf" ? { target: "_blank", rel: "noopener" } : {})}>
                  {file.name}
                </a>
                <span style={QUIET}>
                  {typeWords(file)} · {sizeWords(file.bytes)}
                </span>
              </span>
              {file.caption ? <span style={QUIET}>{file.caption}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {shown ? (
        <dialog
          ref={dialog}
          data-graview-full={shown.href}
          aria-label={fileWords(shown)}
          onClose={() => {
            setOpen(null);
            opener.current?.focus();
          }}
          onClick={(event) => {
            // A press on the dimmed page around the picture closes it.
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
          style={{ padding: 0, border: 0, borderRadius: ROUND, maxWidth: "min(96vw, 1600px)", maxHeight: "94vh", background: "var(--graview-panel)", color: "var(--graview-ink)" }}
        >
          <figure style={{ margin: 0, display: "grid", gap: 8, padding: 10 }}>
            <img src={shown.href} alt={fileWords(shown)} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", display: "block", margin: "0 auto" }} />
            <figcaption style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <span>{shown.caption ?? shown.name}</span>
              <form method="dialog" style={{ margin: 0 }}>
                <button type="submit" autoFocus>
                  Close
                </button>
              </form>
            </figcaption>
          </figure>
        </dialog>
      ) : null}
    </div>
  );
}

// ── put there ─────────────────────────────────────────────────────────────

export interface FilesEditorProps {
  /** What the field holds now. */
  readonly value: readonly FileValue[];
  /** The field's new value: every file, in order. */
  readonly onChange: (next: readonly FileValue[]) => void;
  /** A list: several at once, each removable. One: what is added replaces it. */
  readonly several: boolean;
  /** Only pictures will do. */
  readonly image: boolean;
  /** The field, in the declaration's words. */
  readonly label: string;
  /** Each file small beside its name: where nothing else draws them (a form). Not under a gallery that already does. */
  readonly thumbs?: boolean;
}

/**
 * THE FIELD'S EDITOR: pick, take a photo, drop or paste — each sent to the
 * host's upload and handed on as the field's new value. Its words say what
 * the host takes, what it refused and why; without a host's files it says
 * this host takes none, and offers no way to add one.
 */
export function FilesEditor({ value, onChange, several, image, label, thumbs = true }: FilesEditorProps) {
  const host = useHostFiles();
  const id = useId();
  const picker = useRef<HTMLInputElement | null>(null);
  const camera = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [refused, setRefused] = useState<readonly string[]>([]);
  const [over, setOver] = useState(false);
  const kinds = host ? (image ? host.kinds.filter((kind) => kind.startsWith("image/") || kind === "*" || kind === "*/*") : host.kinds) : [];
  const pictureKinds = host ? host.kinds.length === 0 || kinds.some((kind) => kind.startsWith("image/") || kind.startsWith("*")) : false;
  const open = Boolean(host) && (!image || pictureKinds);
  const noun = image ? (several ? "pictures" : "a picture") : several ? "files" : "a file";
  const accept = image ? (kinds.length > 0 ? kinds.join(",") : "image/*") : host?.kinds.join(",") || undefined;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  // What the field holds as the upload answers, which somebody else may have changed while it was sent.
  const latest = useRef(value);
  latest.current = value;
  // Where the keyboard goes once a move or a removal has redrawn the list: never left on the page.
  const list = useRef<HTMLUListElement | null>(null);
  const focusNext = useRef<{ readonly at: number; readonly what: "move" | "remove"; readonly from: readonly FileValue[] } | null>(null);
  useEffect(() => {
    const next = focusNext.current;
    // Once the field holds what was changed to, not on a render before it.
    if (!next || next.from === value) return;
    focusNext.current = null;
    const rows = list.current?.children;
    const row = rows?.[Math.min(next.at, rows.length - 1)];
    const target = (next.what === "move" ? row?.querySelector<HTMLElement>("[data-graview-file-move]") : null) ?? row?.querySelector<HTMLElement>("[data-graview-file-remove]") ?? picker.current?.parentElement?.querySelector<HTMLElement>("[data-graview-file-choose]");
    target?.focus();
  });

  const add = async (given: readonly File[], from: "picked" | "camera" | "dropped" | "pasted") => {
    if (!host || given.length === 0) return;
    const chosen = several ? given : given.slice(0, 1);
    const kept: FileValue[] = [];
    const problems: string[] = [];
    if (chosen.length < given.length) problems.push(`${label} holds one ${image ? "picture" : "file"}, so ${given.slice(1).map((file) => `“${file.name || "the photo"}”`).join(", ")} ${given.length > 2 ? "were" : "was"} left out.`);
    setRefused([]);
    setSaid(null);
    for (const file of chosen) {
      setBusy(`Sending ${file.name || "the photo"}…`);
      const prepared = await prepare(file, host, { image, camera: from === "camera" });
      if ("refused" in prepared) {
        problems.push(prepared.refused);
        continue;
      }
      const sent = await send(prepared, host, image);
      if ("refused" in sent) problems.push(sent.refused);
      // The same bytes answer the same address: a file already here is said, not held twice.
      else if ([...(several ? latest.current : []), ...kept].some((held) => held.href === sent.href)) problems.push(`“${sent.name}” is already here.`);
      else kept.push(sent);
    }
    setBusy(null);
    setRefused(problems);
    if (kept.length === 0) return;
    try {
      onChange(several ? [...latest.current, ...kept] : kept.slice(-1));
      setSaid(`Added ${kept.map((file) => file.name).join(", ")}.`);
    } catch (error) {
      setRefused([...problems, error instanceof Error ? error.message : String(error)]);
    }
  };
  const change = (next: readonly FileValue[], words: string, focus?: { readonly at: number; readonly what: "move" | "remove" }) => {
    try {
      focusNext.current = focus ? { ...focus, from: value } : null;
      onChange(next);
      setSaid(words);
    } catch (error) {
      focusNext.current = null;
      setRefused([error instanceof Error ? error.message : String(error)]);
    }
  };
  const filesFrom = (list: FileList | null | undefined): File[] => (list ? Array.from(list) : []);
  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const pasted = filesFrom(event.clipboardData?.files);
    if (!open || pasted.length === 0) return;
    event.preventDefault();
    void add(pasted, "pasted");
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    setOver(false);
    if (!open) return;
    event.preventDefault();
    void add(filesFrom(event.dataTransfer?.files), "dropped");
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      data-graview-file-editor=""
      data-graview-dropping={over ? "" : undefined}
      onPaste={onPaste}
      onDragOver={(event) => {
        if (!open) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      style={{ display: "grid", gap: 8, minWidth: 0, padding: over ? 6 : 0, outline: over ? "2px dashed var(--graview-accent)" : "none", borderRadius: ROUND }}
    >
      <span id={`${id}-label`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {value.length > 0 && (several || value.length > 1) ? (
        <ul ref={list} style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {value.map((file, index) => (
            <li key={`${index}:${file.href}`} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
              {thumbs && isImage(file) ? <FileThumb file={file} size={40} /> : null}
              <span style={{ flex: "1 1 8rem", minWidth: 0, overflowWrap: "anywhere" }}>{file.name}</span>
              <CaptionInput file={file} onCaption={(caption) => change(value.map((one, at) => (at === index ? withCaption(one, caption) : one)), caption ? `${file.name} now says “${caption}”.` : `${file.name} says its name again.`)} />
              {several && index > 0 ? (
                <button type="button" data-graview-file-move="" aria-label={`Move ${file.name} earlier`} onClick={() => change(value.map((one, at) => (at === index - 1 ? file : at === index ? value[index - 1]! : one)), `Moved ${file.name} earlier.`, { at: index - 1, what: "move" })}>
                  ↑
                </button>
              ) : null}
              {several ? (
                <button type="button" data-graview-file-remove="" aria-label={`Remove ${file.name}`} onClick={() => change(value.filter((_, at) => at !== index), `Removed ${file.name}.`, { at: index, what: "remove" })}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : value.length === 1 ? (
        <CaptionInput file={value[0]!} onCaption={(caption) => change([withCaption(value[0]!, caption)], caption ? `${value[0]!.name} now says “${caption}”.` : `${value[0]!.name} says its name again.`)} />
      ) : null}
      {open ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            ref={picker}
            type="file"
            hidden
            multiple={several}
            {...(accept ? { accept } : {})}
            data-graview-file-input=""
            aria-label={`Choose ${noun}`}
            onChange={(event) => {
              const picked = filesFrom(event.currentTarget.files);
              event.currentTarget.value = "";
              void add(picked, "picked");
            }}
          />
          <button type="button" disabled={busy !== null} onClick={() => picker.current?.click()} data-graview-file-choose="">
            {value.length > 0 && !several ? `Replace ${image ? "the picture" : "the file"}` : `Choose ${noun}`}
          </button>
          {pictureKinds ? (
            <>
              <input
                ref={camera}
                type="file"
                hidden
                accept="image/*"
                capture="environment"
                data-graview-photo-input=""
                aria-label="Take a photo"
                onChange={(event) => {
                  const taken = filesFrom(event.currentTarget.files);
                  event.currentTarget.value = "";
                  void add(taken, "camera");
                }}
              />
              {coarse ? (
                <button type="button" disabled={busy !== null} onClick={() => camera.current?.click()}>
                  Take a photo
                </button>
              ) : null}
            </>
          ) : null}
          <span style={QUIET} data-graview-file-takes="">
            or drop or paste {several ? "them" : "it"} here · {host!.kinds.length > 0 ? kindsWords(kinds.length > 0 ? kinds : host!.kinds) : "any file"}, up to {sizeWords(host!.maxBytes)}
          </span>
        </div>
      ) : (
        <p style={{ ...QUIET, margin: 0 }} data-graview-file-none="">
          {host ? "This host doesn’t take pictures, so none can be added here." : "This host doesn’t take files, so none can be added here."}
        </p>
      )}
      <p aria-live="polite" style={{ ...QUIET, margin: 0, minHeight: busy || said ? undefined : 0 }} data-graview-file-status="">
        {busy ?? said ?? ""}
      </p>
      {refused.length > 0 ? (
        <div role="alert" data-graview-file-refused="" style={{ color: "var(--graview-warn)", fontSize: "0.875rem", display: "grid", gap: 2 }}>
          {refused.map((line, index) => (
            <p key={index} style={{ margin: 0 }}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const withCaption = (file: FileValue, caption: string): FileValue => {
  const { caption: _was, ...rest } = file;
  return caption ? { ...rest, caption } : rest;
};

/** What a file shows, in words: its alt text. Kept when the box is left or Enter is pressed. */
function CaptionInput({ file, onCaption }: { readonly file: FileValue; readonly onCaption: (caption: string) => void }) {
  const [draft, setDraft] = useState(file.caption ?? "");
  useEffect(() => setDraft(file.caption ?? ""), [file.caption]);
  const keep = () => {
    const next = draft.trim().slice(0, 500);
    if (next !== (file.caption ?? "")) onCaption(next);
  };
  return (
    <input
      type="text"
      value={draft}
      placeholder={isImage(file) ? "What it shows" : "What it is"}
      aria-label={`What ${file.name} ${isImage(file) ? "shows" : "is"}`}
      data-graview-file-caption={file.href}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={keep}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          keep();
        }
      }}
      style={{ flex: "1 1 10rem", minWidth: 0, font: "inherit", fontSize: "0.875rem", minHeight: 24 }}
    />
  );
}

export interface FileRowProps {
  readonly nodeId: string;
  readonly field: string;
  /** The field, in the declaration's words. */
  readonly label: string;
  readonly files: readonly FileValue[];
  readonly labelStyle?: CSSProperties;
  readonly valueStyle?: CSSProperties;
  readonly style?: CSSProperties;
}

/** A row of a record's facts (`<dt>` and `<dd>` in a `<div>`), the width of the record: its label above its files. */
function Row({ field, label, labelStyle, valueStyle, style, children }: Omit<FileRowProps, "nodeId" | "files"> & { readonly children: ReactNode }) {
  return (
    <div data-graview-files={field} style={{ display: "grid", gap: 6, minWidth: 0, gridColumn: "1 / -1", ...style }}>
      <dt style={labelStyle}>{label}</dt>
      <dd style={{ margin: 0, minWidth: 0, display: "grid", gap: 10, ...valueStyle }}>{children}</dd>
    </div>
  );
}

/**
 * A FILE FIELD ON A RECORD, CHANGED WHERE IT STANDS: its files as the page
 * shows them and, where an act writes the field, its editor — whose new
 * value is that act, recorded, judged and undone like any other edit. A
 * field that holds none and that nothing here may change is not drawn.
 */
function FileField(props: FileRowProps): ReactNode {
  const { nodeId, field, label, files } = props;
  const { fields, commit } = useEditableFields(nodeId);
  const editable = fields.find((candidate) => candidate.field === field && candidate.takesValue);
  const shape = editable?.shape;
  const one = shape?.type === "several" ? shape.of : shape;
  const several = shape?.type === "several";
  if (files.length === 0 && one?.type !== "file") return null;
  return (
    <Row {...props}>
      <FilesShown files={files} label={label} />
      {editable && one?.type === "file" ? (
        <FilesEditor
          value={files}
          thumbs={false}
          several={several}
          image={one.image === true}
          label={label}
          onChange={(next) => {
            // One file: what was added replaces it; an edit cannot leave a field with nothing.
            const value = several ? next : next[next.length - 1];
            if (value !== undefined) commit(editable, value);
          }}
        />
      ) : null}
    </Row>
  );
}

/**
 * WHAT A FACE ASKS OF A RECORD'S FILES, BY ONE DOOR (`files-door.tsx`): a
 * file field on a record (`field`, changed in place unless `read`), the file
 * fields it holds none in yet (`unfilled`), a thumbnail (`thumb`), an `image`
 * block (`block`) and a form's control (`control`, in its fieldset unless
 * `bare`). One door, so a face that draws files carries one small part.
 */
export type FilesProps =
  | ({ readonly as: "field"; readonly read?: boolean } & FileRowProps)
  | { readonly as: "unfilled"; readonly nodeId: string; readonly skip: readonly string[]; readonly labels?: Readonly<Record<string, string>>; readonly labelStyle?: CSSProperties; readonly style?: CSSProperties }
  | { readonly as: "thumb"; readonly file: FileValue; readonly size?: number; readonly style?: CSSProperties }
  | { readonly as: "block"; readonly field: string; readonly files: readonly FileValue[]; readonly label: string; readonly view: "thumb" | "gallery" }
  | { readonly as: "control"; readonly value: unknown; readonly onChange: (next: unknown) => void; readonly several: boolean; readonly image: boolean; readonly label: string; readonly title?: string };

export function drawFiles(props: FilesProps): ReactNode {
  switch (props.as) {
    case "field":
      return props.read ? (props.files.length > 0 ? <Row {...props}><FilesShown files={props.files} label={props.label} /></Row> : null) : <FileField {...props} />;
    case "unfilled":
      return <Unfilled {...props} />;
    case "thumb":
      return <FileThumb {...props} />;
    case "block":
      // A gallery's pictures are pressed, so they stand above the card's own link.
      return props.files.length > 0 ? (
        <span className="graview-spec-image" data-graview-field={props.field} data-graview-image={props.view} style={{ display: "block", minWidth: 0, ...(props.view === "gallery" ? { position: "relative", zIndex: LOCAL_LAYERS.raised } : {}) }}>
          {props.view === "thumb" ? <FileThumb file={props.files[0]!} size={72} /> : <FilesShown files={props.files} label={props.label} />}
        </span>
      ) : null;
    case "control": {
      const editor = <FilesEditor value={filesOf(props.value)} several={props.several} image={props.image} label={props.label} onChange={(next) => props.onChange(props.several ? next : next[next.length - 1])} />;
      return props.title === undefined ? (
        editor
      ) : (
        <fieldset data-graview-part="group" data-graview-field={props.several ? "files" : "file"}>
          <legend data-graview-part="label">{props.title}</legend>
          {editor}
        </fieldset>
      );
    }
  }
}

/** The file fields a record holds none in yet, where an act may put one: each drawn as its editor, under its label (FR-163). */
function Unfilled({ nodeId, skip, labels, labelStyle, style }: Extract<FilesProps, { as: "unfilled" }>) {
  const { store } = useGraview();
  const node = useNode(nodeId);
  const definition = node ? store.schema.tryDefinition(node.kind) : undefined;
  const keys = fileFieldsOf(definition).filter((key) => !skip.includes(key) && !(definition?.display?.hide ?? []).includes(key) && filesOf(node?.[key as never]).length === 0);
  if (keys.length === 0) return null;
  return (
    <dl style={{ margin: 0, display: "grid", gap: 14, minWidth: 0 }}>
      {keys.map((key) => (
        <FileField key={key} nodeId={nodeId} field={key} label={labels?.[key] ?? fieldWords(definition, key)} files={[]} {...(labelStyle ? { labelStyle } : {})} {...(style ? { style } : {})} />
      ))}
    </dl>
  );
}
