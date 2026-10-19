import type { AnySchema, FileValue, HostFiles, MutationCall, Principal, Store } from "@graview/core";
import type { GuestDomEvent, GuestDroppedFile, GuestRefusal } from "../protocol.js";
import { fieldFor, planDrop, takes, type DropPlan } from "./drop-plan.js";
import type { WorkerViewManifest } from "./manifest.js";
import { isStoredFile } from "./marks.js";

const isImage = (file: FileValue) => file.type.startsWith("image/");
const isVideo = (file: FileValue) => file.type.startsWith("video/");

/*
 * FILES DROPPED ON WHAT A VIEW DREW, TAKEN BY THE HOST (FR-193).
 *
 * Fetched the first time a view whose manifest `accepts` files draws an
 * element marked `data-drop`, so a page with no such view loads none of it.
 * The view's element is the target; everything else is the host's:
 *
 *   · Offered only where it can be kept (drop-plan.ts): the element is
 *     marked `data-graview-drop`, and said to assistive technology; one
 *     that is not offered takes nothing, and the browser's own drop is left
 *     alone there.
 *   · While files are dragged over it, the host draws it
 *     (`data-graview-drop-over`, its own outline over the view's styles) and
 *     says, in a status of its own, what dropping there does.
 *   · Dropped — or picked: a tap on it opens the picker on a coarse
 *     pointer, and Enter or Space on it wherever it has the keyboard — each
 *     file is held to the field its type fits and to the host's files
 *     (`kinds`, `maxBytes`), stored through `files.upload`, and its answer
 *     held to what a record may keep. What was refused is said, one sentence
 *     a file, and the rest go on.
 *   · Then a view that hears `drop` is told once, on the element, with the
 *     files as the host stored them — never their bytes — and makes what it
 *     will of them with its own acts. One that does not gets a record of the
 *     kind per file, linked as `data-drop-connect` says, in one change that
 *     one undo takes back, said in the status.
 */

export interface GuestDropsOptions<S extends AnySchema> {
  readonly shadow: ShadowRoot;
  readonly manifest: WorkerViewManifest;
  readonly store: Store<S>;
  readonly principal: Principal;
  /** The page's host's files, read at each drop. */
  readonly files: () => HostFiles | undefined;
  /** The records the view was last shown. */
  readonly shown: () => ReadonlySet<string>;
  /** Whether the view hears `drop` (its `graview.on`): then the drop is told to it, and no record is made for it. */
  readonly hears: () => boolean;
  /** The view's id for an element it drew. */
  readonly idOf: (element: Element) => string | undefined;
  /** Tell the view. */
  readonly send: (message: GuestDomEvent) => void;
  /** Apply the change a drop the view does not hear makes: as the viewer, through the view. */
  readonly change: (calls: readonly MutationCall[], intent: string) => { readonly ok: true; readonly intent: string } | { readonly ok: false; readonly reason: GuestRefusal; readonly message: string };
  /** A file the host stored and handed the view: one it may hand back in an act's argument. */
  readonly handed: (file: FileValue) => void;
  /** Whether the pointer is coarse (a phone): then a tap on a drop target opens the picker. `(pointer: coarse)` by default. */
  readonly coarse?: () => boolean;
  /** Something about a drop target, said once for the host's problems: why an element marked `data-drop` is not one. */
  readonly onProblem?: (said: string) => void;
  /** A drop began or settled: the region says it has drawn only once nothing is on its way. */
  readonly onBusy?: () => void;
}

export interface GuestDrops {
  /** Look again at what the view drew: which elements are drop targets now. Run after each batch it draws. */
  refresh(): void;
  /** An event on what the view drew, before the view hears it: a tap or a key on a drop target opens the picker. True when it was the host's. */
  before(event: Event, at: Element, root: Element): boolean;
  /** Settles once every drop under way has been kept or refused. */
  idle(): Promise<void>;
  /** How many drops are under way. */
  readonly waiting: number;
  dispose(): void;
}

/** The host's own look for a drop target: over the view's styles, which cannot reach it. */
const DROP_CSS = `
[data-graview-drop-over] { outline: 2px dashed var(--graview-accent, Highlight) !important; outline-offset: 2px !important; background-color: color-mix(in srgb, var(--graview-accent, Highlight) 10%, transparent) !important; }
[data-graview-drop-status], [data-graview-drop-refused] { margin: 4px 0 0; font: 0.8125rem/1.4 var(--graview-font-body, system-ui, sans-serif); color: var(--graview-ink-muted, GrayText); }
[data-graview-drop-refused] { color: var(--graview-warn, var(--graview-ink, CanvasText)); }
[data-graview-drop-status]:empty, [data-graview-drop-refused]:empty { display: none; }
`;

/** What the person reaches for inside a drop target, which a tap on it leaves to them. */
const OWN_PRESS = "a, button, input, select, textarea, label, summary, [data-act], [data-lightbox], [data-record], [tabindex]";

/** A size as a person reads it: "820 bytes", "120 KB", "3.4 MB" (the file editor's words). */
function sizeWords(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

/** A video's type from its name, where the browser said none (a phone's `.MOV` often comes untyped). */
const ENDINGS: Readonly<Record<string, string>> = { mov: "video/quicktime", mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", heic: "image/heic", heif: "image/heif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const typeOf = (file: File) => file.type || ENDINGS[/\.([a-z0-9]{2,4})$/i.exec(file.name)?.[1]?.toLowerCase() ?? ""] || "application/octet-stream";

/** What a plan's fields hold, said: "a picture or a video". */
function sortsWords(plan: Extract<DropPlan, { ok: true }>): string {
  const said = [...new Set(plan.fields.map((one) => (one.as === "image" ? "a picture" : one.as === "video" ? "a video" : "a file")))];
  return said.length <= 1 ? (said[0] ?? "a file") : `${said.slice(0, -1).join(", ")} or ${said[said.length - 1]}`;
}

/** What a target says to assistive technology: what dropping or pressing there does. */
const describedAs = (plan: Extract<DropPlan, { ok: true }>, coarse: boolean) => `${plan.invite.replace(/\.$/, "")}${coarse ? ", or tap to choose them" : ""}.`;

export function createGuestDrops<S extends AnySchema>(window: Window & typeof globalThis, options: GuestDropsOptions<S>): GuestDrops {
  const { shadow } = options;
  const document = shadow.ownerDocument;
  const coarse = options.coarse ?? (() => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches);
  const plans = new WeakMap<Element, Extract<DropPlan, { ok: true }>>();
  /* What the host wrote on the view's element: taken away again when it is no target. */
  const described = new WeakSet<Element>();
  const told = new Set<string>();
  const pending = new Set<Promise<void>>();

  const style = document.createElement("style");
  style.setAttribute("data-graview-drop-style", "");
  style.textContent = DROP_CSS;
  const status = document.createElement("p");
  status.setAttribute("data-graview-drop-status", "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const refused = document.createElement("div");
  refused.setAttribute("data-graview-drop-refused", "");
  refused.setAttribute("role", "alert");
  const picker = document.createElement("input");
  picker.type = "file";
  picker.multiple = true;
  picker.hidden = true;
  picker.tabIndex = -1;
  picker.setAttribute("data-graview-drop-picker", "");
  picker.setAttribute("aria-hidden", "true");
  shadow.append(style, status, refused, picker);

  const say = (words: string) => {
    if (status.textContent !== words) status.textContent = words;
  };
  const sayRefused = (lines: readonly string[]) => {
    refused.replaceChildren(
      ...lines.map((line) => {
        const one = document.createElement("p");
        one.style.margin = "0";
        one.textContent = line;
        return one;
      }),
    );
  };

  const targets = () => [...shadow.querySelectorAll("[data-drop]")];
  const targetOf = (from: EventTarget | null | undefined): Element | undefined => {
    const at = from as Element | null | undefined;
    const found = at && typeof at.closest === "function" ? at.closest("[data-graview-drop]") : null;
    return found && shadow.contains(found) ? found : undefined;
  };

  const refresh = () => {
    const shown = options.shown();
    const files = options.files();
    let first: Extract<DropPlan, { ok: true }> | undefined;
    for (const element of targets()) {
      const kind = element.getAttribute("data-drop") ?? "";
      const plan = planDrop(options.store, options.principal, options.manifest, {
        kind,
        ...(element.hasAttribute("data-drop-field") ? { field: element.getAttribute("data-drop-field")! } : {}),
        ...(element.hasAttribute("data-drop-connect") ? { connect: element.getAttribute("data-drop-connect")! } : {}),
      }, { shown, files });
      if (plan.ok) {
        first ??= plan;
        plans.set(element, plan);
        element.setAttribute("data-graview-drop", "");
        if (!element.hasAttribute("aria-description") || described.has(element)) {
          element.setAttribute("aria-description", describedAs(plan, coarse()));
          described.add(element);
        }
        continue;
      }
      plans.delete(element);
      element.removeAttribute("data-graview-drop");
      element.removeAttribute("data-graview-drop-over");
      if (described.has(element)) {
        element.removeAttribute("aria-description");
        described.delete(element);
      }
      /* Said once a sentence: a seat that may not make the kind is no problem of the view's, and is not said. */
      if (!/^This seat may not|^This host takes no/.test(plan.says) && !told.has(plan.says)) {
        told.add(plan.says);
        options.onProblem?.(`A drop target the view drew (data-drop="${kind}") is not offered: ${plan.says}`);
      }
    }
    if (first) picker.accept = first.accept;
  };

  /* ── dragging over ───────────────────────────────────────────────────── */
  const hasFiles = (event: Event) => {
    const types = (event as DragEvent).dataTransfer?.types;
    return types !== undefined && Array.from(types as ArrayLike<string>).includes("Files");
  };
  let over: Element | undefined;
  const light = (element: Element | undefined) => {
    if (over === element) return;
    over?.removeAttribute("data-graview-drop-over");
    over = element;
    if (element) {
      element.setAttribute("data-graview-drop-over", "");
      say(plans.get(element)?.invite ?? "");
    } else if (pending.size === 0) say("");
  };
  const onOver = (event: Event) => {
    const element = targetOf(event.composedPath()[0]);
    if (!element || !hasFiles(event)) return;
    event.preventDefault();
    const transfer = (event as DragEvent).dataTransfer;
    if (transfer) transfer.dropEffect = "copy";
    light(element);
  };
  const onLeave = (event: Event) => {
    if (!over) return;
    const into = (event as DragEvent).relatedTarget as Node | null;
    if (into && over.contains(into)) return;
    light(undefined);
  };
  const onDrop = (event: Event) => {
    const element = targetOf(event.composedPath()[0]);
    light(undefined);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(((event as DragEvent).dataTransfer?.files ?? []) as ArrayLike<File>);
    if (files.length > 0) take(element, files);
  };
  const onEnd = () => light(undefined);
  shadow.addEventListener("dragenter", onOver);
  shadow.addEventListener("dragover", onOver);
  shadow.addEventListener("dragleave", onLeave);
  shadow.addEventListener("drop", onDrop);
  document.addEventListener("dragend", onEnd);
  document.addEventListener("drop", onEnd);

  /* ── picked ──────────────────────────────────────────────────────────── */
  let picking: Element | undefined;
  const pick = (element: Element) => {
    const plan = plans.get(element);
    if (!plan) return;
    picking = element;
    picker.accept = plan.accept;
    picker.click();
  };
  picker.addEventListener("change", () => {
    const files = Array.from(picker.files ?? []);
    try {
      picker.value = "";
    } catch {
      // A picker a test filled by hand: nothing to empty.
    }
    if (picking && files.length > 0) take(picking, files);
  });

  /* ── kept ────────────────────────────────────────────────────────────── */
  const take = (element: Element, given: readonly File[]) => {
    const plan = plans.get(element);
    const files = options.files();
    if (!plan || !files) return;
    const work = keep(element, plan, files, given).finally(() => {
      pending.delete(work);
      options.onBusy?.();
    });
    pending.add(work);
    options.onBusy?.();
  };

  async function keep(element: Element, plan: Extract<DropPlan, { ok: true }>, host: HostFiles, given: readonly File[]): Promise<void> {
    sayRefused([]);
    say(`Adding ${given.length === 1 ? `“${given[0]!.name}”` : `${given.length} files`}…`);
    const problems: string[] = [];
    const kept: { readonly field: string; readonly value: FileValue; readonly at?: string }[] = [];
    for (const file of given) {
      const name = file.name || "file";
      const type = typeOf(file);
      const field = fieldFor(plan.fields, type);
      if (!field) {
        problems.push(`“${name}” isn’t ${sortsWords(plan)}.`);
        continue;
      }
      if (!takes(host.kinds, type)) {
        problems.push(`“${name}” is ${type}; this host doesn’t take it.`);
        continue;
      }
      if (file.size > host.maxBytes) {
        problems.push(`“${name}” is ${sizeWords(file.size)}; this host takes files up to ${sizeWords(host.maxBytes)}.`);
        continue;
      }
      let answered: unknown;
      try {
        answered = await host.upload(file, name);
      } catch (error) {
        problems.push(`“${name}” wasn’t kept: ${error instanceof Error && error.message.trim() ? error.message.trim() : "the host refused it"}`);
        continue;
      }
      if (!isStoredFile(answered)) {
        problems.push(`The host’s answer for “${name}” isn’t a file a record can keep.`);
        continue;
      }
      if ((field.as === "image" && !isImage(answered)) || (field.as === "video" && !isVideo(answered))) {
        problems.push(`The host kept “${name}” as ${answered.type}, not as ${field.as === "image" ? "a picture" : "a video"}.`);
        continue;
      }
      let value: FileValue = answered;
      /* A picture's size in pixels, where the host did not say it and this browser can read it. */
      if (isImage(value) && (value.width === undefined || value.height === undefined) && typeof window.createImageBitmap === "function") {
        try {
          const bitmap = await window.createImageBitmap(file);
          value = { ...value, width: bitmap.width, height: bitmap.height };
          bitmap.close();
        } catch {
          // Its size is the host's to know, then.
        }
      }
      const at = Number.isFinite(file.lastModified) && file.lastModified > 0 ? new Date(file.lastModified).toISOString() : undefined;
      kept.push({ field: field.field, value, ...(at ? { at } : {}) });
    }
    for (const one of kept) options.handed(one.value);
    sayRefused(problems);
    if (options.hears()) {
      const target = options.idOf(element);
      say("");
      if (target === undefined) return;
      const files: GuestDroppedFile[] = kept.map(({ field, value, at }) => ({
        href: value.href,
        name: value.name,
        type: value.type,
        bytes: value.bytes,
        ...(value.width !== undefined ? { width: value.width } : {}),
        ...(value.height !== undefined ? { height: value.height } : {}),
        ...(value.poster !== undefined ? { poster: value.poster } : {}),
        ...(value.duration !== undefined ? { duration: value.duration } : {}),
        ...(at ? { at } : {}),
        field,
      }));
      options.send({ type: "dom-event", target, event: "drop", files, ...(problems.length > 0 ? { refused: problems } : {}) });
      return;
    }
    if (kept.length === 0) return say("");
    /* The default: a record per file, linked, as one change. */
    const calls = kept.flatMap((one, at) => plan.calls(one, at));
    const outcome = options.change(calls, plan.intent(kept.length));
    if (outcome.ok) say(plan.added(kept.length));
    else {
      say("");
      sayRefused([...problems, `Nothing was added: ${outcome.message}`]);
    }
  }

  return {
    refresh,
    before(event, at, root) {
      const element = targetOf(at);
      if (!element || !root.contains(element) || !plans.has(element)) return false;
      const key = event.type === "keydown" ? (event as KeyboardEvent).key : undefined;
      /* A button, a link or a field inside it is the person's to press, not a tap on the target. */
      const own = (event.composedPath()[0] as Element | undefined)?.closest?.(OWN_PRESS);
      const theirs = own !== null && own !== undefined && own !== element && element.contains(own);
      const tapped = event.type === "click" && coarse() && !theirs;
      const pressed = (key === "Enter" || key === " ") && at === element;
      if (!tapped && !pressed) return false;
      event.preventDefault();
      event.stopPropagation();
      pick(element);
      return true;
    },
    idle: async () => {
      while (pending.size > 0) await Promise.all([...pending]);
    },
    get waiting() {
      return pending.size;
    },
    dispose() {
      shadow.removeEventListener("dragenter", onOver);
      shadow.removeEventListener("dragover", onOver);
      shadow.removeEventListener("dragleave", onLeave);
      shadow.removeEventListener("drop", onDrop);
      document.removeEventListener("dragend", onEnd);
      document.removeEventListener("drop", onEnd);
      style.remove();
      status.remove();
      refused.remove();
      picker.remove();
    },
  };
}
