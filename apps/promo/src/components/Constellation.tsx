import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { dofBlur } from "../camera";
import { clamp, easings } from "../motion";
import { colors } from "../theme";

type Node = {
  x: number;
  y: number;
  r: number;
  phase: number;
  layer: number;
  hub: boolean;
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Edge = { a: number; b: number; drawAt: number };

type Props = {
  count?: number;
  bloom?: number;
  settle?: number;
  pulse?: number;
  seed?: number;
  /** Slow camera push / drift amplitude — local micro-drift only */
  drift?: number;
  /** Edge draw-on progress 0–1 (in addition to bloom) */
  edgeProgress?: number;
  /** Camera focus 0–1 for depth-of-field */
  focus?: number;
  /** Enable layered CSS blur DOF */
  dof?: boolean;
};

/** Layered constellation with intentional hubs, glow, parallax, DOF. */
export const Constellation: React.FC<Props> = ({
  count = 36,
  bloom = 1,
  settle = 0,
  pulse = 0,
  seed = 42,
  drift = 1,
  edgeProgress = 1,
  focus = 0.5,
  dof = true,
}) => {
  const frame = useCurrentFrame();

  const { nodes, edges } = useMemo(() => {
    const rand = mulberry32(seed);
    const list: Node[] = [];

    const hubs = [
      { x: 720, y: 420 },
      { x: 1080, y: 480 },
      { x: 960, y: 620 },
      { x: 640, y: 580 },
      { x: 1240, y: 380 },
    ];

    for (let i = 0; i < hubs.length; i++) {
      const h = hubs[i]!;
      list.push({
        x: h.x + (rand() - 0.5) * 40,
        y: h.y + (rand() - 0.5) * 30,
        r: 5.5 + rand() * 2.5,
        phase: rand() * Math.PI * 2,
        layer: 2,
        hub: true,
      });
    }

    for (let i = hubs.length; i < count; i++) {
      const layer = rand() < 0.35 ? 0 : rand() < 0.6 ? 1 : 2;
      list.push({
        x: 180 + rand() * 1560,
        y: 140 + rand() * 800,
        r: layer === 0 ? 1.6 + rand() * 1.4 : 2.4 + rand() * 3.2,
        phase: rand() * Math.PI * 2,
        layer,
        hub: false,
      });
    }

    const edgeList: Edge[] = [];
    const hubCount = hubs.length;
    for (let i = 0; i < hubCount; i++) {
      for (let j = i + 1; j < hubCount; j++) {
        edgeList.push({ a: i, b: j, drawAt: (i + j) * 0.06 });
      }
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (i < hubCount && j < hubCount) continue;
        const a = list[i]!;
        const b = list[j]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const maxD = a.hub || b.hub ? 280 : a.layer === b.layer ? 200 : 150;
        if (d < maxD && (a.layer + b.layer >= 2 || rand() > 0.55)) {
          edgeList.push({
            a: i,
            b: j,
            drawAt: 0.15 + rand() * 0.7,
          });
        }
      }
    }

    return { nodes: list, edges: edgeList };
  }, [count, seed]);

  const cx = 960;
  const cy = 520;
  const camX = Math.sin(frame * 0.008) * 10 * drift;
  const camY = Math.cos(frame * 0.0065) * 7 * drift;

  const layerParallax = [0.35, 0.7, 1.0];
  const layerOpacity = [0.35, 0.65, 1];
  /** Map layer → depth for DOF (0 near, 1 far) */
  const layerDepth = [0.85, 0.55, 0.3];

  const pos = (n: Node, i: number) => {
    const ringX = cx + Math.cos((i / nodes.length) * Math.PI * 2) * 300;
    const ringY = cy + Math.sin((i / nodes.length) * Math.PI * 2) * 170;
    const settleX = interpolate(settle, [0, 1], [n.x, ringX], {
      ...clamp,
      easing: easings.softOut,
    });
    const settleY = interpolate(settle, [0, 1], [n.y, ringY], {
      ...clamp,
      easing: easings.softOut,
    });
    const p = layerParallax[n.layer] ?? 1;
    const driftX =
      Math.sin(frame * 0.02 + n.phase) * (3 + n.layer * 2) * (1 - settle);
    const driftY =
      Math.cos(frame * 0.017 + n.phase) * (2 + n.layer) * (1 - settle);
    return {
      x: settleX + camX * p + driftX,
      y: settleY + camY * p + driftY,
    };
  };

  const positions = nodes.map((n, i) => pos(n, i));

  const renderLayer = (layerIdx: number) => {
    const depth = layerDepth[layerIdx] ?? 0.5;
    const blurPx = dof ? dofBlur(depth, focus, 5.5) : 0;
    const nodesInLayer = nodes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.layer === layerIdx);
    const edgesInLayer = edges.filter((e) => {
      const la = nodes[e.a]!.layer;
      const lb = nodes[e.b]!.layer;
      return Math.max(la, lb) === layerIdx;
    });

    return (
      <AbsoluteFill
        key={layerIdx}
        style={{
          filter: blurPx > 0.4 ? `blur(${blurPx}px)` : undefined,
          opacity: 1,
        }}
      >
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter
              id={`nodeGlow-${layerIdx}`}
              x="-80%"
              y="-80%"
              width="260%"
              height="260%"
            >
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id={`hubGlow-${layerIdx}`}
              x="-120%"
              y="-120%"
              width="340%"
              height="340%"
            >
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edgesInLayer.map((e, idx) => {
            const a = positions[e.a]!;
            const b = positions[e.b]!;
            const na = nodes[e.a]!;
            const nb = nodes[e.b]!;
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const baseAlpha = interpolate(d, [40, 300], [0.42, 0.04], clamp);
            const draw = interpolate(
              bloom * edgeProgress,
              [e.drawAt, e.drawAt + 0.18],
              [0, 1],
              clamp,
            );
            const layerFade =
              ((layerOpacity[na.layer] ?? 1) + (layerOpacity[nb.layer] ?? 1)) /
              2;
            return (
              <line
                key={idx}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={colors.mint}
                strokeOpacity={baseAlpha * bloom * draw * layerFade * 0.85}
                strokeWidth={na.hub && nb.hub ? 1.6 : 1}
                strokeLinecap="round"
              />
            );
          })}

          {nodesInLayer.map(({ n, i }) => {
            const p = positions[i]!;
            const twinkle =
              0.55 +
              0.45 *
                Math.sin(frame * 0.07 + n.phase) *
                (0.3 + pulse * 0.7);
            const r =
              n.r *
              (0.55 + bloom * 0.75) *
              (1 + pulse * 0.2 * Math.sin(frame * 0.11 + n.phase));
            const op = twinkle * bloom * (layerOpacity[n.layer] ?? 1);
            return (
              <g
                key={i}
                filter={
                  n.hub
                    ? `url(#hubGlow-${layerIdx})`
                    : n.layer >= 1
                      ? `url(#nodeGlow-${layerIdx})`
                      : undefined
                }
              >
                {n.hub ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r * 3.2}
                    fill={colors.mint}
                    fillOpacity={0.12 * bloom}
                  />
                ) : null}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={n.hub ? colors.white : colors.mint}
                  fillOpacity={op}
                />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
    );
  };

  // Far → near so near hubs paint on top
  return (
    <AbsoluteFill>
      {renderLayer(0)}
      {renderLayer(1)}
      {renderLayer(2)}
    </AbsoluteFill>
  );
};
