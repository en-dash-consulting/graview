import { pluralOf } from "@graview/core";
import type { AnySchema } from "@graview/core";
import type { ReactElement } from "react";

/**
 * "+N MORE", said by a lens handed fewer members than there are (docs/scale.md).
 *
 * A drive-in's thumbnail gives its lens the 12 most relevant members, not
 * the population; a lens that draws them and says nothing lets a picture
 * of 12 pass for all 1,177. One line under the picture, in the kind's words.
 */
export function withMore(
  props: { readonly nodes?: readonly { readonly kind: string }[]; readonly total?: number },
  schema: AnySchema,
  picture: ReactElement,
): ReactElement {
  const drawn = props.nodes?.length ?? 0;
  if (props.total === undefined || props.total <= drawn) return picture;
  const kind = props.nodes?.[0]?.kind;
  const plural = kind ? pluralOf(schema, kind).toLowerCase() : "more";
  return (
    <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) auto", height: "100%", minHeight: 0 }}>
      {picture}
      <p data-testid="lens-more" style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
        +{props.total - drawn} more {plural}
      </p>
    </div>
  );
}
