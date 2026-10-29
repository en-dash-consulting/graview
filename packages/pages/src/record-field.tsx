import type { AnySchema, ReadableField } from "@graview/core";
import { AppLink, EditableValue, FieldLink, Files, LinkedRecordView, LongValue, RepeatEditor } from "@graview/primitives/pages";
import type { CSSProperties, ReactNode } from "react";
import { eyebrow } from "./page-typography.js";

export interface RecordFieldProps {
  /** The record the field is on. */
  readonly nodeId: string;
  /** The record as stored: what a repeating date's editor reads. */
  readonly node?: Record<string, unknown> | undefined;
  /** One of `recordFacts(...).fields`. */
  readonly field: ReadableField;
  /** Whether the face changes values where they stand (under the provider the face draws with). */
  readonly inPlace: boolean;
  /** The label's look; the derived page's eyebrow unless a page sets its own. */
  readonly labelStyle?: CSSProperties;
}

/**
 * ONE FACT OF A RECORD, AS THE DERIVED RECORD PAGE DRAWS IT (the twelfth
 * walk). A picture or a video plays and is put where it is kept, prose
 * spans the page with its paragraphs, a record in another app is its card,
 * a phone is a link, and every other value is changed where it stands —
 * a date by the date editor. The page `graview create` writes drew every
 * one of these as text, so a festival's trailer was a file name and its
 * screening's time was reached only through "Change the screening".
 * A page of a project's own draws its facts with this and cannot drift
 * from the derived page's.
 */
export function RecordField<S extends AnySchema>({ nodeId, node, field, inPlace, labelStyle = eyebrow }: RecordFieldProps): ReactNode {
  if (field.blank) {
    // A blank an act this seat may run writes: its label, and a dim "add" that opens the same editor a value would.
    return (
      <div style={{ display: "grid", gap: 2, minWidth: 0, alignContent: "start" }} data-graview-blank-fact={field.key}>
        <dt style={labelStyle}>{field.label}</dt>
        <dd style={{ margin: 0, minWidth: 0 }}>{inPlace ? <EditableValue<S> nodeId={nodeId} field={field.key} value="" said={`Add ${field.label}`} blank /> : null}</dd>
      </div>
    );
  }
  if (field.files) {
    return <Files as="field" read={!inPlace} nodeId={nodeId} field={field.key} label={field.label} files={field.files} labelStyle={labelStyle} style={{ gap: 4 }} />;
  }
  if (field.long) {
    return (
      <LongValue<S>
        nodeId={nodeId}
        field={field.key}
        label={field.label}
        value={field.value}
        markdown={field.markdown}
        style={{ gridColumn: "1 / -1", gap: 4 }}
        labelStyle={labelStyle}
        valueStyle={{ lineHeight: 1.6 }}
      />
    );
  }
  return (
    <div style={{ display: "grid", gap: 2, minWidth: 0, alignContent: "start" }}>
      <dt style={labelStyle}>{field.label}</dt>
      <dd style={{ margin: 0, overflowWrap: "anywhere", minWidth: 0 }}>
        {field.linked ? (
          // A record in another app (FR-171), with its own card from its home app, picked again beside it where the face changes values in place.
          <LinkedRecordView relation={field.linked.relation} refs={field.linked.refs} {...(inPlace ? { nodeId, field: field.key } : {})} />
        ) : field.app ? (
          // Another app, as the host names it (FR-171), changed beside it where the face changes values in place.
          <AppLink address={field.app} as="record" {...(inPlace ? { nodeId, field: field.key } : {})} />
        ) : field.href ? (
          // A phone to call, a place to map: the value is the link, or the link stands beside where it is changed.
          <FieldLink<S> href={field.href} field={field.key} value={field.value} stored={field.stored} {...(inPlace ? { nodeId } : {})} />
        ) : inPlace ? (
          <>
            <EditableValue<S> nodeId={nodeId} field={field.key} value={field.value} stored={field.stored} />
            {/* How a date repeats, changed beside it. */}
            {field.repeats ? <RepeatEditor nodeId={nodeId} field={field.key} start={node?.[field.key]} value={node?.[`${field.key}Repeat`]} label={`${field.label} repeats`} /> : null}
          </>
        ) : (
          field.value
        )}
      </dd>
    </div>
  );
}
