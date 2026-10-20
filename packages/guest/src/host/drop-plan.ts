import { labelOf, made, nounOf, pluralOf, type AnyMutationDefinition, type AnySchema, type FileKind, type FileValue, type HostFiles, type MutationCall, type Principal, type Store } from "@graview/core";
import { fileFieldOf, type WorkerViewManifest } from "./manifest.js";
import { refArgsOf } from "./marks.js";

/*
 * WHAT FILES DROPPED ON A VIEW BECOME (FR-193), without the DOM.
 *
 * A view marks an element `data-drop="<kind>"`, and `data-drop-connect=
 * "<relation>:<record id>"` for the record they belong to; its manifest's
 * `accepts` says the fields of that kind files go in. Here the host works
 * out whether it may offer the element as a drop target at all, and what a
 * drop there makes:
 *
 *   · a field of the kind for each sort of file — a picture to its image
 *     field, a video to its video field, anything else to a file field —
 *     taken by the host's files (`kinds`, and `maxBytes` above 0);
 *   · an act that makes the kind and takes that field, which this seat may
 *     run: one done to the record dropped on that makes it linked (an act
 *     on a day that adds a moment to it), else one that makes it alone and
 *     an act that links it — the derived "Set the day" — naming the record
 *     just made (`{ $made: n }`), all as one change;
 *   · and, for `data-drop-connect`, a relation of the kind, or of the
 *     record's kind to it, and a record the view was shown.
 *
 * Where any of it is missing the element is no drop target: nothing is
 * offered that would then be refused, and the sentence says why.
 */

/** What a `data-drop` element asks: the kind its files become, the one field it narrows to, and the record they are linked to. */
export interface DropAsked {
  readonly kind: string;
  /** `data-drop-field`: one of the accepted fields of the kind, rather than any. */
  readonly field?: string;
  /** `data-drop-connect`, as the view wrote it: `<relation>:<record id>`. */
  readonly connect?: string;
}

/** A field a file goes in, by its sort. */
export interface DropField {
  readonly field: string;
  readonly as: FileKind;
  readonly list: boolean;
}

export type DropPlan =
  | {
      readonly ok: true;
      readonly kind: string;
      readonly fields: readonly DropField[];
      /** What the picker asks for: the host's kinds of the fields' sorts. */
      readonly accept: string;
      /** The record they are linked to, and by what. */
      readonly connect?: { readonly relation: string; readonly record: string };
      /** The calls one file's record is made with; the change for several files is these, file after file. */
      readonly calls: (file: { readonly field: string; readonly value: FileValue }, at: number) => MutationCall[];
      /** What the change is, said: "Add 4 moments to Saturday". */
      readonly intent: (count: number) => string;
      /** What the host says while files are dragged over it: "Drop to add moments to Saturday." */
      readonly invite: string;
      /** What it says once the change is made: "Added 4 moments to Saturday." */
      readonly added: (count: number) => string;
    }
  | { readonly ok: false; readonly says: string };

/** `<relation>:<record id>`, split at its first colon; undefined where it is not that. */
export function dropConnectOf(said: string | undefined): { readonly relation: string; readonly record: string } | undefined {
  const at = said?.indexOf(":") ?? -1;
  if (!said || at <= 0 || at === said.length - 1) return undefined;
  return { relation: said.slice(0, at), record: said.slice(at + 1) };
}

/** Whether a host's kinds take a type: the type itself, its family (`image/*`), or anything. Any, where it lists none. */
export function takes(kinds: readonly string[], type: string): boolean {
  if (kinds.length === 0) return true;
  const family = `${type.split("/")[0]}/*`;
  return kinds.some((kind) => kind === "*" || kind === "*/*" || kind === type || kind === family);
}

/** The field of a plan a file of `type` goes in: a picture to an image field, a video to a video field, anything else to a file field — else any file field. */
export function fieldFor(fields: readonly DropField[], type: string): DropField | undefined {
  const sort: FileKind = type.startsWith("image/") ? "image" : type.startsWith("video/") ? "video" : "file";
  return fields.find((one) => one.as === sort) ?? fields.find((one) => one.as === "file");
}

/** What the host's kinds take of a field's sort, for the picker: `image/*`, or the host's own image types. */
function acceptOf(fields: readonly DropField[], files: HostFiles): string {
  const families = new Set(fields.map((one) => (one.as === "image" ? "image/" : one.as === "video" ? "video/" : "")));
  if (families.has("") || files.kinds.length === 0) return files.kinds.join(",");
  const out: string[] = [];
  for (const family of families) {
    const listed = files.kinds.filter((kind) => kind.startsWith(family));
    out.push(...(listed.length > 0 ? listed : [`${family}*`]));
  }
  return out.join(",");
}

const shapeOf = (mutation: AnyMutationDefinition<AnySchema>) => (mutation.input as { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> } | undefined)?.shape ?? {};
const required = (mutation: AnyMutationDefinition<AnySchema>, arg: string) => shapeOf(mutation)[arg]?.safeParse(undefined).success === false;

/** A plain text argument the act cannot go without: the one a record is named by, filled with the file's name where nothing else says it. */
function namingArgs(mutation: AnyMutationDefinition<AnySchema>, taken: ReadonlySet<string>): readonly string[] {
  const refs = new Set(refArgsOf(mutation.input).map((ref) => ref.name));
  return Object.keys(shapeOf(mutation)).filter((arg) => !taken.has(arg) && !refs.has(arg) && required(mutation, arg) && shapeOf(mutation)[arg]!.safeParse("a name").success && !shapeOf(mutation)[arg]!.safeParse(1).success);
}

const baseName = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, "") || name;

/** WHAT A DROP ON THIS ELEMENT MAKES, or why it is no drop target. */
export function planDrop<S extends AnySchema>(store: Store<S>, principal: Principal, manifest: WorkerViewManifest, asked: DropAsked, given: { readonly shown: ReadonlySet<string>; readonly files: HostFiles | undefined }): DropPlan {
  const no = (says: string): DropPlan => ({ ok: false, says });
  const { kind } = asked;
  const accepted = (manifest.accepts ?? []).filter((one) => one.kind === kind && (asked.field === undefined || one.field === asked.field));
  if (accepted.length === 0) return no(asked.field === undefined ? `The view's accepts names no field of "${kind}", so nothing dropped there can become one.` : `The view's accepts does not name ${kind}'s "${asked.field}".`);
  const files = given.files;
  if (!files || !(files.maxBytes > 0)) return no("This host takes no files.");
  const fields = accepted.flatMap((one): DropField[] => {
    const held = fileFieldOf(store, one.kind, one.field);
    return held ? [{ field: one.field, ...held }] : [];
  });
  /* Only the fields whose sort the host takes. */
  const taken = fields.filter((one) => one.as === "file" || files.kinds.length === 0 || files.kinds.some((kind) => kind === "*" || kind === "*/*" || kind.startsWith(one.as === "image" ? "image/" : "video/")));
  if (taken.length === 0) return no(`This host takes none of what ${kind}'s ${fields.map((one) => `"${one.field}"`).join(" or ")} holds.`);

  const connect = asked.connect === undefined ? undefined : dropConnectOf(asked.connect);
  if (asked.connect !== undefined && (!connect || given.shown.has(asked.connect))) return no(`data-drop-connect is "<relation>:<record id>", not "${asked.connect}".`);
  if (connect && !given.shown.has(connect.record)) return no(`data-drop-connect names "${connect.record}", which this view was not shown.`);
  const target = connect ? (store.seenBy(principal).graph.getNode(connect.record) as { kind: string } | undefined) : undefined;
  if (connect && !target) return no(`data-drop-connect names "${connect.record}", which this seat does not see.`);
  const declared = (owner: string) => Object.hasOwn((store.schema.tryDefinition(owner)?.edges ?? {}) as object, connect!.relation);
  /* The relation leaves the new record (a moment taken on a day), or the record dropped on (a day's moments). */
  const fromNew = connect ? declared(kind) : false;
  if (connect && !fromNew && !declared(target!.kind)) return no(`Neither a "${kind}" nor a "${target!.kind}" has the relation "${connect.relation}".`);

  const all = store.allMutations() as unknown as AnyMutationDefinition<AnySchema>[];
  const may = (call: MutationCall) => store.permits(call, principal).ok;
  const takesAll = (mutation: AnyMutationDefinition<AnySchema>) => taken.every((one) => Object.hasOwn(shapeOf(mutation), one.field));
  const makers = all.filter((mutation) => (mutation.creates ?? []).includes(kind) && takesAll(mutation));
  const noun = nounOf(store.schema.tryDefinition(kind), kind);
  const plural = pluralOf(store.schema, kind).toLowerCase();
  const label = target ? labelOf(store.schema.tryDefinition(target.kind), target as never) : undefined;
  const counted = (count: number) => `${count === 1 ? `a ${noun}` : `${count} ${plural}`}${label ? ` to ${label}` : ""}`;
  const intent = (count: number) => `Add ${counted(count)}`;
  const added = (count: number) => `Added ${counted(count)}.`;
  const invite = `Drop to add ${plural}${label ? ` to ${label}` : ""}.`;
  const fill = (mutation: AnyMutationDefinition<AnySchema>, args: Record<string, unknown>, file: FileValue) => {
    for (const arg of namingArgs(mutation, new Set(Object.keys(args)))) args[arg] = baseName(file.name);
    return args;
  };
  const value = (one: DropField, file: FileValue) => (one.list ? [file] : file);
  const plan = { ok: true as const, kind, fields: taken, accept: acceptOf(taken, files), ...(connect ? { connect } : {}), intent, invite, added };

  if (!connect) {
    const maker = makers.find((mutation) => !mutation.subject && may({ name: mutation.name, args: {} }));
    if (!maker) return no(`This seat may not make a "${kind}" here.`);
    return { ...plan, calls: (file) => [{ name: maker.name, args: fill(maker, { [file.field]: value(taken.find((one) => one.field === file.field)!, file.value) }, file.value) }] };
  }

  /* One act done to the record dropped on, that makes the kind and links it. */
  const onIt = makers.find((mutation) => mutation.subject && (mutation.subject.kinds === "*" || (mutation.subject.kinds as readonly string[]).includes(target!.kind)) && (mutation.connects ?? []).includes(connect.relation) && may({ name: mutation.name, args: { [mutation.subject.arg]: connect.record } }));
  if (onIt) {
    const arg = onIt.subject!.arg;
    return { ...plan, calls: (file) => [{ name: onIt.name, args: fill(onIt, { [arg]: connect.record, [file.field]: value(taken.find((one) => one.field === file.field)!, file.value) }, file.value) }] };
  }
  /* Else one that makes it, and one that links it, naming the record just made. */
  const maker = makers.find((mutation) => !mutation.subject && may({ name: mutation.name, args: {} }));
  if (!maker) return no(`This seat may not make a "${kind}" here.`);
  const linkerKind = fromNew ? kind : target!.kind;
  const farKind = fromNew ? target!.kind : kind;
  const linker = all.find((mutation) => {
    if (!(mutation.connects ?? []).includes(connect.relation) || !mutation.subject) return false;
    const kinds = mutation.subject.kinds;
    if (kinds !== "*" && !(kinds as readonly string[]).includes(linkerKind)) return false;
    const to = refArgsOf(mutation.input).find((ref) => ref.name !== mutation.subject!.arg && (ref.kinds.includes("*") || ref.kinds.includes(farKind)));
    if (!to) return false;
    /* Asked as it will be: from the record dropped on, or to it. */
    return may({ name: mutation.name, args: fromNew ? { [to.name]: connect.record } : { [mutation.subject.arg]: connect.record } });
  });
  if (!linker) return no(`This seat may not link a "${kind}" to ${connect.record} by "${connect.relation}".`);
  const subject = linker.subject!.arg;
  const to = refArgsOf(linker.input).find((ref) => ref.name !== subject && (ref.kinds.includes("*") || ref.kinds.includes(farKind)))!.name;
  return {
    ...plan,
    calls: (file, at) => [
      { name: maker.name, args: fill(maker, { [file.field]: value(taken.find((one) => one.field === file.field)!, file.value) }, file.value) },
      /* The record the call before it makes: two calls a file, so the maker of file `at` is call `2 × at`. */
      { name: linker.name, args: fromNew ? { [subject]: made(at * 2), [to]: connect.record } : { [subject]: connect.record, [to]: made(at * 2) } },
    ],
  };
}
