import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A view that throws must not take the scene with it.
 *
 * "Fail loudly on a bad binding" is the right instruction — a lens handed a
 * field that does not exist should say so rather than draw an empty, tidy,
 * wrong picture. But loud has to mean THE PANEL SAYS SO, not THE APPLICATION
 * IS GONE. Without a boundary a single thrown render unmounts the whole
 * tree: no bar, no districts, no standing, no way back — a black page, which
 * tells a person nothing and leaves them nowhere.
 *
 * So every view host renders behind one of these. The error's own message
 * lands in the view's place, under the kind and the view that produced it,
 * and everything around it stays mounted and interactive.
 */
export interface ViewBoundaryProps {
  /** The kind whose cell this is, named in the panel. */
  readonly kind: string;
  /** The view that threw, when the registration named one. */
  readonly view?: string;
  readonly children: ReactNode;
}

interface ViewBoundaryState {
  readonly error?: Error;
}

/**
 * An error a view throws can carry a `hint` — a sentence about what to do
 * about it, which is the half of a binding error that actually helps. The
 * `graview-lens` skill teaches throwing one; this is where it gets read.
 */
function hintOf(error: unknown): string | undefined {
  const hint = (error as { hint?: unknown } | null)?.hint;
  return typeof hint === "string" && hint.length > 0 ? hint : undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const text = String(error);
  return text === "[object Object]" ? "The view threw without a message." : text;
}

export class ViewBoundary extends Component<ViewBoundaryProps, ViewBoundaryState> {
  override state: ViewBoundaryState = {};

  static getDerivedStateFromError(error: Error): ViewBoundaryState {
    return { error };
  }

  /*
   * Caught is not swallowed. The panel is for the person looking at the
   * scene; the console is for whoever has to fix the view, and a stack is
   * the only thing that says which line threw.
   */
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[graview] the ${this.props.view ?? "view"} of ${this.props.kind} threw while rendering`,
      error,
      info.componentStack,
    );
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const hint = hintOf(error);
    return (
      <div
        role="alert"
        data-graview-view-error={this.props.kind}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          padding: "var(--graview-pad, 12px)",
          height: "100%",
          overflow: "auto",
          boxSizing: "border-box",
          borderRadius: "var(--graview-radius-sm, 6px)",
          background: "var(--graview-panel-warning, #fdf3ec)",
          color: "var(--graview-ink, #1a1a1a)",
          font: "var(--graview-font-body, 13px/1.45 system-ui)",
          fontSize: "0.875rem",
          lineHeight: 1.45,
        }}
      >
        <strong style={{ color: "var(--graview-warn, #b4462a)" }}>
          {this.props.view ? `${this.props.view} could not draw` : "This view could not draw"}
        </strong>
        <span style={{ color: "var(--graview-ink-muted, #555)" }}>{this.props.kind}</span>
        <span>{messageOf(error)}</span>
        {hint ? <span style={{ color: "var(--graview-ink-muted, #555)" }}>{hint}</span> : null}
      </div>
    );
  }
}
