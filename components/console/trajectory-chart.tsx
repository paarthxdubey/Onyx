const W = 460;
const H = 120;

interface TrajectoryChartProps {
  points: number[];
  trend: string;
}

export function TrajectoryChart({ points, trend }: TrajectoryChartProps) {
  if (points.length < 2) {
    return (
      <p className="text-xs text-faint py-6 text-center">
        Not enough attempts yet — run a couple more to see the trend.
      </p>
    );
  }

  const max = 100;
  const stepX = W / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: H - (p / max) * H,
  }));

  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={`Compliance trend across last ${points.length} turns, ending at ${points[points.length - 1]} percent`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="traj-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="0"
          y1={H * g}
          x2={W}
          y2={H * g}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}

      <polygon points={area} fill="url(#traj-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 4 : 2.5}
          fill="var(--accent)"
          stroke="var(--background)"
          strokeWidth={i === coords.length - 1 ? 2 : 0}
        />
      ))}

      <text
        x={last.x}
        y={last.y - 12}
        fill="var(--accent)"
        fontFamily="var(--font-mono)"
        fontSize="11"
        textAnchor="end"
      >
        {points[points.length - 1]}%
      </text>
    </svg>
  );
}